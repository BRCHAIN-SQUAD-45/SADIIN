# Guia de Integração Front-end ↔ Back-end (FastAPI)

Este guia explica como alternar o Front-end do modo de simulação (**MSW Mock**) para o **Back-end FastAPI real** sem alterar nenhum componente React.

---

## 1. Como Trocar de `mock` para `api`

No arquivo `frontend/.env`:

```env
# Para rodar com dados simulados no navegador (padrão enquanto o back-end não está ativo):
VITE_DATA_MODE=mock

# Para conectar ao servidor FastAPI local:
VITE_DATA_MODE=api
VITE_API_URL=http://localhost:8000
```

> **Nota:** `VITE_API_URL` deve conter apenas a origem (`http://localhost:8000`). O sufixo `/api/v1` é adicionado automaticamente por [`src/config/env.ts`](../src/config/env.ts).

---

## 2. Configuração de CORS necessária no FastAPI (`backend/`)

Para que o navegador permita chamadas de `http://localhost:5173` para `http://localhost:8000`, adicione o `CORSMiddleware` no `main.py` do FastAPI:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="SADIIN / BRchain API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["Accept", "Content-Type", "X-Request-Id"],
)
```

---

## 3. Verificação Automatizada do Contrato (`contract:check`)

Dentro de `frontend/`, execute:

```bash
npm run contract:check
```

Esse comando valida todas as 18 rotas do contrato contra os schemas Zod definidos em [`src/api/schemas.ts`](../src/api/schemas.ts).

> **Atenção:** `contract:check` valida os **mocks (MSW)**, não o back-end. Para testar o FastAPI de verdade, use o comando abaixo.

### 3.1 Verificação contra o back-end real (`contract:live`)

Com o FastAPI rodando em `http://localhost:8000`:

```bash
npm run contract:live
```

O script chama cada rota do back-end real e valida o JSON com os mesmos schemas. Cada linha sai como `OK`, `CONTRATO` (JSON fora do schema, com o campo que quebrou), `ERRO_API` (status de erro com o `code` do back-end) ou `FALHA` (sem conexão ou timeout). Variáveis opcionais: `LIVE_API_URL`, `LIVE_CNES`, `LIVE_CITY_IBGE`, `LIVE_LAT`, `LIVE_LNG`.

### 3.2 Dados ausentes e rotas sem fonte (`501`)

- **`null` significa "a fonte não informa"** e o front nunca transforma isso num valor: `is_open: null` aparece como "Horário não informado" (e não "Fechada"), e `establishments_count: null` aparece como "—".
- **`501 SOURCE_UNAVAILABLE`** é usado pelo back-end quando ainda não há API pública integrada. O front mostra "Dados ainda não disponíveis" com a mensagem do back-end, **sem** botão de tentar novamente.
- **Cidades do IBGE não têm coordenadas.** Ao escolher uma cidade na lista, as UBS são buscadas por `city_ibge` e o mapa centraliza na primeira unidade.
- **Timeout:** a 1ª consulta de UBS de uma cidade grande leva cerca de 9 s (São Paulo) até entrar no cache do back-end. Use `VITE_REQUEST_TIMEOUT_MS=20000`.

---

## 4. Simulação de Cenários de Borda na Interface (Modo `mock`)

Com `VITE_DATA_MODE=mock`, você pode testar visualmente qualquer caso de borda da Entrega Parcial adicionando `?mock=<cenario>` na URL do navegador:

| URL no Navegador                                       | O que simula                                                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `http://localhost:5173/?mock=error503`                 | Simula queda da API do DATASUS (`HTTP 503`) com retry e estado de erro amigável                       |
| `http://localhost:5173/unidades/9990001?mock=estimate` | Simula falha do e-SUS em tempo real ativando o selo **"Estimativa baseada em histórico"** (`US-04.3`) |
| `http://localhost:5173/unidades/9990001?mock=stale`    | Simula dados servidos pelo cache PostgreSQL com aviso de atualização pendente                         |
| `http://localhost:5173/?mock=fallback`                 | Força o bloqueio seguro de IA (**"Sintomas complexos. Procure uma unidade de saúde."**)               |
| `http://localhost:5173/medicamentos?mock=empty`        | Simula retorno vazio para validar os estados vazios (`EmptyState`)                                    |
| `http://localhost:5173/?mock=off`                      | Limpa as simulações e volta ao comportamento normal                                                   |
