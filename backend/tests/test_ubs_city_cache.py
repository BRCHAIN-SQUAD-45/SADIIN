import asyncio

from app.integrations import units


def test_buscar_unidades_municipais_pagina_a_partir_do_cache(monkeypatch):
    city = {"ibge_code": "5300108", "name": "Brasília", "uf": "DF"}
    records = [{"cnes": str(i)} for i in range(5)]

    async def fake_all(code):
        assert code == "5300108"
        return city, records

    monkeypatch.setattr(units, "buscar_todas_unidades_municipais", fake_all)
    result_city, page = asyncio.run(units.buscar_unidades_municipais("5300108", 2, 2))

    assert result_city == city
    assert page == [{"cnes": "2"}, {"cnes": "3"}]


def test_cache_postgres_usa_city_ibge_como_chave(monkeypatch):
    calls = []

    class Cursor:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def execute(self, query, params=None):
            calls.append((query, params))

        def fetchone(self):
            return ({"ibge_code": "5300108", "name": "Brasília", "uf": "DF"}, [{"cnes": "1234567"}])

    class Connection:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def cursor(self):
            return Cursor()

    monkeypatch.setattr(units, "conectar_banco", lambda: Connection())
    monkeypatch.setattr(units, "_salvar_cache_postgres", lambda *args: (_ for _ in ()).throw(AssertionError("Leitura não deve renovar TTL")))
    result = units._ler_cache_postgres("5300108")

    assert result[0]["ibge_code"] == "5300108"
    assert result[1][0]["cnes"] == "1234567"
    assert calls[-1][1] == ("5300108",)



def test_salvar_cache_postgres_faz_upsert_por_city_ibge(monkeypatch):
    calls = []

    class Cursor:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def execute(self, query, params=None):
            calls.append((query, params))

    class Connection:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def cursor(self):
            return Cursor()

    monkeypatch.setattr(units, "conectar_banco", lambda: Connection())
    city = {"ibge_code": "5300108", "name": "Brasília", "uf": "DF"}
    records = [{"cnes": "1234567"}]

    units._salvar_cache_postgres("5300108", city, records)

    upsert = next((query, params) for query, params in calls if "INSERT INTO ubs_cache_municipio" in query)
    assert "ON CONFLICT (city_ibge) DO UPDATE" in upsert[0]
    assert upsert[1][0] == "5300108"
    assert '"Brasília"' in upsert[1][1]
    assert '"1234567"' in upsert[1][2]


def test_buscar_todas_unidades_rejeita_codigo_ibge_invalido():
    import pytest

    with pytest.raises(ValueError, match="7 dígitos"):
        asyncio.run(units.buscar_todas_unidades_municipais("123"))
