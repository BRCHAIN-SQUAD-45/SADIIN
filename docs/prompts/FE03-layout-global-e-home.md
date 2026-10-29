# FE03 — Fase 2: Layout Global, Página Inicial (Home) e Testes de Integração

- **ID:** FE03
- **Camada:** Front-end (`frontend/`)
- **Responsável:** Lia
- **Versão:** `v1.1`
- **Issues atendidas:** `#8` (`US-01.1`), `#9` (`US-01.2`), `#10` (`US-01.3`), `#23` (`US-05.1`), `#24` (`US-05.2`), `#25` (`US-06.1`)

---

## 1. Objetivo
Construir o layout institucional global (`GovBar`, `Header`, `Footer`) e a página `Home` visualmente idênticos ao protótipo oficial, consumindo os endpoints mockados via MSW e cobrindo os cenários de uso e casos de borda com testes automatizados.

---

## 2. Prompt Utilizado (`v1.1`)

```text
Implemente a Fase 2 do front-end em `frontend/` mantendo fidelidade visual de 100% ao protótipo:

1. Estilos em CSS puro (`src/styles/tokens.css`, `reset.css`, `portal.css`, `global.css`) com variáveis de escala de fonte (`--font-scale`) acionadas pelo botão "Acessibilidade" na barra governamental (`html[data-a11y="true"]`).
2. Componentes globais:
   - `GovBar`: selo BRASIL, botão Acessibilidade, indicador de modo demonstração e data de atualização vinda de `GET /api/v1/meta`.
   - `Header`: logo BRchain SAÚDE, navegação SPA, seletor de município (`GET /api/v1/locations`) persistido no `localStorage` e menu responsivo (`<=980px`).
   - `Footer`: colunas institucionais, aviso de emergência SAMU 192 e alerta clínico obrigatório.
3. Página `HomePage.tsx` com as 6 seções na ordem exata do protótipo:
   - Hero + Busca Global com abas, debounce de 300ms, chips populares e banner de fallback seguro de IA (`US-01.1`).
   - Acesso Rápido com os 3 cards de atalho (`US-01.2`).
   - Perto de Você com geolocalização do navegador, fallback manual amigável quando negada, card da UBS mais próxima e prévia do mapa (`US-01.3`, `US-04.1`).
   - Notícias da sua região filtradas pelo município selecionado (`US-05.2`).
   - Saúde em dados (`O retrato da saúde no Brasil`) com destaque epidemiológico e cards laterais (`US-05.1`).
   - Fontes oficiais com tiles carregados de `GET /api/v1/sources` (`US-06.1`).
4. Configurar stub de `window.scrollTo` em `src/test/setup.ts` para suportar `<ScrollRestoration />` do React Router nos testes de integração com Vitest.
```

---

## 3. Histórico de Revisão
- **`v1.0`:** Testes de navegação SPA emitiam aviso de `Not implemented: window.scrollTo` no `jsdom`.
- **`v1.1`:** Adicionado stub de `window.scrollTo` no setup de testes (item 4).
