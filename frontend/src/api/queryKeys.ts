import type {
  DirectoryQuery,
  NearbyQuery,
  NewsQuery,
  RegionalQuery,
  SearchQuery,
  UnitsQuery,
} from './endpoints';

/**
 * Query keys padronizadas do TanStack Query.
 * Convenção: [domínio, ...identificadores, {filtros}].
 */
export const queryKeys = {
  meta: ['meta'] as const,
  health: ['health'] as const,
  search: (params: SearchQuery) => ['search', params] as const,
  medications: (params: DirectoryQuery) => ['medications', params] as const,
  medicationCategories: ['medications', 'categories'] as const,
  medicationDetail: (id: string) => ['medications', 'detail', id] as const,
  conditions: (params: DirectoryQuery) => ['conditions', params] as const,
  conditionCategories: ['conditions', 'categories'] as const,
  conditionDetail: (id: string) => ['conditions', 'detail', id] as const,
  nearbyUnits: (params: NearbyQuery) => ['ubs', 'nearby', params] as const,
  units: (params: UnitsQuery) => ['ubs', 'list', params] as const,
  unitDetail: (cnes: string) => ['ubs', 'detail', cnes] as const,
  unitMetrics: (cnes: string) => ['ubs', 'metrics', cnes] as const,
  unitAttendance: (cnes: string, days: number) => ['ubs', 'attendance', cnes, days] as const,
  unitServices: (cnes: string, category?: string) =>
    ['ubs', 'services', cnes, { category: category ?? '' }] as const,
  unitStaff: (cnes: string) => ['ubs', 'staff', cnes] as const,
  states: ['locations', 'states'] as const,
  cities: (uf: string) => ['locations', 'cities', uf] as const,
  regionalDashboard: (params: RegionalQuery) => ['dashboard', 'regional', params] as const,
  news: (params: NewsQuery) => ['news', params] as const,
  sources: ['sources'] as const,
};
