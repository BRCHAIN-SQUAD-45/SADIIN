
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from psycopg.errors import OperationalError, UniqueViolation, ForeignKeyViolation

from app.database.connection import conectar_banco
from app.integrations.cnes import CnesConector
from app.integrations.ibge import IbgeConector
from app.integrations.demas import buscar_servicos_cnes


router = APIRouter(tags=["Inserções"])


# ============================================================
# MODELOS
# ============================================================

class EstabelecimentoEntrada(BaseModel):
    cnes: str = Field(min_length=1, max_length=20)
    razao_social: str | None = None
    nome_fantasia: str | None = None
    endereco: str | None = None
    telefone: str | None = None


class MedicamentoEntrada(BaseModel):
    nome: str = Field(min_length=1, max_length=255)
    categoria: str | None = Field(default=None, max_length=100)
    indicacao: str | None = None
    requer_receita: bool = False
    imagem_url: str | None = Field(default=None, max_length=500)


class DoencaEntrada(BaseModel):
    nome: str = Field(min_length=1, max_length=255)
    cid10: str | None = Field(default=None, max_length=10)
    categoria: str | None = Field(default=None, max_length=100)
    sintomas_principais: str | None = None
    prevencao_tratamento: str | None = None


class ServicoEntrada(BaseModel):
    id_estabelecimento: int = Field(gt=0)
    nome_servico: str = Field(min_length=1, max_length=255)
    categoria_servico: str | None = Field(default=None, max_length=100)
    disponivel: bool = True


# ============================================================
# TRATAMENTO DE ERROS
# ============================================================

def tratar_erro_banco(erro):
    if isinstance(erro, OperationalError):
        raise HTTPException(
            status_code=503,
            detail="Não foi possível conectar ao PostgreSQL."
        ) from erro

    if isinstance(erro, ForeignKeyViolation):
        raise HTTPException(
            status_code=404,
            detail="O estabelecimento informado não existe."
        ) from erro

    if isinstance(erro, UniqueViolation):
        raise HTTPException(
            status_code=409,
            detail="Já existe um registro com esse identificador."
        ) from erro

    raise erro


def validar_cnes(cnes: str):
    if not cnes.isascii() or not cnes.isdigit():
        raise HTTPException(
            status_code=422,
            detail="O CNES deve conter apenas números."
        )


# ============================================================
# 1. CADASTRAR ESTABELECIMENTO
# ============================================================

