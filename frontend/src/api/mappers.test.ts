import { describe, expect, it } from 'vitest';
import {
  mapAttendanceHistoryToChartView,
  mapConditionToCardView,
  mapMedicationToCardView,
  mapUnitMetricsToKpiView,
  mapUnitSummaryToPinView,
} from './mappers';
import {
  buildAttendanceHistoryFixture,
  buildUnitMetricsFixture,
  conditionsFixture,
  medicationsFixture,
  toUnitSummary,
  unitsFixture,
} from '../mocks/fixtures/meta';

describe('Fase 4 — Camada de mappers (API -> View)', () => {
  it('mapeia Medication para DirectoryCardView com tags de alerta (US-02.3) e fallback de imagem seguro', () => {
    const med = medicationsFixture[0]!;
    const view = mapMedicationToCardView(med);
    expect(view.kicker).toBe('MEDICAMENTO');
    expect(view.title).toBe('Dipirona');
    expect(view.badge).toBe('Mais consultado');
    expect(view.alertTags).toEqual(['Uso adulto', 'Sem receita']);
    expect(view.detailHref).toBe('/medicamentos/dipirona');

    const prescriptionMed = mapMedicationToCardView({ ...med, requires_prescription: true });
    expect(prescriptionMed.alertTags).toEqual(['Uso adulto', 'Requer receita']);

    const withoutImg = mapMedicationToCardView({ ...med, image_url: undefined });
    expect(withoutImg.imageUrl).toContain('data:image/svg+xml');
  });

  it('mapeia Condition para DirectoryCardView com resumo de sintomas (US-03.3)', () => {
    const cond = conditionsFixture[2]!;
    const view = mapConditionToCardView(cond);
    expect(view.kicker).toBe('SAÚDE E BEM-ESTAR');
    expect(view.title).toBe('Dengue');
    expect(view.badge).toBe('Atenção epidemiológica');
    expect(view.alertTags).toEqual(['CID-10: A90']);
    expect(view.symptomSummary.length).toBeGreaterThan(0);
    expect(view.detailHref).toBe('/doencas/dengue');
  });

  it('mapeia UnitSummary para UnitPinView com links nativos tel e rota', () => {
    const unit = toUnitSummary(unitsFixture[0]!);
    const pin = mapUnitSummaryToPinView(unit);
    expect(pin.name).toBe('UBS República');
    expect(pin.statusLabel).toBe('Aberta agora');
    expect(pin.distanceLabel).toBe('850 M');
    expect(pin.closesAtLabel).toBe('Até 19h');
    expect(pin.telHref).toBe('tel:+551133330180');
    expect(pin.routeUrl).toContain('google.com/maps/dir/');
    expect(pin.detailHref).toBe('/unidades/9990001');
  });

  it('mapeia UnitMetrics para UnitKpiView respeitando meta.is_estimate', () => {
    const realtime = mapUnitMetricsToKpiView(buildUnitMetricsFixture('9990001'));
    expect(realtime.attendancesFormatted).toBe('3.842');
    expect(realtime.attendancesDeltaFormatted).toBe('6,2%');
    expect(realtime.waitMinutesLabel).toBe('24 min');
    expect(realtime.waitCaption).toBe('Estimativa para hoje');
    expect(realtime.movementLabel).toBe('Moderado');
    expect(realtime.isEstimate).toBe(false);

    const estimated = mapUnitMetricsToKpiView(
      buildUnitMetricsFixture('9990001', { isEstimate: true }),
    );
    expect(estimated.waitCaption).toBe('Estimativa baseada em histórico');
    expect(estimated.isEstimate).toBe(true);
  });

  it('mapeia AttendanceHistory para AttendanceChartView com soma e média da API', () => {
    const chart = mapAttendanceHistoryToChartView(buildAttendanceHistoryFixture());
    expect(chart.bars).toHaveLength(7);
    expect(chart.totalFormatted).toBe('463');
    expect(chart.dailyAverageFormatted).toBe('66');
    expect(chart.bars[3]?.ariaLabel).toBe('Qui: 92 atendimentos');
  });
});
