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

### FE-F04 — Pinos Acessíveis do Mapa (`FE05 v1.0`): Conflito entre `onFocus` e `onClick` ao clicar no pino

- **Data:** 29/10/2026
- **Prompt Relacionado:** [`FE05-mappers-mapa-leaflet-contrato.md`](./FE05-mappers-mapa-leaflet-contrato.md)
- **O que pedimos:** Tornar os pinos de UBS do mapa acessíveis por teclado (`tabIndex={0}`, `onFocus`, `onClick`) exibindo o tooltip com o nome da unidade.
- **O que veio (Problema):** O handler `onClick={() => setActivePinCnes(isActive ? null : u.cnes)}` combinado com `onFocus={() => setActivePinCnes(u.cnes)}` fazia com que um clique de mouse primeiro disparasse `focus` (`isActive = true`) e em seguida `click` (`isActive = null`), fechando o tooltip imediatamente.
- **O que mudamos (`FE05 v1.1`):** Ajustamos `onClick` para ativar diretamente `setActivePinCnes(u.cnes)`, mantendo a alternância apenas nas teclas `Enter`/`Espaço` e o fechamento no `onBlur`.

---

## Falhas Registradas na Integração Front ↔ Back (Responsável: Nícolas)

### INT-F01 — `contract:check` não testava o back-end real (`INT01 v1.0`)

- **Data:** 10/11/2026
- **Prompt Relacionado:** [`INT01-integracao-front-back.md`](./INT01-integracao-front-back.md)
- **O que pedimos:** Validar as rotas do back-end com `npm run contract:check`, como sugeria o guia de integração.
- **O que veio (Problema):** O comando passava, mas ele valida as respostas do **MSW (mocks)**, não do FastAPI. Contra o back-end real, só 4 de 21 rotas estavam dentro do contrato.
- **O que mudamos:** Criamos `npm run contract:live` (`frontend/scripts/live-contract-check.ts`), que chama o back-end real e valida cada resposta com os mesmos schemas Zod.

---

### INT-F02 — Teste de rota quebrou após mostrar a UBS aberta no seletor (`INT01 v1.0`)

- **Data:** 10/11/2026
- **Prompt Relacionado:** [`INT01-integracao-front-back.md`](./INT01-integracao-front-back.md)
- **O que pedimos:** Remover as UBS fictícias do seletor e garantir que a unidade aberta sempre aparece nele.
- **O que veio (Problema):** O teste `/unidades/9990001` de `router.test.tsx` falhou com `Found multiple elements with the text: /UBS República/`, porque agora o nome aparece no título e no `<option>` do seletor.
- **O que mudamos:** O teste passou a procurar o título (`getByRole('heading')`) e a conferir que o seletor está com o CNES certo.

---

### INT-F03 — `npm ci` reescreveu `mockServiceWorker.js` (`INT01 v1.0`)

- **Data:** 10/11/2026
- **Prompt Relacionado:** [`INT01-integracao-front-back.md`](./INT01-integracao-front-back.md)
- **O que pedimos:** Instalar as dependências do front para rodar a integração.
- **O que veio (Problema):** O `postinstall` do MSW regenerou `frontend/public/mockServiceWorker.js` sem ponto e vírgula, gerando um diff de 167 linhas que não tinha nada a ver com a tarefa.
- **O que mudamos:** Restauramos o arquivo com `git checkout` antes do commit. **Atenção, squad:** confiram se esse arquivo não entrou sem querer nos seus PRs.

---

> **Back-end e IA:** As falhas de prompts das camadas de Back-end e IA serão registradas pelos respectivos responsáveis em suas branches.
