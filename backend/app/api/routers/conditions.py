"""Doenças e sintomas (issues #43 e #46).

Catálogo: tópicos do "Saúde de A a Z" do Ministério da Saúde vinculados à CID-10 oficial do DATASUS.
Categoria = capítulo da CID-10. Sintomas, prevenção e tratamento vêm da página oficial de cada tópico.
"""

import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Query

from app.api.responses import api_error
from app.integrations import doencas
from app.integrations.anvisa import ANVISA_SOURCE, sugerir_indicacoes

router = APIRouter(tags=["Doenças e Sintomas"])
logger = logging.getLogger(__name__)


def _meta() -> dict:
    return {
        "source": doencas.SOURCE,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "is_estimate": False,
        "is_stale": False,
    }


@router.get("/categories")
async def condition_categories():
    """Capítulos da CID-10 que têm doenças no catálogo (ex.: "Algumas doenças infecciosas e parasitárias")."""
    return doencas.categorias()


@router.get("")
async def list_conditions(
    q: str | None = Query(None, max_length=100, description="Nome, sinônimo ou código CID-10 (ex.: A90)"),
    category: str | None = Query(None, max_length=80),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=24),
):
    encontrados = doencas.filtrar(q, category)
    inicio = (page - 1) * page_size
    pagina = encontrados[inicio : inicio + page_size]
    return {
        "items": await doencas.enriquecer_lista(pagina),
        "page": page,
        "page_size": page_size,
        "total": len(encontrados),
        "meta": _meta(),
    }


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
    doenca = doencas.por_id(slug)
    if doenca is None:
        return api_error(404, "NOT_FOUND", "Doença não encontrada no catálogo.", f"/conditions/{slug}")
    return await doencas.detalhe(doenca)
