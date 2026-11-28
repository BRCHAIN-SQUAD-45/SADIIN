from fastapi import APIRouter, HTTPException
from app.integrations.ibge import IbgeConector
from app.integrations.geocoding import municipio_por_coordenadas

router = APIRouter()

@router.get("/states")
async def list_states():
    async with IbgeConector() as ibge:
        return await ibge.listar_estados()

@router.get("/states/{uf}/cities")
async def list_cities(uf: str):
    async with IbgeConector() as ibge:
        return await ibge.listar_municipios(uf)

@router.get("/resolve")
async def resolve_location(lat: float, lng: float):
    """
    Resolve coordenadas GPS para município (ibgeCode, uf, cityName).
    Usado quando o usuário clica em 'Usar GPS' na HomePage.
    
    Issue #76: Bug GPS não atualiza ibgeCode/uf/cityName
    """
    result = await municipio_por_coordenadas(lat, lng)
    if not result:
        raise HTTPException(
            status_code=404, 
            detail="Município não encontrado para as coordenadas fornecidas"
        )
    
    return {
        "ibgeCode": result["codigo_ibge"],
        "uf": result["uf"],
        "cityName": result["municipio"]
    }