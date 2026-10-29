import { z } from 'zod';

/**
 * Leitura e validação das variáveis `VITE_*`.
 * Falha cedo (na inicialização) e com mensagem clara caso algo esteja inválido.
 * Nenhum segredo deve ser colocado aqui: tudo que é `VITE_*` vai para o bundle público.
 */

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const EnvSchema = z.object({
  VITE_DATA_MODE: z.preprocess(emptyToUndefined, z.enum(['mock', 'api']).default('mock')),
  VITE_API_URL: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .regex(
        /^https?:\/\/[^\s]+$/,
        'deve ser uma URL http(s) — ou ficar vazia para usar a mesma origem',
      )
      .transform((v) => v.replace(/\/+$/, ''))
      .optional(),
  ),
  VITE_REQUEST_TIMEOUT_MS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1000).max(60000).default(8000),
  ),
  VITE_MAP_TILE_URL: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .includes('{z}', { message: 'deve conter os marcadores {z}/{x}/{y}' })
      .default('https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
  ),
  VITE_MAP_ATTRIBUTION: z.preprocess(
    emptyToUndefined,
    z.string().default('© OpenStreetMap contributors'),
  ),
  VITE_DEFAULT_CITY_IBGE: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{7}$/, 'deve ser um código IBGE de 7 dígitos')
      .default('3550308'),
  ),
});

export type Env = z.infer<typeof EnvSchema> & {
  /** Base efetiva das rotas da API, já com `/api/v1`. */
  apiBaseUrl: string;
  isMock: boolean;
};

export class EnvError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Configuração inválida:\n${issues.map((i) => `• ${i}`).join('\n')}`);
    this.name = 'EnvError';
  }
}

/** Função pura (testável): valida um objeto de variáveis. */
export function parseEnv(raw: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    throw new EnvError(result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }
  const data = result.data;
  const isMock = data.VITE_DATA_MODE === 'mock';
  // Em mock, sempre mesma origem: o MSW intercepta `/api/v1/*` no próprio navegador.
  const origin = isMock ? '' : (data.VITE_API_URL ?? '');
  return { ...data, isMock, apiBaseUrl: `${origin}/api/v1` };
}

let cached: Env | undefined;

/** Variáveis validadas da aplicação (memoizadas). Lança `EnvError` se inválidas. */
export function getEnv(): Env {
  cached ??= parseEnv(import.meta.env as unknown as Record<string, unknown>);
  return cached;
}
