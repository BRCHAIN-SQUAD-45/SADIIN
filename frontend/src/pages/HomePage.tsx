import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { SearchType } from '../api/types';
import { Icon, isIconName } from '../components/ui/Icon';
import { EmptyState, ErrorState, ProvenanceTags, Skeleton } from '../components/ui/States';
import { useRegionalDashboard } from '../features/dashboard/useRegionalDashboard';
import { useLocationSelection } from '../features/location/useLocation';
import { useMeta } from '../features/meta/useMeta';
import { useNews } from '../features/news/useNews';
import { useGlobalSearch } from '../features/search/useGlobalSearch';
import { useSources } from '../features/sources/useSources';
import { useNearbyUnits } from '../features/units/useNearbyUnits';
import { useDebounce } from '../hooks/useDebounce';
import { useGeolocation } from '../hooks/useGeolocation';
import {
  buildRouteUrl,
  formatClosesAt,
  formatDistanceLabel,
  formatEstablishmentsShort,
  formatNewsDayMonth,
  formatPct,
  formatSignedPct,
} from '../utils/format';

const SEARCH_TABS: { id: string; label: string; apiType: SearchType }[] = [
  { id: 'Tudo', label: 'Tudo', apiType: 'all' },
  { id: 'Medicamentos', label: 'Medicamentos', apiType: 'medications' },
  { id: 'Doenças e sintomas', label: 'Doenças e sintomas', apiType: 'conditions' },
  { id: 'Unidades de saúde', label: 'Unidades de saúde', apiType: 'units' },
];

const POPULAR_SEARCHES = ['Dengue', 'Dipirona', 'Vacina da gripe', 'Dor de cabeça'] as const;

