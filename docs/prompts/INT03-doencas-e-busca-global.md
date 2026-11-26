# INT03 — Catálogo de doenças (#43, #46) e busca global (#33)

- **ID:** INT03
- **Camada:** Back-end (`backend/`)
- **Responsável:** Nícolas (issues também atribuídas a Lucas e Marina)
- **Ferramenta:** Claude Code (app desktop), modelo Claude Opus 5.5, plano Pro
- **Versão:** `v1.0`
- **Data:** 25/11/2026
- **Issues:** [#43](https://github.com/BRCHAIN-SQUAD-45/SADIIN/issues/43),
  [#46](https://github.com/BRCHAIN-SQUAD-45/SADIIN/issues/46) e
  [#33](https://github.com/BRCHAIN-SQUAD-45/SADIIN/issues/33). Foram reabertas pela líder depois da
  revisão do Kanban, que mostrou que estavam como "Finalizado" mas respondiam `501`.

---

## 1. Objetivo

1. **#43:** busca textual no catálogo de doenças/CIDs (`GET /conditions?q=`).
2. **#46:** listas por categoria (`GET /conditions/categories` e `GET /conditions?category=`).
3. **#33:** busca global que unifica medicamentos, doenças e unidades de saúde (`GET /search`).

Regra do projeto: só **fontes oficiais**.

---

## 2. Prompt Utilizado (`v1.0`)

```text
A líder reabriu o #33, #43 e #46 e me marcou. Pode começar.

#43/#46: as rotas /conditions respondem 501 porque não há fonte de dados. Encontre uma fonte
oficial do governo para o catálogo de doenças (nome, CID-10, categoria, sintomas, prevenção,
tratamento) e implemente /conditions, /conditions/categories e /conditions/{id} no formato que
o front já espera (frontend/src/api/schemas.ts).

#33: a busca global só procura UBS. Ligue também medicamentos (ANVISA, já existe) e doenças.

Sem inventar dado: o que a fonte não tiver fica vazio. Testes sem internet, conferência no portal
em modo api e registro em docs/.
```

---

## 3. Fontes escolhidas

| Dado                                                | Fonte oficial                                                                            | Como é usada                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Nome popular, sintomas, prevenção, tratamento, foto | **Saúde de A a Z** do Ministério da Saúde (`gov.br/saude/pt-br/assuntos/saude-de-a-a-z`) | Página de cada tópico lida sob demanda, com cache de 24 h  |
| Código, descrição e categoria                       | **Tabela CID-10 do DATASUS** (download oficial V2008)                                    | CSVs em `backend/app/data/cid10/` (convertidos para UTF-8) |

- **Por que juntar as duas:** o "Saúde de A a Z" não informa o CID-10, e a CID-10 não traz sintomas
  nem prevenção.
- **Catálogo curado (`app/data/doencas_az.py`):** dos 178 tópicos do A a Z, **100 são doenças** com
  código CID-10 claro. Ficaram de fora vacinas, programas (SUS, SAMU, Vigitel), clima e tópicos
  amplos demais ("Doenças oculares", "Arboviroses"). Só 36 batiam automaticamente pelo nome; o resto
  foi vinculado à mão. **Um teste confere que todo código existe na CID-10 oficial.**
- **Categoria = capítulo da CID-10**, com o nome completo oficial (ex.: "Algumas doenças infecciosas e
  parasitárias"). São 15 categorias.
- **CIDs ficam no repositório** para não depender do site antigo do DATASUS em produção e para os
  testes rodarem sem internet.

## 4. Resultado

- `GET /conditions/categories`: os 15 capítulos que têm doenças no catálogo.
- `GET /conditions?q=&category=&page=&page_size=`: busca por **nome, sinônimo** ("pressão alta",
  "derrame") **ou código CID-10** ("A90", "A92.0"; "B16" encontra o intervalo "B15-B19"), sem
  diferença de acento. Os cards trazem só sintomas curtos e a foto do tópico.
- `GET /conditions/{id}`: sintomas, prevenção, tratamento, link da página oficial (`source_url`) e
  foto. Se o gov.br cair, responde com os dados da CID-10 e `meta.is_stale: true`.
- `GET /search`: medicamentos (ANVISA), doenças e UBS **em paralelo**. Em `type=all`, se uma fonte
  falhar, as outras respondem; com um tipo só, a falha vira `502`. Reconhece o termo pelo nome,
  sinônimo ou CID ("Termo reconhecido: Hipertensão (pressão alta)"). Como a busca é textual, não IA,
  `fallback` é sempre `null`: as travas de segurança ficam para a parte de IA.

**Leitura das páginas do gov.br:** elas usam blocos "cover" (`<h2 class="outstanding-title">` +
blocos de texto). Regras que evitam pegar conteúdo de outro assunto dentro da mesma seção:

1. Uma lista só vale se abrir a seção ou se o parágrafo antes dela citar o assunto
   ("Os principais **sintomas** são:").
2. Subtítulos curtos de outro assunto ("Grupos de riscos", "Transmissão") cortam o que vem depois.
3. Chamadas de link ("Veja…", "Acesse…") saem, e o ";" / " e" do fim dos itens é removido.
4. Foto só se for do próprio tópico. Sem ela, o gov.br manda o logo genérico, que é descartado.

## 5. Verificação

- **Back-end:** 49 testes `pytest` (23 novos em `test_doencas.py` e `test_busca_global.py`), sem
  internet.
- **`npm run contract:live`:** **19/21** rotas dentro do contrato (antes 15/21). As 2 que faltam
  não são destas issues: `/staff` (`rooms: null`, resolvido no PR #67) e `/dashboard/regional` (#55).
- **Portal (modo api):** página "Doenças e sintomas" com 100 doenças e 15 filtros de categoria;
  ficha da dengue com sintomas, prevenção e tratamento; busca da Home reconhecendo "pressão alta".

## 6. Limitações conhecidas

- Algumas páginas do gov.br não separam bem os sintomas (ex.: covid-19, diabetes). Nesses casos a
  seção vem vazia ou com um parágrafo, **em vez de vir errada**.
- A busca de medicamentos da ANVISA (já existente) casa pedaços de palavra: "UBS" encontra
  "PEPTO-BISMOL" (sub**s**alicilato). Isso é assunto das issues #63/#64.
