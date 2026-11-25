"""Issue #57: GET /news com o feed oficial do Ministério da Saúde (gov.br/saude)."""

import asyncio
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from fastapi.testclient import TestClient

from app.integrations import noticias
from app.main import app

# Trecho no mesmo formato do search_rss real do gov.br (RDF / RSS 1.0 do Plone).
FEED = """<?xml version="1.0" encoding="utf-8" ?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:dc="http://purl.org/dc/elements/1.1/"
         xmlns="http://purl.org/rss/1.0/">
  <channel rdf:about="https://www.gov.br/saude"><title>Saúde</title></channel>
  <item rdf:about="https://www.gov.br/saude/pt-br/assuntos/noticias/2026/novembro/vacina-gripe">
    <title>Ministério amplia vacinação contra a gripe</title>
    <link>https://www.gov.br/saude/pt-br/assuntos/noticias/2026/novembro/vacina-gripe</link>
    <description>Doses chegam a todos os estados   nesta semana.</description>
    <dc:subject>imunização</dc:subject>
    <dc:date>2026/11/25 17:38:55 GMT-3</dc:date>
    <dc:type>Notícia</dc:type>
  </item>
  <item rdf:about="https://www.gov.br/saude/pt-br/assuntos/noticias/2026/novembro/kits-tupancireta">
    <title>Ministério envia kits emergenciais a Tupanciretã (RS)</title>
    <link>https://www.gov.br/saude/pt-br/assuntos/noticias/2026/novembro/kits-tupancireta</link>
    <description>Força Nacional do SUS restabeleceu duas UBS em 24 horas.</description>
    <dc:subject>força nacional do sus</dc:subject>
    <dc:date>2026/11/25 10:00:00 GMT-3</dc:date>
  </item>
  <item rdf:about="https://exemplo.com/falsa">
    <title>Link fora do gov.br é descartado</title>
    <link>https://exemplo.com/falsa</link>
    <dc:date>2026/11/25 18:00:00 GMT-3</dc:date>
  </item>
  <item rdf:about="https://www.gov.br/saude/pt-br/assuntos/noticias/2026/novembro/revista">
    <title>Revista científica do SUS ultrapassa 2 milhões de acessos</title>
    <link>https://www.gov.br/saude/pt-br/assuntos/noticias/2026/novembro/revista</link>
    <description></description>
    <dc:subject>vigilância em saúde e ambiente</dc:subject>
    <dc:date>2026/11/24 09:00:00 GMT-3</dc:date>
  </item>
</rdf:RDF>"""


def test_parse_feed_extrai_campos_e_descarta_links_externos():
    itens = noticias.parse_feed(FEED)

    assert [i["title"] for i in itens] == [
        "Ministério amplia vacinação contra a gripe",
        "Ministério envia kits emergenciais a Tupanciretã (RS)",
        "Revista científica do SUS ultrapassa 2 milhões de acessos",
    ]
    primeiro = itens[0]
    assert primeiro["summary"] == "Doses chegam a todos os estados nesta semana."
    assert primeiro["published_at"] == "2026-11-25T17:38:55-03:00"
    assert primeiro["source_label"] == "Ministério da Saúde"
    assert primeiro["url"].startswith("https://www.gov.br/saude/")
    assert itens[2]["summary"] is None


def test_data_do_plone_com_fuso():
    data = noticias.parse_data_plone("2026/11/25 17:38:55 GMT-3")
    assert data == datetime(2026, 11, 25, 20, 38, 55, tzinfo=timezone.utc)
    assert data.utcoffset() == timedelta(hours=-3)
    assert noticias.parse_data_plone("2026-11-25T10:00:00Z").tzinfo is not None
    assert noticias.parse_data_plone("ontem") is None


def test_categorias_do_prototipo():
    c = noticias.classificar_categoria
    assert c("Campanha de vacinação", "", []) == "VACINAÇÃO"
    assert c("Casos de dengue sobem", "", []) == "ALERTA DE SAÚDE"
    assert c("Kits emergenciais", "Força Nacional do SUS restabeleceu UBS", []) == "ALERTA DE SAÚDE"
    assert c("Novo curso", "", ["atenção primária"]) == "ATENÇÃO PRIMÁRIA"
    # Nome da secretaria não vira alerta.
    assert c("Revista científica", "", ["vigilância em saúde e ambiente"]) == "MINISTÉRIO DA SAÚDE"
    # "ubs" não casa dentro de "substituição".
    assert c("Substituição de equipamentos", "", []) == "MINISTÉRIO DA SAÚDE"


def test_menciona_uf_por_nome_ou_sigla_sem_falso_positivo():
    def noticia(titulo, resumo=""):
        return {"title": titulo, "summary": resumo, "_subjects": []}

    assert noticias._menciona_uf(noticia("Kits a Tupanciretã (RS)"), "RS")
    assert noticias._menciona_uf(noticia("Mutirão em Minas Gerais"), "mg")
    # "Pará" não pode casar com a preposição "para".
    assert not noticias._menciona_uf(noticia("Recursos para hospitais"), "PA")
    assert noticias._menciona_uf(noticia("Recursos para hospitais do Pará"), "PA")
    assert not noticias._menciona_uf(noticia("Qualquer coisa"), None)