@router.post("/estabelecimentos", status_code=201)
def inserir_estabelecimento(dados: EstabelecimentoEntrada):
    validar_cnes(dados.cnes)

    try:
        with conectar_banco() as conexao:
            with conexao.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO estabelecimento
                    (cnes, razao_social, nome_fantasia, endereco, telefone)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id_estabelecimento
                    """,
                    (
                        dados.cnes,
                        dados.razao_social,
                        dados.nome_fantasia,
                        dados.endereco,
                        dados.telefone
                    )
                )
                identificador = cursor.fetchone()[0]

        return {
            "mensagem": "Estabelecimento cadastrado com sucesso!",
            "id_estabelecimento": identificador
        }

    except (OperationalError, UniqueViolation, ForeignKeyViolation) as erro:
        tratar_erro_banco(erro)


# ============================================================
# 2. IMPORTAR ESTABELECIMENTO DO CNES + IBGE
# ============================================================

@router.post("/estabelecimentos/importar/{cnes}", status_code=201)
async def importar_estabelecimento_cnes(cnes: str):
    validar_cnes(cnes)

    try:
        async with CnesConector() as conector:
            unidade = await conector.buscar_unidade(cnes)

        if not unidade or not unidade.get("cnes"):
            raise HTTPException(
                status_code=404,
                detail="Estabelecimento não encontrado no CNES."
            )

        municipio = None
        codigo_municipio = unidade.get("id_municipio")
        codigo_uf = unidade.get("id_uf")

        if codigo_municipio and codigo_uf:
            async with IbgeConector() as ibge:
                municipio = await ibge.buscar_municipio_por_codigo_cnes(
                    codigo_municipio,
                    codigo_uf
                )

    except httpx.HTTPStatusError as erro:
        status = 404 if erro.response.status_code == 404 else 502
        raise HTTPException(
            status_code=status,
            detail="Falha ao consultar CNES ou IBGE."
        ) from erro

    except (httpx.RequestError, ValueError) as erro:
        raise HTTPException(
            status_code=502,
            detail="Não foi possível consultar os dados externos."
        ) from erro

    try:
        with conectar_banco() as conexao:
            with conexao.cursor() as cursor:
                id_uf = None
                id_municipio = None

                if municipio:
                    cursor.execute(
                        "SELECT id_uf FROM uf WHERE sigla = %s",
                        (municipio["uf"],)
                    )
                    resultado = cursor.fetchone()

                    if resultado:
                        id_uf = resultado[0]

                    if id_uf is not None:
                        cursor.execute(
                            """
                            SELECT id_municipio
                            FROM municipio
                            WHERE codigo_ibge = %s AND id_uf = %s
                            ORDER BY id_municipio
                            LIMIT 1
                            """,
                            (municipio["ibge_code"], id_uf)
                        )
                        resultado = cursor.fetchone()

                        if resultado:
                            id_municipio = resultado[0]
                        else:
                            cursor.execute(
                                """
                                INSERT INTO municipio
                                (nome, id_uf, codigo_ibge)
                                VALUES (%s, %s, %s)
                                RETURNING id_municipio
                                """,
                                (
                                    municipio["name"],
                                    id_uf,
                                    municipio["ibge_code"]
                                )
                            )
                            id_municipio = cursor.fetchone()[0]

                cursor.execute(
                    """
                    INSERT INTO estabelecimento (
                        cnes, razao_social, nome_fantasia,
                        tipo_gestao, cep, endereco, numero, bairro,
                        latitude, longitude, telefone,
                        turno_atendimento, data_atualizacao,
                        id_uf, id_municipio
                    )
                    VALUES (
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (cnes) DO UPDATE SET
                        razao_social = EXCLUDED.razao_social,
                        nome_fantasia = EXCLUDED.nome_fantasia,
                        tipo_gestao = EXCLUDED.tipo_gestao,
                        cep = EXCLUDED.cep,
                        endereco = EXCLUDED.endereco,
                        numero = EXCLUDED.numero,
                        bairro = EXCLUDED.bairro,
                        latitude = EXCLUDED.latitude,
                        longitude = EXCLUDED.longitude,
                        telefone = EXCLUDED.telefone,
                        turno_atendimento = EXCLUDED.turno_atendimento,
                        data_atualizacao = EXCLUDED.data_atualizacao,
                        id_uf = COALESCE(
                            EXCLUDED.id_uf, estabelecimento.id_uf
                        ),
                        id_municipio = COALESCE(
                            EXCLUDED.id_municipio,
                            estabelecimento.id_municipio
                        )
                    RETURNING
                        id_estabelecimento,
                        id_uf,
                        id_municipio,
                        id_tipo_unidade
                    """,
                    (
                        unidade["cnes"],
                        unidade.get("razao_social"),
                        unidade.get("nome_fantasia"),
                        unidade.get("tipo_gestao"),
                        unidade.get("cep"),
                        unidade.get("endereco"),
                        unidade.get("numero"),
                        unidade.get("bairro"),
                        unidade.get("latitude"),
                        unidade.get("longitude"),
                        unidade.get("telefone"),
                        unidade.get("turno_atendimento"),
                        unidade.get("data_atualizacao"),
                        id_uf,
                        id_municipio
                    )
                )

                resultado = cursor.fetchone()

        return {
            "mensagem": "Estabelecimento importado com sucesso!",
            "id_estabelecimento": resultado[0],
            "relacionamentos": {
                "id_uf": resultado[1],
                "id_municipio": resultado[2],
                "id_tipo_unidade": resultado[3]
            },
            "estabelecimento": unidade
        }

    except (OperationalError, UniqueViolation, ForeignKeyViolation) as erro:
        tratar_erro_banco(erro)


# ============================================================
# 3. CADASTRAR MEDICAMENTO
# ============================================================

@router.post("/medicamentos", status_code=201)
def inserir_medicamento(dados: MedicamentoEntrada):
    try:
        with conectar_banco() as conexao:
            with conexao.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO medicamento
                    (nome, categoria, indicacao, requer_receita, imagem_url)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id_medicamento
                    """,
                    (
                        dados.nome,
                        dados.categoria,
                        dados.indicacao,
                        dados.requer_receita,
                        dados.imagem_url
                    )
                )
                identificador = cursor.fetchone()[0]

        return {
            "mensagem": "Medicamento cadastrado com sucesso!",
            "id_medicamento": identificador
        }

    except (OperationalError, UniqueViolation, ForeignKeyViolation) as erro:
        tratar_erro_banco(erro)


