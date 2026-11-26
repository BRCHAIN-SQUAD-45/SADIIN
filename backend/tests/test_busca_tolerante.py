"""Issue #64: busca tolerante a erros rápida (índice de vocabulário) e termo reconhecido."""

import asyncio
import time

from fastapi.testclient import TestClient

from app.api.routers import dashboard
from app.integrations import anvisa
from app.main import app
from app.search.indice import IndiceBusca


def _registro(rid, nome, principio=None, sinonimos=""):
    return {
        "id": rid,
        "name": nome,
        "subtitle": principio or nome,
        "active_ingredient": principio or nome,
        "synonyms": sinonimos,
        "indications": ["Consulte a bula oficial."],
        "variants": [{"id": f"{rid}-v", "name": nome, "manufacturer": "Laboratório Teste"}],
        "category_id": "generico",
        "tag": "Genérico",
    }


CATALOGO = [
    _registro("dipirona", "Dipirona"),
    _registro("dipirona-cafeina", "Dipirona, Cafeína", "Dipirona Monoidratada, Cafeína"),
    _registro("paracetamol", "Paracetamol"),
    _registro("codeina-paracetamol", "Fosfato De Codeína, Paracetamol"),
    _registro("amoxicilina", "Amoxicilina"),
    _registro("losartana", "Losartana Potássica"),
]


def _catalogo_falso(monkeypatch, registros=CATALOGO):
    async def carregar():
        return registros

    monkeypatch.setattr(anvisa, "_load_records", carregar)
    anvisa._indice_cache = None


# --- Índice ---------------------------------------------------------------------------------


def test_indice_acha_trecho_exato_sem_acento():
    indice = IndiceBusca([("a", ["Losartana Potássica"]), ("b", ["Dipirona"])])
    assert indice.contem_trecho("potassica") == {"a"}
    assert indice.contem_trecho("dipi") == {"b"}


def test_indice_acha_palavras_parecidas_e_por_prefixo():
    indice = IndiceBusca([("a", ["Amoxicilina"]), ("b", ["Dipirona"]), ("c", ["Losartana"])])
    assert indice.candidatos_aproximados("amoxicilna") == {"a"}  # erro de digitação
    assert indice.candidatos_aproximados("dprirona") == {"b"}  # troca de letras
    assert indice.candidatos_aproximados("losar") == {"c"}  # começo da palavra
    assert indice.candidatos_aproximados("xqzvnm") == set()


def test_indice_limita_candidatos_preferindo_quem_bate_mais_palavras():
    entradas = [(f"r{i}", [f"Comum Remedio{i}"]) for i in range(600)]
    entradas.append(("alvo", ["Comum Especifico"]))
    indice = IndiceBusca(entradas)
    candidatos = indice.candidatos_aproximados("comum especifico")
    assert len(candidatos) <= 400
    assert "alvo" in candidatos


# --- ANVISA com o índice ------------------------------------------------------------------------


def test_lista_corrige_erro_de_digitacao(monkeypatch):
    _catalogo_falso(monkeypatch)
    nomes = [r["name"] for r in asyncio.run(anvisa.listar_medicamentos("dprirona", None))]
    assert nomes[0] == "Dipirona"


def test_lista_poe_o_nome_exato_primeiro(monkeypatch):
    _catalogo_falso(monkeypatch)
    nomes = [r["name"] for r in asyncio.run(anvisa.listar_medicamentos("paracetamol", None))]
    assert nomes == ["Paracetamol", "Fosfato De Codeína, Paracetamol"]


def test_sugestoes_preferem_o_nome_mais_simples(monkeypatch):
    _catalogo_falso(monkeypatch)
    sugestoes = asyncio.run(anvisa.sugerir_medicamentos("paracetamol"))
    assert sugestoes[0]["label"] == "Paracetamol"


def test_sugestoes_rapidas_em_catalogo_grande(monkeypatch):
    """Antes do índice: SequenceMatcher em todos os registros a cada busca (~5 s no catálogo real)."""
    grande = [_registro(f"med{i}", f"Medicamento Ficticio Numero{i} Composto{i % 97}") for i in range(6500)]
    grande.append(_registro("dipirona", "Dipirona"))
    _catalogo_falso(monkeypatch, grande)
    asyncio.run(anvisa.sugerir_medicamentos("aquecer"))  # monta o índice (1x por carga)

    inicio = time.perf_counter()
    sugestoes = asyncio.run(anvisa.sugerir_medicamentos("dprirona"))
    duracao = time.perf_counter() - inicio

    assert sugestoes[0]["label"] == "Dipirona"
    assert duracao < 1.0


def test_indice_e_refeito_quando_o_catalogo_recarrega(monkeypatch):
    _catalogo_falso(monkeypatch, [_registro("a", "Dipirona")])
    asyncio.run(anvisa.sugerir_medicamentos("dipirona"))
    novo = [_registro("b", "Amoxicilina")]
    _catalogo_falso(monkeypatch, novo)
    assert asyncio.run(anvisa.sugerir_medicamentos("amoxicilna"))[0]["label"] == "Amoxicilina"


# --- Termo reconhecido na busca global ---------------------------------------------------------


def test_doenca_parecida_vence_sugestao_de_medicamento(monkeypatch):
    async def meds(q, categoria):
        return []

    async def sugestao_med(q, limit=5):
        return [{"id": "amlodipina", "label": "Besilato De Amlodipina", "score": 0.74, "kind": "medication"}]

    async def sem_indicacoes(q, limit=5):
        return []

    async def sem_ubs(q, cidade):
        return []

    monkeypatch.setattr(dashboard, "listar_medicamentos", meds)
    monkeypatch.setattr(dashboard, "sugerir_medicamentos", sugestao_med)
    monkeypatch.setattr(dashboard, "sugerir_indicacoes", sem_indicacoes)
    monkeypatch.setattr(dashboard, "_buscar_unidades", sem_ubs)

    corpo = TestClient(app).get("/api/v1/search?q=pressao%20auta").json()
    assert corpo["matched_term"] == "Hipertensão (pressão alta)"
    assert corpo["intent"] == "condition"
