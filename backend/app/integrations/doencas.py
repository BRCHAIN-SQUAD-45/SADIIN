"""Catálogo de doenças e sintomas (issues #43 e #46).

- Lista, categorias e busca: catálogo curado `app/data/doencas_az.py` (tópicos do "Saúde de A a Z"
  do Ministério da Saúde) + tabela oficial da CID-10. Não depende de rede.
- Sintomas, prevenção, tratamento e imagem: lidos da própria página do tópico em
  gov.br/saude/.../saude-de-a-a-z, com cache de 24 h.

As páginas do gov.br usam blocos "cover": um título <h2 class="outstanding-title"> ("Sintomas",
"Prevenção"...) seguido de blocos de texto. O leitor percorre a página em ordem e guarda cada
item de lista ou parágrafo debaixo do último título visto.
"""

import asyncio
import html
import logging
import re
import unicodedata
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx

from app.data.doencas_az import TOPICOS, TopicoAZ
from app.integrations import cid10
from app.integrations.cache import TTLCache
from app.search.fuzzy import rank_fuzzy_candidates

logger = logging.getLogger(__name__)

BASE_AZ = "https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/"
SOURCE = "Ministério da Saúde (Saúde de A a Z) / CID-10 DATASUS"
PAGE_TTL_SECONDS = 24 * 60 * 60
MAX_ITENS_SECAO = 8
MAX_CARACTERES_ITEM = 280
MAX_CARACTERES_SINTOMA_CARD = 60
USER_AGENT = "Mozilla/5.0 (compatible; SADIIN/1.0; portal de dados publicos em saude)"

_pagina_cache: TTLCache[dict] = TTLCache(PAGE_TTL_SECONDS, max_entries=256)
_slots = asyncio.Semaphore(8)

_SECOES = {
    "sintomas": ("sintoma", "sinais", "manifesta", "quadro clinico"),
    "prevencao": ("preven", "como evitar", "protecao", "proteger"),
    "tratamento": ("tratamento", "tratar", "cuidados"),
}
# Listas apresentadas assim falam de outra coisa (ex.: "quem tem mais risco de sintomas graves:").
_INTRODUCOES_DE_OUTRO_ASSUNTO = ("risco", "grupos", "documento", "apresentar")
_SUBTITULOS_DE_OUTRO_ASSUNTO = (*_INTRODUCOES_DE_OUTRO_ASSUNTO, "transmiss", "diagnost")
_CHAMADA_DE_LINK = re.compile(r"^(veja|acesse|clique|confira|saiba|leia|baixe|plataforma)\b")
_IGNORAR_TITULOS = ("voce viu", "mais informac", "leia tambem", "saiba mais", "historico", "publicac")


def _sem_acento(texto: str) -> str:
    return "".join(
        ch for ch in unicodedata.normalize("NFD", texto.casefold()) if unicodedata.category(ch) != "Mn"
    )


def _limpar(texto: str) -> str:
    texto = " ".join(html.unescape(texto).split())
    # Itens de lista do gov.br terminam com ";", "; e" ou "e": tira a pontuação da enumeração.
    texto = re.sub(r"(\s*[;,]\s*(e|ou)?|\s+(e|ou))\s*$", "", texto).strip()
    if len(texto) > MAX_CARACTERES_ITEM:
        corte = texto[:MAX_CARACTERES_ITEM].rsplit(" ", 1)[0]
        texto = corte.rstrip(",;:") + "…"
    return texto


# --- Catálogo (sem rede) ------------------------------------------------------------------


def _id(topico: TopicoAZ) -> str:
    return cid10.slugify(re.sub(r"\(.*?\)", "", topico.nome))


def _resumo(topico: TopicoAZ) -> dict:
    capitulo = cid10.capitulo(topico.cid10)
    descricao = cid10.descricao(topico.cid10) or topico.nome
    return {
        "id": _id(topico),
        "popular_name": topico.nome,
        "cid10_code": topico.cid10,
        "subtitle": f"CID-10 {topico.cid10}: {descricao}",
        "tag": capitulo.nome if capitulo else "Outras condições",
        "category_id": capitulo.slug if capitulo else "outras",
        "main_symptoms": [],
        "_topico": topico,
    }


