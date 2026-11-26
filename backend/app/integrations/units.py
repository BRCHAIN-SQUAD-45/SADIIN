import asyncio
import logging
import math
import re
import time
from datetime import datetime, timezone

from app.integrations.cnes import CnesConector
from app.integrations.ibge import IbgeConector

CNES_UNIT_TYPES = (1, 2, 15, 20)
CNES_PAGE_LIMIT = 20
CNES_SOURCE = "CNES - Ministério da Saúde"
CNES_MAX_PAGES_PER_TYPE = 100
UNIT_CACHE_TTL_SECONDS = 15 * 60
logger = logging.getLogger(__name__)
_municipality_cache: dict[str, tuple[float, dict[str, str], list[dict]]] = {}
_municipality_cache_lock = asyncio.Lock()


async def buscar_unidades_municipais(
    codigo_ibge: str, limit: int, offset: int
) -> tuple[dict[str, str], list[dict]]:
    async with IbgeConector() as ibge:
        city = await ibge.buscar_municipio(codigo_ibge)
    async with CnesConector() as cnes:
        pages = await asyncio.gather(
            *(
                cnes.buscar_unidades_por_municipio(
                    codigo_ibge,
                    tipo_unidade=unit_type,
                    limit=limit,
                    offset=offset,
                )
                for unit_type in CNES_UNIT_TYPES
            )
        )
    units = [unit for page in pages for unit in page]
    return city, [
        unit
        for unit in units
        if unit.get("ativo") and str(unit.get("atende_sus", "")).upper() == "SIM"
    ]


async def buscar_todas_unidades_municipais(codigo_ibge: str) -> tuple[dict[str, str], list[dict]]:
    code = codigo_ibge.strip()
    now = time.monotonic()
    cached = _municipality_cache.get(code)
    if cached and cached[0] > now:
        return cached[1], cached[2]

    async with _municipality_cache_lock:
        now = time.monotonic()
        cached = _municipality_cache.get(code)
        if cached and cached[0] > now:
            return cached[1], cached[2]

        async with IbgeConector() as ibge:
            city = await ibge.buscar_municipio(code)
        async with CnesConector() as cnes:
            async def fetch_unit_type(unit_type: int) -> list[dict]:
                records: list[dict] = []
                for page_number in range(CNES_MAX_PAGES_PER_TYPE):
                    page = await cnes.buscar_unidades_por_municipio(
                        code,
                        tipo_unidade=unit_type,
                        limit=CNES_PAGE_LIMIT,
                        offset=page_number * CNES_PAGE_LIMIT,
                    )
                    records.extend(page)
                    if len(page) < CNES_PAGE_LIMIT:
                        break
                else:
                    logger.warning(
                        "Limite de páginas CNES atingido para município %s e tipo %s",
                        code,
                        unit_type,
                    )
                return records

            pages = await asyncio.gather(*(fetch_unit_type(unit_type) for unit_type in CNES_UNIT_TYPES))

        units = [unit for page in pages for unit in page]
        sus_units = [
            unit
            for unit in units
            if unit.get("ativo") and str(unit.get("atende_sus", "")).upper() == "SIM"
        ]
        _municipality_cache[code] = (
            time.monotonic() + UNIT_CACHE_TTL_SECONDS,
            city,
            sus_units,
        )
        return city, sus_units


def unidade_endereco(unit: dict) -> str:
    street = " ".join(
        part.strip()
        for part in (unit.get("endereco"), unit.get("numero"))
        if isinstance(part, str) and part.strip()
    )
    neighborhood = unit.get("bairro")
    return f"{street}, {neighborhood}" if street and neighborhood else street or neighborhood or "Endereço não informado"


# --- Nomes legíveis (issue #62) ------------------------------------------------------
# O CNES publica nome_fantasia em MAIÚSCULAS e sem acento ("UBS JARDIM ICARAI DR DANIEL").

# Siglas que continuam em maiúsculas.
_SIGLAS = {
    "UBS", "UBSF", "AMA", "AME", "USF", "ESF", "UPA", "CAPS", "CAPSI", "CAPSAD", "AD",
    "CEO", "SAE", "CTA", "CER", "CRST", "NASF", "SUS", "SAMU", "UTI", "PS", "PA", "HU",
    "IST", "DST", "HIV", "AIDS", "CRI", "NIR", "SP", "RJ", "MG", "DF", "CS", "PSF", "UNIFESP", "USP",
}
# Conectivos em minúsculas (exceto no início do nome).
_CONECTIVOS = {"de", "da", "do", "das", "dos", "e", "em", "na", "no", "nas", "nos", "a", "o", "d"}
# Títulos abreviados.
_TITULOS = {"DR": "Dr.", "DRA": "Dra.", "PROF": "Prof.", "PROFA": "Profa.", "STA": "Sta.", "STO": "Sto."}
# Acentos das palavras mais comuns nos nomes de unidades (o CNES remove os acentos).
_ACENTOS = {
    "SAUDE": "Saúde", "BASICA": "Básica", "FAMILIA": "Família", "ATENCAO": "Atenção",
    "ASSISTENCIA": "Assistência", "MEDICA": "Médica", "MEDICO": "Médico", "CLINICA": "Clínica",
    "URGENCIA": "Urgência", "EMERGENCIA": "Emergência", "AMBULATORIO": "Ambulatório",
    "ODONTOLOGICO": "Odontológico", "ODONTOLOGICA": "Odontológica", "PSICOSSOCIAL": "Psicossocial",
    "ESPECIALIDADES": "Especialidades", "REABILITACAO": "Reabilitação", "MAE": "Mãe",
    "CRIANCA": "Criança", "SAO": "São", "JOAO": "João", "JOSE": "José", "ANTONIO": "Antônio",
    "CONCEICAO": "Conceição", "ESPERANCA": "Esperança", "PAZ": "Paz", "VILA": "Vila",
    "MUNICIPIO": "Município", "PUBLICA": "Pública", "PUBLICO": "Público", "REGIAO": "Região",
    "UNIAO": "União", "PRONTO": "Pronto", "ATENDIMENTO": "Atendimento",
}
_ROMANOS = re.compile(r"^(I{1,3}|IV|VI{0,3}|IX|XI{0,3}|XIV|XV)$")


