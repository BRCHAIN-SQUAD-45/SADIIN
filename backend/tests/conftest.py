"""Configuração dos testes do back-end.

Os testes NÃO acessam a internet: as chamadas ao DATASUS e ao gov.br são substituídas por
dados falsos (monkeypatch). Assim rodam rápido e não quebram quando os portais caem.

Rodar (dentro de backend/):
    pip install -r requirements-dev.txt
    python -m pytest
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.integrations import cnes_resources, doencas, noticias  # noqa: E402
from app.api.routers import ubs  # noqa: E402


@pytest.fixture(autouse=True)
def limpar_caches():
    """Cada teste começa sem cache, para um não interferir no outro."""
    for cache in (
        cnes_resources._resource_cache,
        cnes_resources._production_cache,
        noticias._feed_cache,
        noticias._image_cache,
        ubs._unit_detail_cache,
        doencas._pagina_cache,
    ):
        cache.clear()
    noticias._last_good_feed = []
    yield