def catalogo() -> list[dict]:
    return sorted((_resumo(t) for t in TOPICOS), key=lambda d: _sem_acento(d["popular_name"]))


def categorias() -> list[dict]:
    vistas: dict[str, str] = {}
    for doenca in catalogo():
        vistas.setdefault(doenca["category_id"], doenca["tag"])
    return [
        {"id": slug, "name": nome, "slug": slug}
        for slug, nome in sorted(vistas.items(), key=lambda item: _sem_acento(item[1]))
    ]


def _texto_busca(doenca: dict) -> str:
    topico: TopicoAZ = doenca["_topico"]
    partes = [topico.nome, *topico.sinonimos, doenca["subtitle"], doenca["tag"]]
    return _sem_acento(" ".join(partes))


def _bate_codigo(consulta: str, codigo: str) -> bool:
    """"A90", "a90" e "A92.0" batem com o código; "B16" bate com o intervalo "B15-B19"."""
    alvo = cid10.normalizar_codigo(consulta)
    if not re.fullmatch(r"[A-Z]\d{2,3}", alvo):
        return False
    if "-" in codigo:
        inicio, fim = codigo.split("-")
        return inicio <= alvo[:3] <= fim
    return cid10.normalizar_codigo(codigo).startswith(alvo) or alvo.startswith(
        cid10.normalizar_codigo(codigo)
    )


def filtrar(q: str | None = None, categoria: str | None = None) -> list[dict]:
    termo = _sem_acento(q or "").strip()
    elegiveis = [
        doenca
        for doenca in catalogo()
        if not categoria
        or categoria in ("todos", "todas")
        or doenca["category_id"] == categoria
    ]
    if not termo:
        return elegiveis

    palavras = termo.split()
    resultado = [
        doenca
        for doenca in elegiveis
        if all(palavra in _texto_busca(doenca) for palavra in palavras)
        or _bate_codigo(termo, doenca["cid10_code"])
    ]
    if resultado or re.fullmatch(r"[a-z]\d{2,3}(?:\.\d{1,2})?", termo, re.IGNORECASE):
        return resultado

    correspondencias = rank_fuzzy_candidates(
        termo,
        (
            (
                doenca["id"],
                doenca["popular_name"],
                (
                    *doenca["_topico"].sinonimos,
                    doenca["subtitle"],
                    doenca["tag"],
                ),
            )
            for doenca in elegiveis
        ),
        limit=len(elegiveis),
    )
    ids_correspondentes = [correspondencia["id"] for correspondencia in correspondencias]
    doencas_por_id = {doenca["id"]: doenca for doenca in elegiveis}
    return [doencas_por_id[doenca_id] for doenca_id in ids_correspondentes]


def por_id(doenca_id: str) -> dict | None:
    return next((d for d in catalogo() if d["id"] == doenca_id), None)


# --- Leitura da página do gov.br ----------------------------------------------------------


