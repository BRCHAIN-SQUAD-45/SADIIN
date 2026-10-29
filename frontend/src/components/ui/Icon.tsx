import type { ReactNode } from 'react';

/**
 * Os 20 ícones SVG exatos do protótipo (docs/prototype/app-extract.js, linhas 9–28).
 */
export const ICON_NAMES = [
  'search',
  'pin',
  'pill',
  'heart',
  'hospital',
  'shield',
  'arrow',
  'menu',
  'accessibility',
  'chevron',
  'trend',
  'people',
  'clock',
  'phone',
  'route',
  'check',
  'database',
  'activity',
  'info',
  'close',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

const PATHS: Record<IconName, ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  pill: (
    <>
      <path d="m10.5 5.5 8 8a4 4 0 0 1-5.7 5.7l-8-8a4 4 0 0 1 5.7-5.7Z" />
      <path d="m8 14 6-6" />
    </>
  ),
  heart: (
    <>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
      <path d="M7 12h3l1-3 2 6 1-3h3" />
    </>
  ),
  hospital: <path d="M4 21h16M6 21V5h12v16M9 9h6M12 6v6M9 16h2M13 16h2" />,
  shield: (
    <>
      <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z" />
      <path d="m9 12 2 2 4-5" />
    </>
  ),
  arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  accessibility: (
    <>
      <circle cx="12" cy="4" r="2" />
      <path d="M5 8h14M12 6v7M8 21l4-8 4 8" />
    </>
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  trend: (
    <>
      <path d="m3 17 6-6 4 4 8-9" />
      <path d="M15 6h6v6" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 6a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4.6V20" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  phone: (
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
  ),
  route: (
    <>
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="5" r="2" />
      <path d="M8 19h3a3 3 0 0 0 3-3v-1a3 3 0 0 0-3-3H9a3 3 0 0 1-3-3V7a2 2 0 0 1 2-2h8" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  database: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" />
    </>
  ),
  activity: <path d="M3 12h4l2-7 4 14 2-7h6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
};

// eslint-disable-next-line react-refresh/only-export-components
export const isIconName = (v: string): v is IconName =>
  (ICON_NAMES as readonly string[]).includes(v);

export function Icon({ name, size = 21 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
