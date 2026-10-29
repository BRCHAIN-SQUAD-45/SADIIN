import type { z } from 'zod';
import type {
  ApiErrorBodySchema,
  AttendanceHistorySchema,
  CategorySchema,
  CityItemSchema,
  ConditionDetailSchema,
  ConditionSchema,
  HealthSchema,
  MedicationDetailSchema,
  MedicationSchema,
  NewsItemSchema,
  NewsPayloadSchema,
  PortalMetaSchema,
  ProvenanceMetaSchema,
  RegionalDashboardSchema,
  SearchFallbackSchema,
  SearchResponseSchema,
  SourceItemSchema,
  StateItemSchema,
  UnitDetailSchema,
  UnitMetricsSchema,
  UnitServiceSchema,
  UnitStaffSchema,
  UnitSummarySchema,
} from './schemas';

/** Tipos inferidos dos schemas Zod — nunca declare tipos de API “à mão”. */
export type ProvenanceMeta = z.infer<typeof ProvenanceMetaSchema>;
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;
export type PortalMeta = z.infer<typeof PortalMetaSchema>;
export type Health = z.infer<typeof HealthSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Medication = z.infer<typeof MedicationSchema>;
export type MedicationDetail = z.infer<typeof MedicationDetailSchema>;
export type Condition = z.infer<typeof ConditionSchema>;
export type ConditionDetail = z.infer<typeof ConditionDetailSchema>;
export type UnitSummary = z.infer<typeof UnitSummarySchema>;
export type UnitDetail = z.infer<typeof UnitDetailSchema>;
export type UnitMetrics = z.infer<typeof UnitMetricsSchema>;
export type AttendanceHistory = z.infer<typeof AttendanceHistorySchema>;
export type UnitService = z.infer<typeof UnitServiceSchema>;
export type UnitStaff = z.infer<typeof UnitStaffSchema>;
export type SearchFallback = z.infer<typeof SearchFallbackSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
export type StateItem = z.infer<typeof StateItemSchema>;
export type CityItem = z.infer<typeof CityItemSchema>;
export type RegionalDashboard = z.infer<typeof RegionalDashboardSchema>;
export type NewsItem = z.infer<typeof NewsItemSchema>;
export type NewsPayload = z.infer<typeof NewsPayloadSchema>;
export type SourceItem = z.infer<typeof SourceItemSchema>;

export type SearchType = 'all' | 'medications' | 'conditions' | 'units';

export type Page<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  meta?: ProvenanceMeta;
};
