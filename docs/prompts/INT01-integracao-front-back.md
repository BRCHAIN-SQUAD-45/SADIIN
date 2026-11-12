# INT01 — Integração Front-end (React) ↔ Back-end (FastAPI)

- **ID:** INT01
- **Camada:** Integração (`frontend/` + `backend/`)
- **Responsável:** Nícolas (dupla de integração: Nícolas, Áquila e Bruno)
- **Ferramenta:** Claude Code (app desktop), modelo Claude Opus 5.5, plano Pro
- **Versão:** `v1.0`
- **Data:** 10/11/2026
- **Pedido no squad:** "O Lucas subiu todo o backend no github. Peço que integrem backend e frontend até quinta." (Yasmin, 10/11)

---

## 1. Objetivo

Rodar o portal com `VITE_DATA_MODE=api` contra o FastAPI real e corrigir todas as divergências
entre as respostas do back-end e o contrato (`frontend/src/api/schemas.ts`), sem inventar dados
quando a fonte oficial não publica a informação.

---

## 2. Prompt Utilizado (`v1.0`)

```text
Leia o repositório SADIIN e a conversa do squad. Minha parte é integrar o back-end FastAPI
(do Lucas) com o front-end React (da Lia), seguindo frontend/docs/API_CONTRACT.md e
frontend/docs/INTEGRATION_GUIDE.md.

1. Clone o repositório, crie a branch feat/integracao-front-back, suba o back-end na porta 8000
   e o front em modo api.
2. Teste TODAS as rotas do back-end real contra os schemas Zod do front e liste o que quebra.
3. Corrija as divergências. Regra: dado ausente na fonte oficial nunca vira valor inventado
   (ex.: horário desconhecido não pode virar "Fechada"; total desconhecido não vira 452 mil).
4. Rotas sem fonte pública (HTTP 501) devem aparecer como "dado indisponível", sem botão de
   tentar novamente.
5. Rode typecheck, lint, prettier, testes e build. Abra as telas no navegador para conferir.
6. Registre prompt, falhas e custo em docs/.
```

---

## 3. Resultado

**Verificação ao vivo** (`npm run contract:live`, novo script): antes **4/21** rotas dentro do
contrato; depois **9/21**. As 12 restantes respondem `501 SOURCE_UNAVAILABLE` de propósito,
porque ainda não há fonte pública integrada (medicamentos, doenças, busca, notícias, painel
regional e métricas/equipe/histórico da UBS). Elas dependem das duplas de conectores e de IA.

| Rota                                | Problema encontrado                                     | Correção                                                                             |
| ----------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `GET /meta`                         | `establishments_count: null` (CNES não publica o total) | Schema aceita `null`; Home mostra "—" em vez de "452 mil" fixo                       |
| `GET /locations/states/{uf}/cities` | IBGE não traz `lat`/`lng`                               | Coordenadas opcionais; UBS buscadas por `city_ibge` e mapa centraliza na 1ª UBS      |
| `GET /ubs`, `/ubs/nearby`           | `is_open: null`, `total: null`, `phone: null`           | Schema aceita `null`; selo neutro "Horário não informado" (nunca "Fechada")          |
| `GET /ubs/{cnes}`                   | Sem `opening_hours`/`today_label`; data só `YYYY-MM-DD` | Back-end devolve ISO datetime; front calcula a data de hoje e mostra o turno do CNES |
| 501 em 12 rotas                     | Aparecia como erro genérico com "Tentar novamente"      | Novo código `SOURCE_UNAVAILABLE`: "Dados ainda não disponíveis", sem botão           |

**Outras correções encontradas no caminho:**

- Placeholders do protótipo que apareciam como se fossem dados reais em modo `api`: UBS
  fictícias no mapa e no seletor, capacidade "72%", horário "07:00 — 19:00", telefone
  "(11) 3333-0180" e "Hoje, às 08:42". Foram trocados por "Não informado" ou removidos.
- `formatUnitUpdatedLabel` sempre escrevia "Hoje"; agora mostra a data quando não é hoje.
- Timeout padrão de 8 s era menor que a 1ª consulta de UBS de São Paulo (~9 s, sem cache).
  Passou para 20 s nos `.env.example`.
- `.env.example` da raiz usava `VITE_API_TIMEOUT_MS` (variável que o código não lê) e
  `VITE_API_URL` com `/api/v1` (o front já adiciona o prefixo, então ficava duplicado).

**Verificação:** `tsc`, `eslint`, `prettier --check`, `vitest` (58 testes, sendo 11 novos em
`src/api/integration.test.tsx`) e `npm run build` passando. Telas Home, Ficha da UBS e troca
de cidade (Campinas) conferidas no navegador contra o back-end real.
