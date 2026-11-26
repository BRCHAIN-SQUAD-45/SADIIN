"""Issue #62: ficha da UBS rápida, reference_date nunca vazio e nomes legíveis."""

import asyncio
import time

from fastapi.testclient import TestClient

from app.integrations import cnes_resources
from app.integrations.units import eh_unidade_basica, formatar_nome_unidade
from app.main import app


def _falso_get_rows(dados_por_competencia: dict[int, list[dict]], atraso: float = 0.0):
    """Simula a API do DATASUS: devolve as linhas da competência pedida."""
    chamadas: list[int] = []

    async def fake(client, path, key, params):
        chamadas.append(params["nu_comp"])
        await asyncio.sleep(atraso)
        linhas = dados_por_competencia.get(params["nu_comp"], [])
        inicio = params["offset"]
        return linhas[inicio : inicio + params["limit"]]

    return fake, chamadas


# --- Produção SIA/SIH ---------------------------------------------------------------


def test_producao_consulta_as_24_competencias_em_paralelo(monkeypatch):
    competencias = cnes_resources.competencias_recentes()
    dados = {competencias[6]: [{"qt_procedimento": 57}]}
    fake, chamadas = _falso_get_rows(dados, atraso=0.1)
    monkeypatch.setattr(cnes_resources, "_get_rows", fake)

    inicio = time.perf_counter()
    linhas = asyncio.run(cnes_resources.buscar_producao_cnes("2787946"))
    duracao = time.perf_counter() - inicio

    assert len(chamadas) == 24  # 12 meses x (SIA + SIH): nenhum mês foi cortado
    assert duracao < 1.0  # sequencial levaria 24 x 0,1 s = 2,4 s
    # SIA e SIH usam o mesmo dado falso, então a linha aparece uma vez em cada fonte.
    assert {(l["_source"], l["_competence"]) for l in linhas} == {
        ("outpatient_procedures", competencias[6]),
        ("hospital_procedures", competencias[6]),
    }


def test_producao_usa_cache_na_segunda_visita(monkeypatch):
    fake, chamadas = _falso_get_rows({})
    monkeypatch.setattr(cnes_resources, "_get_rows", fake)

    asyncio.run(cnes_resources.buscar_producao_cnes("2787946"))
    asyncio.run(cnes_resources.buscar_producao_cnes("2787946"))

    assert len(chamadas) == 24


# --- Recursos CNES (profissionais, serviços) ----------------------------------------


def test_recurso_para_no_primeiro_lote_quando_ha_dado_recente(monkeypatch):
    competencias = cnes_resources.competencias_recentes()
    fake, chamadas = _falso_get_rows({competencias[4]: [{"co_cnes": "2787946"}]})
    monkeypatch.setattr(cnes_resources, "_get_rows", fake)

    competencia, linhas = asyncio.run(
        cnes_resources.buscar_recurso_cnes_com_competencia("2787946", "professionals")
    )

    assert competencia == competencias[4]
    assert linhas == [{"co_cnes": "2787946"}]
    assert len(chamadas) == cnes_resources.PROBE_BATCH_MONTHS  # um lote só


def test_recurso_procura_no_lote_seguinte(monkeypatch):
    competencias = cnes_resources.competencias_recentes()
    fake, chamadas = _falso_get_rows({competencias[8]: [{"co_cnes": "1"}]})
    monkeypatch.setattr(cnes_resources, "_get_rows", fake)

    competencia, _ = asyncio.run(
        cnes_resources.buscar_recurso_cnes_com_competencia("1", "professionals")
    )

    assert competencia == competencias[8]
    assert len(chamadas) == 2 * cnes_resources.PROBE_BATCH_MONTHS


def test_recurso_sem_dado_em_12_meses_devolve_none(monkeypatch):
    fake, _ = _falso_get_rows({})
    monkeypatch.setattr(cnes_resources, "_get_rows", fake)

    assert asyncio.run(
        cnes_resources.buscar_recurso_cnes_com_competencia("1", "professionals")
    ) == (None, [])


def test_formatar_competencia():
    assert cnes_resources.formatar_competencia(202607) == "2026-07"


# --- Rota /staff ----------------------------------------------------------------------


def test_staff_reference_date_no_formato_do_contrato(monkeypatch):
    async def fake(cnes, resource):
        return 202607, [
            {"st_atende_sus": "SIM", "co_ine": "123"},
            {"st_atende_sus": "NAO", "co_ine": "456"},
        ]

    monkeypatch.setattr("app.api.routers.ubs.buscar_recurso_cnes_com_competencia", fake)
    resposta = TestClient(app).get("/api/v1/ubs/2787946/staff")

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["reference_date"] == "2026-07"
    assert corpo["professionals"] == 1
    assert corpo["esf_teams"] == 1


def test_staff_sem_profissional_ativo_ainda_tem_reference_date(monkeypatch):
    """Antes vinha reference_date "" e o Zod do front rejeitava a resposta."""

    async def fake(cnes, resource):
        return 202605, [{"st_atende_sus": "NAO"}]

    monkeypatch.setattr("app.api.routers.ubs.buscar_recurso_cnes_com_competencia", fake)
    corpo = TestClient(app).get("/api/v1/ubs/1/staff").json()

    assert corpo["reference_date"] == "2026-05"
    assert corpo["professionals"] == 0


def test_staff_sem_dado_publicado_vira_501(monkeypatch):
    async def fake(cnes, resource):
        return None, []

    monkeypatch.setattr("app.api.routers.ubs.buscar_recurso_cnes_com_competencia", fake)
    resposta = TestClient(app).get("/api/v1/ubs/1/staff")

    assert resposta.status_code == 501
    assert resposta.json()["error"]["code"] == "SOURCE_UNAVAILABLE"


# --- Nomes e prioridade ------------------------------------------------------------------


def test_nomes_em_title_case_mantendo_siglas_e_conectivos():
    casos = {
        "UBS JARDIM VISTA ALEGRE VANDA APARECIDA DOS SANTOS": "UBS Jardim Vista Alegre Vanda Aparecida dos Santos",
        "UBS JARDIM ICARAI BRASILANDIA DR DANIEL ALVES GRANGEIRO": "UBS Jardim Icarai Brasilandia Dr. Daniel Alves Grangeiro",
        "AMA/UBS INTEGRADA VILA ESPERANCA": "AMA/UBS Integrada Vila Esperança",
        "CAPS AD III SANTANA": "CAPS AD III Santana",
        "CENTRO DE SAUDE ESCOLA BARRA FUNDA": "Centro de Saúde Escola Barra Funda",
        "USF SAO JOAO II": "USF São João II",
        "  ubs   centro  ": "UBS Centro",
        "DE OLHO NA SAUDE": "De Olho na Saúde",  # conectivo no início fica maiúsculo
    }
    for entrada, esperado in casos.items():
        assert formatar_nome_unidade(entrada) == esperado
    assert formatar_nome_unidade(None) == ""


def test_unidade_basica_por_tipo_ou_nome():
    assert eh_unidade_basica({"id_tipo_unidade": 2, "nome_fantasia": "CENTRO X"})
    assert eh_unidade_basica({"id_tipo_unidade": 20, "nome_fantasia": "AMA SE"})
    assert eh_unidade_basica({"id_tipo_unidade": 20, "nome_fantasia": "USF VILA NOVA"})
    assert not eh_unidade_basica({"id_tipo_unidade": 20, "nome_fantasia": "PS MUN DA LAPA"})
    assert not eh_unidade_basica({"id_tipo_unidade": 5, "nome_fantasia": "HOSPITAL UBSX"})
