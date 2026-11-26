import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Query

from app.api.responses import api_error, source_unavailable
from app.integrations.anvisa import ANVISA_SOURCE, sugerir_indicacoes

router = APIRouter(tags=["Doenças e Sintomas"])
logger = logging.getLogger(__name__)


@router.get("/categories")
async def condition_categories():
    return source_unavailable(
        "/conditions/categories",
        "Não há uma API pública operacional integrada para o catálogo de doenças e sintomas.",
    )


@router.get("")
async def list_conditions():
    return source_unavailable(
        "/conditions",
        "O SINAN e os conjuntos epidemiológicos do SUS não oferecem catálogo clínico aberto integrado por esta API.",
    )


@router.get("/suggestions")
async def condition_search_suggestions(q: str = Query(..., min_length=2)):
    try:
        suggestions = await sugerir_indicacoes(q)
    except httpx.HTTPError as exc:
        logger.warning("Falha ao consultar indicações do CSV da ANVISA: %s", exc)
        return api_error(
            502,
            "UPSTREAM_UNAVAILABLE",
            "Não foi possível consultar os termos de indicação da ANVISA.",
            "/conditions/suggestions",
        )

    return {
        "query": q,
        "suggestions": suggestions,
        "meta": {
            "source": ANVISA_SOURCE,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "is_estimate": False,
            "is_stale": False,
        },
    }


@router.get("/{slug}")
async def get_condition_detail(slug: str):
    return source_unavailable(
        f"/conditions/{slug}",
        "Não há uma API pública operacional integrada para detalhes clínicos desta condição.",
    )
