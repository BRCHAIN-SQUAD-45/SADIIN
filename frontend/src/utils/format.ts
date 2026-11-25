/**
 * Formatadores pt-BR reproduzindo exatamente os formatos do protótipo.
 */

const MONTHS_SHORT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;

const intFmt = new Intl.NumberFormat('pt-BR');
const dec1Fmt = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** "28 mai 2025" (sem "de" e sem ponto, igual ao gov-bar do protótipo). */
export function formatGovDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getUTCDate();
  const month = MONTHS_SHORT[d.getUTCMonth()] ?? '';
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

/** Dia e mês abreviado em maiúsculas para os cards de notícia: `{ day: '28', month: 'MAI' }`. */
export function formatNewsDayMonth(iso: string): { day: string; month: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: '--', month: '---' };
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = (MONTHS_SHORT[d.getUTCMonth()] ?? '').toUpperCase();
  return { day, month };
}

/** `452818` → `"452 mil"` (card flutuante do hero). */
export function formatEstablishmentsShort(n: number): string {
  if (n >= 1000) return `${Math.floor(n / 1000)} mil`;
  return intFmt.format(n);
}

/** `452818` → `"452.818"`. */
export function formatInt(n: number): string {
  return intFmt.format(n);
}

/** `-18.4` → `"−18,4%"` (usa o sinal matemático `−` U+2212 do protótipo). */
export function formatSignedPct(n: number): string {
  const abs = dec1Fmt.format(Math.abs(n));
  if (n < 0) return `−${abs}%`;
  return `${abs}%`;
}

/** `2.3` → `"2,3%"`. */
export function formatPct(n: number): string {
  return `${dec1Fmt.format(Math.abs(n))}%`;
}

/** `850` → `"850 M"` | `1400` → `"1,4 KM"`. */
export function formatDistanceLabel(meters?: number): string {
  if (meters === undefined) return '';
  if (meters < 1000) return `${Math.round(meters)} M`;
  return `${dec1Fmt.format(meters / 1000)} KM`;
}

/** `"19:00"` → `"Até 19h"` | `"19:30"` → `"Até 19h30"`. */
export function formatClosesAt(hhmm?: string): string {
  if (!hhmm) return '';
  const [h = '', m = '00'] = hhmm.split(':');
  const hour = Number(h);
  if (!Number.isFinite(hour)) return `Até ${hhmm}`;
  return m === '00' ? `Até ${hour}h` : `Até ${hour}h${m}`;
}

/** Deep link de rota para Google Maps. */
export function buildRouteUrl(lat: number, lng: number, label?: string): string {
  const dest = label ? `${encodeURIComponent(label)}@${lat},${lng}` : `${lat},${lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

/** `"tel:+551133330180"` a partir de `"(11) 3333-0180"`. */
export function buildTelHref(phone?: string): string {
  if (!phone) return '#';
  const digits = phone.replace(/\D/g, '');
  return digits ? `tel:+55${digits}` : '#';
}

/** Rótulo capitalizado de lotação da UBS (`"baixo"` -> `"Baixo"`, `"moderado"` -> `"Moderado"`). */
export function formatMovementLabel(level: 'baixo' | 'moderado' | 'alto'): string {
  const labels: Record<'baixo' | 'moderado' | 'alto', string> = {
    baixo: 'Baixo',
    moderado: 'Moderado',
    alto: 'Alto',
  };
  return labels[level];
}

/**
 * Data de atualização da UBS.
 * Mesmo dia (UTC) -> `"Hoje, às 08:42"` (formato do protótipo); outros dias -> `"27/02/2026"`.
 */
export function formatUnitUpdatedLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const sameDay = d.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
  if (sameDay) {
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `Hoje, às ${hh}:${mm}`;
  }
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mo}/${d.getUTCFullYear()}`;
}

export type OpenStatusLabel = 'Aberta agora' | 'Fechada' | 'Horário não informado';

/**
 * Status de funcionamento. `null` significa que a fonte (CNES) não informa o horário:
 * nunca exibimos "Fechada" para um dado ausente.
 */
export function formatOpenStatus(isOpen: boolean | null | undefined): {
  label: OpenStatusLabel;
  badgeClass: string;
} {
  if (isOpen === true) return { label: 'Aberta agora', badgeClass: 'open-badge' };
  if (isOpen === false) return { label: 'Fechada', badgeClass: 'open-badge closed' };
  return { label: 'Horário não informado', badgeClass: 'open-badge unknown' };
}

