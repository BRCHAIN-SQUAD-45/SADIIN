/* eslint-disable no-console -- script de linha de comando: a saída no terminal é o objetivo. */
/**
 * Verificação de contrato contra o back-end REAL (FastAPI).
 *
 * Diferente de `npm run contract:check` (que valida os mocks do MSW), este script
 * chama cada rota do back-end rodando de verdade e valida o JSON com os mesmos
 * schemas Zod usados pelo front-end em produção.
 *
 * Uso (com o back-end rodando em http://localhost:8000):
 *   npm run contract:live
 *   LIVE_API_URL=http://outro-host:8000 npm run contract:live
 */
import type { ZodTypeAny } from 'zod';
import {
  ApiErrorBodySchema,
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
} from '../src/api/schemas';

const BASE = `${(process.env.LIVE_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')}/api/v1`;
const TIMEOUT_MS = Number(process.env.LIVE_TIMEOUT_MS ?? 60000);

type Status = 'OK' | 'CONTRATO' | 'ERRO_API' | 'FALHA';
interface Row {
  route: string;
  status: Status;
  http?: number;
  ms: number;
  detail: string;
}

const rows: Row[] = [];

async function check(route: string, path: string, schema: ZodTypeAny): Promise<unknown> {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const ms = Date.now() - started;
    const body: unknown = await res.json().catch(() => undefined);
    if (!res.ok) {
      const err = ApiErrorBodySchema.safeParse(body);
      rows.push({
        route,
        status: 'ERRO_API',
        http: res.status,
        ms,
        detail: err.success
          ? `${err.data.error.code}: ${err.data.error.message}`
          : `corpo de erro fora do padrão ApiError: ${JSON.stringify(body)?.slice(0, 200)}`,
      });
      return undefined;
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .slice(0, 6)
        .map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`)
        .join(' | ');
      rows.push({ route, status: 'CONTRATO', http: res.status, ms, detail: issues });
      return body;
    }
    rows.push({ route, status: 'OK', http: res.status, ms, detail: '' });
    return parsed.data;
  } catch (e) {
    rows.push({
      route,
      status: 'FALHA',
      ms: Date.now() - started,
      detail: e instanceof Error ? e.message : String(e),
    });
    return undefined;
  }
}

async function main() {
  const cityIbge = process.env.LIVE_CITY_IBGE ?? '3550308';
  // Ponto de referência: Praça da Sé, São Paulo.
  const lat = Number(process.env.LIVE_LAT ?? -23.5503);
  const lng = Number(process.env.LIVE_LNG ?? -46.6339);

  await check('GET /health', '/health', HealthSchema);
  await check('GET /meta', '/meta', PortalMetaSchema);
  await check('GET /sources', '/sources', SourceListSchema);
  await check('GET /locations/states', '/locations/states', StateListSchema);
  await check('GET /locations/states/SP/cities', '/locations/states/SP/cities', CityListSchema);

  await check('GET /medications/categories', '/medications/categories', CategoriesSchema);
  const meds = (await check('GET /medications', '/medications', MedicationPageSchema)) as
    { items?: { id?: string }[] } | undefined;
  const medId = process.env.LIVE_MEDICATION_ID ?? meds?.items?.[0]?.id ?? 'dipirona';
  await check(
    `GET /medications/${medId}`,
    `/medications/${encodeURIComponent(medId)}`,
    MedicationDetailSchema,
  );

  await check('GET /conditions/categories', '/conditions/categories', CategoriesSchema);
  await check('GET /conditions', '/conditions', ConditionPageSchema);
  await check('GET /conditions/gripe', '/conditions/gripe', ConditionDetailSchema);

  const nearby = (await check(
    'GET /ubs/nearby',
    `/ubs/nearby?lat=${lat}&lng=${lng}&radius_km=5`,
    UnitSummaryListSchema,
  )) as { cnes_code?: string }[] | undefined;
  const page = (await check('GET /ubs', `/ubs?city_ibge=${cityIbge}`, UnitPageSchema)) as
    { items?: { cnes_code?: string }[] } | undefined;
  const cnes =
    process.env.LIVE_CNES ?? nearby?.[0]?.cnes_code ?? page?.items?.[0]?.cnes_code ?? '2077485';

  await check(`GET /ubs/${cnes}`, `/ubs/${cnes}`, UnitDetailSchema);
  await check(`GET /ubs/${cnes}/metrics`, `/ubs/${cnes}/metrics`, UnitMetricsSchema);
  await check(
    `GET /ubs/${cnes}/attendance-history`,
    `/ubs/${cnes}/attendance-history?days=7`,
    AttendanceHistorySchema,
  );
  await check(`GET /ubs/${cnes}/services`, `/ubs/${cnes}/services`, UnitServiceListSchema);
  await check(`GET /ubs/${cnes}/staff`, `/ubs/${cnes}/staff`, UnitStaffSchema);

  await check(
    'GET /dashboard/regional',
    `/dashboard/regional?uf=SP&city_ibge=${cityIbge}`,
    RegionalDashboardSchema,
  );
  await check('GET /news', `/news?uf=SP&limit=4`, NewsPayloadSchema);
  await check('GET /search', `/search?q=dipirona&type=all`, SearchResponseSchema);

  const width = Math.max(...rows.map((r) => r.route.length));
  console.log(`\nContrato ao vivo — ${BASE}\n`);
  for (const r of rows) {
    const http = r.http ? String(r.http) : '---';
    console.log(
      `${r.status.padEnd(8)} ${http} ${r.route.padEnd(width)} ${String(r.ms).padStart(6)}ms  ${r.detail}`,
    );
  }
  const ok = rows.filter((r) => r.status === 'OK').length;
  console.log(`\n${ok}/${rows.length} rotas dentro do contrato.`);
  process.exitCode = ok === rows.length ? 0 : 1;
}

void main();
