# FE05 — Fases 4, 5 e 6: Camada de Mappers, Mapa Interativo Leaflet, Gráfico Recharts e Documentação do Contrato

- **ID:** FE05
- **Camada:** Front-end (`frontend/`)
- **Responsável:** Lia
- **Versão:** `v1.1`
- **Issues atendidas:** `#13` (`US-02.3`), `#16` (`US-03.3`), `#17` (`US-04.1`), `#20/#21` (`US-04.4` — Recharts), `#25` (`US-06.1`) + Contrato de Integração Front/Back

---

## 1. Objetivo
Concluir o Front-end com:
1. **Fase 4:** Camada `src/api/mappers.ts` para desacoplar os componentes de apresentação da estrutura bruta do JSON da API, incluindo tags de alerta nos cards de medicamentos (`Uso adulto`, `Requer receita` / `Sem receita` — `US-02.3`) e resumo de sintomas nos cards de doenças (`US-03.3`).
2. **Fase 5:**
   - Componente `NearbyUnitsMap.tsx` utilizando **Leaflet + react-leaflet + OpenStreetMap** na seção "Perto de você" da Home (`US-04.1`), mantendo os mesmos pinos customizados, tooltip/popup, indicador "Você está aqui" e legenda "UBS / Hospital" do protótipo.
   - Componente `UnitAttendanceChart.tsx` utilizando **Recharts** (`BarChart`, `Bar`, `XAxis`, `Tooltip`, `Cell`) para o gráfico diário de barras da UBS (`US-04.4`).
3. **Fase 6:** Documentação técnica de integração (`frontend/docs/API_CONTRACT.md` e `frontend/docs/INTEGRATION_GUIDE.md`) e script `npm run contract:check` validando as 18 rotas da API contra os schemas Zod.

---

## 2. Prompt Utilizado (`v1.1`)

```text
Implemente as Fases 4, 5 e 6 do front-end em `frontend/`:

1. `src/api/mappers.ts` (+ `src/api/mappers.test.ts`):
   - Funções puras `mapMedicationToCardView` (com `alertTags` para "Uso adulto" e "Requer receita"/"Sem receita"), `mapConditionToCardView` (com `symptomSummary` e `CID-10`), `mapUnitSummaryToPinView`, `mapUnitMetricsToKpiView` e `mapAttendanceHistoryToChartView`.
2. `src/components/map/NearbyUnitsMap.tsx` (+ `NearbyUnitsMap.test.tsx`):
   - Mapa interativo com `MapContainer`, `TileLayer`, `Marker` e `Popup` do `react-leaflet` consumindo `VITE_MAP_TILE_URL` e `VITE_MAP_ATTRIBUTION`.
   - Marcadores `L.divIcon` reproduzindo os pinos verde (`#087f70`, UBS) e azul (`#3b7796`, Hospital), marcador "Você está aqui" (`#2384c2`) e legenda "UBS / Hospital".
3. `src/components/charts/UnitAttendanceChart.tsx`:
   - Gráfico de barras diário com Recharts (`BarChart`, `Bar`, `XAxis`, `Tooltip`, `Cell`) para `US-04.4` (Issues #20 e #21).
4. `frontend/docs/API_CONTRACT.md`, `frontend/docs/INTEGRATION_GUIDE.md` e `src/api/contractCheck.test.ts` (`npm run contract:check`).
```
