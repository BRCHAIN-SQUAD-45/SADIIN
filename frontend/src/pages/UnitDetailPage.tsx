import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Icon, isIconName } from '../components/ui/Icon';
import { EmptyState, ErrorState, ProvenanceTags, Skeleton } from '../components/ui/States';
import {
  useUnitAttendanceHistory,
  useUnitDetail,
  useUnitMetrics,
  useUnitsList,
  useUnitServices,
  useUnitStaff,
} from '../features/units/useUnitDetail';
import {
  buildRouteUrl,
  buildTelHref,
  formatInt,
  formatMovementLabel,
  formatPct,
  formatUnitUpdatedLabel,
} from '../utils/format';

const SERVICE_CATEGORIES = ['Todos', 'Consultas', 'Prevenção', 'Procedimentos', 'Apoio'] as const;

export function UnitDetailPage() {
  const { cnes } = useParams<{ cnes?: string }>();
  const navigate = useNavigate();
  const [selectedServiceCategory, setSelectedServiceCategory] = useState<string>('Todos');
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const unitsListQuery = useUnitsList();
  const units = unitsListQuery.data?.items ?? [];

  // Rota `/unidades` sem `:cnes` redireciona para a primeira unidade (Q3).
  if (!cnes) {
    if (unitsListQuery.isLoading) {
      return (
        <div className="units-page">
          <div className="unit-content section-width" style={{ paddingTop: 40 }}>
            <Skeleton style={{ height: 120 }} />
          </div>
        </div>
      );
    }
    const targetCnes = units[0]?.cnes_code ?? '9990001';
    return <Navigate to={`/unidades/${targetCnes}`} replace />;
  }

  return (
    <UnitDetailContent
      cnes={cnes}
      units={units}
      selectedServiceCategory={selectedServiceCategory}
      onSelectServiceCategory={setSelectedServiceCategory}
      hoveredDay={hoveredDay}
      onHoverDay={setHoveredDay}
      onSelectUnit={(nextCnes) => navigate(`/unidades/${nextCnes}`)}
    />
  );
}

interface UnitDetailContentProps {
  cnes: string;
  units: Array<{ cnes_code: string; name: string }>;
  selectedServiceCategory: string;
  onSelectServiceCategory: (cat: string) => void;
  hoveredDay: string | null;
  onHoverDay: (day: string | null) => void;
  onSelectUnit: (cnes: string) => void;
}

