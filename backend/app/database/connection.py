
import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv

# Localiza o arquivo .env dentro da pasta backend
ENV_PATH = Path(__file__).resolve().parents[2] / ".env"

# Carrega as variáveis de ambiente
load_dotenv(ENV_PATH)


def conectar_banco():
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError(
            "A variável DATABASE_URL não foi configurada."
        )

    return psycopg.connect(database_url)
