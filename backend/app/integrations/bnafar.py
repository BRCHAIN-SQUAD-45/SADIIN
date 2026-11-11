import re

import httpx

BNAFAR_BASE_URL = "https://apidadosabertos.saude.gov.br"
BNAFAR_STOCK_PATH = "/daf/estoque-medicamentos-bnafar-horus"
BNAFAR_PAGE_SIZE = 1000
BNAFAR_MAX_PAGES = 5


class BnafarConector:
    """Consulta posições de estoque do Hórus publicadas na API DEMAS."""

    def __init__(self, base_url: str = BNAFAR_BASE_URL):
        self.base_url = base_url.rstrip("/")
        self.client: httpx.AsyncClient | None = None

    async def __aenter__(self):
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=20.0,
            headers={"Accept": "application/json", "User-Agent": "SADIIN/1.0"},
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.aclose()
            self.client = None

    def _http_client(self) -> httpx.AsyncClient:
        if self.client is None:
            raise RuntimeError("BnafarConector precisa ser usado dentro de 'async with'.")
        return self.client

    async def buscar_estoque_municipal(self, catmat: str, codigo_municipio: str) -> list[dict]:
        catmat_code = catmat.strip().upper()
        municipality_code = codigo_municipio.strip()
        if not re.fullmatch(r"[A-Z0-9-]{4,40}", catmat_code):
            raise ValueError("Informe um código CATMAT válido.")
        if not municipality_code.isdigit() or len(municipality_code) not in (6, 7):
            raise ValueError("O código do município deve ter seis dígitos CNES ou sete dígitos IBGE.")

        rows: list[dict] = []
        offset = 0
        for _ in range(BNAFAR_MAX_PAGES):
            response = await self._http_client().get(
                BNAFAR_STOCK_PATH,
                params={
                    "codigo_municipio": municipality_code[:6],
                    "codigo_catmat": catmat_code,
                    "limit": BNAFAR_PAGE_SIZE,
                    "offset": offset,
                },
            )
            response.raise_for_status()
            payload = response.json()
            page = payload.get("parametros") if isinstance(payload, dict) else None
            if not isinstance(page, list):
                raise ValueError("Resposta inesperada da API BNAFAR-Hórus.")
            rows.extend(row for row in page if isinstance(row, dict))
            if len(page) < BNAFAR_PAGE_SIZE:
                break
            offset += len(page)
        return rows