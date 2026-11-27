import asyncio
import logging
import math
import re
import time
from datetime import datetime, timezone
import json

from app.database.connection import conectar_banco

from app.integrations.cnes import CnesConector
from app.integrations.ibge import IbgeConector

CNES_UNIT_TYPES = (1, 2, 15, 20)
CNES_PAGE_LIMIT = 20
CNES_SOURCE = "CNES - Ministério da Saúde"
CNES_MAX_PAGES_PER_TYPE = 100
UNIT_CACHE_TTL_SECONDS = 15 * 60
logger = logging.getLogger(__name__)
_municipality_cache: dict[str, tuple[float, dict[str, str], list[dict]]] = {}
_municipality_cache_locks: dict[str, asyncio.Lock] = {}


def _ler_cache_postgres(codigo_ibge: str, *, expired: bool = False):
    """Lê o snapshot persistido e migra suas coordenadas para a tabela própria."""
    try:
        with conectar_banco() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS ubs_cache_municipio (
                        city_ibge VARCHAR(7) PRIMARY KEY,
                        city_data JSONB NOT NULL,
                        units_data JSONB NOT NULL,
                        fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        expires_at TIMESTAMPTZ NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    SELECT city_data, units_data
                    FROM ubs_cache_municipio
                    WHERE city_ibge = %s """ + ("" if expired else "AND expires_at > NOW()") + """
                    """,
                    (codigo_ibge,),
                )
                row = cur.fetchone()
        if not row:
            return None
        city_data, units_data = row
        if isinstance(city_data, str):
            city_data = json.loads(city_data)
        if isinstance(units_data, str):
            units_data = json.loads(units_data)
        return city_data, units_data
    except Exception as exc:
        logger.warning("Cache PostgreSQL de UBS indisponível para %s: %s", codigo_ibge, exc)
        return None


def _salvar_cache_postgres(codigo_ibge: str, city: dict, units: list[dict]) -> None:
    """Persiste os estabelecimentos SUS por código IBGE do município (TTL de 15 min)."""
    try:
        with conectar_banco() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS ubs_cache_municipio (
                        city_ibge VARCHAR(7) PRIMARY KEY,
                        city_data JSONB NOT NULL,
                        units_data JSONB NOT NULL,
                        fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        expires_at TIMESTAMPTZ NOT NULL
                    )
                    """
                )
                cur.execute(
                    """
                    INSERT INTO ubs_cache_municipio
                        (city_ibge, city_data, units_data, fetched_at, expires_at)
                    VALUES (%s, %s::jsonb, %s::jsonb, NOW(), NOW() + (%s * INTERVAL '1 second'))
                    ON CONFLICT (city_ibge) DO UPDATE SET
                        city_data = EXCLUDED.city_data,
                        units_data = EXCLUDED.units_data,
                        fetched_at = NOW(),
                        expires_at = EXCLUDED.expires_at
                    """,
                    (codigo_ibge, json.dumps(city, ensure_ascii=False), json.dumps(units, ensure_ascii=False), UNIT_CACHE_TTL_SECONDS),
                )
                # Mantém uma tabela própria com as coordenadas oficiais por CNES.
                # O UPSERT atualiza a posição sem criar duplicatas e preserva o último
                # ponto conhecido quando a fonte temporariamente vier sem coordenadas.
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS ubs_geolocalizacao (
                        cnes VARCHAR(20) PRIMARY KEY,
                        city_ibge VARCHAR(7) NOT NULL,
                        latitude NUMERIC(9, 6),
                        longitude NUMERIC(9, 6),
                        fonte VARCHAR(80) NOT NULL DEFAULT 'CNES - Ministério da Saúde',
                        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        CONSTRAINT chk_ubs_geo_latitude
                            CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
                        CONSTRAINT chk_ubs_geo_longitude
                            CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
                    )
                    """
                )
                coordenadas = [
                    (
                        str(unit.get("cnes")),
                        codigo_ibge,
                        unit.get("latitude"),
                        unit.get("longitude"),
                    )
                    for unit in units
                    if unit.get("cnes")
                    and unit.get("latitude") is not None
                    and unit.get("longitude") is not None
                ]
                if coordenadas:
                    cur.executemany(
                        """
                        INSERT INTO ubs_geolocalizacao
                            (cnes, city_ibge, latitude, longitude, fonte, atualizado_em)
                        VALUES (%s, %s, %s, %s, 'CNES - Ministério da Saúde', NOW())
                        ON CONFLICT (cnes) DO UPDATE SET
                            city_ibge = EXCLUDED.city_ibge,
                            latitude = EXCLUDED.latitude,
                            longitude = EXCLUDED.longitude,
                            fonte = EXCLUDED.fonte,
                            atualizado_em = NOW()
                        """,
                        coordenadas,
                    )
    except Exception as exc:
        # A aplicação continua funcionando sem persistência quando DATABASE_URL não está configurada.
        logger.warning("Não foi possível persistir cache de UBS para %s: %s", codigo_ibge, exc)


async def buscar_unidades_municipais(
    codigo_ibge: str, limit: int, offset: int
) -> tuple[dict[str, str], list[dict]]:
    """Retorna uma página a partir do cache municipal completo."""
    city, units = await buscar_todas_unidades_municipais(codigo_ibge)
    return city, units[offset : offset + limit]


async def buscar_todas_unidades_municipais(codigo_ibge: str) -> tuple[dict[str, str], list[dict]]:
    code = str(codigo_ibge).strip()
    if not re.fullmatch(r"\d{7}", code):
        raise ValueError("O código IBGE do município deve conter exatamente 7 dígitos.")
    now = time.monotonic()
    cached = _municipality_cache.get(code)
    if cached and cached[0] > now:
        return cached[1], cached[2]

    persisted = await asyncio.to_thread(_ler_cache_postgres, code)
    if persisted is not None:
        city, units = persisted
        _municipality_cache[code] = (time.monotonic() + UNIT_CACHE_TTL_SECONDS, city, units)
        return city, units

    async with _municipality_cache_locks.setdefault(code, asyncio.Lock()):
        now = time.monotonic()
        cached = _municipality_cache.get(code)
        if cached and cached[0] > now:
            return cached[1], cached[2]

        persisted = await asyncio.to_thread(_ler_cache_postgres, code)
        if persisted is not None:
            city, units = persisted
            _municipality_cache[code] = (time.monotonic() + UNIT_CACHE_TTL_SECONDS, city, units)
            return city, units

        try:
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
        except Exception:
            stale = await asyncio.to_thread(_ler_cache_postgres, code, expired=True)
            if stale is None and cached:
                stale = (cached[1], cached[2])
            if stale is None:
                raise
            logger.warning("Usando cache anterior de UBS para %s", code)
            return stale
        _municipality_cache[code] = (
            time.monotonic() + UNIT_CACHE_TTL_SECONDS,
            city,
            sus_units,
        )
        await asyncio.to_thread(_salvar_cache_postgres, code, city, sus_units)
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
    if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)) or not (-34 <= lat <= 6 and -74 <= lng <= -28):
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
        "kind": "ubs" if eh_unidade_basica(unit) else unidade_tipo(unit.get("id_tipo_unidade")),
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