# P02 — Conector Assíncrono CNES / DATASUS em Python

- **ID:** P02
- **Versão:** `v1.1`
- **Modelos utilizados:** Claude 3.5 Sonnet (Anthropic)
- **Camada:** Back-end (`backend/app/integrations/datasus/cnes.py`)
- **Issues relacionadas:** `#17`, `#18`, `#22`, `US-04.6`

---

## 1. Contexto Informado
Necessidade de consultar a API aberta do CNES/DATASUS para listar estabelecimentos de saúde, serviços e estrutura física/equipes, lidando com instabilidade em horários de pico, ausência de SLA oficial e variações de schema sem versionamento.

---

## 2. Prompt Canônico (`v1.1`)

```text
Atue como um Engenheiro Back-end Python Sênior especialista em FastAPI e integrações resilientes.

Implemente o módulo `CnesConnector` em Python 3.11 para consumir a API pública do CNES/DATASUS utilizando OBRIGATORIAMENTE programação assíncrona (`async`/`await`) com `httpx.AsyncClient`.

Requisitos técnicos obrigatórios:
1. Implementar como Async Context Manager (`__aenter__` e `__aexit__`).
2. Configurar timeout explícito e política de retry com exponential backoff usando a biblioteca `tenacity` (apenas para erros de rede e HTTP 5xx/429).
3. Implementar normalização defensiva com Pydantic v2 para que campos ausentes ou nulos na resposta do DATASUS não quebrem o contrato interno.
4. Nunca expor exceções cruas do `httpx` para a camada de rota; lançar exceções de domínio padronizadas permitindo fallback para o cache PostgreSQL.
```

---

## 3. Saída Esperada
Módulo `CnesConnector` assíncrono com `httpx.AsyncClient`, decoradores `@retry` do `tenacity` e função de normalização defensiva testável.

---

## 4. Histórico de Evolução
- **`v1.0`:** O modelo gerou código síncrono utilizando `httpx.Client` bloqueante, incompatível com o event loop assíncrono do FastAPI (registrado em [`PROMPTS_FALHOS.md`](./PROMPTS_FALHOS.md#f02--p02-v10-geracao-de-conector-sincrono-bloqueante)).
- **`v1.1`:** Refinado para exigir explicitamente `async`/`await`, `httpx.AsyncClient` e `__aenter__`/`__aexit__`.