/** `"Quarta-feira, 11 de novembro"` para a data de hoje. */
export function formatTodayLabel(now: Date = new Date()): string {
  const label = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const PRESERVED_ACRONYMS = new Set([
  'UBS',
  'AMA',
  'UPA',
  'CAPS',
  'PS',
  'USF',
  'ESF',
  'SAMU',
  'SUS',
  'CNES',
  'CEO',
  'SAD',
  'DST',
  'HIV',
  'UTI',
  'CTA',
  'APAE',
  'AME',
  'PAI',
  'URSI',
  'NIR',
  'CER',
  'MG',
  'ML',
  'MCG',
  'UI',
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
]);

const LOWER_PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com', 'para', 'por']);

/**
 * Normaliza textos vindos 100% em CAIXA ALTA ou 100% em minúsculas das bases brutas
 * (CNES / ANVISA) para Title Case legível, preservando siglas oficiais do SUS.
 * Strings que já possuem caixa mista (ex.: "UBS República", "Dipirona") permanecem intactas.
 */
export function formatDisplayName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  const hasLetters = /[a-zA-ZÀ-ÿ]/.test(trimmed);
  if (!hasLetters) return raw;

  const isAllUpper = trimmed === trimmed.toUpperCase();
  const isAllLower = trimmed === trimmed.toLowerCase();
  if (!isAllUpper && !isAllLower) {
    return raw;
  }

  return trimmed
    .split(/\s+/)
    .map((word, idx) => {
      const cleanUpper = word.toUpperCase();
      if (PRESERVED_ACRONYMS.has(cleanUpper)) {
        return cleanUpper;
      }
      const lower = word.toLowerCase();
      if (idx > 0 && LOWER_PARTICLES.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/** Imagem SVG local institucional caso uma URL externa falhe ou não exista na base oficial (regra 3.1). */
export const FALLBACK_CARD_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450' viewBox='0 0 800 450'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%23e3f3ef'/><stop offset='100%' stop-color='%23cde5df'/></linearGradient></defs><rect width='800' height='450' fill='url(%23g)'/><circle cx='400' cy='215' r='64' fill='%23ffffff' fill-opacity='0.78'/><rect x='370' y='198' width='60' height='34' rx='17' fill='%23087e70'/><rect x='400' y='198' width='30' height='34' rx='15' fill='%2317a48d'/><text x='400' y='318' text-anchor='middle' fill='%2312584e' font-family='sans-serif' font-size='18' font-weight='700'>CATÁLOGO OFICIAL ANVISA / SUS</text></svg>";

/**
 * Gera ilustração SVG institucional por categoria regulatória do medicamento
 * quando a API da ANVISA não fornece foto de embalagem (`image_url` ausente).
 */
export function buildMedicationCardIllustration(tag?: string): string {
  const normTag = (tag ?? '').toLowerCase();
  if (normTag.includes('genérico') || normTag.includes('generico')) {
    return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450' viewBox='0 0 800 450'><rect width='800' height='450' fill='%23e8f5f1'/><rect y='330' width='800' height='72' fill='%23f4c430'/><circle cx='400' cy='190' r='68' fill='%23ffffff'/><text x='400' y='216' text-anchor='middle' fill='%23087e70' font-family='sans-serif' font-size='76' font-weight='800'>G</text><text x='400' y='374' text-anchor='middle' fill='%23123e3a' font-family='sans-serif' font-size='22' font-weight='800'>MEDICAMENTO GENÉRICO — ANVISA</text></svg>";
  }
  if (normTag.includes('fitoterápico') || normTag.includes('fitoterapico')) {
    return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450' viewBox='0 0 800 450'><rect width='800' height='450' fill='%23e4f4ea'/><circle cx='400' cy='210' r='66' fill='%23ffffff'/><path d='M375 235 C375 185 425 170 435 170 C435 215 415 240 375 235 Z' fill='%23168a5c'/><text x='400' y='324' text-anchor='middle' fill='%2314593d' font-family='sans-serif' font-size='19' font-weight='700'>FITOTERÁPICO REGISTRADO — ANVISA</text></svg>";
  }
  return FALLBACK_CARD_IMAGE;
}
