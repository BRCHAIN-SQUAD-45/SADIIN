import asyncio
import csv
import html
import io
import logging
import time
import unicodedata

import httpx

ANVISA_MEDICATIONS_URL = (
    "https://dados.anvisa.gov.br/dados/CONSULTAS/PRODUTOS/TA_CONSULTA_MEDICAMENTOS.CSV"
)
ANVISA_SOURCE = "ANVISA - Consulta de medicamentos"
ANVISA_CACHE_TTL_SECONDS = 6 * 60 * 60
logger = logging.getLogger(__name__)
_cache: tuple[float, list[dict]] | None = None
_cache_lock = asyncio.Lock()


def _text(value: object) -> str:
    return html.unescape(str(value or "")).strip()


def _normalize(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.casefold())
    return "".join(char for char in normalized if not unicodedata.combining(char))


def _category_id(category: str) -> str:
    return _normalize(category).replace(" ", "-") or "outros"


def _is_active(row: dict[str, str]) -> bool:
    return _normalize(_text(row.get("VALIDADE_SITUACAO"))) == "ativo"


def _is_registered_medicine(row: dict[str, str]) -> bool:
    return (
        _text(row.get("CO_TIPO_PRODUTO")) == "1"
        and _normalize(_text(row.get("TIPO_AUTORIZACAO"))) == "registrado"
    )


def _has_catalog_clinical_data(row: dict[str, str]) -> bool:
    return any(
        _text(row.get(field))
        for field in ("CO_ATC", "CO_FORMA_FISICA", "INDICACOES")
    )


def _to_record(row: dict[str, str]) -> dict | None:
    product_id = _text(row.get("CO_SEQ_PRODUTO")) or _text(row.get("NU_REGISTRO_PRODUTO"))
    name = _text(row.get("NO_PRODUTO"))
    if (
        not product_id
        or not name
        or not _is_active(row)
        or not _is_registered_medicine(row)
        or not _has_catalog_clinical_data(row)
    ):
        return None

    category = _text(row.get("DS_TIPO_CATEGORIA_REGULATORIA")) or "Medicamento"
    substances = _text(row.get("SUBSTANCIAS_MEDICAMENTOS"))
    indications = _text(row.get("INDICACOES"))
    process_number = _text(row.get("NU_PROCESSO"))
    leaflet_url = (
        f"https://consultas.anvisa.gov.br/#/medicamentos/{process_number}/"
        if process_number
        else "https://consultas.anvisa.gov.br/#/bulario/"
    )
    return {
        "id": product_id,
        "name": name,
        "subtitle": substances or category,
        "tag": category,
        "category_id": _category_id(category),
        "requires_prescription": bool(_text(row.get("CO_RESTRICAO"))),
        "adult_use": True,
        "leaflet_url": leaflet_url,
        "indications": [
            indications
            if indications
            else "A indicação detalhada deve ser consultada na bula oficial da ANVISA."
        ],
        "contraindications": [
            "As contraindicações detalhadas devem ser consultadas na bula oficial da ANVISA."
        ],
        "side_effects": [
            "As reações adversas detalhadas devem ser consultadas na bula oficial da ANVISA."
        ],
        "synonyms": _text(row.get("SINONIMOS")),
        "regulatory_status": _text(row.get("SITUACAO_ASSUNTO")),
        "registration_number": _text(row.get("NU_REGISTRO_PRODUTO")),
        "process_number": process_number,
        "updated_at": _text(row.get("DATA_ULTIMA_ATUALIZACAO")),
    }


async def _load_records() -> list[dict]:
    global _cache
    now = time.monotonic()
    if _cache and _cache[0] > now:
        return _cache[1]

    async with _cache_lock:
        now = time.monotonic()
        if _cache and _cache[0] > now:
            return _cache[1]

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(120.0, connect=20.0),
            headers={"Accept": "text/csv", "User-Agent": "SADIIN/1.0"},
        ) as client:
            response = await client.get(ANVISA_MEDICATIONS_URL)
            response.raise_for_status()

        decoded = response.content.decode("cp1252").lstrip("\ufeff")
        reader = csv.DictReader(io.StringIO(decoded), delimiter=";")
        records_by_id: dict[str, dict] = {}
        for row in reader:
            record = _to_record(row)
            if record is not None:
                records_by_id[record["id"]] = record

        records = sorted(records_by_id.values(), key=lambda item: _normalize(item["name"]))
        _cache = (time.monotonic() + ANVISA_CACHE_TTL_SECONDS, records)
        logger.info("Catálogo ANVISA carregado: %s medicamentos ativos", len(records))
        return records


async def listar_medicamentos(query: str | None, category: str | None) -> list[dict]:
    records = await _load_records()
    normalized_query = _normalize(query or "").strip()
    normalized_category = _normalize(category or "").strip()
    return [
        record
        for record in records
        if (
            not normalized_query
            or normalized_query in _normalize(record["name"])
            or normalized_query in _normalize(record["subtitle"])
            or normalized_query in _normalize(record["synonyms"])
        )
        and (
            not normalized_category
            or normalized_category == "todos"
            or record["category_id"] == normalized_category
        )
    ]


async def listar_categorias() -> list[dict]:
    records = await _load_records()
    categories = {
        record["category_id"]: record["tag"]
        for record in records
    }
    return [
        {"id": category_id, "name": name, "slug": category_id}
        for category_id, name in sorted(categories.items(), key=lambda item: _normalize(item[1]))
    ]


async def buscar_medicamento(medication_id: str) -> dict | None:
    records = await _load_records()
    return next((record for record in records if record["id"] == medication_id), None)
