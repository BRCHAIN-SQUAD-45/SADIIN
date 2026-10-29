import { useQuery } from '@tanstack/react-query';
import { getMeta } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';

/** Metadados do portal (data de atualização, contadores). Muda raramente. */
export function useMeta() {
  return useQuery({
    queryKey: queryKeys.meta,
    queryFn: ({ signal }) => getMeta(signal),
    staleTime: 10 * 60_000,
  });
}
