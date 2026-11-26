from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import logging
from pathlib import Path

from app.api.responses import api_error
# Importação de todos os roteadores
from app.api.routers import meta, dashboard, medications, conditions, ubs, locations, insercoes

logger = logging.getLogger(__name__)

app = FastAPI()
app.mount(
    "/assets/medications",
    StaticFiles(directory=Path(__file__).resolve().parent / "static" / "medications"),
    name="medication-assets",
)

# Configuração de CORS (Liberando o Front-end React/Vite)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    insercoes.router,
    prefix="/api/v1"
)

# Tratamento Global de Erros (Envelope padrão exigido)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Erro interno não tratado em %s", request.url.path, exc_info=exc)
    return api_error(500, "INTERNAL_SERVER_ERROR", "Ocorreu um erro interno.", request.url.path)

# Registro das rotas com o prefixo exigido
app.include_router(meta.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(medications.router, prefix="/api/v1/medications")
app.include_router(conditions.router, prefix="/api/v1/conditions")
app.include_router(ubs.router, prefix="/api/v1/ubs")
app.include_router(locations.router, prefix="/api/v1/locations", tags=["Locations"])