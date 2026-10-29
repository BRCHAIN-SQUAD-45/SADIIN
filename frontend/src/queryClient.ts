import { QueryClient } from '@tanstack/react-query';
import { isApiError } from './api/client';

/**
 * Política de retry no nível do TanStack Query:
 * - 5xx retentáveis já são tratados no `api/client.ts` (não duplicar);
 * - falha de rede: 1 nova tentativa;
 * - 429: 1 nova tentativa respeitando `Retry-After` (até 10 s);
 * - demais erros (404, 422, contrato…): sem retry.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (!isApiError(error)) return failureCount < 1;
          if (error.code === 'NETWORK_ERROR') return failureCount < 1;
          if (error.code === 'RATE_LIMITED') {
            return failureCount < 1 && (error.retryAfterMs ?? 0) <= 10_000;
          }
          return false;
        },
        retryDelay: (attempt, error) =>
          isApiError(error) && error.retryAfterMs !== undefined
            ? error.retryAfterMs
            : Math.min(1000 * 2 ** attempt, 8000),
      },
    },
  });
}
