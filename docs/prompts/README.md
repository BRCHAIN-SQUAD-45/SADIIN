# Repositório de Prompts Versionados (Prompt Ops — Item 1.4)

Esta pasta centraliza todos os **prompts de engenharia e de sistema (RAG/NLP)** utilizados pelo **Squad 45 (BRchain / SADIIN)** durante o ciclo de desenvolvimento e na execução do produto.

## Convenção de Versionamento

1. **Um arquivo por prompt:** Cada prompt reside em seu próprio arquivo Markdown (`P0X-nome-descritivo.md`) para que o `git log -p docs/prompts/` registre toda evolução ao longo do projeto.
2. **Estrutura obrigatória de cada arquivo:**
   - **Metadados:** ID, Versão, Modelo(s) alvo, Autor/Responsável, Issue relacionada.
   - **Objetivo e Contexto:** O que o prompt resolve e quais entradas recebe.
   - **Prompt Atual (Canônico):** O texto exato enviado ao modelo.
   - **Saída Esperada / Critérios de Validação:** Formato esperado e guardrails de segurança clínica.
   - **Histórico de Revisões:** O que mudou entre a `v1.0` e as versões subsequentes.
3. **Falhas de Prompt (Item 1.5):** Sempre que um prompt gerar alucinação, código quebrado ou formato incorreto, registre o caso em [`PROMPTS_FALHOS.md`](./PROMPTS_FALHOS.md) antes de atualizar o arquivo do prompt.
4. **Custos e Tokens (Item 2.2):** Registre o consumo de tokens de cada chamada relevante em [`../CUSTOS_IA.md`](../CUSTOS_IA.md).

## Índice de Prompts

| ID | Arquivo | Camada | Objetivo | Versão Atual |
|---|---|---|---|---|
| **P01** | [`P01-backlog-ai-first.md`](./P01-backlog-ai-first.md) | Produto / Engenharia | Geração de Épicos, Histórias de Usuário e Critérios de Aceite AI-First | `v1.1` |
| **P02** | [`P02-conector-cnes-datasus.md`](./P02-conector-cnes-datasus.md) | Back-end / Integração | Geração do conector assíncrono CNES/DATASUS com retry e normalização | `v1.1` |
| **P03** | [`P03-cliente-fhir-rnds.md`](./P03-cliente-fhir-rnds.md) | Back-end / Interoperabilidade | Geração do cliente HL7 FHIR R4 com OAuth2 `client_credentials` e cache de token | `v1.1` |
| **P04** | [`P04-testes-automatizados-conectores.md`](./P04-testes-automatizados-conectores.md) | QA / Back-end | Geração da suíte `pytest` assíncrona com mocks HTTP para CNES e RNDS | `v1.1` |
| **P05** | [`P05-arquitetura-frontend-contrato-api.md`](./P05-arquitetura-frontend-contrato-api.md) | Front-end / Arquitetura | Especificação do contrato REST `/api/v1` (Zod/MSW) e fidelidade ao protótipo | `v1.0` |
| **P06** | [`P06-sistema-busca-nlp-guardrails.md`](./P06-sistema-busca-nlp-guardrails.md) | IA / Runtime (RAG) | System prompt de mapeamento semântico coloquial -> CID-10/SUS com bloqueio de autodiagnóstico | `v1.0` |
