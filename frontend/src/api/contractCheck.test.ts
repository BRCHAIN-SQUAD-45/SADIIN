import { describe, expect, it } from 'vitest';
import {
  getCitiesByState,
  getConditionById,
  getConditionCategories,
  getConditions,
  getHealth,
  getMedicationById,
  getMedicationCategories,
  getMedications,
  getMeta,
  getNearbyUnits,
  getNews,
  getRegionalDashboard,
  getSearch,
  getSources,
  getStates,
  getUnitAttendanceHistory,
  getUnitByCnes,
  getUnitMetrics,
  getUnits,
  getUnitServices,
  getUnitStaff,
} from './endpoints';

describe('Fase 6 — Verificação completa do contrato /api/v1 (contract:check)', () => {
  it('valida todas as 18 rotas do contrato contra os schemas Zod', async () => {
    const [
      health,
      meta,
      sources,
      states,
      cities,
      medCats,
      meds,
      medDetail,
      condCats,
      conds,
      condDetail,
      nearby,
      unitsPage,
      unitDetail,
      unitMetrics,
      unitHistory,
      unitServices,
      unitStaff,
      dashboard,
      news,
      search,
    ] = await Promise.all([
      getHealth(),
      getMeta(),
      getSources(),
      getStates(),
      getCitiesByState('SP'),
      getMedicationCategories(),
      getMedications(),
      getMedicationById('dipirona'),
      getConditionCategories(),
      getConditions(),
      getConditionById('dengue'),
      getNearbyUnits({ lat: -23.5489, lng: -46.6388 }),
      getUnits(),
      getUnitByCnes('9990001'),
      getUnitMetrics('9990001'),
      getUnitAttendanceHistory('9990001', 7),
      getUnitServices('9990001'),
      getUnitStaff('9990001'),
      getRegionalDashboard({ uf: 'SP', city_ibge: '3550308' }),
      getNews({ uf: 'SP', city_ibge: '3550308' }),
      getSearch({ q: 'Dipirona', type: 'all' }),
    ]);

    expect(health.status).toBe('ok');
    expect(meta.establishments_count).toBeGreaterThan(0);
    expect(sources.length).toBeGreaterThanOrEqual(5);
    expect(states.length).toBeGreaterThan(0);
    expect(cities.length).toBeGreaterThan(0);
    expect(medCats.length).toBe(4);
    expect(meds.items.length).toBe(6);
    expect(medDetail.id).toBe('dipirona');
    expect(condCats.length).toBe(4);
    expect(conds.items.length).toBe(6);
    expect(condDetail.cid10_code).toBe('A90');
    expect(nearby.length).toBeGreaterThan(0);
    expect(unitsPage.items.length).toBeGreaterThan(0);
    expect(unitDetail.cnes_code).toBe('9990001');
    expect(unitMetrics.attendances_month).toBe(3842);
    expect(unitHistory.total).toBe(463);
    expect(unitServices.length).toBe(6);
    expect(unitStaff.professionals).toBe(32);
    expect(dashboard.headline.delta_pct).toBe(-18.4);
    expect(news.items.length).toBe(3);
    expect(search.results.medications.length).toBeGreaterThan(0);
  });
});
