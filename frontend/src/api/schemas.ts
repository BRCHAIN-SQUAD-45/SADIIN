import { z } from 'zod';

/**
 * Schemas Zod = contrato completo da API (seção 6 / docs/API_CONTRACT.md).
 * Toda resposta passa por `schema.safeParse` em `api/client.ts`.
 */

/** Data/hora ISO-8601 (UTC "Z" ou com offset). */
export const IsoDateTime = z.string().datetime({ offset: true });

/** Metadados de proveniência que acompanham as respostas de dados. */
export const ProvenanceMetaSchema = z.object({
  source: z.string().min(1),
  fetched_at: IsoDateTime,
  is_estimate: z.boolean(),
  is_stale: z.boolean(),
});

/** Envelope de paginação `Page<T>`. */
export const pageSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    page_size: z.number().int().min(1),
    total: z.number().int().min(0),
    meta: ProvenanceMetaSchema.optional(),
  });

/** Corpo de erro padronizado `ApiError`. */
export const ApiErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    request_id: z.string().optional(),
  }),
});

/** GET /meta — barra gov + cards do hero. */
export const PortalMetaSchema = z.object({
  data_updated_at: IsoDateTime,
  establishments_count: z.number().int().min(0),
  sources_count: z.number().int().min(0),
});

/** GET /health — liveness. */
export const HealthSchema = z.object({
  status: z.string(),
});

/** Categoria de medicamento ou de doença. */
export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

export const CategoriesSchema = z.array(CategorySchema);

/** Medicamento (listagem). */
export const MedicationSchema = z.object({
  id: z.string(),
  name: z.string(),
  subtitle: z.string(),
  tag: z.string(),
  category_id: z.string(),
  requires_prescription: z.boolean(),
  adult_use: z.boolean(),
  image_url: z.string().optional(),
  image_alt: z.string().optional(),
  leaflet_url: z.string().optional(),
});

/** Medicamento (detalhe). */
export const MedicationDetailSchema = MedicationSchema.extend({
  indications: z.array(z.string()).default([]),
  contraindications: z.array(z.string()).optional(),
  side_effects: z.array(z.string()).optional(),
  meta: ProvenanceMetaSchema.optional(),
});

export const MedicationPageSchema = pageSchema(MedicationSchema);

/** Doença ou condição (listagem). */
export const ConditionSchema = z.object({
  id: z.string(),
  popular_name: z.string(),
  cid10_code: z.string().optional(),
  subtitle: z.string(),
  tag: z.string(),
  category_id: z.string(),
  main_symptoms: z.array(z.string()),
  image_url: z.string().optional(),
  image_alt: z.string().optional(),
});

/** Doença ou condição (detalhe). */
export const ConditionDetailSchema = ConditionSchema.extend({
  prevention: z.array(z.string()).default([]),
  treatment: z.array(z.string()).default([]),
  meta: ProvenanceMetaSchema.optional(),
});

export const ConditionPageSchema = pageSchema(ConditionSchema);

/** Resumo de unidade de saúde (UBS / hospital). */
export const UnitSummarySchema = z.object({
  cnes_code: z.string(),
  name: z.string(),
  address: z.string(),
  city: z.string(),
  uf: z.string().length(2),
  lat: z.number(),
  lng: z.number(),
  phone: z.string().optional(),
  distance_m: z.number().nonnegative().optional(),
  is_open: z.boolean(),
  closes_at: z.string().optional(),
  kind: z.enum(['ubs', 'hospital', 'other']),
});

export const UnitSummaryListSchema = z.array(UnitSummarySchema);
export const UnitPageSchema = pageSchema(UnitSummarySchema);

/** Detalhe da UBS (`GET /ubs/{cnes}`). */
export const UnitDetailSchema = UnitSummarySchema.extend({
  opening_hours: z.object({
    open: z.string(),
    close: z.string(),
  }),
  today_label: z.string(),
  data_updated_at: IsoDateTime,
  source_label: z.string(),
});