# ============================================================
# 4. CADASTRAR DOENÇA
# ============================================================

@router.post("/doencas", status_code=201)
def inserir_doenca(dados: DoencaEntrada):
    try:
        with conectar_banco() as conexao:
            with conexao.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO doenca
                    (nome, cid10, categoria,
                     sintomas_principais, prevencao_tratamento)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id_doenca
                    """,
                    (
                        dados.nome,
                        dados.cid10,
                        dados.categoria,
                        dados.sintomas_principais,
                        dados.prevencao_tratamento
                    )
                )
                identificador = cursor.fetchone()[0]

        return {
            "mensagem": "Doença cadastrada com sucesso!",
            "id_doenca": identificador
        }

    except (OperationalError, UniqueViolation, ForeignKeyViolation) as erro:
        tratar_erro_banco(erro)


# ============================================================
# 5. CADASTRAR SERVIÇO
# ============================================================

@router.post("/servicos", status_code=201)
def inserir_servico(dados: ServicoEntrada):
    try:
        with conectar_banco() as conexao:
            with conexao.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id_servico
                    FROM servico_ubs
                    WHERE id_estabelecimento = %s
                      AND nome_servico = %s
                      AND categoria_servico IS NOT DISTINCT FROM %s
                    LIMIT 1
                    """,
                    (
                        dados.id_estabelecimento,
                        dados.nome_servico,
                        dados.categoria_servico
                    )
                )

                existente = cursor.fetchone()

                if existente:
                    return {
                        "mensagem": "Serviço já cadastrado.",
                        "id_servico": existente[0]
                    }

                cursor.execute(
                    """
                    INSERT INTO servico_ubs
                    (id_estabelecimento, nome_servico,
                     categoria_servico, disponivel)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id_servico
                    """,
                    (
                        dados.id_estabelecimento,
                        dados.nome_servico,
                        dados.categoria_servico,
                        dados.disponivel
                    )
                )

                identificador = cursor.fetchone()[0]

        return {
            "mensagem": "Serviço cadastrado com sucesso!",
            "id_servico": identificador
        }

    except (OperationalError, UniqueViolation, ForeignKeyViolation) as erro:
        tratar_erro_banco(erro)


# ============================================================
# 6. IMPORTAR SERVIÇOS DO CNES
# ============================================================

@router.post("/estabelecimentos/{cnes}/importar-servicos")
async def importar_servicos(cnes: str):
    validar_cnes(cnes)

    try:
        servicos = await buscar_servicos_cnes(cnes)

    except (httpx.HTTPError, ValueError) as erro:
        raise HTTPException(
            status_code=502,
            detail="Não foi possível consultar os serviços do CNES."
        ) from erro

    try:
        with conectar_banco() as conexao:
            with conexao.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id_estabelecimento
                    FROM estabelecimento
                    WHERE cnes = %s
                    """,
                    (cnes,)
                )

                resultado = cursor.fetchone()

                if not resultado:
                    raise HTTPException(
                        status_code=404,
                        detail="Importe primeiro o estabelecimento do CNES."
                    )

                id_estabelecimento = resultado[0]
                inseridos = 0
                existentes = 0

                for servico in servicos:
                    nome = servico.get("name")
                    categoria = servico.get("category")

                    if not nome:
                        continue

                    cursor.execute(
                        """
                        SELECT id_servico
                        FROM servico_ubs
                        WHERE id_estabelecimento = %s
                          AND nome_servico = %s
                          AND categoria_servico IS NOT DISTINCT FROM %s
                        LIMIT 1
                        """,
                        (id_estabelecimento, nome, categoria)
                    )

                    if cursor.fetchone():
                        existentes += 1
                        continue

                    cursor.execute(
                        """
                        INSERT INTO servico_ubs
                        (id_estabelecimento, categoria_servico,
                         nome_servico, disponivel)
                        VALUES (%s, %s, %s, TRUE)
                        """,
                        (id_estabelecimento, categoria, nome)
                    )

                    inseridos += 1

        return {
            "mensagem": "Importação de serviços finalizada!",
            "cnes": cnes,
            "servicos_encontrados": len(servicos),
            "servicos_inseridos": inseridos,
            "servicos_ja_cadastrados": existentes
        }

    except (OperationalError, UniqueViolation, ForeignKeyViolation) as erro:
        tratar_erro_banco(erro)
