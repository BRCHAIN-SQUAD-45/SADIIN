import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Literal
from xml.etree import ElementTree

import httpx
from fastapi import APIRouter, Query, Request

from app.api.responses import api_error, source_unavailable
from app.api.routers.medications import public_medication
from app.integrations import doencas
from app.integrations.anvisa import (
    ANVISA_SOURCE,
    listar_medicamentos,
    sugerir_indicacoes,
    sugerir_medicamentos,
)
from app.integrations.geocoding import municipio_por_coordenadas
from app.integrations.noticias import noticias_para_home
from app.search.fuzzy import fuzzy_threshold, normalize_search_text, similarity
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
        str(record.get("name") or ""),
        str(record.get("subtitle") or ""),
        str(record.get("synonyms") or ""),
        *(str(value) for value in record.get("indications", [])),
    ]
    for variant in record.get("variants", []):
        searchable_fields.extend(
            (str(variant.get("name") or ""), str(variant.get("manufacturer") or ""))
        )
    return any(needle in normalize_search_text(value) for value in searchable_fields)


MAX_RESULTADOS_POR_TIPO = 5


async def _buscar_medicamentos(q: str) -> list[dict]:
    registros = await listar_medicamentos(q, None)
    return registros[:MAX_RESULTADOS_POR_TIPO]


def _buscar_doencas(q: str) -> list[dict]:
    # Sem rede: só o catálogo + CID-10. Sintomas ficam para a página da doença.
    return [
        {k: v for k, v in d.items() if not k.startswith("_")}
        for d in doencas.filtrar(q)[:MAX_RESULTADOS_POR_TIPO]
    ]


async def _buscar_unidades(q: str, city_ibge: str) -> list[dict]:
    city, units = await buscar_todas_unidades_municipais(city_ibge)
    needle = _normalize(q)
    matches = [
        unit
        for unit in units
        if needle in _normalize(str(unit.get("nome_fantasia") or ""))
        or needle in _normalize(str(unit.get("razao_social") or ""))
        or needle in _normalize(" ".join(str(unit.get(key) or "") for key in ("endereco", "numero", "bairro")))
    ]
    resumos = [s for unit in matches if (s := unidade_resumo(unit, city)) is not None]
    return resumos[:MAX_RESULTADOS_POR_TIPO]


def _chave(texto: str) -> str:
    """Comparação sem acento e sem diferença de maiúsculas ("pressao alta" == "Pressão alta")."""
    return _normalize(doencas._sem_acento(texto))


def _termo_reconhecido(q: str, medicamentos: list[dict], condicoes: list[dict]) -> tuple[str, str | None]:
    """Intenção e termo reconhecido: nome exato de doença (ou sinônimo) vence; depois medicamento."""
    alvo = _chave(q)
    for doenca in condicoes:
        topico = (doencas.por_id(doenca["id"]) or {}).get("_topico")
        nomes = [doenca["popular_name"], doenca["cid10_code"], *(topico.sinonimos if topico else ())]
        if any(alvo == _chave(nome) for nome in nomes):
            return "condition", doenca["popular_name"]
    for med in medicamentos:
        if alvo == _chave(med["name"]):
            return "medication", med["name"]
    return "unknown", None


def _melhor_doenca_aproximada(q: str, condicoes: list[dict]) -> tuple[str, float] | None:
    """Doença dos resultados mais parecida com o texto digitado (nome ou sinônimo) e a nota."""
    melhor: tuple[str, float] | None = None
    for doenca in condicoes:
        topico = (doencas.por_id(doenca["id"]) or {}).get("_topico")
        nomes = [doenca["popular_name"], *(topico.sinonimos if topico else ())]
        nota = max(similarity(q, nome) for nome in nomes)
        if melhor is None or nota > melhor[1]:
            melhor = (doenca["popular_name"], nota)
    if melhor and melhor[1] >= fuzzy_threshold(q):
        return melhor
    return None


