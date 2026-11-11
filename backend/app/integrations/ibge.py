import httpx


class IbgeConector:
    """Consulta localidades na API oficial do IBGE."""

    def __init__(self, base_url: str = "https://servicodados.ibge.gov.br/api/v1/localidades"):
        self.base_url = base_url.rstrip("/")
        self.client: httpx.AsyncClient | None = None

    async def __aenter__(self):
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=15.0,
            headers={"Accept": "application/json", "User-Agent": "SADIIN/1.0"},
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.aclose()
            self.client = None

    def _http_client(self) -> httpx.AsyncClient:
        if self.client is None:
            raise RuntimeError("IbgeConector precisa ser usado dentro de 'async with'.")
        return self.client

    async def listar_estados(self) -> list[dict[str, str]]:
        response = await self._http_client().get("/estados", params={"orderBy": "nome"})
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, list):
            raise ValueError("Resposta inesperada da API de localidades do IBGE.")
        return [
            {"uf": str(state["sigla"]), "name": str(state["nome"])}
            for state in payload
            if isinstance(state, dict) and state.get("sigla") and state.get("nome")
        ]

    async def listar_municipios(self, uf: str) -> list[dict[str, str]]:
        code = uf.strip().upper()
        if len(code) != 2 or not code.isalpha():
            raise ValueError("A UF deve conter duas letras.")
        response = await self._http_client().get(
            f"/estados/{code}/municipios", params={"orderBy": "nome"}
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, list):
            raise ValueError("Resposta inesperada da API de localidades do IBGE.")
        return [
            {"ibge_code": str(city["id"]), "name": str(city["nome"]), "uf": code}
            for city in payload
            if isinstance(city, dict) and city.get("id") and city.get("nome")
        ]

    async def buscar_municipio(self, codigo_ibge: str) -> dict[str, str]:
        code = codigo_ibge.strip()
        if not code.isdigit() or len(code) != 7:
            raise ValueError("O código IBGE do município deve ter sete dígitos.")
        response = await self._http_client().get(f"/municipios/{code}")
        response.raise_for_status()
        city = response.json()
        uf = city.get("microrregiao", {}).get("mesorregiao", {}).get("UF", {}).get("sigla")
        if not uf:
            uf = city.get("regiao-imediata", {}).get("regiao-intermediaria", {}).get("UF", {}).get("sigla")
        if not isinstance(city, dict) or not city.get("id") or not city.get("nome") or not uf:
            raise ValueError("Resposta inesperada da API de localidades do IBGE.")
        return {"ibge_code": str(city["id"]), "name": str(city["nome"]), "uf": str(uf)}

    async def buscar_municipio_por_codigo_cnes(
        self, codigo_municipio: str | int, codigo_uf: str | int
    ) -> dict[str, str]:
        state_response = await self._http_client().get(f"/estados/{codigo_uf}")
        state_response.raise_for_status()
        state = state_response.json()
        uf = state.get("sigla") if isinstance(state, dict) else None
        if not uf:
            raise ValueError("UF CNES não encontrada na API do IBGE.")
        cities = await self.listar_municipios(str(uf))
        municipality_code = str(codigo_municipio).zfill(6)
        match = next((city for city in cities if city["ibge_code"].startswith(municipality_code)), None)
        if match is None:
            raise ValueError("Município CNES não encontrado na API do IBGE.")
        return match