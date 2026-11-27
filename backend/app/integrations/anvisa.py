import asyncio
import csv
import hashlib
import html
import io
import json
import os
from pathlib import Path
import logging
import re
import time
import unicodedata

import httpx

from app.search.fuzzy import normalize_search_text, rank_fuzzy_candidates
from app.search.indice import IndiceBusca

ANVISA_MEDICATIONS_URL = (
    "https://dados.anvisa.gov.br/dados/CONSULTAS/PRODUTOS/TA_CONSULTA_MEDICAMENTOS.CSV"
)
ANVISA_SOURCE = "ANVISA - Consulta de medicamentos"
ANVISA_CACHE_TTL_SECONDS = 6 * 60 * 60
# Catálogo já processado salvo em disco: reiniciar o servidor lê o arquivo (~1 s) em vez de
# baixar e processar o CSV da ANVISA de novo (~20 s). Vale pelo mesmo TTL do cache em memória.
ANVISA_DISK_CACHE = Path(
    os.getenv("SADIIN_CACHE_DIR", str(Path(__file__).resolve().parents[2] / ".cache"))
) / "anvisa_catalogo.json"
logger = logging.getLogger(__name__)
_cache: tuple[float, list[dict]] | None = None
_cache_lock = asyncio.Lock()
# Índice de busca do catálogo carregado (issue #64): (lista de registros, índice). Guarda a
# própria lista e compara com "is": comparar id() falharia se o Python reaproveitasse o id.
_indice_cache: tuple[list[dict], IndiceBusca] | None = None
_STRENGTH_PATTERN = re.compile(
    r"\b\d+(?:[.,]\d+)?\s*(?:mcg|ug|mg|g|kg|ml|l|ui|%)"
    r"(?:\s*/\s*\d+(?:[.,]\d+)?\s*(?:mcg|ug|mg|g|kg|ml|l|ui))?\b"
)
_FORM_ASSETS = {
    "comprimidos": (
        "comprimidos.svg",
        "Ilustração de comprimidos; não representa embalagem comercial.",
    ),
    "capsulas": (
        "capsulas.svg",
        "Ilustração de cápsulas; não representa embalagem comercial.",
    ),
    "liquidos": (
        "liquidos.svg",
        "Ilustração de medicamento líquido; não representa embalagem comercial.",
    ),
    "topicos": (
        "topicos.svg",
        "Ilustração de medicamento tópico; não representa embalagem comercial.",
    ),
    "injetaveis": (
        "injetaveis.svg",
        "Ilustração de medicamento injetável; não representa embalagem comercial.",
    ),
    "medicamento": (
        "medicamento.svg",
        "Ilustração genérica de medicamento; não representa embalagem comercial.",
    ),
}


def _text(value: object) -> str:
    return html.unescape(str(value or "")).strip()


def _normalize(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.casefold())
    return "".join(char for char in normalized if not unicodedata.combining(char))


def _category_id(category: str) -> str:
    return _normalize(category).replace(" ", "-") or "outros"


def _display_name(value: str) -> str:
    words = " ".join(value.split()).split(" ")
    return " ".join(word[:1].upper() + word[1:].lower() for word in words if word)


def _medicine_form(row: dict[str, str]) -> str:
    text = _normalize(
        " ".join(
            _text(row.get(field))
            for field in ("NO_PRODUTO", "COMPLEMENTO", "DS_REFERENCIA")
        )
    )
    if any(term in text for term in ("capsula", "capsulas")):
        return "capsulas"
    if any(
        term in text for term in ("comprimido", "comprimidos", "dragea", "tablete")
    ):
        return "comprimidos"
    if any(
        term in text for term in ("solucao", "xarope", "suspensao", "gotas", "elixir")
    ):
        return "liquidos"
    if any(term in text for term in ("pomada", "creme", "gel", "locao")):
        return "topicos"
    if any(term in text for term in ("injetavel", "injecao", "ampola", "frasco-ampola")):
        return "injetaveis"
    return "medicamento"


def _strength(row: dict[str, str]) -> str:
    text = _normalize(
        " ".join(_text(row.get(field)) for field in ("NO_PRODUTO", "COMPLEMENTO"))
    ).replace("μ", "u")
    values = _STRENGTH_PATTERN.findall(text)
    return "|".join(
        re.sub(r"\s+", " ", value).strip().replace(",", ".") for value in values
    )


def _group_key(record: dict) -> tuple[str, str, str, str]:
    ingredient = _normalize(record["active_ingredient"])
    strength = record["strength"]
    form = record["dosage_form"]
    if not ingredient:
        ingredient = _normalize(record["name"])
    if not strength:
        ingredient = f"{ingredient}|{_normalize(record['name'])}"
    return ingredient, strength, form, record["dosage_form_code"]


