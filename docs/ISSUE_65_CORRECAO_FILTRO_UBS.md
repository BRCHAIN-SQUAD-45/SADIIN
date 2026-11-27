# Issue #65 — Cache por município e redirecionamento da aba UBS

## Backend

- O conjunto de estabelecimentos CNES ativos que atendem ao SUS é carregado por município.
- O código IBGE de 7 dígitos (`city_ibge`) é a chave primária do cache PostgreSQL.
- A tabela `ubs_cache_municipio` guarda os dados do município, as unidades, a data de busca e a expiração.
- O TTL é de 15 minutos (`UNIT_CACHE_TTL_SECONDS`).
- O cache em memória continua sendo usado para evitar consultas repetidas dentro do mesmo processo.
- A paginação e o filtro por nome/endereço passam a ocorrer sobre o conjunto municipal cacheado.
- Se `DATABASE_URL` não estiver configurada ou o PostgreSQL estiver indisponível, a aplicação registra aviso e continua com o cache em memória/CNES.

A tabela é criada automaticamente na primeira consulta. Também há uma migração SQL em
`backend/app/database/migrations/001_ubs_city_cache.sql` para aplicação manual.

## Frontend

- Em modo API real, `/unidades/9990001` não tenta carregar a ficha fictícia.
- A tela aguarda a consulta das unidades do `city_ibge` escolhido.
- Quando uma unidade real é retornada, navega para `/unidades/{cnes_real}`.
- Se a lista vier vazia, mostra estado vazio; se a API falhar, mostra erro e opção de tentar novamente.
- O comportamento de demonstração/mock continua preservado.

## Configuração

Defina `DATABASE_URL` no arquivo `backend/.env` apontando para um PostgreSQL acessível.
Sem essa variável, a aplicação continua executando, mas não haverá persistência entre reinícios/workers.

## Validação realizada

- Compilação sintática dos arquivos Python alterados: OK.
- A suíte pytest não pôde ser executada neste ambiente porque a dependência `tenacity` não está instalada.
- O build/teste TypeScript não pôde ser executado porque `frontend/node_modules` não está presente.

## Revisão adicional

Leituras do PostgreSQL não renovam a validade do snapshot. O bloqueio de atualização é por município, e snapshots expirados podem ser usados quando a fonte falhar. O frontend filtra códigos fictícios e inválidos no modo API.

Para testar localmente com Docker Desktop, na raiz: `docker compose -f compose.issue65.yml up -d`. Em `backend/.env`, use `DATABASE_URL=postgresql://sadiin:sadiin_local@localhost:5432/sadiin` (credenciais somente para desenvolvimento). Se já houver PostgreSQL, use a conexão existente em vez do Docker. Consulte Brasília e Goiânia conforme ISSUE_65_VALIDACAO.md e confira `SELECT city_ibge, fetched_at, expires_at FROM ubs_cache_municipio;`. A primeira consulta pode ser lenta; a segunda deve aproveitar o cache. A integração real não foi executada neste ambiente.
