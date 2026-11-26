"""Notícias oficiais do Ministério da Saúde para o carrossel da Home (issue #57).

Fonte: portal gov.br/saude (Plone). A busca `search_rss` devolve as notícias mais recentes
(tipo "collective.nitf.content") JÁ ORDENADAS por data, com título, resumo, data, link e
assuntos. A imagem de capa não vem no feed: é lida da tag `og:image` da própria notícia.

Fontes avaliadas e descartadas:
- `/assuntos/noticias/RSS`: lista as pastas de ano (2014, 2015...), não as notícias.
- `/assuntos/noticias/{ano}/{mes}/RSS`: fora de ordem e limitado a 15 itens (pode omitir as
  mais recentes).
- `/saude/pt-br/RSS`: mistura notícias com arquivos e imagens.

Conteúdo do gov.br é público e exige atribuição: cada item leva `source_label` e o link oficial.
"""

import asyncio
import hashlib
import logging
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
from xml.etree import ElementTree

import httpx

from app.integrations.cache import TTLCache

logger = logging.getLogger(__name__)

FEED_URL = "https://www.gov.br/saude/search_rss"
FEED_PARAMS = {
    "portal_type": "collective.nitf.content",
    "sort_on": "effective",
    "sort_order": "reverse",
}
SOURCE_LABEL = "Ministério da Saúde"
FEED_TTL_SECONDS = 15 * 60
IMAGE_TTL_SECONDS = 6 * 60 * 60
USER_AGENT = "Mozilla/5.0 (compatible; SADIIN/1.0; portal de dados publicos em saude)"

_NS = {
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "rss": "http://purl.org/rss/1.0/",
    "dc": "http://purl.org/dc/elements/1.1/",
}

_feed_cache: TTLCache[list[dict]] = TTLCache(FEED_TTL_SECONDS, max_entries=4)
_image_cache: TTLCache[str | None] = TTLCache(IMAGE_TTL_SECONDS, max_entries=512)
# Última leitura boa do feed: servida se o gov.br estiver fora do ar.
_last_good_feed: list[dict] = []

UF_NOMES = {
    "AC": "Acre", "AL": "Alagoas", "AP": "Amapá", "AM": "Amazonas", "BA": "Bahia",
    "CE": "Ceará", "DF": "Distrito Federal", "ES": "Espírito Santo", "GO": "Goiás",
    "MA": "Maranhão", "MT": "Mato Grosso", "MS": "Mato Grosso do Sul", "MG": "Minas Gerais",
    "PA": "Pará", "PB": "Paraíba", "PR": "Paraná", "PE": "Pernambuco", "PI": "Piauí",
    "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte", "RS": "Rio Grande do Sul",
    "RO": "Rondônia", "RR": "Roraima", "SC": "Santa Catarina", "SP": "São Paulo",
    "SE": "Sergipe", "TO": "Tocantins",
}

# Categorias do protótipo, na ordem de prioridade.
_CATEGORIAS: list[tuple[str, tuple[str, ...]]] = [
    # Sem "vigilância": é o nome da Secretaria de Vigilância em Saúde e Ambiente, que marca
    # todas as notícias dela (até as que não são alerta).
    ("ALERTA DE SAÚDE", (
        "alerta", "surto", "epidem", "emergencia em saude", "emergenciais", "forca nacional do sus",
        "dengue", "chikungunya", "zika", "arbovir", "mpox", "sarampo", "febre amarela", "covid",
        "influenza", "desastre", "enchente", "inundac", "calamidade",
    )),
    ("VACINAÇÃO", ("vacin", "imuniz", "dose", "pni")),
    ("ATENÇÃO PRIMÁRIA", (
        "atencao primaria", "ubs", "unidade basica", "saude da familia", "agente comunitario",
        "mais medicos", "atencao basica",
    )),
    ("SERVIÇOS", (
        "meu sus digital", "farmacia popular", "samu", "teleatendimento", "telessaude",
        "agendamento", "medicamento", "exame", "cirurgia", "atendimento",
    )),
]
CATEGORIA_PADRAO = "MINISTÉRIO DA SAÚDE"

_DATA_PLONE = re.compile(
    r"^(\d{4})/(\d{2})/(\d{2}) (\d{2}):(\d{2}):(\d{2}) GMT([+-]\d{1,2})(?::?(\d{2}))?$"
)
_OG_IMAGE = re.compile(
    r"<meta[^>]+property=[\"']og:image[\"'][^>]+content=[\"']([^\"']+)[\"']"
    r"|<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+property=[\"']og:image[\"']",
    re.IGNORECASE,
)


def _sem_acento(texto: str) -> str:
    return "".join(
        ch for ch in unicodedata.normalize("NFD", texto.casefold()) if unicodedata.category(ch) != "Mn"
    )


def _eh_gov_br(url: str | None) -> bool:
    """Só aceitamos links e imagens servidos pelo próprio gov.br, via HTTPS."""
    if not url:
        return False
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    return parsed.scheme == "https" and (host == "gov.br" or host.endswith(".gov.br"))


