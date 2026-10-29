import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import { EmptyState, ErrorState, ProvenanceTags, Skeleton } from '../components/ui/States';
import {
  useConditionCategories,
  useConditions,
} from '../features/conditions/useConditions';
import {
  useMedicationCategories,
  useMedications,
} from '../features/medications/useMedications';
import { useGlobalSearch } from '../features/search/useGlobalSearch';
import { useDebounce } from '../hooks/useDebounce';
import { FALLBACK_CARD_IMAGE } from '../utils/format';

export function DirectoryPage({ kind }: { kind: 'medications' | 'conditions' }) {
  const isMedications = kind === 'medications';
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [searchInput, setSearchInput] = useState<string>('');
  const [submittedSearch, setSubmittedSearch] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchInput, 300);
  const effectiveQuery = (submittedSearch ?? debouncedSearch).trim();

  const medCategoriesQuery = useMedicationCategories();
  const condCategoriesQuery = useConditionCategories();
  const categoriesQuery = isMedications ? medCategoriesQuery : condCategoriesQuery;

  const queryParams = {
    q: effectiveQuery || undefined,
    category: selectedCategory === 'todos' ? undefined : selectedCategory,
  };

  const medicationsQuery = useMedications(isMedications ? queryParams : {});
  const conditionsQuery = useConditions(!isMedications ? queryParams : {});

  // Quando há texto na busca dedicada, consulta também GET /search?type=medications|conditions (Q4)
  // para receber fallback seguro de IA (US-02.1 / US-03.1) e categorias sugeridas.
  const aiSearchQuery = useGlobalSearch({
    q: effectiveQuery,
    type: isMedications ? 'medications' : 'conditions',
  });

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmittedSearch(searchInput.trim());
  };

  const handleInputChange = (val: string) => {
    setSearchInput(val);
    setSubmittedSearch(null);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSubmittedSearch(null);
    setSelectedCategory('todos');
  };

  const categories = categoriesQuery.data ?? [];
  const aiFallback = effectiveQuery.length >= 2 ? aiSearchQuery.data?.fallback : null;
  const suggestedCategories =
    effectiveQuery.length >= 2 ? (aiSearchQuery.data?.suggested_categories ?? []) : [];
  const matchedTerm =
    effectiveQuery.length >= 2 ? aiSearchQuery.data?.matched_term : undefined;

  // Se o modelo de IA bloqueou recomendação prescritiva de medicamento (US-02.1) ou
  // detectou risco clínico/baixa confiança (US-03.1), não exibimos resultados prescritivos.
  const isPrescriptiveBlocked = Boolean(aiFallback);

  const isLoading = isMedications ? medicationsQuery.isLoading : conditionsQuery.isLoading;
  const isError = isMedications ? medicationsQuery.isError : conditionsQuery.isError;
  const error = isMedications ? medicationsQuery.error : conditionsQuery.error;
  const refetch = isMedications ? medicationsQuery.refetch : conditionsQuery.refetch;

  const rawMedications = medicationsQuery.data?.items ?? [];
  const rawConditions = conditionsQuery.data?.items ?? [];

  const totalCount = isPrescriptiveBlocked
    ? 0
    : isMedications
      ? (medicationsQuery.data?.total ?? rawMedications.length)
      : (conditionsQuery.data?.total ?? rawConditions.length);

  const pageMeta = isMedications ? medicationsQuery.data?.meta : conditionsQuery.data?.meta;

  return (
    <div className="directory-page">
      <section className="directory-hero">
        <div className="section-width">
          <span className="directory-kicker">
            <Icon name={isMedications ? 'pill' : 'heart'} size={17} /> GUIA DE SAÚDE
          </span>
          <h1>{isMedications ? 'Medicamentos' : 'Doenças e sintomas'}</h1>
          <p>
            {isMedications
              ? 'Consulte informações sobre indicações, efeitos colaterais e cuidados no uso de medicamentos.'
              : 'Encontre informações confiáveis para reconhecer sintomas, prevenir doenças e saber quando buscar atendimento.'}
          </p>
          <form className="directory-search" role="search" onSubmit={handleSearchSubmit}>
            <Icon name="search" />
            <input
              value={searchInput}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={
                isMedications
                  ? 'Busque pelo nome do medicamento...'
                  : 'Busque uma doença, alergia ou sintoma...'
              }
              aria-label={
                isMedications
                  ? 'Buscar medicamento pelo nome'
                  : 'Buscar doença, alergia ou sintoma'
              }
            />
            <button type="submit">Pesquisar</button>
          </form>
        </div>
      </section>

      <section className="directory-content section-width">
        {aiFallback && (
          <div className="search-fallback directory-ai-fallback" role="alert">
            <Icon name="info" size={18} />
            <div>
              <strong>{aiFallback.message}</strong>
              {aiFallback.code === 'SYMPTOM_ON_MEDICATION_SEARCH' ? (
                <p>
                  O portal não recomenda medicamentos a partir de relatos de sintomas. Você pode
                  explorar as categorias informativas abaixo ou procurar orientação em uma UBS.
                </p>
              ) : (
                <p>
                  Para avaliação segura, procure atendimento presencial em uma{' '}
                  <Link to="/unidades">Unidade Básica de Saúde (UBS)</Link> ou ligue 192 (SAMU) em
                  emergências.
                </p>
              )}
              {suggestedCategories.length > 0 && (
                <div className="suggested-categories">
                  <span>Categorias sugeridas:</span>
                  {suggestedCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setSearchInput('');
                        setSubmittedSearch(null);
                      }}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {matchedTerm && !aiFallback && (
          <div className="search-matched-term" role="status">
            <Icon name="check" size={15} /> Termo interpretado como:{' '}
            <strong>{matchedTerm}</strong>
          </div>
        )}

        <div className="directory-toolbar">
          <div>
            <strong>Explore por categoria</strong>
            <span>
              {totalCount} conteúdos disponíveis <ProvenanceTags meta={pageMeta} />
            </span>
          </div>

          <div className="filter-pills" role="tablist" aria-label="Categorias">
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === 'todos'}
              className={selectedCategory === 'todos' ? 'active' : ''}
              onClick={() => setSelectedCategory('todos')}
            >
              Todos
            </button>
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={isActive ? 'active' : ''}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="content-grid" aria-label="Carregando conteúdos">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <Skeleton key={n} style={{ height: 280 }} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            error={error}
            onRetry={() => void refetch()}
            fallbackTitle={
              isMedications
                ? 'Não foi possível carregar a lista de medicamentos'
                : 'Não foi possível carregar a lista de doenças e sintomas'
            }
          />
        ) : isPrescriptiveBlocked ? null : isMedications ? (
          rawMedications.length === 0 ? (
            <EmptyState
              title="Nenhum medicamento encontrado"
              description="Tente buscar por outro termo ou selecione 'Todos' nas categorias."
              actionLabel="Limpar filtros"
              onAction={handleClearFilters}
            />
          ) : (
            <div className="content-grid">
              {rawMedications.map((med) => (
                <article key={med.id} className="content-card">
                  <div className="content-image">
                    <img
                      src={med.image_url ?? FALLBACK_CARD_IMAGE}
                      alt={med.image_alt ?? med.name}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = FALLBACK_CARD_IMAGE;
                      }}
                    />
                    <span>{med.tag}</span>
                  </div>
                  <div className="content-card-copy">
                    <small>MEDICAMENTO</small>
                    <h2>{med.name}</h2>
                    <p>{med.subtitle}</p>
                    <Link to={`/medicamentos/${med.id}`}>
                      Ver informações completas <Icon name="arrow" size={16} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )
        ) : rawConditions.length === 0 ? (
          <EmptyState
            title="Nenhum conteúdo encontrado"
            description="Tente buscar por outro sintoma ou selecione 'Todos' nas categorias."
            actionLabel="Limpar filtros"
            onAction={handleClearFilters}
          />
        ) : (
          <div className="content-grid">
            {rawConditions.map((cond) => (
              <article key={cond.id} className="content-card">
                <div className="content-image">
                  <img
                    src={cond.image_url ?? FALLBACK_CARD_IMAGE}
                    alt={cond.image_alt ?? cond.popular_name}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = FALLBACK_CARD_IMAGE;
                    }}
                  />
                  <span>{cond.tag}</span>
                </div>
                <div className="content-card-copy">
                  <small>SAÚDE E BEM-ESTAR</small>
                  <h2>{cond.popular_name}</h2>
                  <p>{cond.subtitle}</p>
                  <Link to={`/doencas/${cond.id}`}>
                    Ver informações completas <Icon name="arrow" size={16} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="medical-warning">
          <Icon name="info" />
          <p>
            <strong>Informação para cuidar melhor da sua saúde.</strong> Este conteúdo tem caráter
            educativo e não substitui diagnóstico, prescrição ou acompanhamento de profissionais de
            saúde.
          </p>
        </div>
      </section>
    </div>
  );
}
