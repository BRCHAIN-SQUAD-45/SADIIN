# Repositório de Prompts Versionados (Item 1.4)

Esta pasta armazena os prompts utilizados pelo **Squad 45 (SADIIN / BRchain)** separados por arquivo e versionados no Git.

## Prompts do Front-end (Responsável: Lia)

| ID | Arquivo | Objetivo | Versão |
|---|---|---|---|
| **FE01** | [`FE01-inventario-prototipo-contrato.md`](./FE01-inventario-prototipo-contrato.md) | Fase 0 — Extração do protótipo Figma e definição do contrato REST `/api/v1` | `v1.1` |
| **FE02** | [`FE02-scaffold-cliente-http-msw.md`](./FE02-scaffold-cliente-http-msw.md) | Fase 1 — Scaffold React 18 + Vite + TS, cliente HTTP com timeout/retry, Zod e MSW | `v1.1` |
| **FE03** | [`FE03-layout-global-e-home.md`](./FE03-layout-global-e-home.md) | Fase 2 — Layout global (`GovBar`, `Header`, `Footer`), página Home e testes Vitest | `v1.1` |
| **FE04** | [`FE04-telas-medicamentos-doencas-ubs.md`](./FE04-telas-medicamentos-doencas-ubs.md) | Fase 3 — Páginas de Medicamentos, Doenças e Sintomas e Detalhes da UBS | `v1.0` |
| **FE05** | [`FE05-mappers-mapa-leaflet-contrato.md`](./FE05-mappers-mapa-leaflet-contrato.md) | Fases 4, 5 e 6 — Camada de mappers, Mapa interativo Leaflet (`US-04.1`) e Contrato da API | `v1.0` |
| **FE06** | [`FE06-filtro-ubs-acessibilidade-ux-portugal.md`](./FE06-filtro-ubs-acessibilidade-ux-portugal.md) | Cards 4 e 6 — Filtro de UBS por UF/município, acessibilidade `A/A+/A++` e UI/UX SNS 24/Infarmed | `v1.3` |
| **INT01** | [`INT01-integracao-front-back.md`](./INT01-integracao-front-back.md) | Integração Front ↔ Back: verificação ao vivo das rotas, ajustes de contrato e tratamento de `501` | `v1.0` |
| **INT02** | [`INT02-desempenho-ubs-e-noticias.md`](./INT02-desempenho-ubs-e-noticias.md) | Issues #62 e #57: ficha da UBS de ~30 s para < 1 s com cache e notícias oficiais do gov.br na Home | `v1.0` |
| **INT03** | [`INT03-doencas-e-busca-global.md`](./INT03-doencas-e-busca-global.md) | Issues #43, #46 e #33: catálogo de doenças (Saúde de A a Z + CID-10) e busca global nos três catálogos | `v1.0` |
| **INT04** | [`INT04-busca-tolerante-a-erros.md`](./INT04-busca-tolerante-a-erros.md) | Issue #64: busca tolerante a erros de 10–30 s para < 0,5 s (índice de vocabulário) e "Você quis dizer?" no portal | `v1.0` |

> **Integração:** prompts `INT01` a `INT04` (Nícolas). **Back-end e IA:** Os prompts das integrações Python/FastAPI e RAG serão adicionados nas respectivas branches pelos responsáveis de Back-end e IA.

## Issues #17 e #65

- [Mapa interativo e filtro de UBS](./UBS-issue17-issue65.md) — histórico dos prompts e resultados.
