import { useQuery } from '@tanstack/react-query';
import {
  getUnitAttendanceHistory,
  getUnitByCnes,
  getUnitMetrics,
  getUnits,
  getUnitServices,
  getUnitStaff,
  type UnitsQuery,
} from '../../api/endpoints';
import { queryKeys } from '../../api/queryKeys';

export function useUnitsList(params: UnitsQuery = {}) {
  return useQuery({
    queryKey: queryKeys.units(params),
    queryFn: ({ signal }) => getUnits(params, signal),
    staleTime: 5 * 60_000,
  });
}

export function useUnitDetail(cnes: string) {
  return useQuery({
    queryKey: queryKeys.unitDetail(cnes),
    queryFn: ({ signal }) => getUnitByCnes(cnes, signal),
    enabled: Boolean(cnes),
  });
}

export function useUnitMetrics(cnes: string) {
  return useQuery({
    queryKey: queryKeys.unitMetrics(cnes),
    queryFn: ({ signal }) => getUnitMetrics(cnes, signal),
    enabled: Boolean(cnes),
  });
}

export function useUnitAttendanceHistory(cnes: string, days = 7) {
  return useQuery({
    queryKey: queryKeys.unitAttendance(cnes, days),
    queryFn: ({ signal }) => getUnitAttendanceHistory(cnes, days, signal),
    enabled: Boolean(cnes),
  });
}

export function useUnitServices(cnes: string, category?: string) {
  const catParam = category && category !== 'Todos' ? category : undefined;
  return useQuery({
    queryKey: queryKeys.unitServices(cnes, catParam),
    queryFn: ({ signal }) => getUnitServices(cnes, catParam, signal),
    enabled: Boolean(cnes),
  });
}

export function useUnitStaff(cnes: string) {
  return useQuery({
    queryKey: queryKeys.unitStaff(cnes),
    queryFn: ({ signal }) => getUnitStaff(cnes, signal),
    enabled: Boolean(cnes),
  });
}