def _group_records(records: list[dict]) -> list[dict]:
    grouped: dict[tuple[str, str, str, str], list[dict]] = {}
    for record in records:
        grouped.setdefault(_group_key(record), []).append(record)

    result = []
    for key, variants in grouped.items():
        variants.sort(
            key=lambda item: (
                _normalize(item["name"]),
                _normalize(item["manufacturer"]),
                item["id"],
            )
        )
        representative = variants[0]
        group_id = (
            "med-"
            + hashlib.sha256("|".join(key).encode("utf-8")).hexdigest()[:16]
        )
        manufacturers = {item["manufacturer"] for item in variants if item["manufacturer"]}
        active_ingredient = representative["active_ingredient"] or representative["name"]
        form_label = {
            "comprimidos": "Comprimidos",
            "capsulas": "Cápsulas",
            "liquidos": "Líquido",
            "topicos": "Uso tópico",
            "injetaveis": "Injetável",
            "medicamento": "Forma não identificada",
        }[representative["dosage_form"]]
        presentation = " · ".join(
            part
            for part in (
                representative["strength"].replace("|", " / "),
                form_label,
            )
            if part
        )
        presentation_count = len(variants)
        manufacturer_count = len(manufacturers)
        count_label = (
            f"{presentation_count} registro{'s' if presentation_count != 1 else ''}"
            f" · {manufacturer_count} fabricante{'s' if manufacturer_count != 1 else ''}"
        )
        subtitle = f"{presentation} · {count_label}" if presentation else count_label
        indications = sorted(
            {
                indication
                for item in variants
                for indication in item["indications"]
                if indication
            }
        )
        result.append(
            {
                **{
                    field: value
                    for field, value in representative.items()
                    if field not in {"manufacturer", "active_ingredient", "strength", "dosage_form"}
                },
                "id": group_id,
                "name": _display_name(active_ingredient),
                "subtitle": subtitle,
                "active_ingredient": _display_name(active_ingredient),
                "strength": representative["strength"],
                "dosage_form": representative["dosage_form"],
                "dosage_form_code": representative["dosage_form_code"],
                "image_asset": _FORM_ASSETS[representative["dosage_form"]][0],
                "image_alt": _FORM_ASSETS[representative["dosage_form"]][1],
                "variant_count": len(variants),
                "manufacturer_count": len(manufacturers),
                "synonyms": " ".join(
                    sorted(
                        {
                            item["synonyms"]
                            for item in variants
                            if item["synonyms"]
                        }
                    )
                ),
                "requires_prescription": any(
                    item["requires_prescription"] for item in variants
                ),
                "indications": indications,
                "variants": [
                    {
                        "id": item["id"],
                        "name": _display_name(item["name"]),
                        "manufacturer": item["manufacturer"],
                        "registration_number": item["registration_number"],
                        "presentation": " · ".join(
                            part for part in (item["strength"], form_label) if part
                        ),
                        "leaflet_url": item["leaflet_url"],
                        "requires_prescription": item["requires_prescription"],
                    }
                    for item in variants
                ],
            }
        )
    return sorted(result, key=lambda item: _normalize(item["name"]))


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
    dosage_form = _medicine_form(row)
    strength = _strength(row)
    dosage_form_code = _text(row.get("CO_FORMA_FISICA"))
    leaflet_url = (
        f"https://consultas.anvisa.gov.br/#/medicamentos/{process_number}/"
        if process_number
        else "https://consultas.anvisa.gov.br/#/bulario/"
    )
    return {
        "id": product_id,
        "name": _display_name(name),
        "subtitle": substances or category,
        "tag": category,
        "category_id": _category_id(category),
        "requires_prescription": bool(_text(row.get("CO_RESTRICAO"))),
        "adult_use": True,
        "leaflet_url": leaflet_url,
        "image_asset": _FORM_ASSETS[dosage_form][0],
        "image_alt": _FORM_ASSETS[dosage_form][1],
        "active_ingredient": substances,
        "strength": strength,
        "dosage_form": dosage_form,
        "dosage_form_code": dosage_form_code,
        "manufacturer": _text(row.get("NO_RAZAO_SOCIAL_EMPRESA")),
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


def _ler_cache_em_disco() -> tuple[float, list[dict]] | None:
    """(idade em segundos, registros) se o arquivo existir e ainda estiver dentro do TTL."""
    try:
        idade = time.time() - ANVISA_DISK_CACHE.stat().st_mtime
        if idade >= ANVISA_CACHE_TTL_SECONDS:
            return None
        records = json.loads(ANVISA_DISK_CACHE.read_text(encoding="utf-8"))
        return (idade, records) if isinstance(records, list) and records else None
    except (OSError, ValueError):
        return None


def _salvar_cache_em_disco(records: list[dict]) -> None:
    try:
        ANVISA_DISK_CACHE.parent.mkdir(parents=True, exist_ok=True)
        temporario = ANVISA_DISK_CACHE.with_suffix(".tmp")
        temporario.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
        temporario.replace(ANVISA_DISK_CACHE)  # troca atômica: nunca fica arquivo pela metade
    except OSError as exc:
        logger.warning("Não foi possível salvar o cache em disco da ANVISA: %s", exc)


async def _load_records() -> list[dict]:
    global _cache
    now = time.monotonic()
    if _cache and _cache[0] > now:
        return _cache[1]

    async with _cache_lock:
        now = time.monotonic()
        if _cache and _cache[0] > now:
            return _cache[1]

        do_disco = _ler_cache_em_disco()
        if do_disco is not None:
            idade, records = do_disco
            _cache = (time.monotonic() + ANVISA_CACHE_TTL_SECONDS - idade, records)
            logger.info("Catálogo ANVISA lido do disco (%s grupos, %.0f min de idade)", len(records), idade / 60)
            return records

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

        records = _group_records(list(records_by_id.values()))
        _cache = (time.monotonic() + ANVISA_CACHE_TTL_SECONDS, records)
        _salvar_cache_em_disco(records)
        logger.info("Catálogo ANVISA carregado: %s grupos de medicamentos ativos", len(records))
        return records


def _textos_pesquisaveis(record: dict) -> list[str]:
    """Campos usados na busca exata por trecho (os mesmos de antes do índice)."""
    textos = [record["name"], record["subtitle"], record["synonyms"], *record["indications"]]
    for variant in record["variants"]:
        textos.append(" ".join((variant["name"], variant["manufacturer"])))
    return [t for t in textos if t]


def _indice(records: list[dict]) -> IndiceBusca:
    """Índice montado uma vez por carga do catálogo (antes: SequenceMatcher em tudo, a cada busca)."""
    global _indice_cache
    if _indice_cache is None or _indice_cache[0] is not records:
        _indice_cache = (
            records,
            IndiceBusca(
                (record["id"], [*_textos_pesquisaveis(record), record["active_ingredient"]])
                for record in records
            ),
        )
    return _indice_cache[1]


def _rank(query: str, records: list[dict], limit: int) -> list[dict]:
    return rank_fuzzy_candidates(
        query,
        ((record["id"], record["name"], _record_search_aliases(record)) for record in records),
        limit=limit,
    )


async def listar_medicamentos(query: str | None, category: str | None) -> list[dict]:
    records = await _load_records()
    normalized_query = normalize_search_text(query or "")
    normalized_category = _normalize(category or "").strip()
    eligible = [
        record
        for record in records
        if (
            not normalized_category
            or normalized_category == "todos"
            or record["category_id"] == normalized_category
        )
    ]
    if not normalized_query:
        return eligible

    indice = _indice(records)
    com_trecho = indice.contem_trecho(normalized_query)
    matches = [record for record in eligible if record["id"] in com_trecho]
    if matches:
        # Nome igual ao digitado primeiro, depois nomes que começam com ele, depois o resto.
        def prioridade(record: dict) -> tuple[int, int]:
            nome = normalize_search_text(record["name"])
            if nome == normalized_query:
                return (0, len(nome))
            if nome.startswith(normalized_query):
                return (1, len(nome))
            return (2, 0)

        return sorted(matches, key=prioridade)

    # Sem trecho exato: ranking aproximado só entre os registros com palavras parecidas.
    candidatos = indice.candidatos_aproximados(normalized_query)
    elegiveis_candidatos = [record for record in eligible if record["id"] in candidatos]
    ranked = _rank(normalized_query, elegiveis_candidatos, limit=len(elegiveis_candidatos))
    records_by_id = {record["id"]: record for record in elegiveis_candidatos}
    return [records_by_id[item["id"]] for item in ranked]


def _record_search_aliases(record: dict) -> list[str]:
    aliases = [
        record["active_ingredient"],
        record["subtitle"],
        record["synonyms"],
        *record["indications"],
    ]
    for variant in record["variants"]:
        aliases.extend((variant["name"], variant["manufacturer"]))
    return [alias for alias in aliases if alias]


async def sugerir_medicamentos(query: str, limit: int = 5) -> list[dict]:
    records = await _load_records()
    candidatos = _indice(records).candidatos_aproximados(query)
    ranked = _rank(query, [record for record in records if record["id"] in candidatos], limit)
    return [{**item, "kind": "medication"} for item in ranked]


async def sugerir_indicacoes(query: str, limit: int = 5) -> list[dict]:
    records = await _load_records()
    labels = {
        normalize_search_text(indication): indication
        for record in records
        for indication in record["indications"]
        if indication
    }
    ranked = rank_fuzzy_candidates(
        query,
        (
            (label_key, label, ())
            for label_key, label in labels.items()
        ),
        limit=limit,
    )
    return [
        {**item, "id": f"indication-{item['id']}", "kind": "indication"}
        for item in ranked
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
    return next(
        (
            record
            for record in records
            if record["id"] == medication_id
            or any(variant["id"] == medication_id for variant in record["variants"])
        ),
        None,
    )
