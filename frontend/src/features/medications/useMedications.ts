import { useQuery } from '@tanstack/react-query';
import {
  getMedicationById,
  getMedicationCategories,
  getMedications,
  type DirectoryQuery,
} from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';

export function useMedicationCategories() {
  return useQuery({
    queryKey: queryKeys.medicationCategories,
    queryFn: ({ signal }) => getMedicationCategories(signal),
    staleTime: 10 * 60_000,
  });
}

export function useMedications(params: DirectoryQuery) {
  return useQuery({
    queryKey: queryKeys.medications(params),
    queryFn: ({ signal }) => getMedications(params, signal),
  });
}

export function useMedicationDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.medicationDetail(id),
    queryFn: ({ signal }) => getMedicationById(id, signal),
    enabled: Boolean(id),
  });
}
