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

/** Imagem SVG local neutra caso uma URL externa falhe (regra 3.1). */
export const FALLBACK_CARD_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450' viewBox='0 0 800 450'><rect width='800' height='450' fill='%23e5efec'/><circle cx='400' cy='225' r='44' fill='%23cfe3dd'/></svg>";
