import type { AttendanceHistory, Condition, Medication, UnitMetrics, UnitSummary } from './types';
import {
  buildRouteUrl,
  buildTelHref,
  FALLBACK_CARD_IMAGE,
  formatClosesAt,
  formatDistanceLabel,
  formatInt,
  formatMovementLabel,
  formatOpenStatus,
  formatPct,
  type OpenStatusLabel,
} from '../utils/format';

/**
 * Camada de mapeamento (API → Modelos de View da UI).
 * Isola os componentes React de eventuais ajustes no contrato do Back-end.
 */

export interface DirectoryCardView {
  id: string;
  kicker: 'MEDICAMENTO' | 'SAÚDE E BEM-ESTAR';
  title: string;
  subtitle: string;
  badge: string;
  alertTags: string[];
  requiresPrescription?: boolean;
  symptomSummary: string[];
  imageUrl: string;
  imageAlt: string;
  detailHref: string;
}

export function mapMedicationToCardView(med: Medication): DirectoryCardView {
  const alertTags: string[] = [];
  const lowerBadge = med.tag.toLowerCase();
  if (med.adult_use && !lowerBadge.includes('uso adulto')) {
    alertTags.push('Uso adulto');
  }
  const rxLabel = med.requires_prescription ? 'Requer receita' : 'Sem receita';
  if (lowerBadge !== rxLabel.toLowerCase()) {
    alertTags.push(rxLabel);
  }

  return {
    id: med.id,
    kicker: 'MEDICAMENTO',
    title: med.name,
    subtitle: med.subtitle,
    badge: med.tag,
    alertTags,
    requiresPrescription: med.requires_prescription,
    symptomSummary: [],
    imageUrl: med.image_url ?? FALLBACK_CARD_IMAGE,
    imageAlt: med.image_alt ?? med.name,
    detailHref: `/medicamentos/${med.id}`,
  };
}

export function mapConditionToCardView(cond: Condition): DirectoryCardView {
  const alertTags: string[] = [];
  if (cond.cid10_code) {
    alertTags.push(`CID-10: ${cond.cid10_code}`);
  }

  return {
    id: cond.id,
    kicker: 'SAÚDE E BEM-ESTAR',
    title: cond.popular_name,
    subtitle: cond.subtitle,
    badge: cond.tag,
    alertTags,
    symptomSummary: cond.main_symptoms,
    imageUrl: cond.image_url ?? FALLBACK_CARD_IMAGE,
    imageAlt: cond.image_alt ?? cond.popular_name,
    detailHref: `/doencas/${cond.id}`,
  };
}

export interface UnitPinView {
  cnes: string;
  name: string;
  address: string;
  cityUf: string;
  lat: number;
  lng: number;
  isOpen: boolean | null;
  statusLabel: OpenStatusLabel;
  closesAtLabel: string;
  distanceLabel: string;
  phone?: string;
  telHref: string;
  routeUrl: string;
  detailHref: string;
  kind: 'ubs' | 'hospital' | 'other';
}

export function mapUnitSummaryToPinView(unit: UnitSummary): UnitPinView {
  return {
    cnes: unit.cnes_code,
    name: unit.name,
    address: unit.address,
    cityUf: `${unit.city}, ${unit.uf}`,
    lat: unit.lat,
    lng: unit.lng,
    isOpen: unit.is_open,
    statusLabel: formatOpenStatus(unit.is_open).label,
    closesAtLabel: formatClosesAt(unit.closes_at),
    distanceLabel: formatDistanceLabel(unit.distance_m),
    phone: unit.phone,
    telHref: buildTelHref(unit.phone),
    routeUrl: buildRouteUrl(unit.lat, unit.lng, unit.name),
    detailHref: `/unidades/${unit.cnes_code}`,
    kind: unit.kind,
  };
}

export interface UnitKpiView {
  attendancesFormatted: string;
  attendancesDeltaFormatted: string;
  waitMinutesLabel: string;
  waitCaption: string;
  movementLabel: string;
  capacityPct: number;
  bestTimeHint: string;
  coverageFormatted: string;
  isEstimate: boolean;
  isStale: boolean;
}

export function mapUnitMetricsToKpiView(metrics: UnitMetrics): UnitKpiView {
  return {
    attendancesFormatted: formatInt(metrics.attendances_month),
    attendancesDeltaFormatted: formatPct(metrics.attendances_delta_pct),
    waitMinutesLabel: `${metrics.avg_wait_minutes} min`,
    waitCaption: metrics.meta.is_estimate
      ? 'Estimativa baseada em histórico'
      : 'Estimativa para hoje',
    movementLabel: formatMovementLabel(metrics.movement_level),
    capacityPct: metrics.capacity_pct,
    bestTimeHint: metrics.best_time_hint,
    coverageFormatted: formatInt(metrics.registered_coverage),
    isEstimate: metrics.meta.is_estimate,
    isStale: metrics.meta.is_stale,
  };
}

export interface AttendanceBarView {
  date: string;
  weekdayLabel: string;
  attendances: number;
  heightPct: number;
  ariaLabel: string;
}

export interface AttendanceChartView {
  bars: AttendanceBarView[];
  totalFormatted: string;
  dailyAverageFormatted: string;
  isEstimate: boolean;
  isStale: boolean;
}

export function mapAttendanceHistoryToChartView(history: AttendanceHistory): AttendanceChartView {
  return {
    bars: history.days.map((d) => ({
      date: d.date,
      weekdayLabel: d.weekday_label,
      attendances: d.attendances,
      heightPct: Math.min(100, d.attendances),
      ariaLabel: `${d.weekday_label}: ${d.attendances} atendimentos`,
    })),
    totalFormatted: formatInt(history.total),
    dailyAverageFormatted: formatInt(history.daily_average),
    isEstimate: history.meta.is_estimate,
    isStale: history.meta.is_stale,
  };
}
