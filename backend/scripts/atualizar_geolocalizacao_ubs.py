"""Atualiza mensalmente as coordenadas das UBS já consultadas no SADIIN.

Execute no primeiro dia de cada mês via cron/Agendador de Tarefas.
Requer DATABASE_URL configurada e acesso à API CNES/IBGE.
"""
import asyncio
import logging

from app.database.connection import conectar_banco
from app.integrations.units import buscar_todas_unidades_municipais

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sadiin.ubs.geo")


def listar_municipios_monitorados() -> list[str]:
    with conectar_banco() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS ubs_cache_municipio (
                    city_ibge VARCHAR(7) PRIMARY KEY,
                    city_data JSONB NOT NULL,
                    units_data JSONB NOT NULL,
                    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    expires_at TIMESTAMPTZ NOT NULL
                )
                """
            )
            cur.execute(
                """
                SELECT DISTINCT city_ibge
                FROM ubs_cache_municipio
                WHERE city_ibge ~ '^[0-9]{7}$'
                ORDER BY city_ibge
                """
            )
            return [row[0] for row in cur.fetchall()]


def invalidar_cache_municipal(city_ibge: str) -> None:
    with conectar_banco() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE ubs_cache_municipio SET expires_at = NOW() WHERE city_ibge = %s",
                (city_ibge,),
            )


async def main() -> None:
    municipios = listar_municipios_monitorados()
    if not municipios:
        logger.info("Nenhum município em cache para atualizar.")
        return

    atualizados = 0
    for city_ibge in municipios:
        try:
            invalidar_cache_municipal(city_ibge)
            _, units = await buscar_todas_unidades_municipais(city_ibge)
            com_coordenadas = sum(
                unit.get("latitude") is not None and unit.get("longitude") is not None
                for unit in units
            )
            atualizados += 1
            logger.info(
                "Município %s atualizado: %s unidades, %s com coordenadas.",
                city_ibge, len(units), com_coordenadas,
            )
        except Exception:
            logger.exception("Falha ao atualizar município %s; será tentado no próximo ciclo.", city_ibge)

    logger.info("Atualização mensal concluída: %s/%s municípios.", atualizados, len(municipios))


if __name__ == "__main__":
    asyncio.run(main())