class _LeitorPagina(HTMLParser):
    """Junta parágrafos e itens de lista dentro de <main>, agrupados pelo último título."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.dentro_main = 0
        self.titulo_atual = ""
        self.capturando: str | None = None  # "titulo", "li" ou "p"
        self.buffer: list[str] = []
        self.blocos: list[tuple[str, str, str]] = []  # (titulo, tipo, texto)
        self.og_image: str | None = None
        self.descricao: str | None = None
        self.profundidade_li = 0

    def handle_starttag(self, tag, attrs):
        atributos = dict(attrs)
        if tag == "meta":
            if atributos.get("property") == "og:image":
                self.og_image = atributos.get("content")
            if atributos.get("name") == "description":
                self.descricao = atributos.get("content")
        if tag == "main":
            self.dentro_main += 1
        if not self.dentro_main:
            return
        if tag in ("h2", "h3", "h4"):
            self._fechar()
            self.capturando, self.buffer = "titulo", []
        elif tag == "li":
            self.profundidade_li += 1
            if self.profundidade_li == 1:
                self._fechar()
                self.capturando, self.buffer = "li", []
        elif tag == "p" and self.capturando not in ("li", "titulo"):
            self._fechar()
            self.capturando, self.buffer = "p", []

    def handle_endtag(self, tag):
        if tag == "main" and self.dentro_main:
            self._fechar()
            self.dentro_main -= 1
            return
        if not self.dentro_main:
            return
        if tag in ("h2", "h3", "h4") and self.capturando == "titulo":
            self.titulo_atual = _limpar("".join(self.buffer))
            self.capturando, self.buffer = None, []
        elif tag == "li":
            self.profundidade_li = max(0, self.profundidade_li - 1)
            if self.profundidade_li == 0 and self.capturando == "li":
                self._fechar()
        elif tag == "p" and self.capturando == "p":
            self._fechar()

    def handle_data(self, data):
        if self.dentro_main and self.capturando:
            self.buffer.append(data)

    def _fechar(self):
        if self.capturando in ("li", "p"):
            texto = _limpar("".join(self.buffer))
            if len(texto) >= 3:
                self.blocos.append((self.titulo_atual, self.capturando, texto))
        self.capturando, self.buffer = None, []


def _eh_subtitulo(texto: str) -> bool:
    return len(texto) <= 60 and not texto.endswith((".", ":", ";", "!", "?"))


def _secao_do_titulo(titulo: str) -> str | None:
    t = _sem_acento(titulo)
    if any(i in t for i in _IGNORAR_TITULOS):
        return None
    for secao, termos in _SECOES.items():
        if any(termo in t for termo in termos):
            return secao
    return None


def _eh_gov_br(url: str | None) -> bool:
    if not url:
        return False
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    return parsed.scheme == "https" and (host == "gov.br" or host.endswith(".gov.br"))


def ler_pagina(conteudo_html: str) -> dict:
    """Extrai sintomas, prevenção, tratamento, resumo e imagem de uma página do Saúde de A a Z."""
    leitor = _LeitorPagina()
    leitor.feed(conteudo_html)
    leitor.close()

    blocos_por_secao: dict[str, list[tuple[str, str]]] = {s: [] for s in _SECOES}
    resumo: list[str] = []
    for titulo, tipo, texto in leitor.blocos:
        secao = _secao_do_titulo(titulo) if titulo else None
        if secao:
            blocos_por_secao[secao].append((tipo, texto))
        elif not titulo and tipo == "p":
            resumo.append(texto)

    def itens(secao: str) -> list[str]:
        """Itens de lista que pertencem ao assunto da seção; sem eles, os parágrafos.

        Uma lista só vale se abrir a seção ou se o parágrafo logo antes dela citar o assunto
        ("Os principais sintomas são:"). Assim não entram listas de outro assunto dentro da
        mesma seção (ex.: fatores de risco da covid, documentos da Farmácia Popular).
        """
        termos = _SECOES[secao]
        blocos = blocos_por_secao[secao]
        listas: list[str] = []
        paragrafos: list[str] = []
        lista_valida = False
        subtopico_valido = True
        anterior: tuple[str, str] | None = None
        for tipo, texto in blocos:
            if tipo == "p" and _eh_subtitulo(texto):
                # Parágrafo curto servindo de subtítulo: se for claramente de outro assunto
                # ("Grupos de riscos", "Transmissão"), o que vem depois não entra na seção.
                normalizado = _sem_acento(texto)
                if any(t in normalizado for t in _SUBTITULOS_DE_OUTRO_ASSUNTO):
                    subtopico_valido = False
                    anterior = None
                    continue
                # Curto e do assunto (ex.: "Febre à tarde"): é item da seção, não subtítulo.
                subtopico_valido = True
            if not subtopico_valido:
                continue
            if tipo == "li":
                if anterior is None or anterior[0] == "li":
                    lista_valida = lista_valida if anterior else True
                else:
                    introducao = _sem_acento(anterior[1])
                    lista_valida = any(t in introducao for t in termos) and not any(
                        t in introducao for t in _INTRODUCOES_DE_OUTRO_ASSUNTO
                    )
                if lista_valida:
                    listas.append(texto)
            else:
                lista_valida = False
                paragrafos.append(texto)
            anterior = (tipo, texto)
        escolhidos = listas or [p for p in paragrafos if not p.endswith(":")]
        # Fora chamadas de link ("Veja quais são...", "Acesse o guia"), que não são conteúdo.
        escolhidos = [e for e in escolhidos if not _CHAMADA_DE_LINK.match(_sem_acento(e))]
        return list(dict.fromkeys(escolhidos))[:MAX_ITENS_SECAO]

    descricao = leitor.descricao or ""
    if "saude de a a z" in _sem_acento(descricao) or not descricao.strip():
        descricao = resumo[0] if resumo else ""
    return {
        "main_symptoms": itens("sintomas"),
        "prevention": itens("prevencao"),
        "treatment": itens("tratamento"),
        "summary": _limpar(descricao) if descricao else None,
        # Só foto do próprio tópico: sem ela o gov.br manda o logo genérico (/saude/logo.png).
        "image_url": leitor.og_image
        if _eh_gov_br(leitor.og_image) and "/saude-de-a-a-z/" in (leitor.og_image or "")
        else None,
    }


async def _baixar_pagina(topico: TopicoAZ) -> dict:
    url = BASE_AZ + topico.caminho

    async def load() -> dict:
        async with _slots:
            async with httpx.AsyncClient(
                timeout=15.0,
                follow_redirects=True,
                headers={"User-Agent": USER_AGENT, "Accept-Language": "pt-BR"},
            ) as client:
                response = await client.get(url)
                response.raise_for_status()
        return ler_pagina(response.text)

    return await _pagina_cache.get_or_load(url, load)


async def conteudo_da_pagina(topico: TopicoAZ) -> dict | None:
    """Conteúdo da página oficial ou None se o gov.br falhar (o catálogo continua funcionando)."""
    try:
        return await _baixar_pagina(topico)
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Falha ao ler %s no Saúde de A a Z: %s", topico.caminho, exc)
        return None


# --- Saída no formato do contrato --------------------------------------------------------


def _publico(doenca: dict) -> dict:
    return {k: v for k, v in doenca.items() if not k.startswith("_")}


async def enriquecer_lista(doencas: list[dict]) -> list[dict]:
    """Preenche sintomas e imagem dos itens da página (consultas em paralelo, com cache)."""
    paginas = await asyncio.gather(*(conteudo_da_pagina(d["_topico"]) for d in doencas))
    saida = []
    for doenca, pagina in zip(doencas, paginas):
        item = _publico(doenca)
        if pagina:
            # No card só cabem sintomas curtos ("Febre alta"); parágrafos ficam para a página da doença.
            curtos = [s for s in pagina["main_symptoms"] if len(s) <= MAX_CARACTERES_SINTOMA_CARD]
            item["main_symptoms"] = curtos[:3]
            if pagina["image_url"]:
                item["image_url"] = pagina["image_url"]
                item["image_alt"] = ""
        saida.append(item)
    return saida


async def detalhe(doenca: dict) -> dict:
    pagina = await conteudo_da_pagina(doenca["_topico"])
    item = _publico(doenca)
    item["prevention"] = []
    item["treatment"] = []
    item["source_url"] = BASE_AZ + doenca["_topico"].caminho
    if pagina:
        item["main_symptoms"] = pagina["main_symptoms"]
        item["prevention"] = pagina["prevention"]
        item["treatment"] = pagina["treatment"]
        if pagina["image_url"]:
            item["image_url"] = pagina["image_url"]
            item["image_alt"] = ""
    item["meta"] = {
        "source": SOURCE,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "is_estimate": False,
        # Sem a página do gov.br, só os dados da CID-10 (sem sintomas/prevenção/tratamento).
        "is_stale": pagina is None,
    }
    return item
