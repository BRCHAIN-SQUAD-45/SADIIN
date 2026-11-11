import logging
import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.api.responses import api_error, source_unavailable
from app.integrations.cnes import CnesConector
from app.integrations.demas import buscar_servicos_cnes
from app.integrations.geocoding import municipio_por_coordenadas
from app.integrations.ibge import IbgeConector
from app.integrations.units import (
    CNES_PAGE_LIMIT,
    CNES_SOURCE,
    buscar_todas_unidades_municipais,
    buscar_unidades_municipais,
    distancia_metros,
    metadados_cnes,
    unidade_endereco,
    unidade_resumo,
    unidade_tipo,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Unidades de saúde"])

DEFAULT_CITY_IBGE = os.getenv("SADIIN_DEFAULT_CITY_IBGE", "3550308")


@router.get("")
async def list_units(
    q: str | None = None,
    city_ibge: str = Query(DEFAULT_CITY_IBGE, min_length=7, max_length=7, pattern=r"^\d{7}$"),
    lat: float | None = Query(None, ge=-90, le=90),
    lng: float | None = Query(None, ge=-180, le=180),
    page: int = Query(1, ge=1),
    page_size: int = Query(CNES_PAGE_LIMIT, ge=1, le=CNES_PAGE_LIMIT),
):
    if (lat is None) != (lng is None):
        return api_error(422, "VALIDATION_ERROR", "Informe latitude e longitude juntas.", "/ubs")
    if lat is not None and lng is not None:
        try:
            city_ibge = (await municipio_por_coordenadas(lat, lng))["ibge_code"]
        except httpx.HTTPError as exc:
            logger.warning("Falha na geocodificação GPS da lista de UBS: %s", exc)
            return api_error(
                502,
                "UPSTREAM_UNAVAILABLE",
                "Não foi possível identificar o município da localização atual.",
                "/ubs",
            )
        except ValueError:
            return api_error(
                422,
                "LOCATION_NOT_RESOLVED",
                "Não foi possível associar sua localização a um município do IBGE.",
                "/ubs",
            )

    offset = (page - 1) * page_size
    try:
        city, units = await buscar_unidades_municipais(city_ibge, page_size, offset)
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Falha na consulta de estabelecimentos CNES: %s", exc)
        return api_error(502, "UPSTREAM_UNAVAILABLE", "Não foi possível consultar os estabelecimentos no CNES.", "/ubs")

    if q:
        needle = q.strip().casefold()
        units = [
            unit
            for unit in units
            if needle in str(unit.get("nome_fantasia") or "").casefold()
            or needle in str(unit.get("razao_social") or "").casefold()
            or needle in unidade_endereco(unit).casefold()
        ]
    summaries = [summary for unit in units if (summary := unidade_resumo(unit, city)) is not None]
    summaries.sort(key=lambda unit: unit["name"].casefold())
    return {
        "items": summaries[:page_size],
        "page": page,
        "page_size": page_size,
        "total": None,
        "meta": metadados_cnes(),
    }


@router.get("/nearby")
async def get_nearby_units(
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float = Query(10.0, gt=0, le=100),
    city_ibge: str = Query(DEFAULT_CITY_IBGE, min_length=7, max_length=7, pattern=r"^\d{7}$"),
):
    if (lat is None) != (lng is None):
        return api_error(422, "VALIDATION_ERROR", "Informe latitude e longitude juntas.", "/ubs/nearby")
    if lat is not None and lng is not None:
        try:
            gps_city = await municipio_por_coordenadas(lat, lng)
            city_ibge = gps_city["ibge_code"]
        except httpx.HTTPError as exc:
            logger.warning("Falha na geocodificação reversa do GPS: %s", exc)
            return api_error(
                502,
                "UPSTREAM_UNAVAILABLE",
                "Não foi possível identificar o município da localização atual.",
                "/ubs/nearby",
            )
        except ValueError as exc:
            logger.info("Município não resolvido para a localização GPS: %s", exc)
            return api_error(
                422,
                "LOCATION_NOT_RESOLVED",
                "Não foi possível associar sua localização a um município do IBGE.",
                "/ubs/nearby",
            )
    try:
        city, units = await buscar_todas_unidades_municipais(city_ibge)
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Falha na busca de unidades próximas no CNES: %s", exc)
        return api_error(502, "UPSTREAM_UNAVAILABLE", "Não foi possível consultar unidades no CNES.", "/ubs/nearby")

    summaries = []
    for unit in units:
        summary = unidade_resumo(unit, city)
        if summary is None:
            continue
        if lat is not None and lng is not None:
            distance = distancia_metros(lat, lng, summary["lat"], summary["lng"])
            if distance > radius_km * 1000:
                continue
            summary["distance_m"] = distance
        summaries.append(summary)
    if lat is not None and lng is not None:
        summaries.sort(key=lambda unit: unit.get("distance_m", float("inf")))
    return summaries[:6]


@router.get("/{cnes}")
async def get_unit_detail(cnes: str):
    try:
        async with CnesConector() as cnes_api:
            unit = await cnes_api.buscar_unidade(cnes)
        async with IbgeConector() as ibge:
            city = await ibge.buscar_municipio_por_codigo_cnes(unit["id_municipio"], unit["id_uf"])
    except httpx.HTTPStatusError as exc:
        status = 404 if exc.response.status_code == 404 else 502
        message = "Estabelecimento não encontrado no CNES." if status == 404 else "Falha ao consultar o CNES."
        return api_error(status, "NOT_FOUND" if status == 404 else "UPSTREAM_UNAVAILABLE", message, f"/ubs/{cnes}")
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        logger.warning("Falha ao carregar detalhe CNES %s: %s", cnes, exc)
        return api_error(502, "UPSTREAM_UNAVAILABLE", "Não foi possível carregar o estabelecimento no CNES.", f"/ubs/{cnes}")

    return {
        "cnes_code": unit["cnes"],
        "name": unit.get("nome_fantasia") or unit.get("razao_social") or "Estabelecimento CNES",
        "address": unidade_endereco(unit),
        "city": city["name"],
        "uf": city["uf"],
        "lat": unit.get("latitude"),
        "lng": unit.get("longitude"),
        "is_open": None,
        "kind": unidade_tipo(unit.get("id_tipo_unidade")),
        "phone": unit.get("telefone"),
        "data_updated_at": _iso_datetime(unit.get("data_atualizacao")),
        "source_label": CNES_SOURCE,
        "turno_atendimento": unit.get("turno_atendimento"),
    }


def _iso_datetime(value: str | None) -> str:
    """Converte a data do CNES ("2026-02-27") para ISO-8601 com timezone, como pede o contrato.

    Sem data na fonte, usa o momento da consulta (a ficha foi lida do CNES agora).
    """
    if value:
        try:
            parsed = datetime.fromisoformat(str(value))
        except ValueError:
            logger.info("data_atualizacao CNES em formato inesperado: %r", value)
        else:
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.isoformat()
    return datetime.now(timezone.utc).isoformat()


def _unavailable(endpoint: str, message: str) -> JSONResponse:
    return source_unavailable(endpoint, message)


@router.get("/{cnes}/metrics")
async def get_unit_metrics(cnes: str):
    return _unavailable(f"/ubs/{cnes}/metrics", "O CNES aberto não publica indicadores de movimento ou tempo de espera por unidade.")


@router.get("/{cnes}/services")
async def get_unit_services(cnes: str):
    try:
        return await buscar_servicos_cnes(cnes)
    except httpx.HTTPError as exc:
        logger.warning("Falha ao consultar serviços CNES %s: %s", cnes, exc)
        return api_error(
            502,
            "UPSTREAM_UNAVAILABLE",
            "Não foi possível consultar os serviços especializados no CNES.",
            f"/ubs/{cnes}/services",
        )
    except ValueError as exc:
        return api_error(422, "VALIDATION_ERROR", str(exc), f"/ubs/{cnes}/services")


@router.get("/{cnes}/staff")
async def get_unit_staff(cnes: str):
    return _unavailable(f"/ubs/{cnes}/staff", "A API CNES consultada não publica a composição detalhada da equipe desta unidade.")


@router.get("/{cnes}/attendance-history")
async def get_unit_attendance_history(cnes: str, days: int = Query(7, ge=1, le=90)):
    return _unavailable(
        f"/ubs/{cnes}/attendance-history",
        "Não há endpoint aberto de atendimentos diários por unidade para montar este histórico.",
    )