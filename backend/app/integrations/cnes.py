import httpx
import logging
import math
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

logger = logging.getLogger(__name__)

def _is_retriable_error(exception: BaseException) -> bool:
    """Retenta apenas falhas de rede ou erros 5xx/429 do servidor."""
    if isinstance(exception, httpx.HTTPStatusError):
        status = exception.response.status_code
        # 429: Too Many Requests | 500+: Erros internos do DATASUS
        return status == 429 or status >= 500
    # Retenta sempre em caso de timeout, quebra de DNS, etc.
    return isinstance(exception, httpx.RequestError)

def _safe_float(value: object) -> float | None:
    """Garante a conversão segura para float, retornando None se falhar."""
    if value is None:
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


class CnesConector:
    """
    Conector assíncrono para integração direta com a API do CNES (DATASUS).
    """
    def __init__(self, base_url: str = "https://apidadosabertos.saude.gov.br"):
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
            raise RuntimeError("CnesConector precisa ser usado dentro de 'async with'.")
        return self.client

    @staticmethod
    def _codigo_municipio_cnes(codigo_municipio: str) -> str:
        code = codigo_municipio.strip()
        if not code.isdigit() or len(code) not in (6, 7):
            raise ValueError("O código do município deve ter 6 dígitos (CNES) ou 7 (IBGE).")
        return code[:6]

    @retry(
        stop=stop_after_attempt(4),
        wait=wait_exponential(multiplier=1.5, min=2, max=10),
        retry=retry_if_exception(_is_retriable_error) # <- Condição de retry otimizada
    )
    async def buscar_unidades_por_municipio(
        self,
        codigo_municipio: str,
        *,
        tipo_unidade: int | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[dict]:
        if limit < 1 or limit > 20:
            raise ValueError("A API CNES aceita de 1 a 20 registros por página.")
        if offset < 0:
            raise ValueError("O offset não pode ser negativo.")

        params: dict[str, str | int] = {
            "codigo_municipio": self._codigo_municipio_cnes(codigo_municipio),
            "limit": limit,
            "offset": offset,
        }
        if tipo_unidade is not None:
            params["codigo_tipo_unidade"] = tipo_unidade

        try:
            response = await self._http_client().get("/cnes/estabelecimentos", params=params)
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise ValueError("Resposta inesperada da API CNES.")
            return self._normalizacao_defensiva(payload)

        except httpx.HTTPStatusError as e:
            logger.error("A API CNES retornou HTTP %s.", e.response.status_code)
            raise
        except httpx.RequestError as e:
            logger.error("Falha de rede ao consultar a API CNES: %s", e)
            raise

    @retry(
        stop=stop_after_attempt(4),
        wait=wait_exponential(multiplier=1.5, min=2, max=10),
        retry=retry_if_exception(_is_retriable_error),
    )
    async def buscar_unidade(self, cnes: str) -> dict:
        code = cnes.strip()
        if not code.isdigit():
            raise ValueError("O código CNES deve conter apenas dígitos.")
        response = await self._http_client().get(f"/cnes/estabelecimentos/{code}")
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError("Resposta inesperada da API CNES.")
        return self._normalizar_estabelecimento(payload)

    def _normalizacao_defensiva(self, payload: dict) -> list[dict]:
        estabelecimentos = payload.get("estabelecimentos")
        if not isinstance(estabelecimentos, list):
            raise ValueError("A resposta da API CNES não contém a lista 'estabelecimentos'.")
        return [
            self._normalizar_estabelecimento(estabelecimento)
            for estabelecimento in estabelecimentos
            if isinstance(estabelecimento, dict)
        ]

    @staticmethod
    def _normalizar_estabelecimento(estabelecimento: dict) -> dict:
        return {
            "cnes": str(estabelecimento.get("codigo_cnes") or ""),
            "razao_social": estabelecimento.get("nome_razao_social"),
            "nome_fantasia": estabelecimento.get("nome_fantasia"),
            "tipo_gestao": estabelecimento.get("tipo_gestao"),
            "id_tipo_unidade": estabelecimento.get("codigo_tipo_unidade"),
            "cep": estabelecimento.get("codigo_cep_estabelecimento"),
            "endereco": estabelecimento.get("endereco_estabelecimento"),
            "numero": estabelecimento.get("numero_estabelecimento"),
            "bairro": estabelecimento.get("bairro_estabelecimento"),
            "id_municipio": estabelecimento.get("codigo_municipio"),
            "id_uf": estabelecimento.get("codigo_uf"),
            "latitude": _safe_float(estabelecimento.get("latitude_estabelecimento_decimo_grau")),
            "longitude": _safe_float(estabelecimento.get("longitude_estabelecimento_decimo_grau")),
            "telefone": estabelecimento.get("numero_telefone_estabelecimento"),
            "turno_atendimento": estabelecimento.get("descricao_turno_atendimento"),
            "atende_sus": estabelecimento.get("estabelecimento_faz_atendimento_ambulatorial_sus"),
            "data_atualizacao": estabelecimento.get("data_atualizacao"),
            "ativo": estabelecimento.get("codigo_motivo_desabilitacao_estabelecimento") is None,
        }