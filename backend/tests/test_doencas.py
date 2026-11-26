"""Issues #43 e #46: catálogo de doenças (Saúde de A a Z + CID-10) e rotas /conditions."""

from fastapi.testclient import TestClient

from app.data.doencas_az import TOPICOS
from app.integrations import cid10, doencas
from app.main import app

# Página no formato real do gov.br (blocos "cover"), cobrindo os casos encontrados nas
# páginas de dengue, covid-19, hipertensão e tuberculose.
PAGINA = """
<html><head>
<meta name="description" content="Saúde de A a Z | Ministério da Saúde" />
<meta property="og:image" content="https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/d/dengue/foto.png/@@images/x.png" />
</head><body>
<nav><ul><li>Menu que não é conteúdo</li></ul></nav>
<main id="main-content">
  <div class="cover-richtext-tile"><p>A doença X é causada por um vírus.</p></div>
  <h2 class="outstanding-title">Sinais e sintomas</h2>
  <div class="cover-richtext-tile">
    <p>Os principais sintomas são:</p>
    <ul><li>Febre alta;</li><li>Dor no corpo; e</li><li>Manchas na pele</li></ul>
    <p>Grupos de riscos</p>
    <ul><li>Idade acima de 60 anos</li><li>Gestantes</li></ul>
  </div>
  <h2 class="outstanding-title">Prevenção</h2>
  <div class="cover-richtext-tile">
    <p>Alimentação saudável</p>
    <p>Evite água parada.</p>
    <p>Veja o guia completo</p>
  </div>
  <h2 class="outstanding-title">Tratamento</h2>
  <div class="cover-richtext-tile">
    <p>O tratamento é feito com repouso e hidratação.</p>
    <p>Para retirar o medicamento, apresente:</p>
    <ul><li>Documento de identidade</li><li>CPF</li></ul>
  </div>
  <h2 class="outstanding-title">Você viu?</h2>
  <div class="cover-richtext-tile"><ul><li>Outra notícia</li></ul></div>
</main>
</body></html>
"""


# --- Catálogo e CID-10 -----------------------------------------------------------------


def test_todo_codigo_do_catalogo_existe_na_cid10_oficial():
    """O vínculo tópico -> CID-10 foi feito à mão: este teste garante que nenhum código foi inventado."""
    sem_descricao = [t.cid10 for t in TOPICOS if cid10.descricao(t.cid10) is None]
    sem_capitulo = [t.cid10 for t in TOPICOS if cid10.capitulo(t.cid10) is None]
    assert sem_descricao == []
    assert sem_capitulo == []


def test_catalogo_sem_ids_ou_paginas_repetidas():
    ids = [d["id"] for d in doencas.catalogo()]
    assert len(ids) == len(set(ids))
    assert len({t.caminho for t in TOPICOS}) == len(TOPICOS)


def test_descricoes_e_capitulos_da_cid10():
    assert cid10.descricao("A90") == "Dengue [dengue clássico]"
    assert cid10.descricao("A05.1") == "Botulismo"
    assert cid10.descricao("B15-B19") == "Hepatite viral"
    assert cid10.descricao("Z99.99") is None
    assert cid10.capitulo("A92.0").nome == "Algumas doenças infecciosas e parasitárias"
    assert cid10.capitulo("I10").slug == "doencas-do-aparelho-circulatorio"


def test_busca_por_nome_sinonimo_sem_acento_e_codigo():
    nomes = lambda q: [d["popular_name"] for d in doencas.filtrar(q)]  # noqa: E731
    assert nomes("dengue") == ["Dengue"]
    assert nomes("pressao alta") == ["Hipertensão (pressão alta)"]
    assert nomes("derrame") == ["AVC"]
    assert nomes("a90") == ["Dengue"]
    assert nomes("A92.0") == ["Chikungunya"]
    assert "Hepatites virais" in nomes("B16")  # dentro do intervalo B15-B19
    assert nomes("nada-a-ver") == []


def test_filtro_por_categoria():
    respiratorias = doencas.filtrar(categoria="doencas-do-aparelho-respiratorio")
    assert {d["popular_name"] for d in respiratorias} >= {"Asma", "Bronquite"}
    assert all(d["category_id"] == "doencas-do-aparelho-respiratorio" for d in respiratorias)


# --- Leitura da página oficial -------------------------------------------------------------


def test_le_secoes_da_pagina():
    r = doencas.ler_pagina(PAGINA)

    # Lista introduzida por "sintomas"; "Grupos de riscos" e o que vem depois ficam de fora.
    assert r["main_symptoms"] == ["Febre alta", "Dor no corpo", "Manchas na pele"]
    # Subtítulo do assunto continua; chamada de link ("Veja...") sai.
    assert r["prevention"] == ["Alimentação saudável", "Evite água parada."]
    # Lista de documentos (outro assunto dentro de Tratamento) fica de fora.
    assert r["treatment"] == ["O tratamento é feito com repouso e hidratação."]
    assert r["summary"] == "A doença X é causada por um vírus."
    assert r["image_url"] == "https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/d/dengue/foto.png/@@images/x.png"


