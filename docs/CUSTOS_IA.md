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
| **Total Front-end (Fases 0 a 6)** | — | — | **211** | **3.762.003** | **324.212** | **4.086.215** |

---

## 2. Desenvolvimento Back-end e Chamadas da API de IA (Responsáveis: Back-end e IA)

*(Seção reservada para preenchimento nas branches de Back-end e IA com o consumo de tokens dos conectores e das chamadas em tempo de execução das LLMs).*

---

## 3. Integração Front-end ↔ Back-end (Responsável: Nícolas)

| Data | Prompt / Etapa | Escopo Entregue | Ferramenta / Plano | Contexto final da sessão (tokens) |
|---|---|---|---|---:|
| 10/11/2026 | [`INT01`](./prompts/INT01-integracao-front-back.md) | Verificação ao vivo das 21 rotas, ajustes de contrato, tratamento de 501, 11 testes novos, docs | Claude Code (Claude Opus 5.5), plano **Pro** (assinatura, sem cobrança por token) | ≈ 269.000 |

> **Como ler este número:** o app do Claude Code informa o tamanho do contexto da sessão (≈ 269 mil tokens de 1 milhão, cerca de 27%), e não a soma de tokens de entrada e saída de cada chamada, como na tabela do Front-end. Por isso o valor não é diretamente comparável com a seção 1. No plano Pro o custo é a assinatura mensal: a sessão consumiu cerca de 14% do limite de 5 horas e 15% do limite semanal.
