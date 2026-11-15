import asyncio
import logging
import time
from datetime import datetime, timezone

import httpx

BASE_URL = "https://apidadosabertos.saude.gov.br"
PAGE_SIZE = 1000
MAX_PAGES = 10
LOOKBACK_MONTHS = 12
CACHE_TTL_SECONDS = 30 * 60
logger = logging.getLogger(__name__)
_cache: dict[tuple[str, str], tuple[float, list[dict]]] = {}
_cache_lock = asyncio.Lock()

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


def _validate_cnes(cnes: str) -> str:
    code = cnes.strip()
    if not code.isdigit() or len(code) > 7:
        raise ValueError("O código CNES deve conter até 7 dígitos.")
    return code.zfill(7)


async def _fetch_page(
    client: httpx.AsyncClient,
    path: str,
    key: str,
    cnes: str,
    competence: int,
) -> list[dict]:
    rows: list[dict] = []
    for page_number in range(MAX_PAGES):
        response = await client.get(
            path,
            params={
                "co_cnes": cnes,
                "nu_comp": competence,
                "limit": PAGE_SIZE,
                "offset": page_number * PAGE_SIZE,
            },
        )
        response.raise_for_status()
        payload = response.json()
        page = payload.get(key) if isinstance(payload, dict) else None
        if not isinstance(page, list):
            raise ValueError(f"Resposta inesperada da API para {path}.")
        rows.extend(row for row in page if isinstance(row, dict))
        if len(page) < PAGE_SIZE:
            break
    return rows


async def buscar_recurso_cnes(cnes: str, resource: str) -> list[dict]:
    code = _validate_cnes(cnes)
    definition = RESOURCE_DEFINITIONS.get(resource)
    if definition is None:
        raise ValueError(f"Recurso CNES desconhecido: {resource}.")
    path, key = definition
    cache_key = (code, resource)
    now = time.monotonic()
    cached = _cache.get(cache_key)
    if cached and cached[0] > now:
        return cached[1]

    async with _cache_lock:
        now = time.monotonic()
        cached = _cache.get(cache_key)
        if cached and cached[0] > now:
            return cached[1]

        async with httpx.AsyncClient(
            base_url=BASE_URL,
            timeout=30.0,
            headers={"Accept": "application/json", "User-Agent": "SADIIN/1.0"},
        ) as client:
            for competence in competencias_recentes():
                rows = await _fetch_page(client, path, key, code, competence)
                if rows:
                    _cache[cache_key] = (time.monotonic() + CACHE_TTL_SECONDS, rows)
                    return rows

        _cache[cache_key] = (time.monotonic() + CACHE_TTL_SECONDS, [])
        return []


async def buscar_producao_cnes(cnes: str) -> list[dict]:
    code = _validate_cnes(cnes)
    resources = ("outpatient_procedures", "hospital_procedures")
    results: list[dict] = []
    for resource in resources:
        path, key = RESOURCE_DEFINITIONS[resource]
        async with httpx.AsyncClient(
            base_url=BASE_URL,
            timeout=30.0,
            headers={"Accept": "application/json", "User-Agent": "SADIIN/1.0"},
        ) as client:
            for competence in competencias_recentes():
                rows = await _fetch_page(client, path, key, code, competence)
                results.extend(
                    {
                        **row,
                        "_source": resource,
                        "_competence": competence,
                    }
                    for row in rows
                )
    return results


def metadados_cnes_recursos() -> dict[str, str | bool]:
    return {
        "source": "CNES / SIA / SIH - Ministério da Saúde",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "is_estimate": False,
        "is_stale": False,
    }
