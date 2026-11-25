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

### INT-F04 — Plano da issue #62 esvaziaria a ficha da UBS (`INT02 v1.0`)

- **Data:** 25/11/2026
- **Prompt Relacionado:** [`INT02-desempenho-ubs-e-noticias.md`](./INT02-desempenho-ubs-e-noticias.md)
- **O que pedimos:** Seguir a issue e reduzir a busca do SIA/SIH de 12 para 3–6 meses.
- **O que veio (Problema):** Antes de mudar, uma sonda na API mostrou que os 5 meses mais recentes vêm **vazios**, porque o SIA/SIH é publicado com atraso. Com 3–6 meses a ficha ficaria quase sem dados.
- **O que mudamos:** Mantivemos os 12 meses e trocamos o sequencial por paralelo. O ganho de tempo foi o mesmo, sem perder dados.

---

### INT-F05 — `--reload` do uvicorn travou e mediu o código antigo (`INT02 v1.0`)

- **Data:** 25/11/2026
- **Prompt Relacionado:** [`INT02-desempenho-ubs-e-noticias.md`](./INT02-desempenho-ubs-e-noticias.md)
- **O que pedimos:** Medir de novo a ficha da UBS depois da otimização.
- **O que veio (Problema):** O tempo **piorou** (37–43 s) e `reference_date` continuou no formato antigo. O `--reload` ficou parado em "Reloading..." esperando as requisições lentas terminarem, então o servidor ainda rodava o código antigo.
- **O que mudamos:** Passamos a reiniciar o servidor manualmente após cada mudança e a conferir um campo novo na resposta antes de confiar na medição.

---

### INT-F06 — Categorias e filtro por UF das notícias com falsos positivos (`INT02 v1.0`)

- **Data:** 25/11/2026
- **Prompt Relacionado:** [`INT02-desempenho-ubs-e-noticias.md`](./INT02-desempenho-ubs-e-noticias.md)
- **O que pedimos:** Classificar as notícias do gov.br nas categorias do protótipo e priorizar as do estado selecionado.
- **O que veio (Problema):** (1) "vigilância" virava ALERTA DE SAÚDE, mas é o nome da Secretaria de Vigilância em Saúde e Ambiente, que marca até notícia de revista científica. (2) Comparar sem acento faria "Pará" casar com a preposição "para", presente em quase toda notícia. (3) "ubs" casaria dentro de "substituição".
- **O que mudamos:** Tiramos "vigilância" dos termos de alerta, passamos a comparar o nome do estado **com** acento e a casar termos só no início de palavra. Cada caso virou um teste em `backend/tests/test_noticias.py`.

---

### INT-F07 — Leitor das páginas do gov.br pegava conteúdo de outro assunto (`INT03 v1.0`)

- **Data:** 25/11/2026
- **Prompt Relacionado:** [`INT03-doencas-e-busca-global.md`](./INT03-doencas-e-busca-global.md)
- **O que pedimos:** Extrair sintomas, prevenção e tratamento das páginas do "Saúde de A a Z".
- **O que veio (Problema):** A 1ª versão preferia sempre os itens de lista. Na covid-19, os "sintomas" viraram os **fatores de risco**; na hipertensão, o "tratamento" virou a **lista de documentos** da Farmácia Popular. A correção seguinte exagerou e apagou os sintomas certos da tuberculose (eram parágrafos curtos, não lista).
- **O que mudamos:** Regras em camadas (lista só vale se introduzida pelo assunto; subtítulo curto só corta se for de outro assunto). Cada caso real virou um teste em `backend/tests/test_doencas.py`. Quando a página não separa bem, a seção vem vazia em vez de errada.

---

### INT-F08 — Caractere de controle no lugar de `\b` na expressão regular (`INT03 v1.0`)

- **Data:** 25/11/2026
- **Prompt Relacionado:** [`INT03-doencas-e-busca-global.md`](./INT03-doencas-e-busca-global.md)
- **O que pedimos:** Filtrar chamadas de link ("Veja…", "Acesse…") com a regex `^(veja|acesse|...)\b`.
- **O que veio (Problema):** O script que editou o arquivo gravou um caractere de controle (backspace, `\x08`) no lugar de `\b`. O código rodava sem erro, mas o filtro **não pegava nada**.
- **O que mudamos:** Conferimos o padrão compilado (`repr`) e testamos `"veja quais"` (filtra) contra `"vejamos"` (não filtra). Ficou um teste para isso.

---

### INT-F09 — Logo genérico do gov.br virando foto da doença (`INT03 v1.0`)

- **Data:** 25/11/2026
- **Prompt Relacionado:** [`INT03-doencas-e-busca-global.md`](./INT03-doencas-e-busca-global.md)
- **O que pedimos:** Usar a imagem `og:image` da página como foto do card.
- **O que veio (Problema):** No portal, vários cards (Asma, Aspergilose…) mostraram o **logo "gov.br"**. Sem foto própria, a página manda `gov.br/saude/logo.png`.
- **O que mudamos:** A foto só é aceita se estiver dentro da pasta do tópico (`/saude-de-a-a-z/`). Sem ela, o front usa a imagem neutra padrão.

---

> **Back-end e IA:** As falhas de prompts das camadas de Back-end e IA serão registradas pelos respectivos responsáveis em suas branches.
