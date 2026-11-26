import logging
import re

from app.integrations.cnes_resources import buscar_recurso_cnes_com_competencia

MAX_COMPETENCE_LOOKBACK = 24
logger = logging.getLogger(__name__)


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
    """Serviços especializados SUS da competência mais recente (até 24 meses).

    Usa a busca paralela com cache de `cnes_resources` (issue #62): antes as competências
    eram consultadas uma a uma, com um lock global que fazia uma UBS esperar a outra.
    """
    code = cnes.strip()
    if not code.isdigit():
        raise ValueError("O código CNES deve conter apenas dígitos.")

    competence, rows = await buscar_recurso_cnes_com_competencia(
        code, "services", lookback_months=MAX_COMPETENCE_LOOKBACK
    )
    if competence is None:
        logger.info("Nenhum serviço CNES encontrado para %s nas competências consultadas", code)
        return []
    return [
        service
        for row in rows
        if str(row.get("ds_serv_amb_sus", "")).upper() == "SIM"
        or str(row.get("ds_serv_hosp_sus", "")).upper() == "SIM"
        if (service := _normalize_service(row, competence)) is not None
    ]
