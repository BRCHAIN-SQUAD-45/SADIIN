# FE02 — Fase 1: Scaffold Front-end, Cliente HTTP, Zod e MSW

- **ID:** FE02
- **Camada:** Front-end (`frontend/`)
- **Responsável:** Lia
- **Versão:** `v1.1`

---

## 1. Objetivo
Estruturar a base técnica do projeto front-end em `frontend/` com React 18.3.1, Vite, TypeScript, React Router, TanStack Query, validação de contrato em tempo de execução com Zod e simulação de cenários de API com MSW (Mock Service Worker).

---

## 2. Prompt Utilizado (`v1.1`)

```text
Crie o scaffold da Fase 1 do front-end em `frontend/` seguindo estritamente a stack definida na seção 4.1 (React 18.3.1 fixo + Vite + TypeScript):

1. Configurar `package.json`, `tsconfig`, ESLint, Prettier, `Dockerfile` (multi-stage nginx) e `.env.example`.
2. Implementar `src/config/env.ts` validando `VITE_DATA_MODE` ("mock" | "api"), `VITE_API_URL` e `VITE_API_TIMEOUT_MS`.
3. Implementar `src/api/client.ts` com `fetch` único, `AbortController` por timeout, cabeçalho `X-Request-Id`, retry automático com backoff para falhas 502/503/504 em requisições GET e validação de resposta com schemas Zod.
4. Configurar MSW (`src/mocks/`) suportando troca de cenários (`ok`, `slow`, `degraded`, `error_503`, `empty`, `low_confidence`, `clinical_risk`) via query string ou `localStorage`.
5. Configurar Vitest com ambiente customizado (`jsdom-native-abort.env.ts`) que preserva `AbortController` e `AbortSignal` nativos do Node.js para compatibilidade com `fetch`.
```

---

## 3. Histórico de Revisão
- **`v1.0`:** Uso do ambiente `jsdom` padrão no Vitest causou erro de instância de `AbortSignal` no `fetch` nativo do Node.
- **`v1.1`:** Adicionado requisito de ambiente customizado preservando `AbortController`/`AbortSignal` nativos (item 5).
