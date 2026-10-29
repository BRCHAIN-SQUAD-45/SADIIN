import { useQuery } from '@tanstack/react-query';
import {
  getConditionById,
  getConditionCategories,
  getConditions,
  type DirectoryQuery,
} from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';

export function useConditionCategories() {
  return useQuery({
    queryKey: queryKeys.conditionCategories,
    queryFn: ({ signal }) => getConditionCategories(signal),
    staleTime: 10 * 60_000,
  });
}

export function useConditions(params: DirectoryQuery) {
  return useQuery({
    queryKey: queryKeys.conditions(params),
    queryFn: ({ signal }) => getConditions(params, signal),
  });
}

export function useConditionDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.conditionDetail(id),
    queryFn: ({ signal }) => getConditionById(id, signal),
    enabled: Boolean(id),
  });
}