export function HomePage() {
  const [selectedTab, setSelectedTab] = useState(SEARCH_TABS[0]!);
  const [queryText, setQueryText] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [feedbackBanner, setFeedbackBanner] = useState('');
  const [activePinCnes, setActivePinCnes] = useState<string | null>(null);

  const { location, selectLocation } = useLocationSelection();
  const [placeInput, setPlaceInput] = useState(location.label);
  const geo = useGeolocation();

  const debouncedText = useDebounce(queryText, 300);
  const effectiveSearchTerm = submittedQuery || debouncedText;

  const metaQuery = useMeta();
  const searchQuery = useGlobalSearch({
    q: effectiveSearchTerm,
    type: selectedTab.apiType,
    uf: location.uf,
    cityIbge: location.ibgeCode,
    enabled: effectiveSearchTerm.trim().length >= 2,
  });
  const nearbyQuery = useNearbyUnits(location.lat, location.lng, 10);
  const newsQuery = useNews(location.uf, location.ibgeCode);
  const dashboardQuery = useRegionalDashboard(location.uf, location.ibgeCode);
  const sourcesQuery = useSources();

  const submitSearch = (value = queryText) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setQueryText(trimmed);
    setSubmittedQuery(trimmed);
    setFeedbackBanner(`Resultados para “${trimmed}” em ${selectedTab.label.toLowerCase()}`);
  };

  const clearSearch = () => {
    setFeedbackBanner('');
    setSubmittedQuery('');
    setQueryText('');
  };

  const handleUseMyLocation = () => {
    geo.request(
      (coords) => {
        setPlaceInput('Localização atual');
        selectLocation({
          ...location,
          lat: coords.lat,
          lng: coords.lng,
          label: 'Localização atual',
        });
      },
      () => {
        // Permissão recusada: não quebra o mapa nem os painéis (caso de borda 1.1).
      },
    );
  };

  const establishmentsLabel = metaQuery.data
    ? formatEstablishmentsShort(metaQuery.data.establishments_count)
    : '452 mil';
  const sourcesCountLabel = metaQuery.data ? `${metaQuery.data.sources_count} fontes` : '6 fontes';

  const nearestUnit = nearbyQuery.data?.[0];
  const mapUnits = nearbyQuery.data?.slice(0, 3) ?? [];
  const pinClasses = ['pin-main', 'pin-second', 'pin-third'] as const;

  const showSearchPanel =
    Boolean(feedbackBanner) || (debouncedText.trim().length >= 2 && searchQuery.data !== undefined);

  return (
    <main>
      {/* 1. HERO */}
      <section className="hero" id="inicio">
        <div className="hero-orbit orbit-one" />
        <div className="hero-orbit orbit-two" />

        <div className="hero-content">
          <span className="trust-label">
            <Icon name="shield" size={15} /> Informação oficial, simples e confiável
          </span>
          <h1>Saúde pública ao seu alcance</h1>
          <p>
            Encontre informações sobre medicamentos, doenças, sintomas e serviços do SUS reunidas em
            um único lugar.
          </p>

          <div className="search-box">
            <div className="search-tabs" role="tablist" aria-label="Filtrar tipo de busca">
              {SEARCH_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedTab.id === tab.id}
                  className={selectedTab.id === tab.id ? 'selected' : ''}
                  onClick={() => setSelectedTab(tab)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitSearch();
              }}
            >
              <Icon name="search" size={23} />
              <input
                value={queryText}
                onChange={(e) => {
                  setQueryText(e.target.value);
                  if (!e.target.value.trim()) setSubmittedQuery('');
                }}
                placeholder="O que você procura? Ex.: dengue, dipirona, UBS..."
                aria-label="Pesquisar no portal"
              />
              <button type="submit">Pesquisar</button>
            </form>
          </div>

          <div className="popular-searches">
            <span>Buscas populares:</span>
            {POPULAR_SEARCHES.map((term) => (
              <button key={term} type="button" onClick={() => submitSearch(term)}>
                {term}
              </button>
            ))}
          </div>

          {feedbackBanner && (
            <div className="search-feedback" role="status">
              <Icon name="check" size={17} />
              {feedbackBanner}
              <button type="button" aria-label="Limpar busca" onClick={clearSearch}>
                <Icon name="close" size={15} />
              </button>
            </div>
          )}

          {showSearchPanel && searchQuery.data && (
            <div className="search-results-panel" role="region" aria-label="Resultados da pesquisa">
              <div className="search-results-head">
                <span>
                  {searchQuery.data.matched_term ? (
                    <>
                      Termo reconhecido: <strong>{searchQuery.data.matched_term}</strong>
                    </>
                  ) : (
                    <>
                      Resultados para <strong>“{searchQuery.data.query}”</strong>
                    </>
                  )}
                </span>
                <ProvenanceTags meta={searchQuery.data.meta} />
                <button type="button" aria-label="Fechar resultados" onClick={clearSearch}>
                  <Icon name="close" size={14} />
                </button>
              </div>

              {searchQuery.data.fallback ? (
                <div className="search-fallback" role="alert">
                  <Icon name="info" size={18} />
                  <div>
                    <strong>{searchQuery.data.fallback.message}</strong>
                    {searchQuery.data.suggested_categories &&
                      searchQuery.data.suggested_categories.length > 0 && (
                        <p style={{ marginTop: 4 }}>
                          Categorias relacionadas:{' '}
                          {searchQuery.data.suggested_categories.map((c) => c.name).join(', ')}.
                        </p>
                      )}
                  </div>
                </div>
              ) : (
                <>
                  {searchQuery.data.results.medications.length > 0 && (
                    <div className="search-group">
                      <small>MEDICAMENTOS</small>
                      <ul>
                        {searchQuery.data.results.medications.map((m) => (
                          <li key={m.id}>
                            <Link to={`/medicamentos?q=${encodeURIComponent(m.name)}`}>
                              <div>
                                <strong>{m.name}</strong>
                                <small>{m.subtitle}</small>
                              </div>
                              <span>{m.tag}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {searchQuery.data.results.conditions.length > 0 && (
                    <div className="search-group">
                      <small>DOENÇAS E SINTOMAS</small>
                      <ul>
                        {searchQuery.data.results.conditions.map((c) => (
                          <li key={c.id}>
                            <Link to={`/doencas?q=${encodeURIComponent(c.popular_name)}`}>
                              <div>
                                <strong>{c.popular_name}</strong>
                                <small>{c.subtitle}</small>
                              </div>
                              <span>{c.cid10_code ?? c.tag}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {searchQuery.data.results.units.length > 0 && (
                    <div className="search-group">
                      <small>UNIDADES DE SAÚDE</small>
                      <ul>
                        {searchQuery.data.results.units.map((u) => (
                          <li key={u.cnes_code}>
                            <Link to={`/unidades/${u.cnes_code}`}>
                              <div>
                                <strong>{u.name}</strong>
                                <small>{u.address}</small>
                              </div>
                              <span>{u.is_open ? 'Aberta agora' : 'Fechada'}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {searchQuery.data.results.medications.length === 0 &&
                    searchQuery.data.results.conditions.length === 0 &&
                    searchQuery.data.results.units.length === 0 && (
                      <p style={{ fontSize: 'var(--fs-9)', color: '#718783' }}>
                        Nenhum resultado encontrado na base indexada para “{searchQuery.data.query}
                        ”.
                      </p>
                    )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="data-card data-card-one">
          <span>
            <Icon name="hospital" />
          </span>
          <div>
            <strong>{establishmentsLabel}</strong>
            <small>estabelecimentos mapeados</small>
          </div>
        </div>

        <div className="data-card data-card-two">
          <span>
            <Icon name="database" />
          </span>
          <div>
            <strong>{sourcesCountLabel}</strong>
            <small>de dados integradas</small>
          </div>
        </div>
      </section>

      {/* 2. ACESSO RÁPIDO */}
      <section className="quick-section section-width" id="servicos">
        <div className="section-title">
          <div>
            <span>ACESSO RÁPIDO</span>
            <h2>Como podemos ajudar?</h2>
            <p>Acesse os serviços e informações mais procurados pela população.</p>
          </div>
        </div>

        <div className="quick-grid">
          <article className="quick-card medicine">
            <span className="quick-icon">
              <Icon name="pill" size={25} />
            </span>
            <h3>Medicamentos</h3>
            <p>Consulte indicações, efeitos colaterais, contraindicações e disponibilidade.</p>
            <Link to="/medicamentos">
              Consultar medicamentos <Icon name="arrow" size={17} />
            </Link>
          </article>

          <article className="quick-card symptoms">
            <span className="quick-icon">
              <Icon name="heart" size={25} />
            </span>
            <h3>Doenças e sintomas</h3>
            <p>Entenda sintomas, formas de prevenção e quando procurar atendimento.</p>
            <Link to="/doencas">
              Pesquisar sintomas <Icon name="arrow" size={17} />
            </Link>
          </article>

          <article className="quick-card units">
            <span className="quick-icon">
              <Icon name="hospital" size={25} />
            </span>
            <h3>Unidades de saúde</h3>
            <p>Encontre UBS, hospitais e serviços especializados próximos a você.</p>
            <Link to="/unidades">
              Encontrar unidade <Icon name="arrow" size={17} />
            </Link>
          </article>
        </div>
      </section>

      {/* 3. PERTO DE VOCÊ */}
      <section className="nearby-wrap">
        <div className="nearby section-width">
          <div className="nearby-copy">
            <span className="section-kicker">
              <Icon name="pin" size={16} /> PERTO DE VOCÊ
            </span>
            <h2>Encontre atendimento no SUS</h2>
            <p>
              Localize a unidade de saúde mais próxima, consulte horários, serviços disponíveis e
              trace sua rota.
            </p>

            <div className="place-field">
              <Icon name="pin" size={19} />
              <input
                value={placeInput !== location.label ? placeInput : location.label}
                onChange={(e) => setPlaceInput(e.target.value)}
                aria-label="Sua localização"
              />
              <button type="button" onClick={handleUseMyLocation}>
                Usar minha localização
              </button>
            </div>

            {(geo.status === 'denied' || geo.status === 'unavailable') && (
              <p role="status" style={{ fontSize: 'var(--fs-8)', color: '#7c4d12', marginTop: 8 }}>
                Permissão de localização negada. Selecione manualmente sua cidade e estado no menu
                superior.
              </p>
            )}

            {nearbyQuery.isPending && <Skeleton style={{ height: 92, marginTop: 13 }} />}

            {nearbyQuery.isError && (
              <ErrorState
                error={nearbyQuery.error}
                onRetry={() => void nearbyQuery.refetch()}
                fallbackTitle="Não foi possível localizar unidades próximas"
              />
            )}

            {nearbyQuery.data && nearbyQuery.data.length === 0 && (
              <EmptyState
                title="Nenhuma unidade encontrada neste raio"
                description="Selecione outra cidade ou estado no menu superior."
              />
            )}

            {nearestUnit && (
              <div className="facility">
                <div className="facility-top">
                  <span className="facility-icon">
                    <Icon name="hospital" />
                  </span>
                  <div>
                    <small>
                      MAIS PRÓXIMA
                      {nearestUnit.distance_m !== undefined
                        ? ` • ${formatDistanceLabel(nearestUnit.distance_m)}`
                        : ''}
                    </small>
                    <strong>{nearestUnit.name}</strong>
                    <p>{nearestUnit.address}</p>
                  </div>
                  <span className={`open-badge${nearestUnit.is_open ? '' : ' closed'}`}>
                    <i /> {nearestUnit.is_open ? 'Aberta agora' : 'Fechada'}
                  </span>
                </div>

                <div className="facility-meta">
                  {nearestUnit.closes_at && (
                    <span>
                      <Icon name="clock" size={16} /> {formatClosesAt(nearestUnit.closes_at)}
                    </span>
                  )}
                  {nearestUnit.phone && (
                    <span>
                      <Icon name="phone" size={16} /> {nearestUnit.phone}
                    </span>
                  )}
                  <a
                    href={buildRouteUrl(nearestUnit.lat, nearestUnit.lng, nearestUnit.name)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon name="route" size={16} /> Ver rota
                  </a>
                </div>
              </div>
            )}

            <Link
              className="all-units"
              to={nearestUnit ? `/unidades/${nearestUnit.cnes_code}` : '/unidades'}
            >
              Ver todas as unidades próximas <Icon name="arrow" size={17} />
            </Link>
          </div>

          <div className="map" aria-label="Mapa ilustrativo com unidades próximas">
            <div className="road r1" />
            <div className="road r2" />
            <div className="road r3" />
            <div className="road r4" />
            <div className="block b1" />
            <div className="block b2" />
            <div className="block b3" />
            <div className="block b4" />
            <div className="park" />

            {(mapUnits.length > 0
              ? mapUnits
              : [
                  { cnes_code: '9990001', name: 'UBS República', kind: 'ubs' as const },
                  { cnes_code: '9990002', name: 'UBS Sé', kind: 'ubs' as const },
                  { cnes_code: '9990003', name: 'UBS Santa Cecília', kind: 'hospital' as const },
                ]
            ).map((u, idx) => {
              const pinClass = pinClasses[idx] ?? 'pin-third';
              const isActive = activePinCnes === u.cnes_code;
              return (
                <span
                  key={u.cnes_code}
                  role="button"
                  tabIndex={0}
                  aria-label={u.name}
                  className={`map-pin ${pinClass}`}
                  onClick={() => setActivePinCnes(isActive ? null : u.cnes_code)}
                  onFocus={() => setActivePinCnes(u.cnes_code)}
                  onBlur={() => setActivePinCnes(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActivePinCnes(isActive ? null : u.cnes_code);
                    }
                  }}
                >
                  <Icon name="hospital" size={idx === 0 ? 21 : 17} />
                  {isActive && <span className="pin-tooltip">{u.name}</span>}
                </span>
              );
            })}

            <span className="you">
              <i />
              Você está aqui
            </span>

            <div className="map-legend">
              <span>
                <i /> UBS
              </span>
              <span>
                <i /> Hospital
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. NOTÍCIAS DA SUA REGIÃO */}
      <section className="local-news section-width">
        <div className="section-title split">
          <div>
            <span>NOTÍCIAS DA SUA REGIÃO</span>
            <h2>Saúde perto de você</h2>
            <p>Informações e avisos importantes para moradores de {location.cityName}.</p>
          </div>
          <button type="button" aria-disabled="true">
            Ver todas as notícias <Icon name="arrow" size={17} />
          </button>
        </div>

        {newsQuery.isPending && (
          <div className="news-grid">
            <Skeleton style={{ minHeight: 330 }} />
            <div className="news-list">
              <Skeleton style={{ height: 96 }} />
              <Skeleton style={{ height: 96 }} />
              <Skeleton style={{ height: 96 }} />
            </div>
          </div>
        )}

        {newsQuery.isError && (
          <ErrorState
            error={newsQuery.error}
            onRetry={() => void newsQuery.refetch()}
            fallbackTitle="Não foi possível carregar as notícias regionais"
          />
        )}

        {newsQuery.data && !newsQuery.data.featured && newsQuery.data.items.length === 0 && (
          <EmptyState title="Nenhuma notícia disponível para esta região no momento" />
        )}

        {newsQuery.data && (newsQuery.data.featured || newsQuery.data.items.length > 0) && (
          <div className="news-grid">
            {newsQuery.data.featured && (
              <article className="news-featured">
                {newsQuery.data.featured.image_url && (
                  <img
                    src={newsQuery.data.featured.image_url}
                    alt="Pessoa usando máscara durante atendimento de saúde"
                  />
                )}
                <div>
                  <span>{newsQuery.data.featured.category}</span>
                  <h3>{newsQuery.data.featured.title}</h3>
                  {newsQuery.data.featured.summary && <p>{newsQuery.data.featured.summary}</p>}
                  <small>{newsQuery.data.featured.source_label}</small>
                </div>
              </article>
            )}

            <div className="news-list">
              {newsQuery.data.items.map((item) => {
                const { day, month } = formatNewsDayMonth(item.published_at);
                return (
                  <article key={item.id}>
                    <span className="news-date">
                      {day} <small>{month}</small>
                    </span>
                    <div>
                      <small>{item.category}</small>
                      <h3>{item.title}</h3>
                      {item.summary && <p>{item.summary}</p>}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* 5. SAÚDE EM DADOS */}
      <section className="insights section-width" id="indicadores">
        <div className="section-title split">
          <div>
            <span>SAÚDE EM DADOS</span>
            <h2>O retrato da saúde no Brasil</h2>
            <p>Indicadores públicos atualizados para você entender a realidade da sua região.</p>
          </div>
          <button type="button" aria-disabled="true">
            Explorar todos os indicadores <Icon name="arrow" size={17} />
          </button>
        </div>

        {dashboardQuery.isPending && (
          <div className="insights-grid">
            <Skeleton style={{ minHeight: 280 }} />
            <div className="stats-column">
              <Skeleton style={{ height: 84 }} />
              <Skeleton style={{ height: 84 }} />
              <Skeleton style={{ height: 84 }} />
            </div>
          </div>
        )}

        {dashboardQuery.isError && (
          <ErrorState
            error={dashboardQuery.error}
            onRetry={() => void dashboardQuery.refetch()}
            fallbackTitle="Não foi possível carregar os indicadores regionais"
          />
        )}

        {dashboardQuery.data && (
          <div className="insights-grid">
            <article className="highlight-stat">
              <div className="stat-head">
                <span>
                  <Icon name="activity" />
                </span>
                <small>{dashboardQuery.data.headline.kicker}</small>
                <ProvenanceTags meta={dashboardQuery.data.meta} />
              </div>
              <h3>{dashboardQuery.data.headline.title}</h3>
              <div className="big-number">
                {formatSignedPct(dashboardQuery.data.headline.delta_pct)}
              </div>
              <p>{dashboardQuery.data.headline.comparison_label}</p>
              <div className="mini-chart">
                {dashboardQuery.data.headline.series.map((v, idx) => (
                  <i key={idx} style={{ height: `${v}%` }} />
                ))}
              </div>
              <small>
                Fonte: {dashboardQuery.data.headline.source_label} •{' '}
                {dashboardQuery.data.headline.updated_label}
              </small>
            </article>

            <div className="stats-column">
              {dashboardQuery.data.stats.map((stat) => {
                const iconName =
                  stat.tone === 'blue' ? 'people' : stat.tone === 'green' ? 'hospital' : 'clock';
                return (
                  <article key={stat.key} className="stat-card">
                    <span className={`stat-icon ${stat.tone}`}>
                      <Icon name={isIconName(iconName) ? iconName : 'activity'} />
                    </span>
                    <div>
                      <small>{stat.label}</small>
                      <strong>{stat.value}</strong>
                      <p>
                        {stat.trend_pct !== undefined && (
                          <>
                            <b>
                              <Icon name="trend" size={14} /> {formatPct(stat.trend_pct)}
                            </b>{' '}
                          </>
                        )}
                        {stat.caption}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        <div className="info-note">
          <Icon name="info" size={18} />
          <p>
            <strong>Como esses dados são usados?</strong> No futuro, modelos de análise ajudarão a
            identificar regiões com queda na qualidade do atendimento. Toda análise será baseada em
            dados públicos oficiais, com transparência e sem substituir avaliações de profissionais
            de saúde.
          </p>
        </div>
      </section>

      {/* 6. FONTES OFICIAIS */}
      <section className="sources" id="fontes">
        <div className="section-width">
          <div className="sources-copy">
            <span>
              <Icon name="shield" size={17} /> DADOS CONFIÁVEIS
            </span>
            <h2>Informação que vem de fontes oficiais</h2>
            <p>
              Os dados são consultados diretamente das bases públicas do Ministério da Saúde e
              apresentados de forma acessível.
            </p>
          </div>

          {sourcesQuery.isError ? (
            <ErrorState
              error={sourcesQuery.error}
              onRetry={() => void sourcesQuery.refetch()}
              fallbackTitle="Não foi possível carregar as fontes oficiais"
            />
          ) : (
            <div className="source-logos">
              {(sourcesQuery.data ?? []).map((src) => (
                <div key={src.id}>
                  <strong>{src.name}</strong>
                  <small>{src.subtitle}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
