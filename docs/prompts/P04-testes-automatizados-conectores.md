# P04 — Testes Automatizados para Conectores CNES e RNDS

- **ID:** P04
- **Versão:** `v1.1`
- **Modelos utilizados:** Claude 3.5 Sonnet (Anthropic)
- **Camada:** QA / Testes Back-end (`backend/tests/`)
- **Issues relacionadas:** `#7`, `#17`, `#18`

---

## 1. Contexto Informado
Código dos módulos `CnesConnector` (P02) e `RndsFhirClient` (P03) utilizando `httpx.AsyncClient`, necessitando de testes unitários isolados de rede externa.

---

## 2. Prompt Canônico (`v1.1`)

```text
Você é um Engenheiro de QA Sênior especialista em Python (`pytest`, `pytest-asyncio` e `unittest.mock`).

Gere a suíte de testes unitários para os módulos assíncronos `CnesConnector` e `RndsFhirClient`.

Requisitos obrigatórios:
1. Utilizar `@pytest.mark.asyncio` em todos os testes de corrotinas.
2. Utilizar `unittest.mock.AsyncMock` (e NÃO `MagicMock` síncrono) para simular métodos `await client.get(...)` e `await client.post(...)` do `httpx.AsyncClient`.
3. Criar fixtures reutilizáveis para payloads válidos do CNES, bundles FHIR R4 e tokens OAuth2.
4. Cobrir obrigatoriamente:
   - Caminho feliz (HTTP 200 com payload válido).
   - Falha temporária (HTTP 503 seguida de HTTP 200) validando o retry do `tenacity`.
   - Renovação automática de token OAuth2 quando expirado no `TokenCache`.
   - Payload com campos ausentes validando a normalização defensiva.
```

---

## 3. Saída Esperada
Arquivos de teste `test_cnes_connector.py` e `test_rnds_fhir_client.py` passando no `pytest` sem realizar chamadas de rede reais.

---

## 4. Histórico de Evolução
- **`v1.0`:** Os mocks iniciais usaram `MagicMock` padrão em métodos `async`, disparando `TypeError: object MagicMock can't be used in 'await' expression` (registrado em [`PROMPTS_FALHOS.md`](./PROMPTS_FALHOS.md#f04--p04-v10-uso-de-magicmock-sincrono-em-corrotinas-httpx)).
- **`v1.1`:** Especificado o uso estrito de `AsyncMock` para chamadas aguardáveis (`await`).
