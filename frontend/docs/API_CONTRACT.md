# Contrato da API REST Interna (`/api/v1`) — SADIIN / BRchain Portal

- **Versão do Contrato:** `1.0.0`
- **Base URL (Desenvolvimento):** `http://localhost:8000/api/v1`
- **Fonte da Verdade em Código (Validação Runtime):** [`frontend/src/api/schemas.ts`](../src/api/schemas.ts)
- **Funções Cliente HTTP:** [`frontend/src/api/endpoints.ts`](../src/api/endpoints.ts)

> **Importante para o time de Back-end (FastAPI) e IA:**
> Toda resposta recebida pelo Front-end passa obrigatoriamente por `schema.safeParse(...)` (Zod) em [`src/api/client.ts`](../src/api/client.ts). Se um campo obrigatório estiver ausente ou com tipo diferente, o Front-end levanta `CONTRACT_VIOLATION`.

---

## 1. Convenções Gerais

### 1.1 Headers HTTP

- **Request:**
  - `Accept: application/json`
  - `X-Request-Id: <uuid>` (enviado automaticamente pelo Front-end para rastreabilidade em logs)
- **Response:**
  - `Content-Type: application/json; charset=utf-8`
  - Datas e horários sempre em **ISO-8601 com timezone** (ex.: `"2025-05-28T11:42:00Z"`).

### 1.2 Objeto de Proveniência (`ProvenanceMeta`)

Acompanha as respostas de dados para transparência das fontes do SUS e sinalização de degradação graciosa:

```json
{
  "source": "CNES/DATASUS | e-SUS APS | SINAN/OpenDataSUS | ANVISA | RNDS | MOCK",
  "fetched_at": "2025-05-28T11:42:00Z",
  "is_estimate": false,
  "is_stale": false
}
```

- Quando `is_estimate: true` (ex.: falha do e-SUS em tempo real acionando o modelo preditivo por histórico semanal na `US-04.3`), o Front-end exibe automaticamente a tag **`"Estimativa baseada em histórico"`**.
- Quando `is_stale: true` (ex.: DATASUS offline e resposta servida pelo cache PostgreSQL), o Front-end exibe **`"Dados em cache — atualização pendente"`**.

### 1.3 Envelope de Paginação (`Page<T>`)

```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 6,
  "meta": {
    "source": "ANVISA",
    "fetched_at": "2025-05-28T11:42:00Z",
    "is_estimate": false,
    "is_stale": false
  }
}
```

### 1.4 Formato Padronizado de Erro (`ApiError`)

Em respostas `4xx` ou `5xx`:

```json
{
  "error": {
    "code": "UPSTREAM_UNAVAILABLE | NOT_FOUND | VALIDATION_ERROR | RATE_LIMITED | INTERNAL",
    "message": "Mensagem amigável pronta para exibição",
    "request_id": "req-12345"
  }
}
```

---

## 2. Catálogo de Endpoints (18 Rotas)

### 2.1 Sistema e Metadados

#### `GET /api/v1/health`

Liveness check do serviço FastAPI.

```json
{ "status": "ok" }
```

#### `GET /api/v1/meta`

Alimenta a barra governamental e os contadores flutuantes da Home.

```json
{
  "data_updated_at": "2025-05-28T11:42:00Z",
  "establishments_count": 452818,
  "sources_count": 6
}
```

#### `GET /api/v1/sources`

Alimenta a seção "Informação que vem de fontes oficiais" (`US-06.1`).

```json
[
  { "id": "datasus", "name": "DATASUS", "subtitle": "Ministério da Saúde" },
  { "id": "cnes", "name": "CNES", "subtitle": "Estabelecimentos" },
  { "id": "esus-aps", "name": "e-SUS APS", "subtitle": "Atenção Primária" },
  { "id": "opendatasus", "name": "OpenDataSUS", "subtitle": "Dados abertos" },
  { "id": "rnds", "name": "RNDS", "subtitle": "Padrão FHIR R4" }
]
```

---

### 2.2 Busca Global e Assistida por IA (`US-01.1`, `US-02.1`, `US-03.1`)

