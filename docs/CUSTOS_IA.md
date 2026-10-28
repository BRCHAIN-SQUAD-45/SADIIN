# Controle de Consumo de Tokens e Estimativa de Custos de IA (Item 2.2)

Este documento registra o **consumo real e estimado de tokens** das chamadas de Inteligência Artificial tanto durante o **desenvolvimento assistido por IA (Prompt Ops)** quanto na **execução do produto (Runtime RAG / Busca Semântica)**.

---

## 1. Tabela de Preços de Referência (Outubro/2026)

| Provedor / Modelo | Uso no Projeto | Custo Input (por 1M tokens) | Custo Output (por 1M tokens) |
|---|---|---:|---:|
| **Gemini 1.5 Flash** | Runtime (Busca Semântica / NLP — P06) | US$ 0,075 | US$ 0,300 |
| **Claude 3.5 Haiku** | Runtime alternativo (Busca Semântica — P06) | US$ 0,800 | US$ 4,000 |
| **Claude 3.5 Sonnet** | Desenvolvimento / Engenharia de Código e Contratos (P01–P05) | US$ 3,000 | US$ 15,000 |
| **Gemini 1.5 Pro** | Desenvolvimento / Revisão de Arquitetura e Schemas FHIR | US$ 1,250 | US$ 5,000 |

---

## 2. Registro de Chamadas durante o Desenvolvimento (Prompt Ops)

| Data | ID do Prompt | Tarefa / Issue | Modelo | Iterações | Tokens Input (Total) | Tokens Output (Total) | Custo Estimado (USD) |
|---|---|---|---|:---:|---:|---:|---:|
| 15/10/2026 | `P01` (`v1.0` -> `v1.1`) | Backlog, Épicos e Critérios de Aceite (`#2`–`#25`) | Claude 3.5 Sonnet | 2 | 4.820 | 3.950 | $0,0737 |
| 16/10/2026 | `P02` (`v1.0` -> `v1.1`) | Conector assíncrono CNES (`httpx` + `tenacity`) | Claude 3.5 Sonnet | 2 | 3.640 | 2.810 | $0,0531 |
| 17/10/2026 | `P03` (`v1.0` -> `v1.1`) | Cliente HL7 FHIR R4 + `TokenCache` OAuth2 RNDS | Gemini 1.5 Pro | 2 | 4.110 | 3.120 | $0,0207 |
| 18/10/2026 | `P04` (`v1.0` -> `v1.1`) | Suíte `pytest` assíncrona com `AsyncMock` | Claude 3.5 Sonnet | 2 | 5.290 | 3.480 | $0,0681 |
| 28/10/2026 | `P05` (`v1.0`) | Arquitetura Front-end, Schemas Zod e Mocks MSW | Claude / Gemini | 3 | 18.450 | 14.200 | $0,2683 |
| 28/10/2026 | `P06` (`v1.0`) | Desenho e teste do System Prompt RAG + Guardrails | Gemini 1.5 Flash | 4 | 3.200 | 1.180 | $0,0006 |
| **TOTAL ACUMULADO (DEV)** | — | — | — | **15** | **39.510** | **28.740** | **$0,4845** |

---

## 3. Simulação de Custo em Produção (Runtime — Busca Assistida por IA)

Cada pesquisa em linguagem natural no portal (`GET /api/v1/search`) que não encontra correspondência exata no cache PostgreSQL aciona o pipeline RAG com o prompt **P06**:

- **Tamanho médio do Input por chamada:** ~650 tokens (System Prompt `P06` + query do usuário + top-5 chunks recuperados do catálogo CID-10/ANVISA).
- **Tamanho médio do Output por chamada:** ~120 tokens (JSON estruturado com `interpreted_as`, `confidence`, `suggested_categories` e `fallback`).
- **Taxa de Cache Hit estimada (PostgreSQL / buscas populares como "Dengue", "Dipirona"):** 60% das buscas são atendidas em cache (0 tokens consumidos); 40% acionam o LLM.

### Projeção Mensal por Volume de Usuários

| Cenário de Tráfego | Buscas Totais / Mês | Chamadas ao LLM (40%) | Tokens Input / Mês | Tokens Output / Mês | Custo Mensal (Gemini 1.5 Flash) | Custo Mensal (Claude 3.5 Haiku) |
|---|---:|---:|---:|---:|---:|---:|
| **Piloto Municipal (Pequeno)** | 10.000 | 4.000 | 2,60 M | 0,48 M | **US$ 0,34** (~R$ 1,95) | **US$ 4,00** (~R$ 23,20) |
| **Médio Porte (Regional)** | 100.000 | 40.000 | 26,00 M | 4,80 M | **US$ 3,39** (~R$ 19,65) | **US$ 40,00** (~R$ 232,00) |
| **Escala Estadual (SUS)** | 1.000.000 | 400.000 | 260,00 M | 48,00 M | **US$ 33,90** (~R$ 196,60) | **US$ 400,00** (~R$ 2.320,00) |

---

## 4. Como Registrar Novas Chamadas (Guia para o Squad)

1. **No Back-end (`ai_service.py`):** Capturar os campos `usage.prompt_tokens` e `usage.completion_tokens` retornados pelo SDK da LLM e logar em formato estruturado (`logs/ai_usage.jsonl`).
2. **No Desenvolvimento:** A cada nova feature ou refinamento de prompt em `/docs/prompts/`, adicionar uma linha na **Seção 2** deste documento antes de abrir o Pull Request.
