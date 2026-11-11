import logging
import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter

from app.api.responses import api_error
from app.integrations.cnes import CnesConector

router = APIRouter(tags=["Metadados e Localização"])
logger = logging.getLogger(__name__)
DEFAULT_CITY_IBGE = os.getenv("SADIIN_DEFAULT_CITY_IBGE", "3550308")

@router.get("/health")
async def healthcheck():
    return {"status": "ok"}

@router.get("/meta")
async def get_meta():
    try:
        async with CnesConector() as cnes:
            units = await cnes.buscar_unidades_por_municipio(
                DEFAULT_CITY_IBGE, tipo_unidade=2, limit=20
            )
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Falha ao consultar metadados CNES: %s", exc)
        return api_error(
            502,
            "UPSTREAM_UNAVAILABLE",
            "Não foi possível consultar a atualização do CNES.",
            "/meta",
        )

    update_dates = [unit["data_atualizacao"] for unit in units if unit.get("data_atualizacao")]
    latest_update = max(update_dates) if update_dates else None
    updated_at = (
        datetime.fromisoformat(latest_update).replace(tzinfo=timezone.utc).isoformat()
        if latest_update
        else None
    )
    return {
        "data_updated_at": updated_at,
        "establishments_count": None,
        "sources_count": 2,
    }

@router.get("/sources")
async def get_sources():
    return [
        {
            "id": "cnes",
            "name": "CNES",
            "subtitle": "Estabelecimentos de saúde - Ministério da Saúde",
        },
        {
            "id": "ibge",
            "name": "IBGE",
            "subtitle": "Estados, municípios e códigos oficiais",
        },
    ]


@router.get("/")
async def api_root():
    return {"name": "SADIIN API", "status": "ok"}