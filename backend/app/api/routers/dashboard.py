import logging
import os
from typing import Literal

import httpx
from fastapi import APIRouter, Query

from app.api.responses import api_error, source_unavailable
from app.integrations.geocoding import municipio_por_coordenadas
from app.integrations.units import (
    CNES_PAGE_LIMIT,
    buscar_todas_unidades_municipais,
    buscar_unidades_municipais,
    metadados_cnes,
    unidade_resumo,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Dashboard e Busca"])
DEFAULT_CITY_IBGE = os.getenv("SADIIN_DEFAULT_CITY_IBGE", "3550308")


def _normalize(value: str) -> str:
    return " ".join(value.casefold().split())


@router.get("/search")
async def global_search(
    q: str = Query(..., min_length=2),
    search_type: Literal["all", "medications", "conditions", "units"] = Query("all", alias="type"),
    city_ibge: str = Query(DEFAULT_CITY_IBGE, min_length=7, max_length=7, pattern=r"^\d{7}$"),
    lat: float | None = Query(None, ge=-90, le=90),
    lng: float | None = Query(None, ge=-180, le=180),
):
    if search_type in {"medications", "conditions"}:
        return source_unavailable(
            "/search",
            "A busca de medicamentos e condições não possui fonte pública operacional integrada.",
        )

    if (lat is None) != (lng is None):
        return api_error(422, "VALIDATION_ERROR", "Informe latitude e longitude juntas.", "/search")
    if lat is not None and lng is not None:
        try:
            city_ibge = (await municipio_por_coordenadas(lat, lng))["ibge_code"]
        except httpx.HTTPError as exc:
            logger.warning("Falha na geocodificação GPS da busca: %s", exc)
            return api_error(
                502,
                "UPSTREAM_UNAVAILABLE",
                "Não foi possível identificar o município da localização atual.",
                "/search",
            )
        except ValueError as exc:
            logger.info("Município não resolvido na busca GPS: %s", exc)
            return api_error(
                422,
                "LOCATION_NOT_RESOLVED",
                "Não foi possível associar sua localização a um município do IBGE.",
                "/search",
            )

    try:
        city, units = await buscar_todas_unidades_municipais(city_ibge)
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Falha na busca CNES: %s", exc)
        return api_error(
            502,
            "UPSTREAM_UNAVAILABLE",
            "Não foi possível consultar a busca de unidades no CNES.",
            "/search",
        )

    needle = _normalize(q)
    matches = [
        unit
        for unit in units
        if needle in _normalize(str(unit.get("nome_fantasia") or ""))
        or needle in _normalize(str(unit.get("razao_social") or ""))
        or needle in _normalize(" ".join(str(unit.get(key) or "") for key in ("endereco", "numero", "bairro")))
    ]
    summaries = [summary for unit in matches if (summary := unidade_resumo(unit, city)) is not None]
    if search_type == "all" and not summaries:
        return source_unavailable(
            "/search",
            "A busca clínica não está conectada; é possível pesquisar estabelecimentos CNES por cidade.",
        )

    return {
        "query": q,
        "intent": "unit" if summaries else "unknown",
        "confidence": 0.9 if summaries else 0,
        "fallback": None,
        "results": {"medications": [], "conditions": [], "units": summaries},
        "meta": metadados_cnes(),
    }


@router.get("/dashboard/regional")
async def regional_dashboard():
    return source_unavailable(
        "/dashboard/regional",
        "O e-SUS APS não disponibiliza indicadores regionais por esta API pública sem integração autorizada.",
    )


@router.get("/news")
async def get_news():
    return source_unavailable(
        "/news",
        "Não há feed de notícias do Ministério da Saúde integrado a esta API.",
    )
