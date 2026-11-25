import asyncio

import pytest

from app.integrations.cache import TTLCache


def test_chamadas_simultaneas_fazem_um_download_so():
    """/metrics e /attendance-history pedem a mesma produção ao mesmo tempo: 1 download."""
    cache: TTLCache[str] = TTLCache(60)
    chamadas = 0

    async def loader():
        nonlocal chamadas
        chamadas += 1
        await asyncio.sleep(0.05)
        return "dados"

    async def cenario():
        return await asyncio.gather(*(cache.get_or_load("ubs-1", loader) for _ in range(5)))

    assert asyncio.run(cenario()) == ["dados"] * 5
    assert chamadas == 1


def test_chaves_diferentes_nao_esperam_uma_pela_outra():
    """O lock é por chave: uma UBS lenta não trava a consulta de outra."""
    cache: TTLCache[str] = TTLCache(60)
    lenta_liberada = asyncio.Event()

    async def lenta():
        await lenta_liberada.wait()
        return "lenta"

    async def rapida():
        return "rapida"

    async def cenario():
        tarefa_lenta = asyncio.create_task(cache.get_or_load("ubs-lenta", lenta))
        await asyncio.sleep(0)
        resultado = await asyncio.wait_for(cache.get_or_load("ubs-rapida", rapida), timeout=1)
        lenta_liberada.set()
        await tarefa_lenta
        return resultado

    assert asyncio.run(cenario()) == "rapida"


def test_falha_nao_fica_no_cache():
    cache: TTLCache[str] = TTLCache(60)
    tentativas = 0

    async def instavel():
        nonlocal tentativas
        tentativas += 1
        if tentativas == 1:
            raise RuntimeError("DATASUS fora do ar")
        return "ok"

    with pytest.raises(RuntimeError):
        asyncio.run(cache.get_or_load("k", instavel))
    assert asyncio.run(cache.get_or_load("k", instavel)) == "ok"
    assert tentativas == 2


def test_expira_depois_do_ttl(monkeypatch):
    cache: TTLCache[int] = TTLCache(10)
    agora = [1000.0]
    monkeypatch.setattr("app.integrations.cache.time.monotonic", lambda: agora[0])
    valores = iter([1, 2])

    async def loader():
        return next(valores)

    assert asyncio.run(cache.get_or_load("k", loader)) == 1
    agora[0] += 5
    assert asyncio.run(cache.get_or_load("k", loader)) == 1
    agora[0] += 10
    assert asyncio.run(cache.get_or_load("k", loader)) == 2
