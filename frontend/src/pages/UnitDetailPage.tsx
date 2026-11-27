import { UnitRoutes } from '../components/map/UnitRoutes';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { UnitAttendanceChart } from '../components/charts/UnitAttendanceChart';
import { Icon, isIconName } from '../components/ui/Icon';
import { EmptyState, ErrorState, ProvenanceTags, Skeleton } from '../components/ui/States';
import { getEnv } from '../config/env';
import { useLocationSelection } from '../features/location/useLocation';
import {
  useUnitAttendanceHistory,
  useUnitDetail,
  useUnitMetrics,
  useUnitsList,
  useUnitServices,
  useUnitStaff,
} from '../features/units/useUnitDetail';
import {
  buildTelHref,
  formatDisplayName,
  formatInt,
  formatMovementLabel,
  formatOpenStatus,
  formatPct,
  formatTodayLabel,
  formatUnitUpdatedLabel,
} from '../utils/format';

function formatUnitPhone(phone?: string) {
  const digits = (phone ?? '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  return digits.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
}

const SERVICE_CATEGORIES = ['Todos', 'Consultas', 'Prevenção', 'Procedimentos', 'Apoio'] as const;

export function UnitDetailPage() {
  const { cnes } = useParams<{ cnes?: string }>();
  const navigate = useNavigate();
  const { isMock } = getEnv();
  const { location } = useLocationSelection();
  const [selectedServiceCategory, setSelectedServiceCategory] = useState<string>('Todos');
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const unitsListQuery = useUnitsList({ city_ibge: location.ibgeCode });
  const units = (unitsListQuery.data?.items ?? []).filter(
    (unit) => isMock || (/^\d{7}$/.test(unit.cnes_code) && unit.cnes_code !== '9990001'),
  );

  // O CNES 9990001 existe apenas nos mocks. Em API real, aguarda a lista do
  // município selecionado e só navega quando houver uma unidade verdadeira.
  if (!isMock && cnes === '9990001') {
    if (unitsListQuery.isLoading) {
      return (
        <div className="units-page">
          <div className="unit-content section-width" style={{ paddingTop: 40 }}>
            <Skeleton style={{ height: 120 }} />
          </div>
        </div>
      );
    }
    if (units[0] && units[0].cnes_code !== '9990001') {
      return <Navigate to={`/unidades/${units[0].cnes_code}`} replace />;
    }
    return (
      <div className="units-page">
        <div className="unit-content section-width" style={{ paddingTop: 40 }}>
          {unitsListQuery.isError ? (
            <ErrorState
              error={unitsListQuery.error}
              onRetry={() => void unitsListQuery.refetch()}
              fallbackTitle={`Não foi possível carregar as unidades de ${location.cityName} (${location.uf})`}
            />
          ) : (
            <EmptyState
              title={`Nenhuma unidade encontrada em ${location.cityName} (${location.uf})`}
              description="Selecione outro município ou estado no menu de localização superior."
            />
          )}
        </div>
      </div>
    );
  }

  // Rota `/unidades` sem `:cnes` redireciona para a primeira unidade real
  // retornada para o city_ibge selecionado. Não usa CNES fictício em modo API.
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
    if (units[0]) {
      return <Navigate to={`/unidades/${units[0].cnes_code}`} replace />;
    }
    if (isMock) {
      return <Navigate to="/unidades/9990001" replace />;
    }
    return (
      <div className="units-page">
        <div className="unit-content section-width" style={{ paddingTop: 40 }}>
          {unitsListQuery.isError ? (
            <ErrorState
              error={unitsListQuery.error}
              onRetry={() => void unitsListQuery.refetch()}
              fallbackTitle={`Não foi possível carregar as unidades de ${location.cityName} (${location.uf})`}
            />
          ) : (
            <EmptyState
              title={`Nenhuma unidade encontrada em ${location.cityName} (${location.uf})`}
              description="Selecione outro município ou estado no menu de localização superior."
            />
          )}
        </div>
      </div>
    );
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
  const { location } = useLocationSelection();
  const detailQuery = useUnitDetail(cnes);
  const metricsQuery = useUnitMetrics(cnes);
  const historyQuery = useUnitAttendanceHistory(cnes, 7);
  const servicesQuery = useUnitServices(cnes);
  const [structureOpen, setStructureOpen] = useState(false);
  useEffect(() => { setStructureOpen(false); onSelectServiceCategory('Todos'); }, [cnes, onSelectServiceCategory]);
  const staffQuery = useUnitStaff(cnes);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const selectorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);
  const listboxId = useId();

  const unit = detailQuery.data;
  const metrics = metricsQuery.data;
  const history = historyQuery.data;
  const allServices = servicesQuery.data ?? [];
  const services = selectedServiceCategory === 'Todos' ? allServices : allServices.filter(s => s.category === selectedServiceCategory);
  const staff = staffQuery.data;

  // A unidade aberta sempre aparece no seletor (ela pode não estar na 1ª página da lista).
  const selectorOptions: { cnes_code: string; name: string }[] = units.some(
    (u) => u.cnes_code === cnes,
  )
    ? units
    : [{ cnes_code: cnes, name: unit?.name ?? `CNES ${cnes}` }, ...units];

  const selectedIndex = Math.max(
    0,
    selectorOptions.findIndex((u) => u.cnes_code === cnes),
  );
  const selectedOption = selectorOptions[selectedIndex];
  const selectedLabel = selectedOption ? formatDisplayName(selectedOption.name) : `CNES ${cnes}`;

  useEffect(() => {
    if (!selectorOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setSelectorOpen(false);
      }
    };
    const onDocKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectorOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onDocKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onDocKeyDown);
    };
  }, [selectorOpen]);

  useEffect(() => {
    if (!selectorOpen) return;
    const el = optionRefs.current[highlightedIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectorOpen, highlightedIndex]);

  const openSelector = (initialIndex = selectedIndex) => {
    setHighlightedIndex(initialIndex);
    setSelectorOpen(true);
  };

  const handleSelectOption = (nextCnes: string) => {
    setSelectorOpen(false);
    onSelectUnit(nextCnes);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (selectorOptions.length === 0) return;
    if (!selectorOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openSelector(selectedIndex);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % selectorOptions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + selectorOptions.length) % selectorOptions.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setHighlightedIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setHighlightedIndex(selectorOptions.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const chosen = selectorOptions[highlightedIndex];
      if (chosen) handleSelectOption(chosen.cnes_code);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSelectorOpen(false);
    } else if (e.key === 'Tab') {
      setSelectorOpen(false);
    }
  };

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
            <div
              ref={selectorRef}
              className={selectorOpen ? 'unit-selector open' : 'unit-selector'}
            >
              <button
                ref={triggerRef}
                type="button"
                className="unit-selector-trigger"
                aria-label="Selecionar unidade"
                aria-haspopup="listbox"
                aria-expanded={selectorOpen}
                aria-controls={listboxId}
                aria-activedescendant={
                  selectorOpen && selectorOptions[highlightedIndex]
                    ? `${listboxId}-option-${selectorOptions[highlightedIndex]!.cnes_code}`
                    : undefined
                }
                onClick={() => (selectorOpen ? setSelectorOpen(false) : openSelector())}
                onKeyDown={handleTriggerKeyDown}
              >
                <span>{selectedLabel}</span>
                <Icon name="chevron-down" size={15} />
              </button>

              {selectorOpen && (
                <ul
                  id={listboxId}
                  role="listbox"
                  aria-label="Unidades de saúde"
                  className="unit-selector-menu"
                  tabIndex={-1}
                >
                  {selectorOptions.map((u, idx) => {
                    const isSelected = u.cnes_code === cnes;
                    const isHighlighted = idx === highlightedIndex;
                    return (
                      <li
                        key={u.cnes_code}
                        ref={(el) => {
                          optionRefs.current[idx] = el;
                        }}
                        id={`${listboxId}-option-${u.cnes_code}`}
                        role="option"
                        aria-selected={isSelected}
                        className={[
                          'unit-selector-option',
                          isSelected ? 'selected' : '',
                          isHighlighted ? 'highlighted' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectOption(u.cnes_code)}
                      >
                        <span>{formatDisplayName(u.name)}</span>
                        {isSelected && <Icon name="check" size={15} />}
                      </li>
                    );
                  })}
                </ul>
              )}
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
              <span className={formatOpenStatus(unit.is_open).badgeClass}>
                <i /> {formatOpenStatus(unit.is_open).label}
              </span>
              <h2>{formatDisplayName(unit.name)}</h2>
              <p>
                <Icon name="pin" size={15} /> {formatDisplayName(unit.address)}, {unit.city}
              </p>
            </div>
            <div className="unit-actions">
              <a href={buildTelHref(unit.phone)}>
                <Icon name="phone" size={17} /> Ligar
              </a>
              {Number.isFinite(unit.lat) && Number.isFinite(unit.lng) && <UnitRoutes unit={unit} origin={(location.label === 'Localização atual' || location.label === 'Localização confirmada') && location.lat !== null && location.lng !== null ? { lat: location.lat, lng: location.lng } : undefined} />}
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
              <UnitAttendanceChart
                history={history}
                hoveredDay={hoveredDay}
                onHoverDay={onHoverDay}
              />
            )}
          </article>

          <article className="unit-panel operation-panel">
            <div className="unit-panel-head">
              <div>
                <h2>Funcionamento hoje</h2>
                <p>{unit?.today_label ?? formatTodayLabel()}</p>
              </div>
              <span className={formatOpenStatus(unit?.is_open).badgeClass}>
                <i /> {formatOpenStatus(unit?.is_open).label}
              </span>
            </div>
            <div className="hours">
              <span>
                <Icon name="clock" />
                <small>HORÁRIO DE ATENDIMENTO</small>
              </span>
              <strong>
                {unit?.opening_hours
                  ? `${unit.opening_hours.open} — ${unit.opening_hours.close}`
                  : (unit?.turno_atendimento ?? 'Não informado')}
              </strong>
            </div>
            <div className="operation-row">
              <span>Capacidade de atendimento</span>
              <strong>{metrics ? `${metrics.capacity_pct}%` : 'Não informado'}</strong>
            </div>
            <div className="capacity">
              <i style={{ width: `${metrics?.capacity_pct ?? 0}%` }} />
            </div>
            <div className="best-time">
              <Icon name="check" size={17} />
              <div>
                <strong>Melhor horário para ir</strong>
                <span>
                  {metrics?.best_time_hint ??
                    'Sem dados de movimento para esta unidade. Ligue antes de ir.'}
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
              <p>Serviços especializados registrados no CNES. A lista pode não incluir todos os atendimentos da unidade.</p>
            </div>
            <button
              type="button"
              disabled={buildTelHref(unit?.phone) === '#'}
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
                  {cat} ({cat === 'Todos' ? allServices.length : allServices.filter(s => s.category === cat).length})
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
              title={selectedServiceCategory === 'Todos' ? 'Nenhum serviço especializado retornado pelo CNES' : 'Nenhum serviço registrado nesta categoria'}
              description="Isso não significa que a UBS não ofereça atendimento. Confirme diretamente com a unidade."
              actionLabel="Ver todos os serviços"
              onAction={() => onSelectServiceCategory('Todos')}
            />
          ) : (
            <div className="services-grid">
              {services.map((service) => (
                <article key={`${service.id}-${service.name}-${service.detail}`}>
                  <span>
                    <Icon name={isIconName(service.icon_key) ? service.icon_key : 'hospital'} />
                  </span>
                  <div>
                    <small>{service.category}</small>
                    <h3>{service.detail.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().includes('ELETROCARDIOGRAFICO') ? 'Eletrocardiograma (ECG)' : formatDisplayName(service.name)}</h3>
                    <p>{service.detail}</p>
                    {service.detail.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().includes('ELETROCARDIOGRAFICO') && <p>{formatDisplayName(service.name)}</p>}
                  </div>

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
                    <small>registros profissionais SUS</small>
                  </span>
                  <span>
                    <strong>{staff.rooms !== null ? formatInt(staff.rooms) : '—'}</strong>
                    <small>consultórios</small>
                  </span>
                  <span>
                    <strong>{formatInt(staff.esf_teams)}</strong>
                    <small>equipes identificadas (INE)</small>
                  </span>
                </div>
                <button type="button" aria-expanded={structureOpen} onClick={() => setStructureOpen(v => !v)}>
                  {structureOpen ? 'Ocultar estrutura' : 'Ver estrutura completa'} <Icon name="arrow" size={16} />
                </button>
                {structureOpen && <div style={{ padding: 17 }}>
                  <p>Registros profissionais com atendimento SUS: {formatInt(staff.professionals)}</p>
                  <p>Consultórios: {staff.rooms == null ? 'Não informado pelo CNES' : formatInt(staff.rooms)}</p>
                  <p>Equipes identificadas pelo INE: {formatInt(staff.esf_teams)}</p>
                  <p>Os registros podem incluir mais de um vínculo por profissional. A ausência de INE não comprova ausência de equipes ESF.</p>
                  <a href="https://cnes.datasus.gov.br/" target="_blank" rel="noreferrer">Consultar ficha oficial no CNES (código {cnes})</a>
                </div>}
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
                {buildTelHref(unit?.phone) !== '#' ? <a href={buildTelHref(unit?.phone)}>{formatUnitPhone(unit?.phone)}</a> : 'Telefone não informado ou inválido'}
              </span>
            </p>
            <p>
              <Icon name="clock" size={16} />
              <span>
                <small>ATUALIZAÇÃO DOS DADOS</small>
                {unit ? formatUnitUpdatedLabel(unit.data_updated_at) : '—'}
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
