import { useQuery } from '@tanstack/react-query';
import { getNews } from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';

export function useNews(uf?: string, cityIbge?: string) {
  const params = { uf, city_ibge: cityIbge, limit: 4 };
  return useQuery({
    queryKey: queryKeys.news(params),
    queryFn: ({ signal }) => getNews(params, signal),
    staleTime: 5 * 60_000,
  });
}
