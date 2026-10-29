import { useQuery } from '@tanstack/react-query';
import { getSources } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';

export function useSources() {
  return useQuery({
    queryKey: queryKeys.sources,
    queryFn: ({ signal }) => getSources(signal),
    staleTime: 60 * 60_000,
  });
}
