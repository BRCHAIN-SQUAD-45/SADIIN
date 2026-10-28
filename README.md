# SADIIN — BRchain Portal de Saúde Pública (Squad 45)

Portal web interoperável que conecta o ecossistema **BRchain** às bases públicas oficiais do **SUS / DATASUS** (**CNES**, **e-SUS APS**, **OpenDataSUS**) e ao padrão **HL7 FHIR R4 (RNDS)**, oferecendo consulta acessível de medicamentos, doenças e sintomas, localização de Unidades Básicas de Saúde (UBS) com indicadores de fluxo e painéis epidemiológicos regionais.

---

## 1. Visão Geral da Arquitetura

O sistema é dividido em camadas desacopladas por um contrato REST interno versionado (`/api/v1`):

1. **Front-end (`frontend/`):** SPA em **React 18.3 + Vite + TypeScript**, CSS puro fiel ao protótipo oficial, validação de contrato em tempo de execução com **Zod**, cache reativo via **TanStack Query**, mapas interativos com **Leaflet** e simulação completa de cenários com **MSW (Mock Service Worker)**.
2. **Back-end (`backend/`):** API REST assíncrona em **Python 3.11 + FastAPI + httpx**, orquestrando os conectores governamentais, cache relacional e serviços de IA.
3. **Conectores SUS & FHIR (`backend/app/integrations/`):**
   - **Conector DATASUS/CNES/e-SUS:** Cliente HTTP assíncrono com *retry exponential backoff* (`tenacity`) e normalização defensiva.
   - **Cliente HL7 FHIR R4 (RNDS):** Autenticação OAuth2 `client_credentials` com renovação preventiva em cache (`TokenCache`).
4. **Módulo de IA & Guardrails Clínicos:** Busca semântica assistida por NLP/RAG para mapear linguagem coloquial às taxonomias oficiais (CID-10 / ANVISA / CNES), operando com limiar mínimo de **85% de confiança semântica** e bloqueio estrito contra autodiagnóstico ou prescrição medicamentosa.

```text
SADIIN/
├── docs/
│   ├── prompts/                     # Prompts versionados no Git (Item 1.4)
│   │   ├── README.md
│   │   ├── P01-backlog-ai-first.md
│   │   ├── P02-conector-cnes-datasus.md
│   │   ├── P03-cliente-fhir-rnds.md
│   │   ├── P04-testes-automatizados-conectores.md
│   │   ├── P05-arquitetura-frontend-contrato-api.md
│   │   ├── P06-sistema-busca-nlp-guardrails.md
│   │   └── PROMPTS_FALHOS.md        # Registro de prompts que falharam (Item 1.5)
│   └── CUSTOS_IA.md                 # Controle de tokens e custos de IA (Item 2.2)
├── frontend/                        # Aplicação React 18 + Vite + TypeScript
├── backend/                         # API Python 3.11 + FastAPI + Conectores SUS
├── .env.example                     # Template de variáveis de ambiente
└── README.md
```

---

## 2. Divisão de Responsabilidades — Squad 45 (Item 2.4)

| Papel | Responsável | Atribuições Principais |
|---|---|---|
| **Tech Lead** | *Definir titular do Squad 45* | Definição da arquitetura, revisão de Pull Requests na `main`, destravamento técnico e padronização do contrato `/api/v1`. |
| **Front-end** | **Lia Costa** (`@LiaCost`) | Implementação das interfaces React 18 + TypeScript, fidelidade ao protótipo, integração com mapa Leaflet, acessibilidade e testes Vitest/MSW. |
| **Back-end** | *Definir titular do Squad 45* | Rotas FastAPI, persistência e cache PostgreSQL 15, conectores assíncronos DATASUS (CNES/e-SUS) e cliente OAuth2 HL7 FHIR R4 (RNDS). |
| **Responsável por IA** | *Definir titular do Squad 45* | Integração com APIs de LLM (Gemini / Anthropic), pipeline RAG, calibração do limiar de 85% de confiança e manutenção de `/docs/prompts/`. |
| **QA + Documentação** | *Definir titular do Squad 45* | Testes automatizados (`pytest` e `Vitest`), atualização do `README.md`, registro de [`PROMPTS_FALHOS.md`](./docs/prompts/PROMPTS_FALHOS.md) e [`CUSTOS_IA.md`](./docs/CUSTOS_IA.md). |
| **Ponto Focal com a Empresa** | *Definir titular do Squad 45* | Alinhamento contínuo com os *stakeholders* da BRchain e validação incremental das entregas. |

---

## 3. Artefatos de Engenharia de IA (Entrega Final)

- **Prompts Versionados (Item 1.4):** [`docs/prompts/`](./docs/prompts/README.md)
- **Registro de Prompts que Falharam (Item 1.5):** [`docs/prompts/PROMPTS_FALHOS.md`](./docs/prompts/PROMPTS_FALHOS.md)
- **Análise de Consumo de Tokens e Custos (Item 2.2):** [`docs/CUSTOS_IA.md`](./docs/CUSTOS_IA.md)

---

## 4. Como Executar o Projeto Localmente

### Pré-requisitos
- **Node.js** `>= 20.x` e **npm** `>= 10.x` (para o Front-end)
- **Python** `>= 3.11` e **PostgreSQL** `>= 15` (para o Back-end)

### 4.1 Configuração de Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env` na raiz (e em `frontend/.env` quando necessário):

```bash
cp .env.example .env
```

### 4.2 Executando o Front-end (`frontend/`)
O front-end possui modo **Mock (`VITE_DATA_MODE=mock`)** integrado via MSW, permitindo rodar e testar todas as telas mesmo sem o servidor back-end ativo:

```bash
cd frontend
npm install
npm run dev
```

Para conectar ao back-end FastAPI real, altere no `.env`:
```env
VITE_DATA_MODE=api
VITE_API_URL=http://localhost:8000/api/v1
```

### 4.3 Executando o Back-end (`backend/`)
```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# Linux/macOS:
# source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

---

## 5. Fluxo de Trabalho no Git e GitHub Projects

1. **Branch `main` protegida:** Nenhum push é feito direto na `main`. Toda alteração entra via **Pull Request** com pelo menos **1 revisão aprovada**.
2. **Branches por tarefa/Issue:**
   - `chore/initial-setup` — Configuração inicial do repositório e governança de IA
   - `chore/frontend-scaffold` — Base técnica do front-end e contrato da API
   - `feature/us-01.1-busca-global` (Issue `#8`)
   - `feature/us-01.2-atalhos-home` (Issue `#9`)
   - `feature/us-01.3-seletor-localizacao` (Issue `#10`)
   - `feature/us-02.1-busca-medicamentos` (Issue `#11`), etc.
3. **Commits semânticos e atômicos:** Mensagens claras descrevendo a alteração realizada (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
