# Registro de Prompts que Falharam — Front-end (Item 1.5)

Este documento registra os casos em que prompts de desenvolvimento geraram problemas técnicos ou visuais e como foram corrigidos.

---

## Falhas Registradas no Front-end (Responsável: Lia)

### FE-F01 — Extração do Protótipo (`FE01 v1.0`): Textos e Pseudo-elementos CSS com Encoding Corrompido
- **Data:** 15/10/2026
- **Prompt Relacionado:** [`FE01-inventario-prototipo-contrato.md`](./FE01-inventario-prototipo-contrato.md)
- **O que pedimos:** Extrair diretamente as strings de interface e regras CSS do bundle exportado do protótipo no Figma.
- **O que veio (Problema):** Os arquivos exportados do protótipo continham caracteres corrompidos por dupla codificação UTF-8/Windows-1252 (ex.: `content: "?"` nos pseudo-elementos `::after` dos links e palavras acentuadas truncadas), o que deixava setas e acentos quebrados na tela.
- **O que mudamos (`FE01 v1.1`):** Refinamos o prompt exigindo sanitização UTF-8 completa de todos os textos em português e restauração explícita dos glifos CSS (`content: "→"` e `content: "•"`), preservando os valores numéricos de layout.

---

### FE-F02 — Cliente HTTP + Testes (`FE02 v1.0`): Conflito de `AbortSignal` entre `jsdom` e `fetch` do Node
- **Data:** 28/10/2026
- **Prompt Relacionado:** [`FE02-scaffold-cliente-http-msw.md`](./FE02-scaffold-cliente-http-msw.md)
- **O que pedimos:** Gerar o cliente HTTP (`src/api/client.ts`) com timeout via `AbortController` e os testes unitários no Vitest usando o ambiente `jsdom` padrão.
- **O que veio (Problema):** Todos os testes que passavam `signal` para o `fetch` falharam com `TypeError: RequestInit: Expected signal ("AbortSignal {}") to be an instance of AbortSignal`, porque o `jsdom` sobrescreve `window.AbortController` com uma implementação própria incompatível com o `fetch` nativo do Node.js (Undici).
- **O que mudamos (`FE02 v1.1`):** Ajustamos o prompt para criar um ambiente customizado do Vitest (`src/test/jsdom-native-abort.env.ts`) que restaura `AbortController` e `AbortSignal` nativos do Node após a inicialização do `jsdom`.

---

### FE-F03 — Testes de Rotas SPA (`FE03 v1.0`): Erro `window.scrollTo` não implementado no `jsdom`
- **Data:** 28/10/2026
- **Prompt Relacionado:** [`FE03-layout-global-e-home.md`](./FE03-layout-global-e-home.md)
- **O que pedimos:** Implementar o roteador SPA com `<ScrollRestoration />` do React Router e testar a navegação entre páginas no Vitest.
- **O que veio (Problema):** Durante a execução dos testes, o `jsdom` lançou erros no console (`Error: Not implemented: window.scrollTo`) sempre que o componente `<Layout />` era montado.
- **O que mudamos (`FE03 v1.1`):** Incluímos no prompt a configuração obrigatória de `window.scrollTo = vi.fn()` dentro do arquivo `src/test/setup.ts`.

---

> **Back-end e IA:** As falhas de prompts das camadas de Back-end e IA serão registradas pelos respectivos responsáveis em suas branches.
