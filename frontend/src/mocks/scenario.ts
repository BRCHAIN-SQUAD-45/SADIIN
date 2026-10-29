/**
 * Cenários de simulação do MSW, ativáveis por query string na página:
 *   ?mock=error503   → todas as rotas respondem 503 UPSTREAM_UNAVAILABLE
 *   ?mock=error500   → 500 INTERNAL
 *   ?mock=ratelimit  → 429 com Retry-After
 *   ?mock=timeout    → resposta nunca chega a tempo (estoura o timeout do cliente)
 *   ?mock=invalid    → resposta fora do contrato (testa a validação Zod)
 *   ?mock=empty      → listas vazias            (aplicado pelos handlers de lista — Fase 4)
 *   ?mock=estimate   → meta.is_estimate = true   (Fase 4)
 *   ?mock=stale      → meta.is_stale = true      (Fase 4)
 *   ?mock=fallback   → busca retorna fallback de IA (Fase 4)
 *   ?mock=off        → limpa o cenário
 * Vários cenários podem ser combinados: ?mock=stale,estimate
 * O cenário fica salvo na sessão (sessionStorage) para sobreviver à navegação SPA.
 */

export const SCENARIOS = [
  'error503',
  'error500',
  'ratelimit',
  'timeout',
  'invalid',
  'empty',
  'estimate',
  'stale',
  'fallback',
] as const;

export type Scenario = (typeof SCENARIOS)[number];

const STORAGE_KEY = 'brchain.mockScenario';
/** Header usado pelos testes para forçar cenário por requisição. */
export const SCENARIO_HEADER = 'x-mock-scenario';

const isScenario = (v: string): v is Scenario => (SCENARIOS as readonly string[]).includes(v);

function parseList(raw: string | null | undefined): Scenario[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(isScenario);
}

/** Lê o cenário da URL da página (e persiste) ou da sessão. */
export function readPageScenarios(): Scenario[] {
  if (typeof window === 'undefined') return [];
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('mock');
    if (fromUrl === 'off') {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return [];
    }
    if (fromUrl) {
      const list = parseList(fromUrl);
      window.sessionStorage.setItem(STORAGE_KEY, list.join(','));
      return list;
    }
    return parseList(window.sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

/** Cenários ativos para uma requisição: header (testes) tem prioridade sobre a página. */
export function scenariosFor(request: Request): Set<Scenario> {
  const fromHeader = parseList(request.headers.get(SCENARIO_HEADER));
  return new Set(fromHeader.length ? fromHeader : readPageScenarios());
}
