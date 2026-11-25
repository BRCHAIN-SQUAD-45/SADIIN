# INT02 — Desempenho da ficha da UBS (#62) e notícias oficiais na Home (#57)

- **ID:** INT02
- **Camada:** Back-end (`backend/`) + ajuste pontual no front (`HomePage.tsx`)
- **Responsável:** Nícolas
- **Ferramenta:** Claude Code (app desktop), modelo Claude Opus 5.5, plano Pro
- **Versão:** `v1.0`
- **Data:** 25/11/2026
- **Issues:** [#62](https://github.com/BRCHAIN-SQUAD-45/SADIIN/issues/62) e [#57](https://github.com/BRCHAIN-SQUAD-45/SADIIN/issues/57)

---

## 1. Objetivo

1. **#62:** a ficha da UBS levava de 20 a 30 s para carregar. Baixar para menos de 2 s, corrigir
   `reference_date: ""` em `/ubs/{cnes}/staff` e deixar os nomes das unidades legíveis, com as
   unidades básicas primeiro.
2. **#57:** trocar o `501` de `GET /api/v1/news` por notícias de **fonte oficial**, com título,
   resumo, data, categoria, imagem de capa e link.

---

## 2. Prompt Utilizado (`v1.0`)

```text
Recebi duas tarefas do projeto SADIIN (prints das issues #62 e #57).

#62: a ficha da UBS demora 20-30 s porque buscar_producao_cnes faz 24 requisições
sequenciais ao DATASUS sem cache, chamada duas vezes (/metrics e /attendance-history).
get_unit_staff devolve reference_date "" e quebra o Zod. Também padronizar os nomes
(Title Case) e priorizar UBS/AMA/USF na listagem.

#57: GET /api/v1/news ainda responde 501. Integrar feed RSS / API oficial do Ministério
da Saúde (gov.br), retornando título, resumo, data, categoria, imagem de capa e link.
Tem que ser fonte oficial do governo.

Antes de mudar, meça o tempo atual. Confira se alguém já abriu branch para essas issues
e não mexa nos arquivos do PR aberto da Lia. Rode testes e confira no portal em modo api.
```

---

## 3. Resultado — #62 (ficha da UBS)

**Medição** (5 rotas da ficha em paralelo, como o front pede; 4 UBS diferentes):

|                       | Antes                     | Depois        |
| --------------------- | ------------------------- | ------------- |
| 1ª visita (sem cache) | 29–43 s                   | **3,9–6,7 s** |
| Visitas seguintes     | 29–43 s (não havia cache) | **0,4–0,6 s** |

Na 1ª visita, o que sobra é o tempo de resposta da própria API do DATASUS (1,5 a 5 s por chamada).

**Decisão importante:** a issue sugeria reduzir de 12 para 3–6 meses. A sonda mostrou que o
SIA/SIH é publicado com **~5 meses de atraso** (os 5 meses mais recentes vêm vazios). Cortar para
3–6 meses deixaria a ficha praticamente vazia. Por isso mantivemos os 12 meses e fizemos as 24
consultas **em paralelo** (2 s no total, contra ~30 s em sequência).

O que mudou:

- `cache.py` (novo): cache em memória com TTL e "single-flight" por chave. Duas rotas pedindo o
  mesmo dado fazem **um** download, e o lock é por chave, então uma UBS não trava a outra.
- `cnes_resources.py`: produção SIA/SIH em paralelo e com cache (6 h, porque os dados são
  mensais). Profissionais e serviços são buscados em lotes de 6 meses, do mais recente para o mais
  antigo. Saiu o lock **global**, que fazia uma consulta esperar a outra.
- `demas.py`: serviços passaram a usar a mesma busca paralela (antes eram até 24 meses em
  sequência, com outro lock global).
- `ubs.py`: cache da ficha (CNES + município IBGE). `reference_date` agora sai no formato
  `"YYYY-MM"`. Se o CNES não publicou profissionais em 12 meses, a rota responde `501` em vez de
  devolver `""`.
- `units.py`: `formatar_nome_unidade` (Title Case com siglas UBS/AMA/USF/CAPS, conectivos em
  minúsculas, `Dr.`, números romanos e acentos de palavras comuns) e `eh_unidade_basica`. As listas
  `/ubs` e `/ubs/nearby` mostram as unidades básicas primeiro.

## 4. Resultado — #57 (notícias)

**Fonte escolhida:** busca RSS oficial do portal do Ministério da Saúde (Plone):
`https://www.gov.br/saude/search_rss?portal_type=collective.nitf.content&sort_on=effective&sort_order=reverse`.
Ela devolve as notícias mais recentes **já ordenadas por data**, com título, resumo, data, link e
assuntos.

| Fonte testada                                      | Resultado                                                             |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| `/saude/pt-br/assuntos/noticias/RSS`               | ❌ Lista as pastas de ano (2014, 2015…), não as notícias              |
| `/saude/pt-br/assuntos/noticias/2026/novembro/RSS` | ❌ Fora de ordem e limitado a 15 itens (pode omitir as mais recentes) |
| `/saude/pt-br/RSS`                                 | ❌ Mistura notícias com arquivos e imagens                            |
| API REST do Plone (`++api++`)                      | ❌ 404 (desativada no gov.br)                                         |
| **`/saude/search_rss?...`**                        | ✅ Só notícias, ordenadas, com resumo e assuntos                      |

- **Imagem de capa:** não vem no feed. É lida da tag `og:image` da página da notícia e só é aceita
  se for HTTPS do gov.br.
- **Categoria:** os assuntos do gov.br são mapeados para as categorias do protótipo (VACINAÇÃO,
  ALERTA DE SAÚDE, ATENÇÃO PRIMÁRIA, SERVIÇOS), e o padrão é "MINISTÉRIO DA SAÚDE".
- **Região:** o feed é nacional. Com `uf`, notícias que citam o estado (nome ou sigla, como
  "(RS)") aparecem primeiro.
- **Resiliência:** cache de 15 min. Se o gov.br cair, a rota serve a última cópia boa; sem cópia,
  responde `502`.
- **Front:** o título de cada notícia virou link para a página oficial (nova aba), como pede a
  atribuição do gov.br. A imagem de destaque ficou com `alt=""` (decorativa), porque o `alt` fixo
  "Pessoa usando máscara…" não correspondia à foto real.

## 5. Verificação

- **Back-end:** 26 testes novos com `pytest` (`backend/tests/`), sem acesso à internet. Novo
  workflow `.github/workflows/backend.yml` roda os testes em todo PR que mexe em `backend/`.
- **Front-end:** `tsc`, `eslint`, `prettier` e 58 testes `vitest` passando.
- **`npm run contract:live`:** 15/21 rotas dentro do contrato (antes 9/21). `/news` passa. A única
  divergência que sobra no escopo é `rooms: null` em `/staff`, já corrigida no schema do front
  pelo PR #67 da Lia.
- **Portal (modo api):** carrossel com notícias reais, foto e link; ficha da UBS com métricas,
  histórico e nomes legíveis.

## 6. Achados para o squad (fora do escopo destas issues)

- **CNES por município:** o back-end encontra só **28** unidades SUS ativas em São Paulo, quando a
  cidade tem centenas de UBS. A listagem por cidade (`buscar_todas_unidades_municipais`) está
  perdendo unidades.
- **`/ubs/{cnes}/metrics`:** devolve `avg_wait_minutes: 0`, `capacity_pct: 0` e
  `registered_coverage: 0` quando a fonte não tem o dado. O portal mostra "0 min" e "0 pessoas"
  como se fossem valores reais.
- **Profissionais:** a API do CNES devolveu 1 profissional por UBS em todas as unidades testadas.
  Vale conferir se é limitação da API ou do filtro.
