import { useQuery } from '@tanstack/react-query';
import { getSearch } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';
import type { SearchType } from '../../api/types';

export function useGlobalSearch(params: {
  q: string;
  type: SearchType;
  uf?: string;
  cityIbge?: string;
  enabled?: boolean;
}) {
  const trimmed = params.q.trim();
  const query = {
    q: trimmed,
    type: params.type,
    uf: params.uf,
    city_ibge: params.cityIbge,
  };
  return useQuery({
    queryKey: queryKeys.search(query),
    queryFn: ({ signal }) => getSearch(query, signal),
    enabled: (params.enabled ?? true) && trimmed.length >= 2,
    staleTime: 60_000,
  });
}
