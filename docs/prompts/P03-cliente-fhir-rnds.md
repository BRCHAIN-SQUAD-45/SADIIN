# P03 — Cliente HL7 FHIR R4 para Homologação da RNDS

- **ID:** P03
- **Versão:** `v1.1`
- **Modelos utilizados:** Claude 3.5 Sonnet (Anthropic) / Gemini 1.5 Pro
- **Camada:** Back-end (`backend/app/integrations/fhir_rnds/`)
- **Issues relacionadas:** `#7`, `#25`

---

## 1. Contexto Informado
Integração machine-to-machine com o ambiente de homologação da Rede Nacional de Dados em Saúde (RNDS) seguindo o padrão HL7 FHIR R4 para leitura de recursos clínicos (`Patient`, `Immunization`) via fluxo OAuth2 `client_credentials`.

---

## 2. Prompt Canônico (`v1.1`)

```text
Você é um especialista em interoperabilidade em saúde (HL7 FHIR R4 e RNDS do Ministério da Saúde).

Desenvolva em Python 3.11 (`httpx` assíncrono) a classe `RndsFhirClient` para o ambiente de homologação da RNDS.

Requisitos obrigatórios:
1. Implementar fluxo de autenticação OAuth2 `client_credentials`.
2. Incluir uma estrutura `TokenCache` em memória que armazene o `access_token` e seu `expires_at`, renovando o token proativamente 60 segundos antes da expiração (evitando HTTP 401 durante requisições concorrentes).
3. Implementar método privado `_fhir_get(resource_type, params)` que injeta o header `Authorization: Bearer <token>` e trata HTTP 401 forçando uma única renovação de token.
4. Expor métodos públicos tipados para consulta de `Patient` e `Immunization` em formato FHIR R4 Bundle.
5. Ler todas as URLs e credenciais via variáveis de ambiente (`RNDS_AUTH_URL`, `RNDS_FHIR_BASE_URL`, `RNDS_CLIENT_ID`, `RNDS_CLIENT_SECRET`).
```

---

## 3. Saída Esperada
Classes `TokenCache` e `RndsFhirClient` assíncronas com renovação preventiva de token OAuth2 e métodos de consulta FHIR R4.

---

## 4. Histórico de Evolução
- **`v1.0`:** Primeira versão solicitava um novo token OAuth2 a cada chamada `_fhir_get`, sem cache nem renovação preventiva (registrado em [`PROMPTS_FALHOS.md`](./PROMPTS_FALHOS.md#f03--p03-v10-ausencia-de-cache-de-token-oauth2)).
- **`v1.1`:** Adicionado requisito explícito da classe `TokenCache` com margem de segurança de 60 segundos antes do `expires_in`.
