import type { ZodType, ZodTypeDef } from 'zod';
import { getEnv } from '../config/env';
import { ApiErrorBodySchema } from './schemas';

/**
 * Cliente HTTP único do portal.
 * - baseURL de `VITE_API_URL` (+ `/api/v1`); em mock, mesma origem (MSW).
 * - timeout por requisição (`VITE_REQUEST_TIMEOUT_MS`) via AbortController.
 * - header `Accept-Language: pt-BR`; lê `x-request-id`.
 * - converte qualquer falha em `ApiError`.
 * - retry apenas em GET idempotente, máx. 2, com backoff, para 502/503/504.
 * - valida a resposta com Zod; divergência de contrato vira `CONTRACT_MISMATCH`.
 */

export type ApiErrorCode =
  | 'VALIDATION_ERROR' // 422
  | 'NOT_FOUND' // 404
  | 'RATE_LIMITED' // 429
  | 'UPSTREAM_UNAVAILABLE' // 503
  | 'TIMEOUT' // 504 ou timeout no cliente
  | 'INTERNAL' // 500 e demais 5xx
  | 'HTTP_ERROR' // outros 4xx
  | 'NETWORK_ERROR' // sem conexão / CORS / DNS
  | 'CONTRACT_MISMATCH' // resposta fora do contrato (Zod)
  | 'ABORTED'; // cancelada pelo chamador

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;
  readonly endpoint: string;
  readonly requestId?: string;
  readonly details?: unknown;
  /** Para 429: quanto esperar antes de tentar de novo (de `Retry-After`). */
  readonly retryAfterMs?: number;

  constructor(init: {
    code: ApiErrorCode;
    message: string;
    endpoint: string;
    status?: number;
    requestId?: string;
    details?: unknown;
    retryAfterMs?: number;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.code = init.code;
    this.status = init.status;
    this.endpoint = init.endpoint;
    this.requestId = init.requestId;
    this.details = init.details;
    this.retryAfterMs = init.retryAfterMs;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export interface GetOptions {
  params?: QueryParams;
  signal?: AbortSignal;
  /** Sobrescreve `VITE_REQUEST_TIMEOUT_MS`. */
  timeoutMs?: number;
  /** Máximo de novas tentativas para 502/503/504 (padrão 2). */
  retries?: number;
  /** Base do backoff exponencial em ms (padrão 400). */
  backoffMs?: number;
}

const RETRYABLE_STATUS = new Set([502, 503, 504]);

const DEFAULT_MESSAGES: Record<ApiErrorCode, string> = {
  VALIDATION_ERROR: 'Verifique os dados informados e tente novamente.',
  NOT_FOUND: 'Não encontramos o que você procurou.',
  RATE_LIMITED: 'Muitas consultas em pouco tempo. Aguarde um instante e tente novamente.',
  UPSTREAM_UNAVAILABLE: 'Serviço temporariamente indisponível. Tente novamente em instantes.',
  TIMEOUT: 'A consulta demorou mais que o esperado. Tente novamente.',
  INTERNAL: 'Ocorreu um erro inesperado. Tente novamente mais tarde.',
  HTTP_ERROR: 'Não foi possível concluir a consulta.',
  NETWORK_ERROR: 'Não foi possível conectar ao serviço. Verifique sua conexão.',
  CONTRACT_MISMATCH: 'Recebemos dados em um formato inesperado. Tente novamente mais tarde.',
  ABORTED: 'Consulta cancelada.',
};

export function codeFromStatus(status: number): ApiErrorCode {
  if (status === 422 || status === 400) return 'VALIDATION_ERROR';
  if (status === 404) return 'NOT_FOUND';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503) return 'UPSTREAM_UNAVAILABLE';
  if (status === 504) return 'TIMEOUT';
  if (status >= 500) return 'INTERNAL';
  return 'HTTP_ERROR';
}

/** `Retry-After` pode ser segundos ou uma data HTTP. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

export function buildUrl(path: string, params?: QueryParams): URL {
  const { apiBaseUrl } = getEnv();
  const base = /^https?:\/\//.test(apiBaseUrl)
    ? apiBaseUrl
    : `${globalThis.location?.origin ?? 'http://localhost'}${apiBaseUrl}`;
  const url = new URL(`${base}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

async function requestOnce<T>(
  endpoint: string,
  url: URL,
  schema: ZodType<T, ZodTypeDef, unknown>,
  timeoutMs: number,
  outerSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  if (outerSignal?.aborted) controller.abort();
  outerSignal?.addEventListener('abort', forwardAbort, { once: true });

  try {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', 'Accept-Language': 'pt-BR' },
        signal: controller.signal,
      });
    } catch {
      if (timedOut) {
        throw new ApiError({ code: 'TIMEOUT', message: DEFAULT_MESSAGES.TIMEOUT, endpoint });
      }
      if (outerSignal?.aborted) {
        throw new ApiError({ code: 'ABORTED', message: DEFAULT_MESSAGES.ABORTED, endpoint });
      }
      throw new ApiError({
        code: 'NETWORK_ERROR',
        message: DEFAULT_MESSAGES.NETWORK_ERROR,
        endpoint,
      });
    }

    const requestId = res.headers.get('x-request-id') ?? undefined;

    if (!res.ok) {
      const code = codeFromStatus(res.status);
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = undefined;
      }
      const parsed = ApiErrorBodySchema.safeParse(body);
      throw new ApiError({
        code,
        status: res.status,
        endpoint,
        message: parsed.success ? parsed.data.error.message : DEFAULT_MESSAGES[code],
        details: parsed.success ? parsed.data.error.details : undefined,
        requestId: (parsed.success && parsed.data.error.request_id) || requestId,
        retryAfterMs: parseRetryAfter(res.headers.get('retry-after')),
      });
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new ApiError({
        code: 'CONTRACT_MISMATCH',
        status: res.status,
        endpoint,
        requestId,
        message: DEFAULT_MESSAGES.CONTRACT_MISMATCH,
        details: 'Resposta não é um JSON válido.',
      });
    }

    const result = schema.safeParse(json);
    if (!result.success) {
      console.error(`[contrato] ${endpoint} divergente do contrato`, {
        requestId,
        issues: result.error.issues,
      });
      throw new ApiError({
        code: 'CONTRACT_MISMATCH',
        status: res.status,
        endpoint,
        requestId,
        message: DEFAULT_MESSAGES.CONTRACT_MISMATCH,
        details: result.error.issues,
      });
    }
    return result.data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (timedOut)
      throw new ApiError({ code: 'TIMEOUT', message: DEFAULT_MESSAGES.TIMEOUT, endpoint });
    if (outerSignal?.aborted) {
      throw new ApiError({ code: 'ABORTED', message: DEFAULT_MESSAGES.ABORTED, endpoint });
    }
    throw new ApiError({
      code: 'NETWORK_ERROR',
      message: DEFAULT_MESSAGES.NETWORK_ERROR,
      endpoint,
    });
  } finally {
    clearTimeout(timer);
    outerSignal?.removeEventListener('abort', forwardAbort);
  }
}

/**
 * GET validado pelo schema do contrato.
 * @param endpoint rótulo usado em logs/erros, ex.: `"GET /meta"`.
 */
export async function apiGet<T>(
  endpoint: string,
  path: string,
  schema: ZodType<T, ZodTypeDef, unknown>,
  options: GetOptions = {},
): Promise<T> {
  const {
    params,
    signal,
    timeoutMs = getEnv().VITE_REQUEST_TIMEOUT_MS,
    retries = 2,
    backoffMs = 400,
  } = options;
  const url = buildUrl(path, params);

  for (let attempt = 0; ; attempt++) {
    try {
      return await requestOnce(endpoint, url, schema, timeoutMs, signal);
    } catch (err) {
      const retryable =
        err instanceof ApiError &&
        err.status !== undefined &&
        RETRYABLE_STATUS.has(err.status) &&
        attempt < retries;
      if (!retryable) throw err;
      const jitter = Math.random() * backoffMs * 0.25;
      try {
        await sleep(backoffMs * 2 ** attempt + jitter, signal);
      } catch {
        throw new ApiError({ code: 'ABORTED', message: DEFAULT_MESSAGES.ABORTED, endpoint });
      }
    }
  }
}

/** Mensagem amigável padrão para um código (usada pela UI quando o back não manda texto). */
export const defaultErrorMessage = (code: ApiErrorCode) => DEFAULT_MESSAGES[code];