def test_og_image_so_aceita_gov_br():
    html_ok = '<meta property="og:image" content="https://www.gov.br/saude/foto.jpg/@@images/x.jpeg" />'
    html_externo = '<meta property="og:image" content="https://cdn.exemplo.com/foto.jpg" />'
    assert noticias.extrair_og_image(html_ok) == "https://www.gov.br/saude/foto.jpg/@@images/x.jpeg"
    assert noticias.extrair_og_image(html_externo) is None
    assert noticias.extrair_og_image("<html></html>") is None


@pytest.fixture
def feed_falso(monkeypatch):
    async def carregar():
        return noticias.parse_feed(FEED)

    imagens = {
        "https://www.gov.br/saude/pt-br/assuntos/noticias/2026/novembro/vacina-gripe": "https://www.gov.br/saude/vacina.jpg",
        "https://www.gov.br/saude/pt-br/assuntos/noticias/2026/novembro/kits-tupancireta": "https://www.gov.br/saude/kits.jpg",
    }

    async def imagem(client, url):
        return imagens.get(url)

    monkeypatch.setattr(noticias, "_carregar_feed", carregar)
    monkeypatch.setattr(noticias, "_buscar_imagem", imagem)


def test_rota_news_no_formato_do_contrato(feed_falso):
    resposta = TestClient(app).get("/api/v1/news?limit=3")

    assert resposta.status_code == 200
    corpo = resposta.json()
    # Total = limit: 1 destaque + 2 itens, do mais recente para o mais antigo.
    assert corpo["featured"]["title"] == "Ministério amplia vacinação contra a gripe"
    assert corpo["featured"]["image_url"] == "https://www.gov.br/saude/vacina.jpg"
    assert len(corpo["items"]) == 2
    for item in [corpo["featured"], *corpo["items"]]:
        assert set(item) >= {"id", "category", "title", "published_at", "source_label", "url"}
        assert "_subjects" not in item
        assert item.get("summary", "x") is not None  # sem resumo, o campo é omitido


def test_rota_news_prioriza_noticias_do_estado(feed_falso):
    sem_uf = TestClient(app).get("/api/v1/news?limit=3").json()
    com_rs = TestClient(app).get("/api/v1/news?limit=3&uf=RS").json()

    # Sem UF a vacinação (mais recente) vem antes; com RS, Tupanciretã (RS) sobe.
    ordem_sem_uf = [i["title"] for i in [sem_uf["featured"], *sem_uf["items"]]]
    assert ordem_sem_uf.index("Ministério amplia vacinação contra a gripe") < ordem_sem_uf.index(
        "Ministério envia kits emergenciais a Tupanciretã (RS)"
    )
    assert com_rs["featured"]["title"] == "Ministério envia kits emergenciais a Tupanciretã (RS)"


def test_destaque_e_a_primeira_noticia_com_imagem(feed_falso, monkeypatch):
    async def so_tupancireta(client, url):
        return "https://www.gov.br/saude/kits.jpg" if url.endswith("kits-tupancireta") else None

    monkeypatch.setattr(noticias, "_buscar_imagem", so_tupancireta)
    corpo = TestClient(app).get("/api/v1/news?limit=3").json()

    assert corpo["featured"]["title"] == "Ministério envia kits emergenciais a Tupanciretã (RS)"
    assert [i["title"] for i in corpo["items"]][0] == "Ministério amplia vacinação contra a gripe"


def test_rota_news_valida_parametros():
    cliente = TestClient(app)
    assert cliente.get("/api/v1/news?limit=0").status_code == 422
    assert cliente.get("/api/v1/news?uf=SAO").status_code == 422


def test_gov_br_fora_do_ar_sem_copia_vira_502(monkeypatch):
    async def falha():
        raise httpx.ConnectError("gov.br fora do ar")

    monkeypatch.setattr(noticias, "_carregar_feed", falha)
    resposta = TestClient(app).get("/api/v1/news")

    assert resposta.status_code == 502
    assert resposta.json()["error"]["code"] == "UPSTREAM_UNAVAILABLE"


def test_gov_br_fora_do_ar_serve_ultima_copia(monkeypatch):
    async def ok():
        return noticias.parse_feed(FEED)

    async def falha():
        raise httpx.ConnectError("gov.br fora do ar")

    monkeypatch.setattr(noticias, "_carregar_feed", ok)
    asyncio.run(noticias.buscar_feed())

    noticias._feed_cache.clear()  # simula o cache expirado
    monkeypatch.setattr(noticias, "_carregar_feed", falha)
    itens, stale = asyncio.run(noticias.buscar_feed())

    assert stale is True
    assert len(itens) == 3
