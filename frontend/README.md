# BRchain Portal — Front-end

Portal web que reúne informações públicas oficiais de saúde (medicamentos, doenças e sintomas,
UBS, indicadores regionais), sempre indicando a fonte oficial dos dados.

> **Escopo:** apenas front-end. O front **nunca** chama DATASUS, RNDS ou LLMs diretamente — só a
> API REST interna descrita em `docs/API_CONTRACT.md`. Enquanto o back-end não existe, roda contra
> **dados mock** (MSW) no formato exato do contrato.

## Requisitos

- Node.js ≥ 20.19 (testado com Node 24) e npm

## Começando

```bash
npm install
npm run dev          # http://localhost:5173 — modo mock por padrão
```

Nenhum `.env` é necessário para rodar em mock. Para personalizar, copie `.env.example` para `.env`.

## Modos de dados

| `VITE_DATA_MODE` | Comportamento                                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `mock` (padrão)  | MSW intercepta `/api/v1/*` no navegador e responde com fixtures do contrato. Exibe o selo “Dados de demonstração”.            |
| `api`            | Chama `${VITE_API_URL}/api/v1`. Com `VITE_API_URL` vazio usa a mesma origem (proxy do Vite em dev → `VITE_DEV_PROXY_TARGET`). |

Trocar de modo **não exige alterar componentes**.

### Simular falhas no modo mock

Acrescente `?mock=` à URL (fica salvo na sessão; `?mock=off` limpa):
`error503`, `error500`, `ratelimit`, `timeout`, `invalid`, `empty`, `estimate`, `stale`, `fallback`
(combináveis: `?mock=stale,estimate`).

## Scripts

| Script                                     | O que faz                               |
| ------------------------------------------ | --------------------------------------- |
| `npm run dev`                              | Servidor de desenvolvimento             |
| `npm run build`                            | `tsc -b` + build de produção em `dist/` |
| `npm run preview`                          | Serve o build localmente                |
| `npm run typecheck`                        | Checagem de tipos                       |
| `npm run lint` / `format` / `format:check` | ESLint / Prettier                       |
| `npm test` / `test:watch` / `coverage`     | Vitest + Testing Library + MSW          |

## Docker

```bash
docker build -t brchain-frontend .
docker build -t brchain-frontend --build-arg VITE_DATA_MODE=api --build-arg VITE_API_URL=https://api.exemplo.gov.br .
docker run -p 8080:80 brchain-frontend
```

As variáveis `VITE_*` são embutidas **em tempo de build** (são públicas — nunca coloque segredos).
O `nginx.conf` faz o fallback de SPA, cache de assets e expõe `/healthz`.

## Estrutura

```
src/
├── api/          client.ts (fetch único), endpoints.ts, schemas.ts (Zod = contrato), types.ts, queryKeys.ts
├── components/   layout/, ui/, map/, charts/
├── config/       env.ts (validação das VITE_*)
├── features/     hooks TanStack Query por domínio (únicos que chamam api/endpoints)
├── mocks/        MSW: handlers, fixtures, cenários de falha
├── pages/        Home, Directory, UnitDetail, NotFound
└── test/         setup e ambiente de testes
docs/
└── prototype/    CSS e App compilado do protótipo Figma (referência visual — fonte da verdade)
```

## Mapa

Tiles configuráveis por `VITE_MAP_TILE_URL`. O `tile.openstreetmap.org` é apenas para dev/demo;
em produção configure outro provedor (MapTiler, Stadia, self-hosted…).