def _palavra_legivel(palavra: str, primeira: bool) -> str:
    if not palavra:
        return palavra
    upper = palavra.upper()
    if upper in _SIGLAS or _ROMANOS.match(upper) or any(ch.isdigit() for ch in palavra):
        return upper
    if upper in _TITULOS:
        return _TITULOS[upper]
    if upper in _ACENTOS:
        return _ACENTOS[upper]
    lower = palavra.lower()
    if not primeira and lower in _CONECTIVOS:
        return lower
    return lower[:1].upper() + lower[1:]


def formatar_nome_unidade(nome: str | None) -> str:
    """`"UBS JARDIM ICARAI DR DANIEL"` -> `"UBS Jardim Icarai Dr. Daniel"`.

    Mantém siglas (UBS, AMA, USF, CAPS...) e números romanos, deixa conectivos
    (de, da, do...) em minúsculas e recoloca acentos de palavras comuns.
    """
    texto = " ".join(str(nome or "").split())
    if not texto:
        return ""
    palavras = texto.split(" ")
    resultado = []
    for i, palavra in enumerate(palavras):
        # Partes com hífen/barra são tratadas separadamente ("SANTA CECILIA-NORTE").
        partes = re.split(r"([-/])", palavra)
        resultado.append(
            "".join(
                parte if parte in {"-", "/"} else _palavra_legivel(parte, primeira=(i == 0 and j == 0))
                for j, parte in enumerate(partes)
            )
        )
    return " ".join(resultado)


def nome_unidade(unit: dict) -> str:
    return formatar_nome_unidade(unit.get("nome_fantasia") or unit.get("razao_social")) or "Estabelecimento CNES"


# Tipos CNES de atenção básica: 1 = posto de saúde, 2 = centro de saúde/unidade básica.
_TIPOS_BASICOS = {1, 2}
_PREFIXOS_BASICOS = re.compile(r"^(UBS|UBSF|AMA|USF|ESF|PSF|POSTO DE SAUDE|CENTRO DE SAUDE)\b")


def eh_unidade_basica(unit: dict) -> bool:
    """UBS/AMA/USF e afins vêm primeiro nas listagens (porta de entrada do SUS)."""
    if unit.get("id_tipo_unidade") in _TIPOS_BASICOS:
        return True
    nome = str(unit.get("nome_fantasia") or unit.get("razao_social") or "").upper().strip()
    return bool(_PREFIXOS_BASICOS.match(nome))


def unidade_tipo(tipo_unidade: int | None) -> str:
    if tipo_unidade in {1, 2, 15}:
        return "ubs"
    if tipo_unidade in {4, 5}:
        return "hospital"
    return "other"


def unidade_resumo(
    unit: dict, city: dict[str, str], distance_m: int | None = None
) -> dict | None:
    lat, lng = unit.get("latitude"), unit.get("longitude")
    if lat is None or lng is None:
        return None
    summary = {
        "cnes_code": unit["cnes"],
        "name": nome_unidade(unit),
        "address": unidade_endereco(unit),
        "city": city["name"],
        "uf": city["uf"],
        "lat": lat,
        "lng": lng,
        "phone": unit.get("telefone"),
        "is_open": None,
        "kind": unidade_tipo(unit.get("id_tipo_unidade")),
    }
    if distance_m is not None:
        summary["distance_m"] = distance_m
    return summary


def distancia_metros(lat: float, lng: float, target_lat: float, target_lng: float) -> int:
    earth_radius_m = 6_371_000
    lat1, lat2 = math.radians(lat), math.radians(target_lat)
    delta_lat = math.radians(target_lat - lat)
    delta_lng = math.radians(target_lng - lng)
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lng / 2) ** 2
    return round(earth_radius_m * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def metadados_cnes() -> dict[str, str | bool]:
    return {
        "source": CNES_SOURCE,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "is_estimate": False,
        "is_stale": False,
    }