#### `GET /api/v1/search`

- **Query Params:**
  - `q` _(string, obrigatório)_: texto digitado pelo usuário.
  - `type` _(`"all"` | `"medications"` | `"conditions"` | `"units"`, default `"all"`)_
  - `uf` _(string, opcional)_: sigla UF (ex.: `"SP"`).
  - `city_ibge` _(string, opcional)_: código IBGE de 7 dígitos (ex.: `"3550308"`).
- **Regras de Guardrail de IA (`fallback`):**
  - `code: "SELF_DIAGNOSIS"` ou `"LOW_CONFIDENCE"` (`confidence < 0.85`): `message` deve ser **`"Sintomas complexos. Procure uma unidade de saúde."`** e `results` deve vir vazio.
  - `code: "SYMPTOM_ON_MEDICATION_SEARCH"` (usuário digitou sintoma na busca de medicamentos): `message` deve ser **`"Consulte um profissional de saúde"`**, `results.medications` deve vir vazio e `suggested_categories` traz as categorias informativas sugeridas.
- **Response 200:**

```json
{
  "query": "dor de cabeca",
  "matched_term": "Cefaleia",
  "intent": "condition",
  "confidence": 0.92,
  "fallback": null,
  "suggested_categories": [{ "id": "analgesicos", "name": "Analgésicos", "slug": "analgesicos" }],
  "results": {
    "medications": [],
    "conditions": [],
    "units": []
  },
  "meta": {
    "source": "SUS/RAG",
    "fetched_at": "2025-05-28T11:42:00Z",
    "is_estimate": false,
    "is_stale": false
  }
}
```

---

### 2.3 Medicamentos (`US-02.1`, `US-02.2`, `US-02.3`)

#### `GET /api/v1/medications/categories`

```json
[
  { "id": "analgesicos", "name": "Analgésicos", "slug": "analgesicos" },
  { "id": "antialergicos", "name": "Antialérgicos", "slug": "antialergicos" },
  { "id": "antibioticos", "name": "Antibióticos", "slug": "antibioticos" },
  { "id": "uso-continuo", "name": "Uso contínuo", "slug": "uso-continuo" }
]
```

#### `GET /api/v1/medications`

- **Query Params:** `q`, `category` (slug/id da categoria), `page` (default `1`), `page_size` (default `20`).
- **Response 200:** `Page<Medication>`