/** KPIs de movimento da UBS (`GET /ubs/{cnes}/metrics`). */
export const UnitMetricsSchema = z.object({
  attendances_month: z.number().int().nonnegative(),
  attendances_delta_pct: z.number(),
  avg_wait_minutes: z.number().nonnegative(),
  movement_level: z.enum(['baixo', 'moderado', 'alto']),
  capacity_pct: z.number().min(0).max(100),
  best_time_hint: z.string(),
  registered_coverage: z.number().int().nonnegative(),
  meta: ProvenanceMetaSchema,
});

/** Histórico de atendimentos dos últimos N dias (`GET /ubs/{cnes}/attendance-history`). */
export const AttendanceHistorySchema = z.object({
  days: z.array(
    z.object({
      date: z.string(),
      weekday_label: z.string(),
      attendances: z.number().int().nonnegative(),
    }),
  ),
  total: z.number().int().nonnegative(),
  daily_average: z.number().nonnegative(),
  meta: ProvenanceMetaSchema,
});

/** Serviço oferecido pela UBS (`GET /ubs/{cnes}/services`). */
export const UnitServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  detail: z.string(),
  category: z.enum(['Consultas', 'Prevenção', 'Procedimentos', 'Apoio']),
  icon_key: z.string(),
});

export const UnitServiceListSchema = z.array(UnitServiceSchema);

/** Equipe e estrutura da UBS (`GET /ubs/{cnes}/staff`). */
export const UnitStaffSchema = z.object({
  professionals: z.number().int().nonnegative(),
  rooms: z.number().int().nonnegative(),
  esf_teams: z.number().int().nonnegative(),
  reference_date: z.string(),
  meta: ProvenanceMetaSchema,
});

/** Fallback seguro retornado pela IA na busca. */
export const SearchFallbackSchema = z.object({
  code: z.enum(['LOW_CONFIDENCE', 'SELF_DIAGNOSIS', 'SYMPTOM_ON_MEDICATION_SEARCH']),
  message: z.string(),
});

/** Resposta de `GET /search`. */
export const SearchResponseSchema = z.object({
  query: z.string(),
  matched_term: z.string().optional(),
  intent: z.enum(['medication', 'condition', 'unit', 'unknown']),
  confidence: z.number().min(0).max(1),
  fallback: SearchFallbackSchema.nullable(),
  suggested_categories: z.array(CategorySchema).optional(),
  results: z.object({
    medications: z.array(MedicationSchema),
    conditions: z.array(ConditionSchema),
    units: z.array(UnitSummarySchema),
  }),
  meta: ProvenanceMetaSchema,
});

/** Localidades (`GET /locations/states` e `/locations/states/{uf}/cities`). */
export const StateItemSchema = z.object({
  uf: z.string().length(2),
  name: z.string(),
});

export const StateListSchema = z.array(StateItemSchema);

export const CityItemSchema = z.object({
  ibge_code: z.string(),
  name: z.string(),
  uf: z.string().length(2),
  lat: z.number(),
  lng: z.number(),
});

export const CityListSchema = z.array(CityItemSchema);

/** Dashboard regional (`GET /dashboard/regional`). */
export const RegionalDashboardSchema = z.object({
  headline: z.object({
    kicker: z.string(),
    title: z.string(),
    delta_pct: z.number(),
    comparison_label: z.string(),
    series: z.array(z.number()),
    source_label: z.string(),
    updated_label: z.string(),
  }),
  stats: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      value: z.string(),
      trend_pct: z.number().optional(),
      caption: z.string(),
      tone: z.enum(['blue', 'green', 'amber']),
    }),
  ),
  meta: ProvenanceMetaSchema,
});

/** Notícias regionais (`GET /news`). */
export const NewsItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  title: z.string(),
  summary: z.string().optional(),
  image_url: z.string().optional(),
  published_at: IsoDateTime,
  source_label: z.string(),
  url: z.string().optional(),
});

export const NewsPayloadSchema = z.object({
  featured: NewsItemSchema.nullable(),
  items: z.array(NewsItemSchema),
});

/** Fontes oficiais (`GET /sources`). */
export const SourceItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  subtitle: z.string(),
});

export const SourceListSchema = z.array(SourceItemSchema);