def parse_data_plone(valor: str | None) -> datetime | None:
    """`"2026/11/25 17:38:55 GMT-3"` -> datetime com fuso; também aceita ISO-8601."""
    if not valor:
        return None
    texto = valor.strip()
    match = _DATA_PLONE.match(texto)
    if match:
        ano, mes, dia, hh, mm, ss, offset_h, offset_m = match.groups()
        horas = int(offset_h)
        minutos = int(offset_m or 0) * (1 if horas >= 0 else -1)
        fuso = timezone(timedelta(hours=horas, minutes=minutos))
        return datetime(int(ano), int(mes), int(dia), int(hh), int(mm), int(ss), tzinfo=fuso)
    try:
        parsed = datetime.fromisoformat(texto.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def classificar_categoria(titulo: str, resumo: str, assuntos: list[str]) -> str:
    texto = _sem_acento(" ".join([titulo, resumo, *assuntos]))
    for categoria, termos in _CATEGORIAS:
        # Casa no início de palavra: "vacin" pega "vacina"/"vacinação", mas "ubs" não pega "substituição".
        if any(re.search(rf"\b{re.escape(termo)}", texto) for termo in termos):
            return categoria
    return CATEGORIA_PADRAO


def parse_feed(xml: str) -> list[dict]:
    """Converte o RDF/RSS 1.0 do Plone em notícias (sem imagem ainda)."""
    root = ElementTree.fromstring(xml)
    noticias = []
    for item in root.findall("rss:item", _NS):
        titulo = (item.findtext("rss:title", default="", namespaces=_NS) or "").strip()
        link = (item.findtext("rss:link", default="", namespaces=_NS) or "").strip()
        resumo = " ".join((item.findtext("rss:description", default="", namespaces=_NS) or "").split())
        publicada = parse_data_plone(item.findtext("dc:date", default="", namespaces=_NS))
        assuntos = [
            (s.text or "").strip() for s in item.findall("dc:subject", _NS) if (s.text or "").strip()
        ]
        if not titulo or not _eh_gov_br(link) or publicada is None:
            continue
        noticias.append(
            {
                "id": hashlib.sha1(link.encode("utf-8")).hexdigest()[:16],
                "category": classificar_categoria(titulo, resumo, assuntos),
                "title": titulo,
                "summary": resumo or None,
                "published_at": publicada.isoformat(),
                "source_label": SOURCE_LABEL,
                "url": link,
                "_subjects": assuntos,
            }
        )
    return noticias


def extrair_og_image(html: str) -> str | None:
    match = _OG_IMAGE.search(html)
    if not match:
        return None
    url = (match.group(1) or match.group(2) or "").strip()
    return url if _eh_gov_br(url) else None


def _novo_cliente() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=15.0,
        follow_redirects=True,
        headers={"User-Agent": USER_AGENT, "Accept-Language": "pt-BR"},
    )


async def _carregar_feed() -> list[dict]:
    async with _novo_cliente() as client:
        response = await client.get(FEED_URL, params=FEED_PARAMS)
        response.raise_for_status()
    noticias = parse_feed(response.text)
    if not noticias:
        raise ValueError("Feed de notícias do Ministério da Saúde veio vazio.")
    return noticias


async def buscar_feed() -> tuple[list[dict], bool]:
    """Notícias do feed e se vieram da última cópia boa (gov.br fora do ar)."""
    global _last_good_feed
    try:
        noticias = await _feed_cache.get_or_load("feed", _carregar_feed)
    except (httpx.HTTPError, ElementTree.ParseError, ValueError) as exc:
        if _last_good_feed:
            logger.warning("Feed gov.br indisponível, servindo última cópia: %s", exc)
            return _last_good_feed, True
        raise
    _last_good_feed = noticias
    return noticias, False


async def _buscar_imagem(client: httpx.AsyncClient, url: str) -> str | None:
    async def load() -> str | None:
        try:
            response = await client.get(url)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.info("Sem imagem de capa para %s: %s", url, exc)
            return None
        return extrair_og_image(response.text)

    return await _image_cache.get_or_load(url, load)


def _menciona_uf(noticia: dict, uf: str | None) -> bool:
    """Heurística leve: cita o nome do estado ou a sigla entre parênteses, ex.: "(RS)".

    As notícias costumam citar só a cidade, então nem sempre dispara; quando não dispara,
    a ordem é a do Ministério (mais recentes primeiro).
    """
    sigla = (uf or "").upper()
    nome = UF_NOMES.get(sigla)
    if not nome:
        return False
    original = " ".join([noticia["title"], noticia.get("summary") or "", *noticia["_subjects"]])
    if re.search(rf"\(\s*{sigla}\s*\)", original):
        return True
    # COM acento: sem ele "Pará" viraria "para", que aparece em quase toda notícia.
    return re.search(rf"\b{re.escape(nome.casefold())}\b", original.casefold()) is not None


async def noticias_para_home(limit: int = 4, uf: str | None = None) -> tuple[dict, bool]:
    """Payload `{featured, items}` do contrato, com `limit` notícias no total.

    O feed é nacional. Quando há UF selecionada, notícias que citam o estado sobem para
    o topo (mantendo a ordem por data dentro de cada grupo).
    """
    noticias, stale = await buscar_feed()
    ordenadas = sorted(
        noticias,
        key=lambda n: (not _menciona_uf(n, uf), -datetime.fromisoformat(n["published_at"]).timestamp()),
    )
    selecionadas = [dict(n) for n in ordenadas[:limit]]

    async with _novo_cliente() as client:
        imagens = await asyncio.gather(*(_buscar_imagem(client, n["url"]) for n in selecionadas))
    for noticia, imagem in zip(selecionadas, imagens):
        noticia.pop("_subjects", None)
        if imagem:
            noticia["image_url"] = imagem
        if noticia.get("summary") is None:
            noticia.pop("summary")

    # Destaque: a primeira que tem imagem (o card grande precisa de foto).
    destaque_idx = next((i for i, n in enumerate(selecionadas) if n.get("image_url")), 0)
    destaque = selecionadas.pop(destaque_idx) if selecionadas else None
    return {"featured": destaque, "items": selecionadas}, stale
