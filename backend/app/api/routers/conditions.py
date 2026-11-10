from fastapi import APIRouter

from app.api.responses import source_unavailable

router = APIRouter(tags=["Doenças e Sintomas"])


@router.get("/categories")
async def condition_categories():
    return source_unavailable(
        "/conditions/categories",
        "Não há uma API pública operacional integrada para o catálogo de doenças e sintomas.",
    )


@router.get("")
async def list_conditions():
    return source_unavailable(
        "/conditions",
        "O SINAN e os conjuntos epidemiológicos do SUS não oferecem catálogo clínico aberto integrado por esta API.",
    )


@router.get("/{slug}")
async def get_condition_detail(slug: str):
    return source_unavailable(
        f"/conditions/{slug}",
        "Não há uma API pública operacional integrada para detalhes clínicos desta condição.",
    )
