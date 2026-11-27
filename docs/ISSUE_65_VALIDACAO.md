# Issue #65 — validação local

## O que foi alterado

- O cache municipal usa `city_ibge` como chave primária no PostgreSQL.
- Os dados do município e das unidades são persistidos em JSONB com validade de 15 minutos.
- A listagem filtra e pagina o conjunto municipal cacheado, evitando consultas repetidas ao CNES durante a paginação.
- A rota `/unidades` aguarda o carregamento da lista e só redireciona quando recebe um `cnes_code` real.
- O CNES `9990001` permanece permitido somente no modo mock.

## Configuração necessária

1. Copie `backend/.env.example` para `backend/.env`.
2. Configure `DATABASE_URL` com uma URL PostgreSQL válida.
3. A tabela `ubs_cache_municipio` é criada automaticamente na primeira consulta. A migration equivalente está em `backend/app/database/migrations/001_ubs_city_cache.sql`.
4. Para o frontend em modo API, configure `VITE_DATA_MODE=api` e `VITE_API_URL` conforme o ambiente.

## Testes

Backend (em `backend/`):

```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

Frontend (em `frontend/`):

```bash
npm ci
npm run typecheck
npm test -- --run
npm run build
```

## Teste de integração PostgreSQL e municípios

Com PostgreSQL disponível e `DATABASE_URL` configurada, iniciar o backend e consultar:

```text
GET /api/v1/ubs?city_ibge=5300108&page=1&page_size=20
GET /api/v1/ubs?city_ibge=5208707&page=1&page_size=20
```

Os códigos correspondem a Brasília/DF e Goiânia/GO. Confirmar que as respostas contêm unidades com CNES real e que existem registros separados para cada `city_ibge` em `ubs_cache_municipio`.

## Limitação desta validação

Os testes de integração dependem de PostgreSQL e de acesso às fontes externas do IBGE/CNES. Não devem ser considerados aprovados apenas com testes unitários ou compilação.
