import logging
import os
from datetime import datetime, timezone
from typing import Literal

import httpx
from fastapi import APIRouter, Query, Request

from app.api.responses import api_error, source_unavailable
from app.api.routers.medications import public_medication
from app.integrations.anvisa import (
    ANVISA_SOURCE,
    listar_medicamentos,
    sugerir_indicacoes,
    sugerir_medicamentos,
)
from app.integrations.geocoding import municipio_por_coordenadas
from app.search.fuzzy import normalize_search_text
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


def _is_exact_medication_match(query: str, record: dict) -> bool:
    needle = normalize_search_text(query)
    searchable_fields = [
        record["name"],
        record["subtitle"],
        record["synonyms"],
        *record["indications"],
    ]
    for variant in record["variants"]:
        searchable_fields.extend((variant["name"], variant["manufacturer"]))
    return any(needle in normalize_search_text(value) for value in searchable_fields)


@router.get("/search")
async def global_search(
    request: Request,
    q: str = Query(..., min_length=2),
    search_type: Literal["all", "medications", "conditions", "units"] = Query("all", alias="type"),
    city_ibge: str = Query(DEFAULT_CITY_IBGE, min_length=7, max_length=7, pattern=r"^\d{7}$"),
    lat: float | None = Query(None, ge=-90, le=90),
    lng: float | None = Query(None, ge=-180, le=180),
):
    if search_type == "conditions":
        try:
            suggestions = await sugerir_indicacoes(q)
        except httpx.HTTPError as exc:
            logger.warning("Falha ao consultar indicações no catálogo ANVISA: %s", exc)
            return api_error(
                502,
                "UPSTREAM_UNAVAILABLE",
                "Não foi possível consultar os termos de indicação da ANVISA.",
                "/search",
            )
        return {
            "query": q,
            "intent": "unknown",
            "confidence": 0,
            "fallback": None,
            "suggestions": suggestions,
            "results": {"medications": [], "conditions": [], "units": []},
            "meta": {
                "source": ANVISA_SOURCE,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_estimate": False,
                "is_stale": False,
            },
        }

    medication_records: list[dict] = []
    medication_suggestions: list[dict] = []
    indication_suggestions: list[dict] = []
    medication_source_unavailable = False
    if search_type in {"all", "medications"}:
        try:
            medication_records = await listar_medicamentos(q, None)
            medication_suggestions = await sugerir_medicamentos(q)
            indication_suggestions = await sugerir_indicacoes(q)
        except httpx.HTTPError as exc:
            logger.warning("Falha ao consultar catálogo ANVISA na busca global: %s", exc)
            if search_type == "medications":
                return api_error(
                    502,
                    "UPSTREAM_UNAVAILABLE",
                    "Não foi possível consultar o catálogo de medicamentos da ANVISA.",
                    "/search",
                )
            medication_source_unavailable = True

    if search_type == "medications":
        exact_match = any(_is_exact_medication_match(q, record) for record in medication_records)
        best_suggestion = medication_suggestions[0] if medication_suggestions else None
        return {
            "query": q,
            "matched_term": (
                best_suggestion["label"]
                if not exact_match and best_suggestion is not None
                else None
            ),
            "intent": "medication" if medication_records else "unknown",
            "confidence": best_suggestion["score"] if best_suggestion else 0,
            "fallback": None,
            "suggestions": medication_suggestions,
            "results": {
                "medications": [
                    public_medication(record, request) for record in medication_records[:10]
                ],
                "conditions": [],
                "units": [],
            },
            "meta": {
                "source": ANVISA_SOURCE,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_estimate": False,
                "is_stale": False,
            },
        }

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
    if search_type == "all" and not summaries and not medication_records:
        if medication_source_unavailable:
            return api_error(
                502,
                "UPSTREAM_UNAVAILABLE",
                "Não foi possível consultar as fontes de medicamentos nem encontrar unidades.",
                "/search",
            )
        return source_unavailable(
            "/search",
            "Não foram encontrados medicamentos nem estabelecimentos para esta busca.",
        )

    suggestions = sorted(
        medication_suggestions + indication_suggestions,
        key=lambda item: (-item["score"], item["label"].casefold()),
    )
    best_suggestion = suggestions[0] if suggestions else None
    exact_match = any(
        _is_exact_medication_match(q, record) for record in medication_records
    )
    return {
        "query": q,
        "matched_term": (
            best_suggestion["label"]
            if not exact_match and best_suggestion
            else None
        ),
        "intent": "medication" if medication_records else "unit" if summaries else "unknown",
        "confidence": best_suggestion["score"] if best_suggestion else (0.9 if summaries else 0),
        "fallback": None,
        "suggestions": suggestions,
        **(
            {
                "warnings": [
                    {
                        "source": ANVISA_SOURCE,
                        "message": "Sugestões de medicamentos indisponíveis nesta consulta.",
                    }
                ]
            }
            if medication_source_unavailable
            else {}
        ),
        "results": {
            "medications": [
                public_medication(record, request) for record in medication_records[:10]
            ],
            "conditions": [],
            "units": summaries,
        },
        "meta": {
            **metadados_cnes(),
            "source": (
                "CNES"
                if medication_source_unavailable
                else f"{ANVISA_SOURCE}; CNES"
            ),
        },
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
