import logging
import math
from datetime import date, datetime, timedelta, timezone

import httpx
from fastapi import APIRouter

from app.api.responses import api_error, source_unavailable
from app.integrations.bnafar import BnafarConector
from app.integrations.geocoding import municipio_por_coordenadas
from app.integrations.units import distancia_metros

router = APIRouter(tags=["Medicamentos"])
logger = logging.getLogger(__name__)


def _parse_date(value: object) -> date | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return datetime.fromisoformat(value.strip().replace("Z", "+00:00")).date()
    except ValueError:
        try:
            return date.fromisoformat(value.strip()[:10])
        except ValueError:
            return None


def _safe_float(value: object) -> float | None:
    if value is None:
        return None
    try:
        result = float(value.replace(",", ".") if isinstance(value, str) else value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def _stock_address(row: dict) -> str:
    street = " ".join(
        str(part).strip()
        for part in (row.get("logradouro"), row.get("numero_endereco"))
        if part is not None and str(part).strip()
    )
    neighborhood = row.get("bairro")
    return f"{street}, {neighborhood}" if street and neighborhood else street or neighborhood or "Endereço não informado"


@router.get("/categories")
async def medication_categories():
    return source_unavailable(
        "/medications/categories",
        "Não há uma API pública operacional integrada para catálogo de medicamentos.",
    )


@router.get("")
async def list_medications():
    return source_unavailable(
        "/medications",
        "O catálogo de medicamentos do SUS não está disponível por API pública operacional neste momento.",
    )


@router.get("/{medication_id}/availability")
async def medication_availability(
    medication_id: str,
    catmat_code: str,
    lat: float,
    lng: float,
    radius_km: float = 10,
):
    endpoint = f"/medications/{medication_id}/availability"
    if not -90 <= lat <= 90 or not -180 <= lng <= 180:
        return api_error(422, "VALIDATION_ERROR", "Coordenadas GPS inválidas.", endpoint)
    if not 0 < radius_km <= 100:
        return api_error(422, "VALIDATION_ERROR", "O raio deve ser maior que 0 e até 100 km.", endpoint)

    try:
        city = await municipio_por_coordenadas(lat, lng)
        async with BnafarConector() as bnafar:
            stock_rows = await bnafar.buscar_estoque_municipal(catmat_code, city["ibge_code"])
    except httpx.HTTPError as exc:
        logger.warning("Falha ao consultar estoque BNAFAR: %s", exc)
        return api_error(
            502,
            "UPSTREAM_UNAVAILABLE",
            "Não foi possível consultar a posição de estoque BNAFAR-Hórus.",
            endpoint,
        )
    except ValueError as exc:
        logger.info("Consulta de disponibilidade inválida: %s", exc)
        return api_error(422, "VALIDATION_ERROR", str(exc), endpoint)

    today = datetime.now(timezone.utc).date()
    freshest_allowed = today - timedelta(days=30)
    stale_records = 0
    fresh_records = 0
    valid_lots = 0
    unlocated_lots = 0
    grouped: dict[str, dict] = {}

    for row in stock_rows:
        if str(row.get("codigo_catmat", "")).strip().upper() != catmat_code.strip().upper():
            continue
        stock_date = _parse_date(row.get("data_posicao_estoque"))
        if stock_date is None or stock_date < freshest_allowed or stock_date > today:
            stale_records += 1
            continue
        fresh_records += 1

        expiry_date = _parse_date(row.get("data_validade"))
        quantity = _safe_float(row.get("quantidade_estoque"))
        if expiry_date is None or expiry_date < today or quantity is None or quantity <= 0:
            continue
        valid_lots += 1

        cnes_code = str(row.get("codigo_cnes") or "").strip()
        row_lat = _safe_float(row.get("latitude"))
        row_lng = _safe_float(row.get("longitude"))
        if not cnes_code.isdigit() or int(cnes_code) <= 0 or row_lat is None or row_lng is None:
            unlocated_lots += 1
            continue
        distance = distancia_metros(lat, lng, row_lat, row_lng)
        if distance > radius_km * 1000:
            continue

        item = grouped.setdefault(
            cnes_code,
            {
                "cnes_code": cnes_code,
                "name": row.get("nome_fantasia") or row.get("razao_social") or "Estabelecimento CNES",
                "address": _stock_address(row),
                "city": row.get("municipio") or city["name"],
                "uf": row.get("uf") or city["uf"],
                "lat": row_lat,
                "lng": row_lng,
                "distance_m": distance,
                "quantity": 0.0,
                "stock_position_date": stock_date.isoformat(),
                "expires_on": expiry_date.isoformat(),
                "product_name": row.get("descricao_produto"),
            },
        )
        item["quantity"] += quantity
        item["distance_m"] = min(item["distance_m"], distance)
        item["stock_position_date"] = max(item["stock_position_date"], stock_date.isoformat())
        item["expires_on"] = min(item["expires_on"], expiry_date.isoformat())

    items = sorted(grouped.values(), key=lambda item: item["distance_m"])
    if items:
        status = "available"
        message = "Estoque reportado pelo BNAFAR-Hórus; confirme a disponibilidade diretamente com a unidade."
    elif fresh_records == 0:
        status = "not_reported"
        message = "Não há posição recente reportada para este CATMAT e município. Isso não confirma falta de estoque."
    elif valid_lots == 0:
        status = "no_current_stock"
        message = "Não há lotes válidos e localizados deste CATMAT no raio consultado."
    elif unlocated_lots > 0:
        status = "location_unavailable"
        message = "Há lotes válidos reportados, mas sem coordenadas para calcular a distância."
    else:
        status = "outside_radius"
        message = "Há estoque reportado neste município, mas nenhuma unidade com lote válido ficou dentro do raio."

    return {
        "medication_id": medication_id,
        "catmat_code": catmat_code.strip().upper(),
        "status": status,
        "message": message,
        "items": items,
        "meta": {
            "source": "BNAFAR-Hórus - Ministério da Saúde",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "is_estimate": False,
            "is_stale": stale_records > 0,
        },
    }


@router.get("/{medication_id}")
async def get_medication_detail(medication_id: str):
    return source_unavailable(
        f"/medications/{medication_id}",
        "Não há uma API pública operacional integrada para bula e detalhes de medicamentos.",
    )
