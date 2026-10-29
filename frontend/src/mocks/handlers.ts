import { http } from 'msw';
import { api, errorResponse, okJson, withScenario } from './http';
import {
  buildAttendanceHistoryFixture,
  buildMockMeta,
  buildRegionalDashboardFixture,
  buildUnitMetricsFixture,
  buildUnitStaffFixture,
  citiesByStateFixture,
  conditionCategoriesFixture,
  conditionsFixture,
  evaluateMockSearchFallback,
  medicationCategoriesFixture,
  medicationsFixture,
  metaFixture,
  newsFixture,
  sourcesFixture,
  statesFixture,
  toUnitSummary,
  unitsFixture,
  unitServicesFixture,
} from './fixtures/meta';

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Um handler por endpoint do contrato (seção 6.2), respondendo exatamente no formato dos schemas.
 */
export const handlers = [
  http.get(
    api('/meta'),
    withScenario(() => okJson(metaFixture)),
  ),

  http.get(api('/health'), () => okJson({ status: 'ok' })),

  http.get(
    api('/search'),
    withScenario(({ request }, { scenarios }) => {
      const url = new URL(request.url);
      const q = (url.searchParams.get('q') ?? '').trim();
      const type = url.searchParams.get('type') ?? 'all';
      const meta = buildMockMeta({
        isEstimate: scenarios.has('estimate'),
        isStale: scenarios.has('stale'),
      });

      if (scenarios.has('empty') || !q) {
        return okJson({
          query: q,
          intent: 'unknown' as const,
          confidence: 0,
          fallback: null,
          results: { medications: [], conditions: [], units: [] },
          meta,
        });
      }

      const { matchedTerm, fallback, confidence } = evaluateMockSearchFallback(
        q,
        type,
        scenarios.has('fallback'),
      );

      if (fallback) {
        return okJson({
          query: q,
          matched_term: matchedTerm,
          intent: type === 'medications' ? ('medication' as const) : ('condition' as const),
          confidence,
          fallback,
          suggested_categories:
            fallback.code === 'SYMPTOM_ON_MEDICATION_SEARCH'
              ? medicationCategoriesFixture.slice(0, 2)
              : undefined,
          results: { medications: [], conditions: [], units: [] },
          meta,
        });
      }

      const needle = norm(matchedTerm ?? q);
      const medications =
        type === 'all' || type === 'medications'
          ? medicationsFixture.filter(
              (m) => norm(m.name).includes(needle) || norm(m.subtitle).includes(needle),
            )
          : [];
      const conditions =
        type === 'all' || type === 'conditions'
          ? conditionsFixture.filter(
              (c) =>
                norm(c.popular_name).includes(needle) ||
                norm(c.subtitle).includes(needle) ||
                c.main_symptoms.some((s) => norm(s).includes(needle)),
            )
          : [];
      const units =
        type === 'all' || type === 'units'
          ? unitsFixture
              .filter(
                (u) =>
                  norm(u.name).includes(needle) ||
                  norm(u.address).includes(needle) ||
                  needle.includes('ubs') ||
                  needle.includes('vacina'),
              )
              .map(toUnitSummary)
          : [];

      const totalFound = medications.length + conditions.length + units.length;
      if (totalFound === 0 && q.split(/\s+/).length >= 3) {
        return okJson({
          query: q,
          matched_term: matchedTerm,
          intent: 'condition' as const,
          confidence: 0.55,
          fallback: {
            code: 'LOW_CONFIDENCE' as const,
            message: 'Sintomas complexos. Procure uma unidade de saúde.',
          },
          results: { medications: [], conditions: [], units: [] },
          meta,
        });
      }

      const intent =
        medications.length > 0
          ? ('medication' as const)
          : conditions.length > 0
            ? ('condition' as const)
            : units.length > 0
              ? ('unit' as const)
              : ('unknown' as const);

      return okJson({
        query: q,
        matched_term: matchedTerm,
        intent,
        confidence,
        fallback: null,
        results: { medications, conditions, units },
        meta,
      });
    }),
  ),

  http.get(
    api('/medications/categories'),
    withScenario(() => okJson(medicationCategoriesFixture)),
  ),

  http.get(
    api('/medications'),
    withScenario(({ request }, { scenarios }) => {
      const url = new URL(request.url);
      const q = norm(url.searchParams.get('q') ?? '');
      const category = url.searchParams.get('category') ?? '';
      const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
      const pageSize = Math.max(1, Number(url.searchParams.get('page_size') ?? 20));

      const filtered = scenarios.has('empty')
        ? []
        : medicationsFixture.filter((m) => {
            const byCat = !category || category === 'todos' || m.category_id === category;
            const byText = !q || norm(m.name).includes(q) || norm(m.subtitle).includes(q);
            return byCat && byText;
          });

      return okJson({
        items: filtered.slice((page - 1) * pageSize, page * pageSize),
        page,
        page_size: pageSize,
        total: filtered.length,
        meta: buildMockMeta({
          isEstimate: scenarios.has('estimate'),
          isStale: scenarios.has('stale'),
        }),
      });
    }),
  ),

  http.get(
    api('/medications/:id'),
    withScenario(({ params }) => {
      const item = medicationsFixture.find((m) => m.id === params.id);
      if (!item) return errorResponse(404, 'NOT_FOUND', 'Medicamento não encontrado.');
      return okJson({ ...item, meta: buildMockMeta() });
    }),
  ),

  http.get(
    api('/conditions/categories'),
    withScenario(() => okJson(conditionCategoriesFixture)),
  ),

  http.get(
    api('/conditions'),
    withScenario(({ request }, { scenarios }) => {
      const url = new URL(request.url);
      const q = norm(url.searchParams.get('q') ?? '');
      const category = url.searchParams.get('category') ?? '';
      const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
      const pageSize = Math.max(1, Number(url.searchParams.get('page_size') ?? 20));

      const filtered = scenarios.has('empty')
        ? []
        : conditionsFixture.filter((c) => {
            const byCat = !category || category === 'todos' || c.category_id === category;
            const byText =
              !q ||
              norm(c.popular_name).includes(q) ||
              norm(c.subtitle).includes(q) ||
              (c.cid10_code && norm(c.cid10_code).includes(q));
            return byCat && byText;
          });

      return okJson({
        items: filtered.slice((page - 1) * pageSize, page * pageSize),
        page,
        page_size: pageSize,
        total: filtered.length,
        meta: buildMockMeta({
          isEstimate: scenarios.has('estimate'),
          isStale: scenarios.has('stale'),
        }),
      });
    }),
  ),

  http.get(
    api('/conditions/:id'),
    withScenario(({ params }) => {
      const item = conditionsFixture.find((c) => c.id === params.id);
      if (!item) return errorResponse(404, 'NOT_FOUND', 'Condição de saúde não encontrada.');
      return okJson({ ...item, meta: buildMockMeta() });
    }),
  ),

  http.get(
    api('/ubs/nearby'),
    withScenario((_info, { scenarios }) => {
      if (scenarios.has('empty')) return okJson([]);
      return okJson(unitsFixture.map(toUnitSummary));
    }),
  ),

  http.get(
    api('/ubs'),
    withScenario(({ request }, { scenarios }) => {
      const url = new URL(request.url);
      const q = norm(url.searchParams.get('q') ?? '');
      const items = scenarios.has('empty')
        ? []
        : unitsFixture
            .filter((u) => !q || norm(u.name).includes(q) || norm(u.address).includes(q))
            .map(toUnitSummary);
      return okJson({
        items,
        page: 1,
        page_size: 20,
        total: items.length,
        meta: buildMockMeta({
          isEstimate: scenarios.has('estimate'),
          isStale: scenarios.has('stale'),
        }),
      });
    }),
  ),

  http.get(
    api('/ubs/:cnes'),
    withScenario(({ params }) => {
      const unit = unitsFixture.find((u) => u.cnes_code === params.cnes) ?? unitsFixture[0];
      if (!unit) return errorResponse(404, 'NOT_FOUND', 'Unidade de saúde não encontrada.');
      return okJson(unit);
    }),
  ),

  http.get(
    api('/ubs/:cnes/metrics'),
    withScenario(({ params }, { scenarios }) =>
      okJson(
        buildUnitMetricsFixture(String(params.cnes), {
          isEstimate: scenarios.has('estimate'),
          isStale: scenarios.has('stale'),
        }),
      ),
    ),
  ),

  http.get(
    api('/ubs/:cnes/attendance-history'),
    withScenario((_info, { scenarios }) =>
      okJson(
        buildAttendanceHistoryFixture({
          isEstimate: scenarios.has('estimate'),
          isStale: scenarios.has('stale'),
        }),
      ),
    ),
  ),

  http.get(
    api('/ubs/:cnes/services'),
    withScenario(({ request }, { scenarios }) => {
      if (scenarios.has('empty')) return okJson([]);
      const category = new URL(request.url).searchParams.get('category');
      const items =
        !category || category === 'Todos'
          ? unitServicesFixture
          : unitServicesFixture.filter((s) => s.category === category);
      return okJson(items);
    }),
  ),

  http.get(
    api('/ubs/:cnes/staff'),
    withScenario((_info, { scenarios }) =>
      okJson(
        buildUnitStaffFixture({
          isEstimate: scenarios.has('estimate'),
          isStale: scenarios.has('stale'),
        }),
      ),
    ),
  ),

  http.get(
    api('/locations/states'),
    withScenario(() => okJson(statesFixture)),
  ),

  http.get(
    api('/locations/states/:uf/cities'),
    withScenario(({ params }) => {
      const uf = String(params.uf ?? 'SP').toUpperCase();
      return okJson(citiesByStateFixture[uf] ?? citiesByStateFixture.SP!);
    }),
  ),

  http.get(
    api('/dashboard/regional'),
    withScenario((_info, { scenarios }) =>
      okJson(
        buildRegionalDashboardFixture({
          isEstimate: scenarios.has('estimate'),
          isStale: scenarios.has('stale'),
        }),
      ),
    ),
  ),

  http.get(
    api('/news'),
    withScenario((_info, { scenarios }) => {
      if (scenarios.has('empty')) return okJson({ featured: null, items: [] });
      return okJson(newsFixture);
    }),
  ),

  http.get(
    api('/sources'),
    withScenario((_info, { scenarios }) =>
      scenarios.has('empty') ? okJson([]) : okJson(sourcesFixture),
    ),
  ),
];
