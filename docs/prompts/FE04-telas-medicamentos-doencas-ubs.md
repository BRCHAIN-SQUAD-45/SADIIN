# FE04 — Fase 3: Páginas de Medicamentos, Doenças e Sintomas e Detalhes da UBS

- **ID:** FE04
- **Camada:** Front-end (`frontend/`)
- **Responsável:** Lia
- **Versão:** `v1.0`
- **Issues atendidas:** `#11` (`US-02.1`), `#12` (`US-02.2`), `#13` (`US-02.3`), `#14` (`US-03.1`), `#15` (`US-03.2`), `#16` (`US-03.3`), `#18` (`US-04.2`), `#19` (`US-04.3`), `#20/#21` (`US-04.4`), `#22` (`US-04.5`), `US-04.6`

---

## 1. Objetivo
Implementar as páginas dedicadas de **Medicamentos** (`/medicamentos` e `/medicamentos/:id`), **Doenças e Sintomas** (`/doencas` e `/doencas/:id`) e **Detalhes de Unidades de Saúde** (`/unidades` e `/unidades/:cnes`), idênticas ao protótipo oficial e integradas ao contrato `/api/v1`.

---

## 2. Prompt Utilizado (`v1.0`)

```text
Implemente a Fase 3 do front-end em `frontend/`:

1. Hooks de domínio com TanStack Query:
   - `src/features/medications/useMedications.ts` (`useMedicationCategories`, `useMedications`, `useMedicationDetail`).
   - `src/features/conditions/useConditions.ts` (`useConditionCategories`, `useConditions`, `useConditionDetail`).
   - `src/features/units/useUnitDetail.ts` (`useUnitsList`, `useUnitDetail`, `useUnitMetrics`, `useUnitAttendanceHistory`, `useUnitServices`, `useUnitStaff`).
2. `DirectoryPage.tsx` (`/medicamentos` e `/doencas`):
   - Hero centralizado, busca dedicada com debounce e integração com `GET /search?type=medications|conditions` para exibir o alerta "Consulte um profissional de saúde" + categorias sugeridas quando o usuário digitar sintomas na busca de medicamentos (US-02.1) e "Sintomas complexos. Procure uma unidade de saúde." quando a confiança for < 85% ou houver tentativa de autodiagnóstico (US-03.1).
   - Filtro por pills de categorias (US-02.2, US-03.2) e grid de 3 colunas com cards, tags de alerta e link "Ver informações completas" (US-02.3, US-03.3).
3. `MedicationDetailPage.tsx` e `ConditionDetailPage.tsx`:
   - Visualização estruturada da bula resumida (indicações, contraindicações, reações adversas, link oficial ANVISA) e da condição de saúde (CID-10, sintomas, prevenção e tratamento oficial).
4. `UnitDetailPage.tsx` (`/unidades` e `/unidades/:cnes`):
   - Redirecionamento automático de `/unidades` para a primeira UBS; seletor de unidade no topo.
   - Card de perfil com status ("Aberta agora"/"Fechada") e ações nativas `tel:` ("Ligar") e rota Google Maps ("Como chegar") (US-04.2).
   - 4 KPIs de movimento em tempo real com tag "Estimativa baseada em histórico" quando `meta.is_estimate = true` (US-04.3).
   - Gráfico de barras dos últimos 7 dias com tooltip por dia e total/média calculados pela API (US-04.4).
   - Grid de serviços filtrável por categoria + botão "Confirmar disponibilidade" (US-04.5).
   - Card de Equipe e estrutura com números oficiais do CNES e selo de competência (US-04.6).
```
