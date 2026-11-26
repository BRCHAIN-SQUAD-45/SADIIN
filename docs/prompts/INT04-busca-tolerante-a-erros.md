# INT04 — Busca tolerante a erros: desempenho e "Você quis dizer?" (#64)

- **ID:** INT04
- **Camada:** Back-end (`backend/`) + Front-end (`frontend/`)
- **Responsável:** Nícolas (a issue é de Lucas e Yasmin; a busca aproximada no back-end veio do PR #70 do Lucas)
- **Ferramenta:** Claude Code (app desktop), modelo Claude Opus 5.5, plano Pro
- **Versão:** `v1.0`
- **Data:** 26/11/2026
- **Issue:** [#64](https://github.com/BRCHAIN-SQUAD-45/SADIIN/issues/64)

---

## 1. Objetivo

Completar a issue #64. A busca aproximada no back-end já existia (PR #70, `app/search/fuzzy.py`). Faltava:

1. **Desempenho:** depois do #70, toda busca levava de **10 a 30 s**, inclusive palavras escritas certas.
2. **Termo reconhecido:** "pressao auta" era reconhecido como um remédio, e não como a doença Hipertensão.
3. **Tela:** o portal não mostrava as sugestões. Não havia "Você quis dizer…?".

---

## 2. Prompt Utilizado (`v1.0`)

```text
Fazer agora a #64 (busca tolerante a erros / "Você quis dizer?").
Antes de começar, veja o que já existe: o Lucas mergeou o PR #70 com busca aproximada.
Faça só o que falta, sem refazer o trabalho dele, e meça antes e depois.
```

---

## 3. Diagnóstico (medido no catálogo real da ANVISA: 6.517 grupos)

| Função                                        | Tempo por busca (antes)     | Por quê                                                |
| --------------------------------------------- | --------------------------- | ------------------------------------------------------ |
| `sugerir_medicamentos`                        | **4,7–6,2 s** em toda busca | `SequenceMatcher` contra todos os registros e apelidos |
| `listar_medicamentos` (com erro de digitação) | **5,5 s**                   | Mesmo motivo                                           |
| `/search` completo                            | **10–30 s**                 | Soma das duas, mais doenças e UBS                      |

## 4. O que mudou

**Back-end**

- **`app/search/indice.py` (novo):** índice montado **uma vez por carga do catálogo** (0,3 s). Guarda o texto normalizado de cada registro e o vocabulário (palavra → registros). A palavra digitada é comparada só com o vocabulário (7.201 palavras, `difflib.get_close_matches`) e com o começo das palavras. O ranking final continua sendo o `rank_fuzzy_candidates` do Lucas, mas roda só nos poucos registros candidatos.
- **`anvisa.py`:** a lista e as sugestões usam o índice. O nome igual ao digitado vem primeiro ("paracetamol" → Paracetamol antes de "Fosfato de Codeína, Paracetamol"). O índice é refeito quando o catálogo recarrega (compara a lista com `is`, não com `id()`).
- **`dashboard.py`:**
  - Sem nome exato, a doença parecida compete com a melhor sugestão de remédio e vence no empate ("pressao auta" → Hipertensão).
  - As sugestões são ordenadas só pela nota, mantendo a ordem do ranking no empate (antes desempatava em ordem alfabética).

**Front-end**

- **`components/search/DidYouMean.tsx` + `utils/busca.ts` (novos):** quando o termo reconhecido não contém o que foi digitado, mostra **"Você quis dizer Dipirona?"** como botão que refaz a busca, mais até 3 outras sugestões.
- **Home e páginas de Medicamentos / Doenças** usam o componente.

## 5. Resultado

| Busca                             | Antes                    | Depois                              |
| --------------------------------- | ------------------------ | ----------------------------------- |
| `/search?q=dprirona`              | 11–60 s                  | **0,43 s**                          |
| `/search?q=paracetamol`           | 21 s                     | **0,37 s**                          |
| `/search?q=pressao auta`          | 21–29 s (termo: remédio) | **0,40 s** (termo: **Hipertensão**) |
| Sugestões de medicamento (função) | 4,7–6,2 s                | **0,07–0,11 s**                     |

A primeira busca depois de subir o servidor ainda leva ~20 s, porque baixa o catálogo da ANVISA (uma vez a cada 6 h).

## 6. Verificação

- **Back-end:** 72 testes `pytest` (9 novos em `test_busca_tolerante.py`, incluindo um de tempo em catálogo de 6.500 registros). Os testes do Lucas (`test_fuzzy_search.py`, `test_anvisa.py`) continuam passando.
- **Front-end:** `tsc`, `eslint`, `prettier`, 68 testes `vitest` (5 novos) e `build`.
- **Portal (modo api):**
  - Home: "dprirona" → "Você quis dizer Dipirona?"; o clique corrige a busca.
  - Medicamentos: "amoxicilna" → Amoxicilina.
  - Doenças: "tuberculoze" → Tuberculose.
