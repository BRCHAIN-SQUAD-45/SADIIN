import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import { ErrorState, ProvenanceTags, Skeleton } from '../components/ui/States';
import { useConditionDetail } from '../features/conditions/useConditions';
import { FALLBACK_CARD_IMAGE } from '../utils/format';

export function ConditionDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { data: cond, isLoading, isError, error, refetch } = useConditionDetail(id);

  return (
    <div className="directory-page">
      <section className="units-top">
        <div className="section-width">
          <div className="unit-breadcrumb">
            <Link to="/">Início</Link> <span>›</span>{' '}
            <Link to="/doencas">Doenças e sintomas</Link> <span>›</span>{' '}
            <span>{cond?.popular_name ?? 'Detalhes'}</span>
          </div>
          <div className="units-heading">
            <div>
              <span className="directory-kicker">
                <Icon name="heart" size={17} /> GUIA DE SAÚDE
              </span>
              <h1>{cond?.popular_name ?? 'Carregando condição...'}</h1>
              <p>{cond?.subtitle ?? 'Orientações oficiais de prevenção e cuidado.'}</p>
            </div>
            <Link to="/doencas" className="detail-back-link">
              Voltar para doenças e sintomas
            </Link>
          </div>
        </div>
      </section>

      <div className="unit-content section-width">
        {isLoading ? (
          <div className="unit-details-grid" aria-label="Carregando detalhes da condição">
            <Skeleton style={{ height: 220 }} />
            <Skeleton style={{ height: 220 }} />
          </div>
        ) : isError || !cond ? (
          <ErrorState
            error={error}
            onRetry={() => void refetch()}
            fallbackTitle="Não foi possível carregar as informações desta condição"
          />
        ) : (
          <>
            <section className="unit-profile">
              <div className="detail-thumb">
                <img
                  src={cond.image_url ?? FALLBACK_CARD_IMAGE}
                  alt={cond.image_alt ?? cond.popular_name}
                  onError={(e) => {
                    e.currentTarget.src = FALLBACK_CARD_IMAGE;
                  }}
                />
              </div>
              <div className="unit-identity">
                <div className="detail-badges">
                  <span className="open-badge">{cond.tag}</span>
                  {cond.cid10_code && (
                    <span className="provenance-tag">CID-10: {cond.cid10_code}</span>
                  )}
                  <ProvenanceTags meta={cond.meta} />
                </div>
                <h2>{cond.popular_name}</h2>
                <p>{cond.subtitle}</p>
              </div>
              <div className="unit-actions">
                <Link to="/unidades" className="primary">
                  <Icon name="hospital" size={16} /> Buscar atendimento em UBS
                </Link>
              </div>
            </section>

            <section className="unit-details-grid">
              <article className="unit-panel detail-list-panel">
                <div className="unit-panel-head">
                  <div>
                    <h2>Principais sintomas</h2>
                    <p>Sinais mais frequentes relatados</p>
                  </div>
                </div>
                <ul className="detail-list">
                  {cond.main_symptoms.map((symptom) => (
                    <li key={symptom}>{symptom}</li>
                  ))}
                </ul>
              </article>

              <article className="unit-panel detail-list-panel">
                <div className="unit-panel-head">
                  <div>
                    <h2>Formas de prevenção</h2>
                    <p>Medidas recomendadas pelo Ministério da Saúde</p>
                  </div>
                </div>
                <ul className="detail-list">
                  {cond.prevention.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </section>

            <section className="unit-details-grid">
              <article className="unit-panel detail-list-panel">
                <div className="unit-panel-head">
                  <div>
                    <h2>Cuidado e tratamento oficial</h2>
                    <p>Condutas orientadas na Atenção Primária (SUS)</p>
                  </div>
                </div>
                <ul className="detail-list">
                  {cond.treatment.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>

              <article className="unit-panel contact-card">
                <div className="unit-panel-head">
                  <div>
                    <h2>Quando procurar atendimento</h2>
                    <p>Orientação segura no SUS</p>
                  </div>
                </div>
                <p>
                  <Icon name="hospital" size={16} />
                  <span>
                    <small>UNIDADE BÁSICA DE SAÚDE (UBS)</small>
                    Procure uma UBS se os sintomas persistirem ou se agravarem. Em caso de urgência,
                    ligue 192 (SAMU).
                  </span>
                </p>
              </article>
            </section>

            <div className="medical-warning">
              <Icon name="info" />
              <p>
                <strong>Informação para cuidar melhor da sua saúde.</strong> Este conteúdo tem
                caráter educativo e não substitui diagnóstico, prescrição ou acompanhamento de
                profissionais de saúde.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
