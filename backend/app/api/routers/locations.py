from fastapi import APIRouter
from app.integrations.ibge import IbgeConector

router = APIRouter()

@router.get("/states")
async def list_states():
    async with IbgeConector() as ibge:
        return await ibge.listar_estados()

@router.get("/states/{uf}/cities")
async def list_cities(uf: str):
    async with IbgeConector() as ibge:
        return await ibge.listar_municipios(uf)