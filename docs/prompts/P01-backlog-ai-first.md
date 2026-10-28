# P01 — Geração do Backlog e Engenharia de Requisitos "AI-First"

- **ID:** P01
- **Versão:** `v1.1`
- **Modelos utilizados:** Claude 3.5 Sonnet (Anthropic) / Gemini 1.5 Pro
- **Camada:** Produto / Engenharia de Requisitos
- **Issues geradas:** `#2` a `#25` (Épicos EP-01 a EP-06 e Histórias US-01.1 a US-06.1)

---

## 1. Contexto Informado
Descrição completa do desafio **SADIIN / BRchain** (integração com bases abertas do DATASUS/CNES/e-SUS APS e protótipo HL7 FHIR R4 para RNDS + portal web para cidadãos e gestores), stack tecnológica definida (FastAPI, React 18 + Vite, PostgreSQL 15) e prazo de execução de 4 meses.

---

## 2. Prompt Canônico (`v1.1`)

```text
Você é um Product Manager Técnico e Arquiteto de Software especialista em Saúde Digital no Brasil (SUS, DATASUS, CNES, e-SUS APS e RNDS/HL7 FHIR R4).

Com base no escopo do projeto BRchain Portal (SADIIN), estruture o backlog completo da aplicação para um ciclo de 4 meses usando a stack:
- Front-end: React 18 + Vite
- Back-end: Python 3.11 + FastAPI + httpx
- Banco de dados: PostgreSQL 15
- IA: Pipeline RAG para busca semântica de sintomas/medicamentos e modelo preditivo de fallback para lotação de UBS.

Gere:
1. 6 Épicos priorizados cobrindo: Busca Global/Navegação, Medicamentos, Doenças e Sintomas, Unidades de Saúde (UBS), Dashboards Regionais/Notícias e Transparência/Fontes Oficiais.
2. Histórias de Usuário numeradas (US-01.1, US-01.2...) no formato "Como <persona>, quero <ação>, para <benefício>".
3. Tarefas técnicas desmembradas explicitamente por camada (Front-end, Back-end, Integração, Banco de Dados).
4. OBRIGATÓRIO: Tabela de Critérios de Aceite (Gerais e de IA) para cada História de Usuário, incluindo limites de latência (<= 1.5s), limiar de confiança semântica (>= 85%) e mensagens de fallback clínico seguro ("Sintomas complexos. Procure uma unidade de saúde." e "Consulte um profissional de saúde").
```

---

## 3. Saída Esperada
- Tabela de Épicos (`EP-01` a `EP-06`) e Histórias de Usuário (`US-01.1` a `US-06.1`).
- Tarefas técnicas divididas por camada para alimentar o quadro Kanban no GitHub Projects.
- Tabela de Critérios de Aceite com guardrails de IA explícitos.

---

## 4. Histórico de Evolução
- **`v1.0`:** Primeira versão gerou os épicos e histórias, mas omitiu os critérios de aceite verificáveis e os limiares de segurança da IA (registrado em [`PROMPTS_FALHOS.md`](./PROMPTS_FALHOS.md#f01--p01-v10-ausencia-de-criterios-de-aceite-e-guardrails-de-ia)).
- **`v1.1`:** Adicionado o item 4 obrigatório exigindo critérios de aceite gerais e de IA por história.
