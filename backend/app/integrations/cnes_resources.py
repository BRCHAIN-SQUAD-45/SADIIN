"""Recursos do CNES e produção SIA/SIH por estabelecimento (API de Dados Abertos do Ministério da Saúde).

Desempenho (issue #62):
- A API demora ~1,5 s por chamada, então as competências são consultadas EM PARALELO
  (antes eram sequenciais: 24 chamadas x ~1,3 s = ~30 s na ficha da UBS).
- Mantemos 12 meses: o SIA/SIH é publicado com ~5 meses de atraso, então cortar para
  3-6 meses deixaria a ficha praticamente vazia.
- Cache em memória (TTLCache, 6 h: os dados são mensais) com lock POR CHAVE: a 2ª rota
  que pedir o mesmo dado (ex.: /metrics e /attendance-history ao mesmo tempo) espera o
  download em andamento em vez de repeti-lo, sem bloquear consultas de outras unidades.
- Um semáforo global limita as chamadas simultâneas ao DATASUS.
"""

import asyncio
import logging
import os
from datetime import datetime, timezone

import httpx

from app.integrations.cache import TTLCache

BASE_URL = "https://apidadosabertos.saude.gov.br"
PAGE_SIZE = 1000
MAX_PAGES = 10
LOOKBACK_MONTHS = 12
PROBE_BATCH_MONTHS = 6
# CNES, SIA e SIH são publicados por competência (mês): 6 h de cache não perde atualização.
CACHE_TTL_SECONDS = int(os.getenv("SADIIN_DATASUS_CACHE_TTL_SECONDS", str(6 * 60 * 60)))
MAX_CONCURRENT_REQUESTS = int(os.getenv("SADIIN_DATASUS_MAX_CONCURRENCY", "24"))
logger = logging.getLogger(__name__)

# (cnes, recurso) -> (competência, linhas)
_resource_cache: TTLCache[tuple[int | None, list[dict]]] = TTLCache(CACHE_TTL_SECONDS)
# cnes -> linhas de produção SIA + SIH
_production_cache: TTLCache[list[dict]] = TTLCache(CACHE_TTL_SECONDS)
_request_slots = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

RESOURCE_DEFINITIONS = {
    "establishments": (
        "/assistencia-a-saude/cnes-estabelecimentos",
        "cnes_estabelecimentos",
    ),
    "services": ("/assistencia-a-saude/cnes-servicos-especializados", "cnes_servicos_especializados"),
    "professionals": ("/assistencia-a-saude/cnes-profissionais", "cnes_profissionais"),
    "equipment": ("/assistencia-a-saude/cnes-equipamentos", "cnes_equipamentos"),
    "beds": ("/assistencia-a-saude/cnes-leitos", "cnes_leitos"),
    "outpatient_procedures": (
        "/assistencia-a-saude/sia-procedimentos-ambulatoriais",
        "sia_procedimentos_ambulatoriais",
    ),
    "hospital_procedures": (
        "/assistencia-a-saude/sih-procedimentos-hospitalares",
        "sih_procedimentos_hospitalares",
    ),
}


def competencias_recentes(limit: int = LOOKBACK_MONTHS) -> list[int]:
    now = datetime.now(timezone.utc)
    year, month = now.year, now.month
    result = []
    for _ in range(limit):
        result.append(year * 100 + month)
        month -= 1
        if month == 0:
            year -= 1
            month = 12
    return result


def formatar_competencia(competence: int) -> str:
    """`202607` -> `"2026-07"` (mesmo formato dos mocks do front)."""
    return f"{competence // 100:04d}-{competence % 100:02d}"


def _validate_cnes(cnes: str) -> str:
    code = cnes.strip()
    if not code.isdigit() or len(code) > 7:
        raise ValueError("O código CNES deve conter até 7 dígitos.")
    return code.zfill(7)


def _new_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=BASE_URL,
        timeout=30.0,
        headers={"Accept": "application/json", "User-Agent": "SADIIN/1.0"},
    )


async def _get_rows(
    client: httpx.AsyncClient, path: str, key: str, params: dict
) -> list[dict]:
    async with _request_slots:
        response = await client.get(path, params=params)
    response.raise_for_status()
    payload = response.json()
    page = payload.get(key) if isinstance(payload, dict) else None
    if not isinstance(page, list):
        raise ValueError(f"Resposta inesperada da API para {path}.")
    return [row for row in page if isinstance(row, dict)]


