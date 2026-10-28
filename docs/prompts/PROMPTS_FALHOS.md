# Registro de Prompts que Falharam e Refinamentos (Item 1.5)

Este documento registra todas as ocorrências em que um prompt enviado à IA gerou **resultado inadequado, incompleto, código incompatível ou risco de alucinação**, detalhando **o que foi pedido**, **o que a IA retornou** e **como o prompt foi corrigido**.

> **Regra do Squad:** Toda vez que um prompt gerar saída ruim durante o desenvolvimento ou testes do pipeline RAG, adicione uma nova entrada abaixo em 2 minutos.

---

## Histórico de Falhas Registradas

### F01 — P01 (`v1.0`): Ausência de Critérios de Aceite e Guardrails de IA
- **Data:** 15/10/2026
- **Prompt Relacionado:** [`P01-backlog-ai-first.md`](./P01-backlog-ai-first.md)
- **Modelo:** Claude 3.5 Sonnet
- **O que pedimos:** Gerar o backlog completo do projeto SADIIN (Épicos, Histórias de Usuário priorizadas e tarefas por camada FE/BE/DB) com base na descrição do desafio.
- **O que veio (Problema):** O modelo gerou os 6 Épicos e as Histórias de Usuário, mas **não incluiu critérios de aceite verificáveis** nem limites mensuráveis para o comportamento da IA (tempo de resposta, limiar de confiança semântica e mensagens de fallback contra autodiagnóstico).
- **O que mudamos (`v1.1`):** Adicionamos instrução explícita obrigando uma tabela de **Critérios de Aceite (Gerais e de IA)** para cada US, especificando latência `<= 1.5s`, confiança `>= 85%` e os textos canônicos de fallback clínico.

---

### F02 — P02 (`v1.0`): Geração de Conector Síncrono Bloqueante
- **Data:** 16/10/2026
- **Prompt Relacionado:** [`P02-conector-cnes-datasus.md`](./P02-conector-cnes-datasus.md)
- **Modelo:** Claude 3.5 Sonnet
- **O que pedimos:** Gerar o módulo `CnesConnector` em Python usando `httpx` e `tenacity` para consultar estabelecimentos de saúde no DATASUS com tratamento de erro e retry.
- **O que veio (Problema):** O modelo gerou uma classe síncrona baseada em `httpx.Client()` e `def get_establishment(...)`. Em rotas `async def` do FastAPI, chamadas síncronas bloqueiam a *event loop* principal, degradando a concorrência da API.
- **O que mudamos (`v1.1`):** Refinamos o prompt exigindo explicitamente `async`/`await`, `httpx.AsyncClient` e implementação do protocolo *Async Context Manager* (`__aenter__` e `__aexit__`).

---

### F03 — P03 (`v1.0`): Ausência de Cache de Token OAuth2 na RNDS
- **Data:** 17/10/2026
- **Prompt Relacionado:** [`P03-cliente-fhir-rnds.md`](./P03-cliente-fhir-rnds.md)
- **Modelo:** Gemini 1.5 Pro
- **O que pedimos:** Criar a classe `RndsFhirClient` implementando o fluxo OAuth2 `client_credentials` e métodos de busca para os recursos FHIR R4 `Patient` e `Immunization`.
- **O que veio (Problema):** O código gerado realizava uma requisição `POST /api/token` antes de **cada** chamada `GET` na RNDS, sem reutilizar o token válido e sem tratar renovação preventiva antes da expiração (`expires_in`), o que causaria alta latência e bloqueio por *rate limit* no servidor de autenticação da RNDS.
- **O que mudamos (`v1.1`):** Solicitamos explicitamente a criação da estrutura `TokenCache` com controle de `expires_at` e renovação proativa 60 segundos antes do vencimento.

---

### F04 — P04 (`v1.0`): Uso de `MagicMock` Síncrono em Corrotinas `httpx`
- **Data:** 18/10/2026
- **Prompt Relacionado:** [`P04-testes-automatizados-conectores.md`](./P04-testes-automatizados-conectores.md)
- **Modelo:** Claude 3.5 Sonnet
- **O que pedimos:** Gerar testes unitários com `pytest` e `unittest.mock` para validar os conectores `CnesConnector` e `RndsFhirClient`.
- **O que veio (Problema):** O modelo utilizou `MagicMock` padrão para simular `client.get` e `client.post`. Ao executar `pytest`, todas as corrotinas falharam com `TypeError: object MagicMock can't be used in 'await' expression`.
- **O que mudamos (`v1.1`):** Especificamos no prompt o uso obrigatório de `unittest.mock.AsyncMock` para métodos aguardáveis (`await`) e `@pytest.mark.asyncio` em todos os casos de teste.

---

### F05 — Extração de Protótipo UI: Artefatos de Encoding UTF-8 (Mojibake)
- **Data:** 20/10/2026
- **Prompt Relacionado:** [`P05-arquitetura-frontend-contrato-api.md`](./P05-arquitetura-frontend-contrato-api.md)
- **Modelo:** Auxílio de Engenharia Front-end
- **O que pedimos:** Extrair diretamente as strings e pseudo-elementos CSS do código exportado do protótipo sem pós-processamento de encoding.
- **O que veio (Problema):** O arquivo exportado do protótipo continha caracteres corrompidos por dupla codificação Windows-1252/UTF-8 (ex.: `content: "?"` no CSS e `Sade`, `ateno` nos textos), que apareceriam quebrados em tela.
- **O que mudamos (`v1.0`):** Adicionamos instrução explícita no P05 exigindo sanitização UTF-8 completa de todos os rótulos, textos e seletores CSS (`content: "→"`, `"•"`) mantendo 100% dos valores visuais originais.

---

## Template para Novos Registros

```markdown
### F0X — P0X (`vX.Y`): <Título curto da falha>
- **Data:** DD/MM/AAAA
- **Prompt Relacionado:** [`P0X-nome.md`](./P0X-nome.md)
- **Modelo:** <Nome do modelo>
- **O que pedimos:** <Resumo do prompt enviado>
- **O que veio (Problema):** <Erro, alucinação ou limitação observada>
- **O que mudamos (`vX.Z`):** <Ajuste feito no prompt para resolver>
```