def test_imagem_fora_do_gov_br_e_descartada():
    html = PAGINA.replace("https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/d/dengue/foto.png/@@images/x.png", "https://cdn.exemplo.com/x.png")
    assert doencas.ler_pagina(html)["image_url"] is None


def test_logo_generico_do_gov_br_nao_vira_capa():
    html = PAGINA.replace(
        "https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/d/dengue/foto.png/@@images/x.png",
        "https://www.gov.br/saude/logo.png",
    )
    assert doencas.ler_pagina(html)["image_url"] is None


def test_card_da_lista_so_usa_sintomas_curtos(monkeypatch):
    longo = "O primeiro sintoma, e o mais característico, é a perda de memória recente e progressiva"
    html = PAGINA.replace("<li>Dor no corpo; e</li>", f"<li>{longo}</li>")
    _pagina_falsa(monkeypatch, conteudo=html)
    item = TestClient(app).get("/api/v1/conditions?q=dengue").json()["items"][0]
    assert item["main_symptoms"] == ["Febre alta", "Manchas na pele"]
    detalhe = TestClient(app).get("/api/v1/conditions/dengue").json()
    assert longo in detalhe["main_symptoms"]


def test_pagina_sem_secoes_nao_quebra():
    r = doencas.ler_pagina("<html><body><main id='main-content'><p>Texto.</p></main></body></html>")
    assert r["main_symptoms"] == [] and r["prevention"] == [] and r["treatment"] == []


# --- Rotas /conditions ---------------------------------------------------------------------


def _pagina_falsa(monkeypatch, conteudo=PAGINA, falhar=False):
    chamadas = []

    async def fake(topico):
        chamadas.append(topico.caminho)
        if falhar:
            raise doencas.httpx.ConnectError("gov.br fora do ar")
        return doencas.ler_pagina(conteudo)

    monkeypatch.setattr(doencas, "_baixar_pagina", fake)
    return chamadas


def test_rota_categorias():
    corpo = TestClient(app).get("/api/v1/conditions/categories").json()
    assert {"id", "name", "slug"} <= set(corpo[0])
    assert "algumas-doencas-infecciosas-e-parasitarias" in {c["id"] for c in corpo}


def test_rota_lista_paginada_com_sintomas(monkeypatch):
    chamadas = _pagina_falsa(monkeypatch)
    corpo = TestClient(app).get("/api/v1/conditions?page_size=5").json()

    assert corpo["total"] == len(TOPICOS)
    assert len(corpo["items"]) == 5 and len(chamadas) == 5  # só as páginas da página atual
    item = corpo["items"][0]
    assert set(item) >= {"id", "popular_name", "cid10_code", "subtitle", "tag", "category_id", "main_symptoms"}
    assert item["main_symptoms"] == ["Febre alta", "Dor no corpo", "Manchas na pele"]
    assert "_topico" not in item


def test_rota_lista_com_busca_e_categoria(monkeypatch):
    _pagina_falsa(monkeypatch)
    cliente = TestClient(app)
    assert [i["id"] for i in cliente.get("/api/v1/conditions?q=A90").json()["items"]] == ["dengue"]
    infecciosas = cliente.get("/api/v1/conditions?category=algumas-doencas-infecciosas-e-parasitarias").json()
    assert infecciosas["total"] > 10


def test_rota_detalhe(monkeypatch):
    _pagina_falsa(monkeypatch)
    corpo = TestClient(app).get("/api/v1/conditions/dengue").json()

    assert corpo["popular_name"] == "Dengue"
    assert corpo["cid10_code"] == "A90"
    assert corpo["subtitle"] == "CID-10 A90: Dengue [dengue clássico]"
    assert corpo["prevention"] == ["Alimentação saudável", "Evite água parada."]
    assert corpo["source_url"].endswith("/saude-de-a-a-z/d/dengue")
    assert corpo["meta"]["is_stale"] is False


def test_detalhe_com_gov_br_fora_do_ar_mostra_so_a_cid10(monkeypatch):
    _pagina_falsa(monkeypatch, falhar=True)
    resposta = TestClient(app).get("/api/v1/conditions/dengue")

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["cid10_code"] == "A90"
    assert corpo["main_symptoms"] == [] and corpo["prevention"] == []
    assert corpo["meta"]["is_stale"] is True


def test_detalhe_inexistente_404():
    resposta = TestClient(app).get("/api/v1/conditions/nao-existe")
    assert resposta.status_code == 404
    assert resposta.json()["error"]["code"] == "NOT_FOUND"
