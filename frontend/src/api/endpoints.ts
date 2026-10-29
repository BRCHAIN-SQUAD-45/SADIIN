import { apiGet } from './client';
import {
  AttendanceHistorySchema,
  CategoriesSchema,
  CityListSchema,
  ConditionDetailSchema,
  ConditionPageSchema,
  HealthSchema,
  MedicationDetailSchema,
  MedicationPageSchema,
  NewsPayloadSchema,
  PortalMetaSchema,
  RegionalDashboardSchema,
  SearchResponseSchema,
  SourceListSchema,
  StateListSchema,
  UnitDetailSchema,
  UnitMetricsSchema,
  UnitPageSchema,
  UnitServiceListSchema,
  UnitStaffSchema,
  UnitSummaryListSchema,
} from './schemas';
import type { SearchType } from './types';

/**
 * Uma função por endpoint do contrato (docs/API_CONTRACT.md).
 * Somente os hooks de `features/` chamam estas funções — componentes nunca.
 */

export const getMeta = (signal?: AbortSignal) =>
  apiGet('GET /meta', '/meta', PortalMetaSchema, { signal });

export const getHealth = (signal?: AbortSignal) =>
  apiGet('GET /health', '/health', HealthSchema, { signal, retries: 0 });

export interface SearchQuery {
  q: string;
  type?: SearchType;
  uf?: string;
  city_ibge?: string;
}

export const getSearch = (params: SearchQuery, signal?: AbortSignal) =>
  apiGet('GET /search', '/search', SearchResponseSchema, {
    params: { ...params, type: params.type ?? 'all' },
    signal,
  });

export interface DirectoryQuery {
  q?: string;
  category?: string;
  page?: number;
  page_size?: number;
}

export const getMedications = (params: DirectoryQuery = {}, signal?: AbortSignal) =>
  apiGet('GET /medications', '/medications', MedicationPageSchema, {
    params: { ...params },
    signal,
  });

export const getMedicationCategories = (signal?: AbortSignal) =>
  apiGet('GET /medications/categories', '/medications/categories', CategoriesSchema, { signal });

export const getMedicationById = (id: string, signal?: AbortSignal) =>
  apiGet(
    `GET /medications/${id}`,
    `/medications/${encodeURIComponent(id)}`,
    MedicationDetailSchema,
    {
      signal,
    },
  );

export const getConditions = (params: DirectoryQuery = {}, signal?: AbortSignal) =>
  apiGet('GET /conditions', '/conditions', ConditionPageSchema, { params: { ...params }, signal });

export const getConditionCategories = (signal?: AbortSignal) =>
  apiGet('GET /conditions/categories', '/conditions/categories', CategoriesSchema, { signal });

export const getConditionById = (id: string, signal?: AbortSignal) =>
  apiGet(`GET /conditions/${id}`, `/conditions/${encodeURIComponent(id)}`, ConditionDetailSchema, {
    signal,
  });

export interface NearbyQuery {
  lat: number;
  lng: number;
  radius_km?: number;
}

export const getNearbyUnits = (params: NearbyQuery, signal?: AbortSignal) =>
  apiGet('GET /ubs/nearby', '/ubs/nearby', UnitSummaryListSchema, {
    params: { radius_km: 10, ...params },
    signal,
  });

export interface UnitsQuery {
  q?: string;
  city_ibge?: string;
  page?: number;
  page_size?: number;
}

export const getUnits = (params: UnitsQuery = {}, signal?: AbortSignal) =>
  apiGet('GET /ubs', '/ubs', UnitPageSchema, { params: { ...params }, signal });

export const getUnitByCnes = (cnes: string, signal?: AbortSignal) =>
  apiGet(`GET /ubs/${cnes}`, `/ubs/${encodeURIComponent(cnes)}`, UnitDetailSchema, { signal });

export const getUnitMetrics = (cnes: string, signal?: AbortSignal) =>
  apiGet(
    `GET /ubs/${cnes}/metrics`,
    `/ubs/${encodeURIComponent(cnes)}/metrics`,
    UnitMetricsSchema,
    { signal },
  );

export const getUnitAttendanceHistory = (cnes: string, days = 7, signal?: AbortSignal) =>
  apiGet(
    `GET /ubs/${cnes}/attendance-history`,
    `/ubs/${encodeURIComponent(cnes)}/attendance-history`,
    AttendanceHistorySchema,
    { params: { days }, signal },
  );

export const getUnitServices = (cnes: string, category?: string, signal?: AbortSignal) =>
  apiGet(
    `GET /ubs/${cnes}/services`,
    `/ubs/${encodeURIComponent(cnes)}/services`,
    UnitServiceListSchema,
    { params: { category }, signal },
  );

export const getUnitStaff = (cnes: string, signal?: AbortSignal) =>
  apiGet(`GET /ubs/${cnes}/staff`, `/ubs/${encodeURIComponent(cnes)}/staff`, UnitStaffSchema, {
    signal,
  });

export const getStates = (signal?: AbortSignal) =>
  apiGet('GET /locations/states', '/locations/states', StateListSchema, { signal });

export const getCitiesByState = (uf: string, signal?: AbortSignal) =>
  apiGet(
    `GET /locations/states/${uf}/cities`,
    `/locations/states/${encodeURIComponent(uf)}/cities`,
    CityListSchema,
    { signal },
  );

export interface RegionalQuery {
  uf?: string;
  city_ibge?: string;
}

export const getRegionalDashboard = (params: RegionalQuery = {}, signal?: AbortSignal) =>
  apiGet('GET /dashboard/regional', '/dashboard/regional', RegionalDashboardSchema, {
    params: { ...params },
    signal,
  });

export interface NewsQuery {
  uf?: string;
  city_ibge?: string;
  limit?: number;
}

export const getNews = (params: NewsQuery = {}, signal?: AbortSignal) =>
  apiGet('GET /news', '/news', NewsPayloadSchema, { params: { ...params }, signal });

export const getSources = (signal?: AbortSignal) =>
  apiGet('GET /sources', '/sources', SourceListSchema, { signal });
