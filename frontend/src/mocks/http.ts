import { delay, HttpResponse, type DefaultBodyType, type HttpResponseResolver } from 'msw';
import { scenariosFor, type Scenario } from './scenario';

/** Padrão de rota que casa com qualquer origem: `*\/api/v1/<path>`. */
export const api = (path: string) => `*/api/v1${path}`;

const isTest = import.meta.env.MODE === 'test';

let seq = 0;
const nextRequestId = () => `mock-${Date.now().toString(36)}-${(++seq).toString(36)}`;

export function errorResponse(
  status: number,
  code: string,
  message: string,
  init?: { headers?: Record<string, string>; details?: unknown },
) {
  const requestId = nextRequestId();
  return HttpResponse.json(
    { error: { code, message, details: init?.details, request_id: requestId } },
    { status, headers: { 'x-request-id': requestId, ...init?.headers } },
  );
}

export function okJson<T extends DefaultBodyType>(body: T) {
  return HttpResponse.json(body, { headers: { 'x-request-id': nextRequestId() } });
}

export interface MockContext {
  scenarios: Set<Scenario>;
}

/**
 * Envolve um resolver aplicando latência simulada (200–800 ms; 0 nos testes)
 * e os cenários globais de falha (503, 500, 429, timeout, resposta inválida).
 */
export function withScenario(
  resolver: (
    info: Parameters<HttpResponseResolver>[0],
    ctx: MockContext,
  ) => Response | Promise<Response>,
): HttpResponseResolver {
  return async (info) => {
    const scenarios = scenariosFor(info.request);
    if (!isTest) await delay(200 + Math.round(Math.random() * 600));

    if (scenarios.has('timeout')) {
      await delay('infinite');
    }
    if (scenarios.has('error503')) {
      return errorResponse(
        503,
        'UPSTREAM_UNAVAILABLE',
        'Fonte de dados do SUS temporariamente indisponível. Tente novamente em instantes.',
      );
    }
    if (scenarios.has('error500')) {
      return errorResponse(500, 'INTERNAL', 'Erro interno simulado.');
    }
    if (scenarios.has('ratelimit')) {
      return errorResponse(429, 'RATE_LIMITED', 'Limite de requisições atingido.', {
        headers: { 'retry-after': '5' },
      });
    }
    if (scenarios.has('invalid')) {
      return okJson({ unexpected: true, note: 'resposta propositalmente fora do contrato' });
    }
    return resolver(info, { scenarios });
  };
}
