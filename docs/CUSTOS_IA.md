# Controle de Consumo de Tokens e Custos de IA (Item 2.2)

Este documento registra o consumo real de tokens utilizado no desenvolvimento assistido por IA do projeto **SADIIN / BRchain Portal**.

---

## 1. Desenvolvimento Front-end (Responsável: Lia)

Os números abaixo foram extraídos diretamente dos logs de execução (`input_tokens` e `output_tokens`) das sessões de construção do Front-end:

| Data | Prompt / Etapa | Escopo Entregue | Interações | Tokens de Entrada (Reais) | Tokens de Saída (Reais) | Total de Tokens |
|---|---|---|---:|---:|---:|---:|
| 15/10/2026 | [`FE01`](./prompts/FE01-inventario-prototipo-contrato.md) — Fase 0 | Inventário do protótipo Figma, tokens de design e contrato `/api/v1` | 15 | 866.782 | 26.432 | 893.214 |
| 28/10/2026 | [`FE02`](./prompts/FE02-scaffold-cliente-http-msw.md) — Fase 1 | Scaffold React 18 + Vite + TS, cliente HTTP, schemas Zod, MSW e Docker | 22 | 273.938 | 33.451 | 307.389 |
| 28/10/2026 | [`FE03`](./prompts/FE03-layout-global-e-home.md) — Fase 2 | Layout global (`GovBar`, `Header`, `Footer`), página Home e 34 testes Vitest | 69 | 455.470 | 92.207 | 547.677 |
| 28/10/2026 | [`FE04`](./prompts/FE04-telas-medicamentos-doencas-ubs.md) — Fase 3 | Páginas de Medicamentos, Doenças e Sintomas, Detalhes da UBS e 40 testes Vitest | 70 | 313.866 | 63.218 | 377.084 |
| 02/11/2026 | [`FE05`](./prompts/FE05-mappers-mapa-leaflet-contrato.md) — Fases 4, 5 e 6 | Camada de mappers, mapa interativo Leaflet, gráfico Recharts (`US-04.4`), contrato `/api/v1` e 47 testes Vitest | 35 | 1.851.947 | 108.904 | 1.960.851 |
| 24/11/2026 | [`FE06`](./prompts/FE06-filtro-ubs-acessibilidade-ux-portugal.md) — Cards 4 e 6 | Filtro de UBS por UF/município, `rooms: null`, escala proporcional, acessibilidade `A/A+/A++`, UI/UX SNS 24/Infarmed e 61 testes Vitest | 47 | 829.291 | 39.755 | 869.046 |
| 25/11/2026 | [`FE06`](./prompts/FE06-filtro-ubs-acessibilidade-ux-portugal.md) `v1.3` — Revisão do PR #67 | Remoção de dados não confirmados do resumo do medicamento, guia de atendimento com emergências (192 primeiro), escala de fonte `A/A+/A++` corrigida, cabeçalho e celular, `formatDisplayName` e 63 testes Vitest | 49 | 1.330.955 | 36.779 | 1.367.734 |
| **Total Front-end (Fases 0 a 6 + Cards 4 e 6 + revisão do PR #67)** | — | — | **307** | **5.922.249** | **400.746** | **6.322.995** |

---

## 2. Desenvolvimento Back-end e Chamadas da API de IA (Responsáveis: Back-end e IA)

*(Seção reservada para preenchimento nas branches de Back-end e IA com o consumo de tokens dos conectores e das chamadas em tempo de execução das LLMs).*

---

## 3. Integração Front-end ↔ Back-end (Responsável: Nícolas)

| Data | Prompt / Etapa | Escopo Entregue | Ferramenta / Plano | Contexto final da sessão (tokens) |
|---|---|---|---|---:|
| 10/11/2026 | [`INT01`](./prompts/INT01-integracao-front-back.md) | Verificação ao vivo das 21 rotas, ajustes de contrato, tratamento de 501, 11 testes novos, docs | Claude Code (Claude Opus 5.5), plano **Pro** (assinatura, sem cobrança por token) | ≈ 269.000 |
| 25/11/2026 | [`INT02`](./prompts/INT02-desempenho-ubs-e-noticias.md) | #62 (cache e paralelismo da ficha da UBS, nomes legíveis) e #57 (notícias oficiais do gov.br), 26 testes `pytest`, workflow do back-end, docs | Claude Code (Claude Opus 5.5), plano **Pro** | ≈ 429.000 (≈ 160.000 a mais que no INT01, na mesma sessão) |
| 25/11/2026 | [`INT03`](./prompts/INT03-doencas-e-busca-global.md) | Revisão do Kanban (PDF) + #43/#46 (catálogo de doenças com CID-10) e #33 (busca global), 23 testes `pytest`, docs | Claude Code (Claude Opus 5.5), plano **Pro** | ≈ 637.000 (≈ 208.000 a mais que no INT02, na mesma sessão) |
| 26/11/2026 | [`INT04`](./prompts/INT04-busca-tolerante-a-erros.md) | Revisão do PR #67 + #64 (índice de busca, termo reconhecido, "Você quis dizer?"), 14 testes novos, docs | Claude Code (Claude Opus 5.5), plano **Pro** | ≈ 810.000 (≈ 173.000 a mais que no INT03, na mesma sessão) |

> **Como ler este número:** o app do Claude Code informa o tamanho do contexto da sessão (≈ 269 mil tokens de 1 milhão, cerca de 27%), e não a soma de tokens de entrada e saída de cada chamada, como na tabela do Front-end. Por isso o valor não é diretamente comparável com a seção 1. No plano Pro o custo é a assinatura mensal: a sessão consumiu cerca de 14% do limite de 5 horas e 15% do limite semanal.

> **INT02:** feito na mesma sessão do INT01, por isso o contexto acumula as duas tarefas. A parte do INT02 é a diferença, cerca de 160 mil tokens. Consumo do plano Pro: cerca de 22% do limite de 5 horas e 14% do limite semanal.

> **INT03:** mesma sessão do INT01 e do INT02. A parte do INT03 (com a revisão do Kanban) é a diferença, cerca de 208 mil tokens. Consumo do plano Pro: cerca de 57% do limite de 5 horas e 18% do limite semanal.

> **INT04:** mesma sessão dos anteriores. A parte do INT04 (com a revisão do PR #67) é a diferença, cerca de 173 mil tokens. Consumo do plano Pro: cerca de 28% do limite de 5 horas e 26% do limite semanal.
