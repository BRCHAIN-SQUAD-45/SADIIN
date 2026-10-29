import httpx
import logging
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = logging.getLogger(__name__)

class CnesConector:
    """
    Conector assíncrono para integração direta com a API do CNES (DATASUS).
    """
    def __init__(self, base_url: str = "https://apidadosabertos.saude.gov.br/cnes/estabelecimentos"):
        self.base_url = base_url
        self.client = None

    async def __aenter__(self):
        # Inicializa a sessão assíncrona no gestor de contexto
        self.client = httpx.AsyncClient(base_url=self.base_url, timeout=15.0)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        # Garante o fecho correto das ligações TCP
        if self.client:
            await self.client.aclose()

    @retry(
        stop=stop_after_attempt(4),
        wait=wait_exponential(multiplier=1.5, min=2, max=10),
        retry=retry_if_exception_type((httpx.RequestError, httpx.HTTPStatusError))
    )
    async def buscar_unidades_por_municipio(self, codigo_municipio: str) -> list:
        """
        Consulta os estabelecimentos de um município específico.
        Implementa retry automático em caso de falhas de rede ou indisponibilidade (502/504).
        """
        params = {"codigo_municipio": codigo_municipio}
        
        try:
            # Efetua o pedido GET à API pública
            response = await self.client.get("", params=params)
            response.raise_for_status()
            
            payload = response.json()
            return self._normalizacao_defensiva(payload)
            
        except httpx.HTTPStatusError as e:
            logger.error(f"O DATASUS retornou erro {e.response.status_code}. Tentando novamente...")
            raise
        except httpx.RequestError as e:
            logger.error(f"Falha de rede ao tentar aceder ao CNES: {e}")
            raise

    def _normalizacao_defensiva(self, payload: dict) -> list:
        """
        Filtra e padroniza a estrutura do JSON recebido.
        Previne a quebra da interface caso a origem altere a estrutura dos dados.
        """
        # Extrai a lista de forma segura; se não existir, retorna lista vazia
        estabelecimentos = payload.get("estabelecimentos", [])
        lista_normalizada = []
        
        for est in estabelecimentos:
            # Utiliza .get() para atribuir um estado de fallback caso atributos venham nulos
            lista_normalizada.append({
                "cnes": est.get("codigo_cnes"),
                "razao_social": est.get("nome_razao_social", "Razão Social Indisponível"),
                "nome_fantasia": est.get("nome_fantasia", "Nome Indisponível"),
                "tipo_gestao": est.get("tipo_gestao"),
                "id_tipo_unidade": est.get("codigo_tipo_unidade"),
                "cep": est.get("codigo_cep_estabelecimento", "CEP Indisponível"),
                "endereco": est.get("endereco_estabelecimento"),
                "numero": est.get("numero_estabelecimento"),
                "bairro": est.get("bairro_estabelecimento"),
                "id_municipio": est.get("codigo_municipio"),
                "id_uf": est.get("codigo_uf"),
                "latitude": est.get("latitude_estabelecimento_grau"),
                "longitude": est.get("longitude_estabelecimento_grau"),
                "telefone": est.get("numero_telefone_estabelecimento", "Não informado"),
                "turno_atendimento": est.get("descricao_turno_atendimento", "Não informado"),
            })
            
        return lista_normalizada