"""Tabela oficial da CID-10 (DATASUS), lida dos CSVs em backend/app/data/cid10/.

Os arquivos são os do download oficial (www2.datasus.gov.br/cid10/V2008), convertidos de
Latin-1 para UTF-8. Ficam no repositório para o portal não depender do site antigo do DATASUS
em tempo de execução e para os testes conferirem os códigos sem internet.
"""

import csv
import re
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import NamedTuple

PASTA = Path(__file__).resolve().parents[1] / "data" / "cid10"


class Capitulo(NamedTuple):
    numero: int
    inicio: str
    fim: str
    nome: str  # ex.: "Algumas doenças infecciosas e parasitárias"
    slug: str


def slugify(texto: str) -> str:
    sem_acento = "".join(
        ch for ch in unicodedata.normalize("NFD", texto.casefold()) if unicodedata.category(ch) != "Mn"
    )
    return re.sub(r"[^a-z0-9]+", "-", sem_acento).strip("-")


def _ler(nome: str) -> list[dict[str, str]]:
    with open(PASTA / nome, encoding="utf-8", newline="") as arquivo:
        return list(csv.DictReader(arquivo, delimiter=";"))


@lru_cache(maxsize=1)
def _tabelas() -> tuple[dict, dict, dict, list[Capitulo]]:
    categorias = {r["CAT"]: r["DESCRICAO"].strip() for r in _ler("CID-10-CATEGORIAS.csv")}
    subcategorias = {r["SUBCAT"]: r["DESCRICAO"].strip() for r in _ler("CID-10-SUBCATEGORIAS.csv")}
    grupos = {(r["CATINIC"], r["CATFIM"]): r["DESCRICAO"].strip() for r in _ler("CID-10-GRUPOS.csv")}
    capitulos = []
    for r in _ler("CID-10-CAPITULOS.csv"):
        # DESCRICAO vem como "Capítulo I - Algumas doenças..." -> fica só o nome completo
        # (o DESCRABREV é abreviado demais: "Doenças sangue órgãos hemat e transt imunitár").
        nome = re.sub(r"^Cap[ií]tulo\s+[IVXL]+\s*-\s*", "", r["DESCRICAO"]).strip()
        capitulos.append(Capitulo(int(r["NUMCAP"]), r["CATINIC"], r["CATFIM"], nome, slugify(nome)))
    return categorias, subcategorias, grupos, capitulos


def _partes(codigo: str) -> tuple[str, str | None]:
    codigo = codigo.strip().upper()
    if "-" in codigo:
        inicio, fim = codigo.split("-", 1)
        return inicio, fim
    return codigo, None


def descricao(codigo: str) -> str | None:
    """Descrição oficial de "A90", "A05.1" ou de um intervalo "B15-B19" (grupo ou faixa de categorias)."""
    categorias, subcategorias, grupos, _ = _tabelas()
    inicio, fim = _partes(codigo)
    if fim:
        if (inicio, fim) in grupos:
            return grupos[(inicio, fim)]
        if inicio in categorias and fim in categorias:
            return f"{categorias[inicio]} a {categorias[fim].lower()}"
        return None
    if "." in inicio:
        return subcategorias.get(inicio.replace(".", ""))
    return categorias.get(inicio)


def capitulo(codigo: str) -> Capitulo | None:
    """Capítulo da CID-10 a que o código pertence (usado como categoria no portal)."""
    _, _, _, capitulos = _tabelas()
    inicio, _ = _partes(codigo)
    categoria = inicio.split(".")[0][:3]
    return next((c for c in capitulos if c.inicio <= categoria <= c.fim), None)


def normalizar_codigo(texto: str) -> str:
    """"a90", "A05.1", "a051" -> "A90", "A051" (para comparar códigos digitados na busca)."""
    return re.sub(r"[^A-Z0-9]", "", texto.upper())
