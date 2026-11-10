import asyncio
import logging
import re
import time
from datetime import datetime, timezone

import httpx

DEMAS_BASE_URL = "https://apidadosabertos.saude.gov.br"
CNES_SERVICES_PATH = "/assistencia-a-saude/cnes-servicos-especializados"
DEMAS_PAGE_SIZE = 1000
DEMAS_MAX_PAGES = 10
MAX_COMPETENCE_LOOKBACK = 24
SERVICE_CACHE_TTL_SECONDS = 60 * 60
logger = logging.getLogger(__name__)
_service_cache: dict[str, tuple[float, list[dict]]] = {}
_service_cache_lock = asyncio.Lock()


def _competence_months() -> list[int]:
    now = datetime.now(timezone.utc)
    year, month = now.year, now.month
    result = []
    for _ in range(MAX_COMPETENCE_LOOKBACK):
        result.append(year * 100 + month)
        month -= 1
        if month == 0:
            year -= 1
            month = 12
    return result


def _category(service: str, classification: str) -> str:
    text = f"{service} {classification}".casefold()
    if any(term in text for term in ("vacina", "imuniz", "prevenc")):
        return "Prevenção"
    if any(term in text for term in ("proced", "coleta", "cirurg", "curativo", "diagnost")):
        return "Procedimentos"
    if any(term in text for term in ("consulta", "atendimento", "estrategia de saude da familia", "saude bucal")):
        return "Consultas"
    return "Apoio"


def _normalize_service(row: dict, competence: int) -> dict | None:
    service_code = str(row.get("co_servico") or "")
    classification_code = str(row.get("co_classificacao") or "")
    service = str(row.get("ds_servico") or "").strip()
    classification = str(row.get("ds_classificacao") or "").strip()
    if not service:
        return None

    notes = []
    if str(row.get("ds_serv_amb_sus", "")).upper() == "SIM":
        notes.append("Atendimento ambulatorial SUS")
    if str(row.get("ds_serv_hosp_sus", "")).upper() == "SIM":
        notes.append("Atendimento hospitalar SUS")
    if classification and classification != "-":
        notes.append(f"Classificação: {classification}")

    return {
        "id": f"{service_code}-{classification_code}".strip("-"),
        "name": re.sub(r"^\d+\s*-\s*", "", service),
        "detail": " · ".join(notes) or "Serviço cadastrado no CNES",
        "category": _category(service, classification),
        "icon_key": "hospital",
        "reference_competence": f"{competence // 100:04d}-{competence % 100:02d}",
    }


async def buscar_servicos_cnes(cnes: str) -> list[dict]:
    code = cnes.strip()
    if not code.isdigit():
        raise ValueError("O código CNES deve conter apenas dígitos.")

    now = time.monotonic()
    cached = _service_cache.get(code)
    if cached and cached[0] > now:
        return cached[1]

    async with _service_cache_lock:
        now = time.monotonic()
        cached = _service_cache.get(code)
        if cached and cached[0] > now:
            return cached[1]

        async with httpx.AsyncClient(
            base_url=DEMAS_BASE_URL,
            timeout=20.0,
            headers={"Accept": "application/json", "User-Agent": "SADIIN/1.0"},
        ) as client:
            for competence in _competence_months():
                rows: list[dict] = []
                for page_number in range(DEMAS_MAX_PAGES):
                    response = await client.get(
                        CNES_SERVICES_PATH,
                        params={
                            "co_cnes": code,
                            "nu_comp": competence,
                            "limit": DEMAS_PAGE_SIZE,
                            "offset": page_number * DEMAS_PAGE_SIZE,
                        },
                    )
                    response.raise_for_status()
                    payload = response.json()
                    page = payload.get("cnes_servicos_especializados") if isinstance(payload, dict) else None
                    if not isinstance(page, list):
                        raise ValueError("Resposta inesperada da API DEMAS para serviços CNES.")
                    rows.extend(row for row in page if isinstance(row, dict))
                    if len(page) < DEMAS_PAGE_SIZE:
                        break
                if rows:
                    services = [
                        service
                        for row in rows
                        if str(row.get("ds_serv_amb_sus", "")).upper() == "SIM"
                        or str(row.get("ds_serv_hosp_sus", "")).upper() == "SIM"
                        if (service := _normalize_service(row, competence)) is not None
                    ]
                    _service_cache[code] = (
                        time.monotonic() + SERVICE_CACHE_TTL_SECONDS,
                        services,
                    )
                    return services

    logger.info("Nenhum serviço CNES encontrado para %s nas competências consultadas", code)
    _service_cache[code] = (time.monotonic() + SERVICE_CACHE_TTL_SECONDS, [])
    return []