async def _fetch_page(
    client: httpx.AsyncClient,
    path: str,
    key: str,
    cnes: str,
    competence: int,
    first_page: list[dict] | None = None,
) -> list[dict]:
    """Todas as páginas de uma competência. `first_page` evita baixar de novo a página 0."""
    rows: list[dict] = list(first_page or [])
    if first_page is not None and len(first_page) < PAGE_SIZE:
        return rows
    for page_number in range(1 if first_page is not None else 0, MAX_PAGES):
        page = await _get_rows(
            client,
            path,
            key,
            {
                "co_cnes": cnes,
                "nu_comp": competence,
                "limit": PAGE_SIZE,
                "offset": page_number * PAGE_SIZE,
            },
        )
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            break
    return rows


async def _first_page(
    client: httpx.AsyncClient, path: str, key: str, cnes: str, competence: int
) -> list[dict]:
    return await _get_rows(
        client,
        path,
        key,
        {"co_cnes": cnes, "nu_comp": competence, "limit": PAGE_SIZE, "offset": 0},
    )


async def buscar_recurso_cnes_com_competencia(
    cnes: str, resource: str, lookback_months: int = LOOKBACK_MONTHS
) -> tuple[int | None, list[dict]]:
    """Linhas da competência mais recente publicada e qual competência foi.

    Busca em lotes de PROBE_BATCH_MONTHS competências, da mais recente para a mais antiga,
    pedindo a 1ª página de cada lote em paralelo. O CNES costuma ter dados nos últimos
    ~4-5 meses, então o 1º lote quase sempre resolve (6 chamadas em vez de 12 ou 24 e
    menos disputa com o SIA/SIH pelas vagas do semáforo). Só baixa páginas extras se a
    competência tiver mais de PAGE_SIZE linhas (hospitais grandes).
    """
    code = _validate_cnes(cnes)
    definition = RESOURCE_DEFINITIONS.get(resource)
    if definition is None:
        raise ValueError(f"Recurso CNES desconhecido: {resource}.")
    path, key = definition

    async def load() -> tuple[int | None, list[dict]]:
        competences = competencias_recentes(lookback_months)
        async with _new_client() as client:
            for start in range(0, len(competences), PROBE_BATCH_MONTHS):
                batch = competences[start : start + PROBE_BATCH_MONTHS]
                first_pages = await asyncio.gather(
                    *(_first_page(client, path, key, code, competence) for competence in batch)
                )
                for competence, page in zip(batch, first_pages):
                    if page:
                        rows = await _fetch_page(
                            client, path, key, code, competence, first_page=page
                        )
                        return competence, rows
        return None, []

    return await _resource_cache.get_or_load((code, resource, lookback_months), load)


async def buscar_recurso_cnes(cnes: str, resource: str) -> list[dict]:
    _, rows = await buscar_recurso_cnes_com_competencia(cnes, resource)
    return rows


async def buscar_producao_cnes(cnes: str) -> list[dict]:
    """Produção SIA (ambulatorial) + SIH (hospitalar) dos últimos 12 meses, com cache.

    As 24 consultas (2 fontes x 12 competências) rodam em paralelo. Falhas não são
    guardadas no cache: a próxima visita tenta de novo.
    """
    code = _validate_cnes(cnes)

    async def load() -> list[dict]:
        jobs = [
            (resource, competence)
            for resource in ("outpatient_procedures", "hospital_procedures")
            for competence in competencias_recentes()
        ]
        async with _new_client() as client:
            pages = await asyncio.gather(
                *(
                    _fetch_page(client, *RESOURCE_DEFINITIONS[resource], code, competence)
                    for resource, competence in jobs
                )
            )
        return [
            {**row, "_source": resource, "_competence": competence}
            for (resource, competence), rows in zip(jobs, pages)
            for row in rows
        ]

    return await _production_cache.get_or_load(code, load)


def metadados_cnes_recursos() -> dict[str, str | bool]:
    return {
        "source": "CNES / SIA / SIH - Ministério da Saúde",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "is_estimate": False,
        "is_stale": False,
    }