@router.get("/search")
async def global_search(
    request: Request,
    q: str = Query(..., min_length=2, max_length=100),
    search_type: Literal["all", "medications", "conditions", "units"] = Query("all", alias="type"),
    city_ibge: str = Query(DEFAULT_CITY_IBGE, min_length=7, max_length=7, pattern=r"^\d{7}$"),
    lat: float | None = Query(None, ge=-90, le=90),
    lng: float | None = Query(None, ge=-180, le=180),
):
    """Busca global (issue #33): medicamentos (ANVISA), doenças (Saúde de A a Z + CID-10) e UBS (CNES).

    As três fontes são consultadas em paralelo. Em `type=all`, se uma fonte falhar, as outras
    respondem mesmo assim; com um tipo só, a falha vira 502. A busca é textual (não é IA): por
    isso `fallback` é sempre `null` e `confidence` indica só se houve resultado.
    """
    if (lat is None) != (lng is None):
        return api_error(422, "VALIDATION_ERROR", "Informe latitude e longitude juntas.", "/search")

    quer = {
        "medications": search_type in ("all", "medications"),
        "conditions": search_type in ("all", "conditions"),
        "units": search_type in ("all", "units"),
    }

    async def unidades() -> list[dict]:
        cidade = city_ibge
        if lat is not None and lng is not None:
            cidade = (await municipio_por_coordenadas(lat, lng))["ibge_code"]
        return await _buscar_unidades(q, cidade)

    async def vazio() -> list[dict]:
        return []

    async def doencas_async() -> list[dict]:
        return _buscar_doencas(q)

    medicamentos, condicoes, unidades_encontradas = await asyncio.gather(
        _buscar_medicamentos(q) if quer["medications"] else vazio(),
        doencas_async() if quer["conditions"] else vazio(),
        unidades() if quer["units"] else vazio(),
        return_exceptions=True,
    )

    falhas = []
    resultados = {}
    for nome, valor in (("medications", medicamentos), ("conditions", condicoes), ("units", unidades_encontradas)):
        if isinstance(valor, BaseException):
            if not isinstance(valor, (httpx.HTTPError, ValueError)):
                raise valor
            logger.warning("Busca global: fonte %s indisponível: %s", nome, valor)
            falhas.append(nome)
            resultados[nome] = []
        else:
            resultados[nome] = valor

    if search_type != "all" and search_type in falhas:
        return api_error(
            502,
            "UPSTREAM_UNAVAILABLE",
            "Não foi possível consultar esta fonte agora. Tente novamente em instantes.",
            "/search",
        )

    medication_suggestions = []
    indication_suggestions = []
    suggestions_unavailable = False
    if search_type in ("all", "medications"):
        try:
            medication_suggestions = await sugerir_medicamentos(q)
        except httpx.HTTPError as exc:
            logger.warning("Sugestões de medicamentos indisponíveis: %s", exc)
            suggestions_unavailable = True
    if search_type in ("all", "conditions"):
        try:
            indication_suggestions = await sugerir_indicacoes(q)
        except httpx.HTTPError as exc:
            logger.warning("Sugestões de indicações indisponíveis: %s", exc)
            suggestions_unavailable = True

    # Ordena só pela nota; no empate mantém a ordem do ranking (que já prefere o nome mais
    # simples: "Paracetamol" antes de "Fosfato de Codeína, Paracetamol"). sorted() é estável.
    suggestions = sorted(
        medication_suggestions + indication_suggestions,
        key=lambda item: -item["score"],
    )
    best_suggestion = suggestions[0] if suggestions else None
    exact_medication_match = any(
        _is_exact_medication_match(q, record)
        for record in resultados["medications"]
    )
    intent, termo = _termo_reconhecido(q, resultados["medications"], resultados["conditions"])
    if intent == "unknown":
        contagem = {
            "medication": len(resultados["medications"]),
            "condition": len(resultados["conditions"]),
            "unit": len(resultados["units"]),
        }
        if any(contagem.values()):
            intent = max(contagem, key=contagem.get)
    total = sum(len(v) for v in resultados.values())
    resultados["medications"] = [
        public_medication(record, request)
        for record in resultados["medications"]
    ]

    resposta = {
        "query": q,
        "intent": intent,
        "confidence": 1.0 if total else 0.0,
        "fallback": None,
        "results": resultados,
        "meta": {
            "source": "ANVISA / Ministério da Saúde (Saúde de A a Z, CID-10) / CNES",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "is_estimate": False,
            # Alguma fonte falhou e a resposta saiu só com as outras.
            "is_stale": bool(falhas) or suggestions_unavailable,
        },
    }
    if termo:
        resposta["matched_term"] = termo
    else:
        # Sem nome exato: a doença parecida (catálogo oficial e curado) compete com a melhor
        # sugestão de medicamento e vence no empate. Ex.: "pressao auta" -> Hipertensão.
        doenca_parecida = _melhor_doenca_aproximada(q, resultados["conditions"])
        nota_sugestao = best_suggestion["score"] if best_suggestion and not exact_medication_match else -1
        if doenca_parecida and doenca_parecida[1] >= nota_sugestao:
            resposta["matched_term"] = doenca_parecida[0]
            resposta["intent"] = "condition"
        elif best_suggestion and not exact_medication_match:
            resposta["matched_term"] = best_suggestion["label"]
    if suggestions:
        resposta["suggestions"] = suggestions
    if "medications" in falhas or suggestions_unavailable:
        resposta["warnings"] = [
            {
                "source": ANVISA_SOURCE,
                "message": "Sugestões de medicamentos indisponíveis nesta consulta.",
            }
        ]
    return resposta


@router.get("/dashboard/regional")
async def regional_dashboard():
    return source_unavailable(
        "/dashboard/regional",
        "O e-SUS APS não disponibiliza indicadores regionais por esta API pública sem integração autorizada.",
    )


@router.get("/news")
async def get_news(
    uf: str | None = Query(None, min_length=2, max_length=2, pattern=r"^[A-Za-z]{2}$"),
    city_ibge: str | None = Query(None, pattern=r"^\d{7}$"),
    limit: int = Query(4, ge=1, le=12),
):
    """Notícias oficiais do Ministério da Saúde (gov.br/saude) para o carrossel da Home.

    O feed é nacional; com `uf`, notícias que citam o estado aparecem primeiro. `city_ibge`
    é aceito pelo contrato, mas o Ministério não publica notícias por município.
    """
    try:
        payload, stale = await noticias_para_home(limit=limit, uf=uf)
    except (httpx.HTTPError, ElementTree.ParseError, ValueError) as exc:
        logger.warning("Falha ao consultar notícias do Ministério da Saúde: %s", exc)
        return api_error(
            502,
            "UPSTREAM_UNAVAILABLE",
            "Não foi possível carregar as notícias do Ministério da Saúde agora.",
            "/news",
        )
    if stale:
        logger.info("Notícias servidas da última cópia válida (gov.br indisponível).")
    return payload
