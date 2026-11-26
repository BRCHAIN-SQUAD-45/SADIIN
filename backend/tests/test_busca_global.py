"""Issue #33: busca global em medicamentos (ANVISA), doenças (A a Z + CID-10) e UBS (CNES)."""

import httpx
from fastapi.testclient import TestClient

from app.api.routers import dashboard
from app.main import app

MEDICAMENTOS = [
    {"id": "1", "name": "QDENGA", "subtitle": "vacina dengue", "tag": "Vacina", "category_id": "vacina",
     "requires_prescription": True, "adult_use": True, "leaflet_url": "https://consultas.anvisa.gov.br/",
     "synonyms": "", "indications": ["x"]},
    {"id": "2", "name": "DIPIRONA", "subtitle": "dipirona monoidratada", "tag": "Genérico",
     "category_id": "generico", "requires_prescription": False, "adult_use": True},
]
UNIDADE = {
    "cnes_code": "2787946", "name": "UBS Dengue Sul", "address": "Rua A", "city": "São Paulo", "uf": "SP",
    "lat": -23.5, "lng": -46.6, "is_open": None, "kind": "ubs",
}


def _fontes(monkeypatch, medicamentos=MEDICAMENTOS, unidades=(UNIDADE,), falha_anvisa=False, falha_cnes=False):
    async def meds(q, categoria):
        if falha_anvisa:
            raise httpx.ConnectError("ANVISA fora do ar")
        q = q.casefold()
        return [m for m in medicamentos if q in m["name"].casefold() or q in m["subtitle"].casefold()]

    async def ubs(q, cidade):
        if falha_cnes:
            raise httpx.ConnectError("CNES fora do ar")
        return [u for u in unidades if q.casefold() in u["name"].casefold()]

    async def sugestoes(q):
        return []

    monkeypatch.setattr(dashboard, "listar_medicamentos", meds)
    monkeypatch.setattr(dashboard, "sugerir_medicamentos", sugestoes)
    monkeypatch.setattr(dashboard, "sugerir_indicacoes", sugestoes)
    monkeypatch.setattr(dashboard, "_buscar_unidades", ubs)


def test_busca_unifica_os_tres_catalogos(monkeypatch):
    _fontes(monkeypatch)
    corpo = TestClient(app).get("/api/v1/search?q=dengue").json()

    assert [m["name"] for m in corpo["results"]["medications"]] == ["QDENGA"]
    assert [c["popular_name"] for c in corpo["results"]["conditions"]] == ["Dengue"]
    assert [u["name"] for u in corpo["results"]["units"]] == ["UBS Dengue Sul"]
    assert corpo["intent"] == "condition"
    assert corpo["matched_term"] == "Dengue"
    assert corpo["confidence"] == 1.0
    assert corpo["fallback"] is None
    # Campos internos não vazam.
    assert "synonyms" not in corpo["results"]["medications"][0]
    assert "_topico" not in corpo["results"]["conditions"][0]


def test_sinonimo_sem_acento_vira_termo_reconhecido(monkeypatch):
    _fontes(monkeypatch)
    corpo = TestClient(app).get("/api/v1/search?q=pressao%20alta&type=conditions").json()
    assert corpo["matched_term"] == "Hipertensão (pressão alta)"


def test_filtro_por_tipo(monkeypatch):
    _fontes(monkeypatch)
    corpo = TestClient(app).get("/api/v1/search?q=dipirona&type=medications").json()
    assert [m["name"] for m in corpo["results"]["medications"]] == ["DIPIRONA"]
    assert corpo["results"]["conditions"] == [] and corpo["results"]["units"] == []
    assert corpo["intent"] == "medication"


def test_sem_resultado(monkeypatch):
    _fontes(monkeypatch)
    corpo = TestClient(app).get("/api/v1/search?q=xyzabc").json()
    assert corpo["intent"] == "unknown"
    assert corpo["confidence"] == 0.0
    assert "matched_term" not in corpo


def test_uma_fonte_fora_do_ar_nao_derruba_a_busca(monkeypatch):
    _fontes(monkeypatch, falha_anvisa=True, falha_cnes=True)
    resposta = TestClient(app).get("/api/v1/search?q=dengue")

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert [c["popular_name"] for c in corpo["results"]["conditions"]] == ["Dengue"]
    assert corpo["results"]["medications"] == [] and corpo["results"]["units"] == []
    assert corpo["meta"]["is_stale"] is True


def test_fonte_unica_fora_do_ar_vira_502(monkeypatch):
    _fontes(monkeypatch, falha_anvisa=True)
    resposta = TestClient(app).get("/api/v1/search?q=dipirona&type=medications")
    assert resposta.status_code == 502
    assert resposta.json()["error"]["code"] == "UPSTREAM_UNAVAILABLE"


def test_validacao_de_parametros():
    cliente = TestClient(app)
    assert cliente.get("/api/v1/search?q=a").status_code == 422
    assert cliente.get("/api/v1/search?q=dengue&lat=-23.5").status_code == 422
