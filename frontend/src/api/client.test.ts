import { describe, expect, it, vi } from 'vitest';
import { delay, http, HttpResponse } from 'msw';
import { z } from 'zod';
import { server } from '../mocks/server';
import { api } from '../mocks/http';
import { SCENARIO_HEADER } from '../mocks/scenario';
import { ApiError, apiGet, buildUrl, codeFromStatus, parseRetryAfter } from './client';
import { getMeta } from './endpoints';
import { metaFixture } from '../mocks/fixtures/meta';

const Schema = z.object({ ok: z.boolean() });

describe('buildUrl', () => {
  it('monta URL absoluta e ignora parâmetros vazios', () => {
    const url = buildUrl('/search', { q: 'dengue', type: 'all', uf: '', city_ibge: undefined });
    expect(url.pathname).toBe('/api/v1/search');
    expect(url.searchParams.get('q')).toBe('dengue');
    expect(url.searchParams.has('uf')).toBe(false);
    expect(url.searchParams.has('city_ibge')).toBe(false);
  });
});

describe('codeFromStatus / parseRetryAfter', () => {
  it.each([
    [422, 'VALIDATION_ERROR'],
    [404, 'NOT_FOUND'],
    [429, 'RATE_LIMITED'],
    [503, 'UPSTREAM_UNAVAILABLE'],
    [504, 'TIMEOUT'],
    [500, 'INTERNAL'],
    [418, 'HTTP_ERROR'],
  ])('%i → %s', (status, code) => expect(codeFromStatus(status)).toBe(code));

  it('Retry-After em segundos e em data HTTP', () => {
    expect(parseRetryAfter('5')).toBe(5000);
    const now = Date.parse('2025-05-28T12:00:00Z');
    expect(parseRetryAfter('Wed, 28 May 2025 12:00:10 GMT', now)).toBe(10000);
    expect(parseRetryAfter(null)).toBeUndefined();
  });
});

describe('apiGet', () => {
  it('valida a resposta com o schema do contrato', async () => {
    await expect(getMeta()).resolves.toEqual(metaFixture);
  });

  it('envia Accept-Language pt-BR', async () => {
    let lang: string | null = null;
    server.use(
      http.get(api('/probe'), ({ request }) => {
        lang = request.headers.get('accept-language');
        return HttpResponse.json({ ok: true });
      }),
    );
    await apiGet('GET /probe', '/probe', Schema);
    expect(lang).toBe('pt-BR');
  });

  it('faz retry com backoff em 503 e recupera', async () => {
    let calls = 0;
    server.use(
      http.get(api('/probe'), () => {
        calls++;
        return calls < 3
          ? HttpResponse.json(
              { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'x' } },
              { status: 503 },
            )
          : HttpResponse.json({ ok: true });
      }),
    );
    await expect(apiGet('GET /probe', '/probe', Schema, { backoffMs: 1 })).resolves.toEqual({
      ok: true,
    });
    expect(calls).toBe(3);
  });

  it('desiste após 2 retries e devolve ApiError com a mensagem do back e request_id', async () => {
    let calls = 0;
    server.use(
      http.get(api('/probe'), () => {
        calls++;
        return HttpResponse.json(
          {
            error: { code: 'UPSTREAM_UNAVAILABLE', message: 'CNES fora do ar', request_id: 'r-1' },
          },
          { status: 503 },
        );
      }),
    );
    const err = await apiGet('GET /probe', '/probe', Schema, { backoffMs: 1 }).catch((e) => e);
    expect(calls).toBe(3);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
      status: 503,
      message: 'CNES fora do ar',
      requestId: 'r-1',
      endpoint: 'GET /probe',
    });
  });

  it('não faz retry em 404/422', async () => {
    let calls = 0;
    server.use(
      http.get(api('/probe'), () => {
        calls++;
        return HttpResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'q muito curto' } },
          { status: 422 },
        );
      }),
    );
    const err = await apiGet('GET /probe', '/probe', Schema).catch((e) => e);
    expect(calls).toBe(1);
    expect(err).toMatchObject({ code: 'VALIDATION_ERROR', message: 'q muito curto' });
  });

  it('expõe Retry-After em 429', async () => {
    server.use(
      http.get(api('/meta'), () =>
        HttpResponse.json(
          { error: { code: 'RATE_LIMITED', message: 'calma' } },
          { status: 429, headers: { 'retry-after': '3' } },
        ),
      ),
    );
    await expect(getMeta()).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterMs: 3000 });
  });

  it('converte timeout do cliente em TIMEOUT', async () => {
    server.use(
      http.get(api('/probe'), async () => {
        await delay(500);
        return HttpResponse.json({ ok: true });
      }),
    );
    await expect(apiGet('GET /probe', '/probe', Schema, { timeoutMs: 30 })).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
  });

  it('converte falha de rede em NETWORK_ERROR', async () => {
    server.use(http.get(api('/probe'), () => HttpResponse.error()));
    await expect(apiGet('GET /probe', '/probe', Schema)).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });

  it('respeita cancelamento pelo chamador (ABORTED)', async () => {
    server.use(
      http.get(api('/probe'), async () => {
        await delay(500);
        return HttpResponse.json({ ok: true });
      }),
    );
    const controller = new AbortController();
    const p = apiGet('GET /probe', '/probe', Schema, { signal: controller.signal });
    controller.abort();
    await expect(p).rejects.toMatchObject({ code: 'ABORTED' });
  });

  it('resposta fora do contrato vira CONTRACT_MISMATCH e é logada com o endpoint', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(
      http.get(api('/meta'), () =>
        HttpResponse.json({ data_updated_at: 'ontem', establishments_count: -1 }),
      ),
    );
    await expect(getMeta()).rejects.toMatchObject({ code: 'CONTRACT_MISMATCH' });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('GET /meta'),
      expect.objectContaining({ issues: expect.any(Array) }),
    );
    spy.mockRestore();
  });
});

describe('cenários do MSW (header de teste)', () => {
  it('error503 responde no formato ApiError do contrato', async () => {
    const res = await fetch(`${location.origin}/api/v1/meta`, {
      headers: { [SCENARIO_HEADER]: 'error503' },
    });
    expect(res.status).toBe(503);
    expect(res.headers.get('x-request-id')).toMatch(/^mock-/);
    const body = await res.json();
    expect(body.error.code).toBe('UPSTREAM_UNAVAILABLE');
  });
});