```json
{
  "items": [
    {
      "id": "dipirona",
      "name": "Dipirona",
      "subtitle": "Analgésico e antitérmico",
      "tag": "Mais consultado",
      "category_id": "analgesicos",
      "requires_prescription": false,
      "adult_use": true,
      "image_url": "https://...",
      "image_alt": "Comprimidos brancos, azuis e alaranjados",
      "leaflet_url": "https://consultas.anvisa.gov.br/#/bulario/"
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

#### `GET /api/v1/medications/{id}`

Retorna `MedicationDetail` (campos de `Medication` + `indications: string[]`, `contraindications?: string[]`, `side_effects?: string[]`, `meta?: ProvenanceMeta`).

---

### 2.4 Doenças e Sintomas (`US-03.1`, `US-03.2`, `US-03.3`)

#### `GET /api/v1/conditions/categories`

```json
[
  { "id": "alergias", "name": "Alergias", "slug": "alergias" },
  { "id": "sintomas", "name": "Sintomas", "slug": "sintomas" },
  {
    "id": "doencas-respiratorias",
    "name": "Doenças respiratórias",
    "slug": "doencas-respiratorias"
  },
  { "id": "condicoes-cronicas", "name": "Condições crônicas", "slug": "condicoes-cronicas" }
]
```

#### `GET /api/v1/conditions`

- **Query Params:** `q`, `category`, `page`, `page_size`.
- **Response 200:** `Page<Condition>`

```json
{
  "items": [
    {
      "id": "dengue",
      "popular_name": "Dengue",
      "cid10_code": "A90",
      "subtitle": "Febre alta, dor no corpo e manchas",
      "tag": "Atenção epidemiológica",
      "category_id": "sintomas",
      "main_symptoms": ["Febre alta de início súbito", "Dor muscular e atrás dos olhos"],
      "image_url": "https://...",
      "image_alt": "Descrição da imagem"
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

#### `GET /api/v1/conditions/{id}`

Retorna `ConditionDetail` (campos de `Condition` + `prevention: string[]`, `treatment: string[]`, `meta?: ProvenanceMeta`).

---

### 2.5 Unidades Básicas de Saúde — UBS (`US-04.1` a `US-04.6`)

#### `GET /api/v1/ubs/nearby`

- **Query Params:** `lat` _(number)_, `lng` _(number)_, `radius_km` _(number, default `10`)_.
- **Response 200:** `UnitSummary[]`

#### `GET /api/v1/ubs`

- **Query Params:** `q`, `city_ibge`, `page`, `page_size`.
- **Response 200:** `Page<UnitSummary>`

#### `GET /api/v1/ubs/{cnes}`

```json
{
  "cnes_code": "9990001",
  "name": "UBS República",
  "address": "Praça da Bandeira, 15 — Centro",
  "city": "São Paulo",
  "uf": "SP",
  "lat": -23.5489,
  "lng": -46.6388,
  "phone": "(11) 3333-0180",
  "distance_m": 850,
  "is_open": true,
  "closes_at": "19:00",
  "kind": "ubs",
  "opening_hours": { "open": "07:00", "close": "19:00" },
  "today_label": "Quarta-feira, 28 de maio",
  "data_updated_at": "2025-05-28T08:42:00Z",
  "source_label": "CNES / e-SUS APS"
}
```

#### `GET /api/v1/ubs/{cnes}/metrics`

```json
{
  "attendances_month": 3842,
  "attendances_delta_pct": 6.2,
  "avg_wait_minutes": 24,
  "movement_level": "moderado",
  "capacity_pct": 72,
  "best_time_hint": "Entre 14h e 16h, com menor tempo de espera.",
  "registered_coverage": 18420,
  "meta": {
    "source": "e-SUS APS",
    "fetched_at": "2025-05-28T11:42:00Z",
    "is_estimate": false,
    "is_stale": false
  }
}
```

#### `GET /api/v1/ubs/{cnes}/attendance-history`

- **Query Params:** `days` _(number, default `7`)_.

```json
{
  "days": [{ "date": "2025-05-22", "weekday_label": "Seg", "attendances": 68 }],
  "total": 463,
  "daily_average": 66,
  "meta": {
    "source": "e-SUS APS",
    "fetched_at": "2025-05-28T11:42:00Z",
    "is_estimate": false,
    "is_stale": false
  }
}
```

#### `GET /api/v1/ubs/{cnes}/services`

- **Query Params:** `category` _(opcional: `"Consultas"` | `"Prevenção"` | `"Procedimentos"` | `"Apoio"`)_.
- **Response 200:** `UnitService[]`

#### `GET /api/v1/ubs/{cnes}/staff`

```json
{
  "professionals": 32,
  "rooms": 8,
  "esf_teams": 4,
  "reference_date": "2025-05",
  "meta": {
    "source": "CNES",
    "fetched_at": "2025-05-28T11:42:00Z",
    "is_estimate": false,
    "is_stale": false
  }
}
```

---

### 2.6 Localidades, Painel Regional e Notícias (`US-01.3`, `US-05.1`, `US-05.2`)

- **`GET /api/v1/locations/states`** → `StateItem[]` (`[{ "uf": "SP", "name": "São Paulo" }]`)
- **`GET /api/v1/locations/states/{uf}/cities`** → `CityItem[]` (`[{ "ibge_code": "3550308", "name": "São Paulo", "uf": "SP", "lat": -23.5489, "lng": -46.6388 }]`)
- **`GET /api/v1/dashboard/regional?uf=SP&city_ibge=3550308`** → `RegionalDashboard`
- **`GET /api/v1/news?uf=SP&city_ibge=3550308&limit=4`** → `NewsPayload` (`{ "featured": NewsItem | null, "items": NewsItem[] }`)
