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
| **Subtotal Front-end (até Fase 2)** | — | — | **106** | **1.596.190** | **152.090** | **1.748.280** |

> *Nota: Conforme as Fases 3 a 6 do Front-end forem concluídas, as linhas correspondentes serão adicionadas a esta tabela.*

---

## 2. Desenvolvimento Back-end e Chamadas da API de IA (Responsáveis: Back-end e IA)

*(Seção reservada para preenchimento nas branches de Back-end e IA com o consumo de tokens dos conectores e das chamadas em tempo de execução das LLMs).*