function UnitDetailContent({
  cnes,
  units,
  selectedServiceCategory,
  onSelectServiceCategory,
  hoveredDay,
  onHoverDay,
  onSelectUnit,
}: UnitDetailContentProps) {
  const detailQuery = useUnitDetail(cnes);
  const metricsQuery = useUnitMetrics(cnes);
  const historyQuery = useUnitAttendanceHistory(cnes, 7);
  const servicesQuery = useUnitServices(cnes, selectedServiceCategory);
  const staffQuery = useUnitStaff(cnes);

  const unit = detailQuery.data;
  const metrics = metricsQuery.data;
  const history = historyQuery.data;
  const services = servicesQuery.data ?? [];
  const staff = staffQuery.data;

  const selectorOptions =
    units.length > 0
      ? units
      : [
          { cnes_code: '9990001', name: 'UBS República' },
          { cnes_code: '9990002', name: 'UBS Sé' },
          { cnes_code: '9990003', name: 'UBS Santa Cecília' },
        ];

  return (
    <div className="units-page">
      <section className="units-top">
        <div className="section-width">
          <div className="unit-breadcrumb">
            <Link to="/">Início</Link> <span>›</span> Unidades de saúde
          </div>
          <div className="units-heading">
            <div>
              <span className="directory-kicker">
                <Icon name="hospital" size={17} /> REDE SUS
              </span>
              <h1>Unidades de saúde</h1>
              <p>
                Consulte informações, estrutura, movimento e serviços oferecidos pelas unidades
                próximas.
              </p>
            </div>
            <div className="unit-selector">
              <Icon name="search" size={18} />
              <select
                value={cnes}
                onChange={(e) => onSelectUnit(e.target.value)}
                aria-label="Selecionar unidade"
              >
                {selectorOptions.map((u) => (
                  <option key={u.cnes_code} value={u.cnes_code}>
                    {u.name}
                  </option>
                ))}
              </select>
              <Icon name="chevron" size={15} />
            </div>
          </div>
        </div>
      </section>

      <div className="unit-content section-width">
        {detailQuery.isLoading ? (
          <Skeleton style={{ height: 103 }} />
        ) : detailQuery.isError || !unit ? (
          <ErrorState
            error={detailQuery.error}
            onRetry={() => void detailQuery.refetch()}
            fallbackTitle="Não foi possível carregar os dados desta UBS"
          />
        ) : (
          <section className="unit-profile">
            <div className="unit-avatar">
              <Icon name="hospital" size={28} />
            </div>
            <div className="unit-identity">
              <span className={unit.is_open ? 'open-badge' : 'open-badge closed'}>
                <i /> {unit.is_open ? 'Aberta agora' : 'Fechada'}
              </span>
              <h2>{unit.name}</h2>
              <p>
                <Icon name="pin" size={15} /> {unit.address}, {unit.city}
              </p>
            </div>
            <div className="unit-actions">
              <a href={buildTelHref(unit.phone)}>
                <Icon name="phone" size={17} /> Ligar
              </a>
              <a
                className="primary"
                href={buildRouteUrl(unit.lat, unit.lng, unit.name)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="route" size={17} /> Como chegar
              </a>
            </div>
          </section>
        )}

        <section className="unit-metrics" aria-label="Indicadores da unidade">
          {metricsQuery.isLoading ? (
            [1, 2, 3, 4].map((n) => <Skeleton key={n} style={{ height: 84 }} />)
          ) : metricsQuery.isError || !metrics ? (
            <div style={{ gridColumn: '1 / -1' }}>
              <ErrorState
                error={metricsQuery.error}
                onRetry={() => void metricsQuery.refetch()}
                fallbackTitle="Não foi possível carregar os indicadores de movimento"
              />
            </div>
          ) : (
            <>
              <article>
                <span className="unit-metric-icon green">
                  <Icon name="people" />
                </span>
                <div>
                  <small>ATENDIMENTOS ESTE MÊS</small>
                  <strong>{formatInt(metrics.attendances_month)}</strong>
                  <p>
                    <b>
                      <Icon name="trend" size={13} /> {formatPct(metrics.attendances_delta_pct)}
                    </b>{' '}
                    vs. mês anterior
                  </p>
                </div>
              </article>

              <article>
                <span className="unit-metric-icon blue">
                  <Icon name="clock" />
                </span>
                <div>
                  <small>TEMPO MÉDIO DE ESPERA</small>
                  <strong>{metrics.avg_wait_minutes} min</strong>
                  <p>
                    {metrics.meta.is_estimate
                      ? 'Estimativa baseada em histórico'
                      : 'Estimativa para hoje'}
                  </p>
                </div>
              </article>

              <article>
                <span className="unit-metric-icon amber">
                  <Icon name="activity" />
                </span>
                <div>
                  <small>MOVIMENTO AGORA</small>
                  <strong>{formatMovementLabel(metrics.movement_level)}</strong>
                  <p>
                    {metrics.meta.is_estimate ? (
                      <ProvenanceTags meta={metrics.meta} />
                    ) : (
                      'Melhor horário após 14h'
                    )}
                  </p>
                </div>
              </article>

              <article>
                <span className="unit-metric-icon purple">
                  <Icon name="shield" />
                </span>
                <div>
                  <small>COBERTURA CADASTRADA</small>
                  <strong>{formatInt(metrics.registered_coverage)}</strong>
                  <p>Pessoas na área atendida</p>
                </div>
              </article>
            </>
          )}
        </section>

        <section className="unit-dashboard">
          <article className="unit-panel flow-panel">
            <div className="unit-panel-head">
              <div>
                <h2>Fluxo de atendimentos</h2>
                <p>Média diária nos últimos sete dias</p>
              </div>
              <span>
                Esta semana <Icon name="chevron" size={13} />
              </span>
            </div>

            {historyQuery.isLoading ? (
              <div style={{ padding: 20 }}>
                <Skeleton style={{ height: 140 }} />
              </div>
            ) : historyQuery.isError || !history ? (
              <div style={{ padding: 16 }}>
                <ErrorState
                  error={historyQuery.error}
                  onRetry={() => void historyQuery.refetch()}
                  fallbackTitle="Não foi possível carregar o histórico de atendimentos"
                />
              </div>
            ) : (
              <>
                <div
                  className="flow-chart"
                  role="list"
                  aria-label="Atendimentos nos últimos 7 dias"
                >
                  {history.days.map((d) => {
                    const isHovered = hoveredDay === d.date;
                    return (
                      <div
                        key={d.date}
                        role="listitem"
                        tabIndex={0}
                        className="flow-bar"
                        title={`${d.weekday_label}: ${d.attendances} atendimentos`}
                        aria-label={`${d.weekday_label}: ${d.attendances} atendimentos`}
                        onMouseEnter={() => onHoverDay(d.date)}
                        onMouseLeave={() => onHoverDay(null)}
                        onFocus={() => onHoverDay(d.date)}
                        onBlur={() => onHoverDay(null)}
                      >
                        <span>{isHovered ? `${d.attendances} atend.` : d.attendances}</span>
                        <div>
                          <i style={{ height: `${Math.min(100, d.attendances)}%` }} />
                        </div>
                        <small>{d.weekday_label}</small>
                      </div>
                    );
                  })}
                </div>
                <div className="chart-summary">
                  <span>
                    <i /> {formatInt(history.total)} atendimentos na semana{' '}
                    <ProvenanceTags meta={history.meta} />
                  </span>
                  <strong>
                    {formatInt(history.daily_average)} <small>média por dia</small>
                  </strong>
                </div>
              </>
            )}
          </article>

          <article className="unit-panel operation-panel">
            <div className="unit-panel-head">
              <div>
                <h2>Funcionamento hoje</h2>
                <p>{unit?.today_label ?? 'Quarta-feira, 28 de maio'}</p>
              </div>
              <span className={unit?.is_open !== false ? 'open-badge' : 'open-badge closed'}>
                <i /> {unit?.is_open !== false ? 'Aberta' : 'Fechada'}
              </span>
            </div>
            <div className="hours">
              <span>
                <Icon name="clock" />
                <small>HORÁRIO DE ATENDIMENTO</small>
              </span>
              <strong>
                {unit
                  ? `${unit.opening_hours.open} — ${unit.opening_hours.close}`
                  : '07:00 — 19:00'}
              </strong>
            </div>
            <div className="operation-row">
              <span>Capacidade de atendimento</span>
              <strong>{metrics ? `${metrics.capacity_pct}%` : '72%'}</strong>
            </div>
            <div className="capacity">
              <i style={{ width: `${metrics?.capacity_pct ?? 72}%` }} />
            </div>
            <div className="best-time">
              <Icon name="check" size={17} />
              <div>
                <strong>Melhor horário para ir</strong>
                <span>
                  {metrics?.best_time_hint ?? 'Entre 14h e 16h, com menor tempo de espera.'}
                </span>
              </div>
            </div>
          </article>
        </section>

        <section className="services-section">
          <div className="section-title split">
            <div>
              <span>SERVIÇOS DA UNIDADE</span>
              <h2>O que esta UBS oferece</h2>
              <p>Confira os atendimentos disponíveis antes de se deslocar.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (unit?.phone) {
                  window.location.href = buildTelHref(unit.phone);
                }
              }}
            >
              <Icon name="phone" size={16} /> Confirmar disponibilidade
            </button>
          </div>

          <div
            className="service-filters"
            role="tablist"
            aria-label="Filtrar serviços por categoria"
          >
            {SERVICE_CATEGORIES.map((cat) => {
              const isActive = selectedServiceCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={isActive ? 'active' : ''}
                  onClick={() => onSelectServiceCategory(cat)}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {servicesQuery.isLoading ? (
            <div className="services-grid">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <Skeleton key={n} style={{ height: 74 }} />
              ))}
            </div>
          ) : servicesQuery.isError ? (
            <ErrorState
              error={servicesQuery.error}
              onRetry={() => void servicesQuery.refetch()}
              fallbackTitle="Não foi possível carregar os serviços da unidade"
            />
          ) : services.length === 0 ? (
            <EmptyState
              title="Nenhum serviço nesta categoria"
              description="Selecione 'Todos' para visualizar todos os serviços ativos."
              actionLabel="Ver todos os serviços"
              onAction={() => onSelectServiceCategory('Todos')}
            />
          ) : (
            <div className="services-grid">
              {services.map((service) => (
                <article key={service.id}>
                  <span>
                    <Icon name={isIconName(service.icon_key) ? service.icon_key : 'hospital'} />
                  </span>
                  <div>
                    <small>{service.category}</small>
                    <h3>{service.name}</h3>
                    <p>{service.detail}</p>
                  </div>
                  <Icon name="chevron" size={17} />
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="unit-details-grid">
          <article className="unit-panel team-card">
            <div className="unit-panel-head">
              <div>
                <h2>Equipe e estrutura</h2>
                <p>
                  Dados oficiais do CNES
                  {staff?.reference_date ? ` • Competência ${staff.reference_date}` : ''}
                </p>
              </div>
              <ProvenanceTags meta={staff?.meta} />
            </div>

            {staffQuery.isLoading ? (
              <div style={{ padding: 17 }}>
                <Skeleton style={{ height: 56 }} />
              </div>
            ) : staffQuery.isError || !staff ? (
              <div style={{ padding: 17 }}>
                <ErrorState
                  error={staffQuery.error}
                  onRetry={() => void staffQuery.refetch()}
                  fallbackTitle="Não foi possível carregar os dados do CNES"
                />
              </div>
            ) : (
              <>
                <div className="team-stats">
                  <span>
                    <strong>{formatInt(staff.professionals)}</strong>
                    <small>profissionais</small>
                  </span>
                  <span>
                    <strong>{formatInt(staff.rooms)}</strong>
                    <small>consultórios</small>
                  </span>
                  <span>
                    <strong>{formatInt(staff.esf_teams)}</strong>
                    <small>equipes ESF</small>
                  </span>
                </div>
                <button type="button" aria-disabled="true" title="Detalhamento completo em breve">
                  Ver estrutura completa <Icon name="arrow" size={16} />
                </button>
              </>
            )}
          </article>

          <article className="unit-panel contact-card">
            <div className="unit-panel-head">
              <div>
                <h2>Contato e informações</h2>
                <p>Canais oficiais da unidade</p>
              </div>
            </div>
            <p>
              <Icon name="phone" size={16} />
              <span>
                <small>TELEFONE</small>
                {unit?.phone ?? '(11) 3333-0180'}
              </span>
            </p>
            <p>
              <Icon name="clock" size={16} />
              <span>
                <small>ATUALIZAÇÃO DOS DADOS</small>
                {unit ? formatUnitUpdatedLabel(unit.data_updated_at) : 'Hoje, às 08:42'}
              </span>
            </p>
            <p>
              <Icon name="database" size={16} />
              <span>
                <small>FONTE</small>
                {unit?.source_label ?? 'CNES / e-SUS APS'}
              </span>
            </p>
          </article>
        </section>
      </div>
    </div>
  );
}
