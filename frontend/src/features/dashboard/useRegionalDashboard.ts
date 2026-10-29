import { useQuery } from '@tanstack/react-query';
import { getRegionalDashboard } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';

export function useRegionalDashboard(uf?: string, cityIbge?: string) {
  const params = { uf, city_ibge: cityIbge };
  return useQuery({
    queryKey: queryKeys.regionalDashboard(params),
    queryFn: ({ signal }) => getRegionalDashboard(params, signal),
    staleTime: 5 * 60_000,
  });
}
