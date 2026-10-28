# P05 — Arquitetura do Front-end e Contrato da API REST (`/api/v1`)

- **ID:** P05
- **Versão:** `v1.0`
- **Modelos utilizados:** Claude Opus / Gemini Pro
- **Camada:** Front-end (`frontend/`) + Contrato de Integração (`frontend/docs/API_CONTRACT.md`)
- **Issues relacionadas:** `#2` a `#25`

---

## 1. Contexto Informado
Artefatos visuais do protótipo oficial no Figma (`index.css` e bundle React de referência) + Entrega Parcial do Squad 45 com todas as Histórias de Usuário (`US-01.1` a `US-06.1`), cenários válidos e casos de borda (API indisponível, fallback preditivo de UBS, limiar de 85% de confiança na busca com IA e negação de geolocalização).

---

## 2. Prompt Canônico (`v1.0`)

```text
Você é um Engenheiro Front-end Sênior (React 18.3 + TypeScript + Vite) com experiência em produtos de saúde pública.

Construa o front-end do BRchain Portal visualmente idêntico ao protótipo oficial e funcional, consumindo uma API REST interna versionada (/api/v1) validada em runtime por schemas Zod e simulada por MSW (Mock Service Worker) enquanto o back-end estiver em desenvolvimento.

Regras inegociáveis:
1. Fixar React 18.3.1 (não usar APIs exclusivas do React 19).
2. Reaproveitar integralmente os tokens e regras CSS do protótipo em CSS puro (sem Tailwind), corrigindo artefatos de codificação UTF-8 e expondo escala de acessibilidade no botão "Acessibilidade" da barra governamental.
3. O front-end NUNCA chama DATASUS, RNDS ou provedores de LLM diretamente e NUNCA gera texto clínico/médico no cliente: apenas renderiza os dados e o objeto `fallback` retornados pelo contrato `/api/v1`.
4. Tratar estados de loading (skeleton), vazio, erro (com botão "Tentar novamente") e degradação graciosa (`meta.degraded` / `is_estimated` para lotação de UBS).
5. Documentar o contrato completo em `frontend/docs/API_CONTRACT.md` para implementação direta pelo time de Back-end em FastAPI.
```

---

## 3. Saída Esperada
- Aplicação React 18 + TypeScript + Vite estruturada por features.
- Schemas Zod (`src/api/schemas.ts`), cliente HTTP com retry/timeout (`src/api/client.ts`) e mocks MSW (`src/mocks/`).
- Testes automatizados com Vitest + Testing Library.
