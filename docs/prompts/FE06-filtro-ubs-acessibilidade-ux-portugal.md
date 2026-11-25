# Prompt FE06 — Filtro de UBS por UF/Município, Acessibilidade e UI/UX (SNS 24 / Infarmed)

- **Responsável:** Lia (`@LiaCost`)
- **Versão:** `v1.2`
- **Data:** 24/11/2026
- **Cards / Issues Relacionados:** Card 4 (Filtro por Estados/Municípios e Redirecionamento da Aba UBS) e Card 6 (Benchmarking Portugal SNS 24 / Infarmed e Acessibilidade)

---

## Prompt Utilizado (Versão Final `v1.2`)

> Implemente exclusivamente as melhorias de **Front-end** dos **Cards 4 e 6** na branch `feature/frontend`, mantendo o contrato REST `/api/v1/*`:
>
> 1. **Card 4 — Filtro por UF/Município e Aba UBS (`UnitDetailPage.tsx`, `Header.tsx`, `schemas.ts`, `mappers.ts`):**
>    - Passar `{ city_ibge: location.ibgeCode }` em `useUnitsList` para listar unidades do município selecionado.
>    - Em `VITE_DATA_MODE=api`, nunca redirecionar `/unidades` para o CNES fictício `9990001`; redirecionar automaticamente para a primeira unidade real da cidade escolhida ao trocar de UF/cidade no Header.
>    - Aceitar `rooms: null` em `UnitStaffSchema` (exibir `—` quando o CNES não informar consultórios) e escalar proporcionalmente as barras em `mapAttendanceHistoryToChartView` quando a produção ultrapassar `100`.
>
> 2. **Card 6 — Benchmarking Portugal (SNS 24 / Infarmed), Acessibilidade e UI/UX (`GovBar.tsx`, `Layout.tsx`, `MedicationDetailPage.tsx`, `ConditionDetailPage.tsx`, `format.ts`, `tokens.css`, `global.css`):**
>    - Adicionar *Skip Link* (`Pular para o conteúdo principal`) e controles progressivos de fonte (`A` = `1.3` como padrão principal do portal, `A+` = `1.45`, `A++` = `1.6`) persistidos em `localStorage`.
>    - Manter o `.site-header` e `.location-button` em linha única (`flex-wrap: nowrap`, `white-space: nowrap`) para que o seletor de localização não quebre nem cole no canto esquerdo ao ativar Alto Contraste + `A++`.
>    - Adicionar resumo rápido ao cidadão no padrão *Infomed/ANVISA* em `MedicationDetailPage`, guia de 3 níveis de atendimento no padrão *SNS 24/SUS* em `ConditionDetailPage`, ilustrações SVG institucionais por categoria regulatória (`buildMedicationCardIllustration`) e normalização de nomes em caixa alta (`formatDisplayName`) preservando siglas do SUS.
>    - Ajustar espaçamento vertical entre badges e link nos cards de medicamentos e entre o card principal/aviso educativo e o rodapé na ficha do medicamento.

---

## Histórico de Evolução

- **`v1.0`:** Implementação inicial dos controles `A` / `A+` / `A++` (com escala base `1.0`), resumo *Infomed*, guia *SNS 24*, filtro de UBS por `city_ibge` e `rooms: null`.
- **`v1.1`:** Ajuste da escala tipográfica padrão (`--font-scale: 1.3` como padrão `A`) a pedido da revisão visual, elevando `A+` (`1.45`) e `A++` (`1.6`).
- **`v1.2`:** Correção do layout do `.site-header` em modo Alto Contraste + `A++` (`FE-F05`) e refinamento de espaçamentos verticais nos cards e na ficha de medicamentos (`FE-F06`).
