from fastapi import APIRouter, HTTPException, Query, Path
from typing import Optional
import logging
from app.integrations.cnes import CnesConector 

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Unidades de Saúde"])

@router.get("/api/v1/unidades", status_code=200)
async def listar_unidades(
    municipio: str = Query(..., description="Código IBGE do município para filtro regional"),
    tipo: Optional[str] = Query(None, description="Filtro opcional por tipo de unidade (código)"),
    latitude: Optional[float] = Query(None, description="Latitude para filtro por mapa"),
    longitude: Optional[float] = Query(None, description="Longitude para filtro por mapa")
):
    """
    Lista paginada de unidades de saúde (estabelecimentos).
    Filtros: localização (mapa/coordenadas), tipo e município.
    """
    # Validação rigorosa dos parâmetros geográficos
    if (latitude is not None and longitude is None) or (longitude is not None and latitude is None):
        raise HTTPException(
            status_code=400, 
            detail="Formato inválido: deve fornecer tanto a latitude como a longitude para a pesquisa no mapa."
        )

    try:
        # Inicia a sessão HTTP assíncrona baseada no teu ficheiro cnes.py
        async with CnesConector() as conector:
            
            # Executa a pesquisa e passa pelos teus tratamentos e normalização defensiva
            unidades = await conector.buscar_unidades_por_municipio(codigo_municipio=municipio)
            
            # Uma vez que a API do DATASUS devolve todas as unidades, aplicamos o filtro de tipo em memória, se exigido
            if tipo:
                unidades = [u for u in unidades if str(u.get("id_tipo_unidade")) == tipo]
                
            # Retorna a lista processada e limpa para o frontend
            return {
                "resultados": unidades, 
                "total": len(unidades)
            }

    except Exception as e:
        logger.error(f"Erro ao orquestrar a rota de listagem de unidades: {e}")
        # Captura as falhas da API externa e devolve o erro 502 (Bad Gateway)
        raise HTTPException(
            status_code=502, 
            detail="O serviço do DATASUS encontra-se temporariamente indisponível. Tente novamente mais tarde."
        )


@router.get("/api/v1/unidades/{id}", status_code=200)
async def detalhar_unidade(
    id: str = Path(..., description="Identificador único (CNES) do estabelecimento")
):
    """
    Detalhes de uma unidade de saúde.
    """
    try:
        # Em ambiente de produção, este método não fará uma requisição direta ao DATASUS.
        # Ele consultará a base de dados PostgreSQL local para encontrar o estabelecimento
        # e fazer o cruzamento (JOIN) com as métricas de lotação.
        
        # Exemplo da validação e bloqueio de unidade não encontrada (404)
        unidade_encontrada = False 
        
        if not unidade_encontrada:
            raise HTTPException(
                status_code=404, 
                detail=f"Não foi encontrada nenhuma unidade de saúde com o identificador CNES {id}."
            )
            
        # O retorno virá da base de dados local
        return {"mensagem": "Dados da base de dados PostgreSQL entrarão aqui."}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro interno ao detalhar unidade {id}: {e}")
        raise HTTPException(
            status_code=500, 
            detail="Ocorreu um erro interno no servidor ao processar os detalhes da unidade."
        )