import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import { ErrorState, ProvenanceTags, Skeleton } from '../components/ui/States';
import { useMedicationDetail } from '../features/medications/useMedications';
import { FALLBACK_CARD_IMAGE } from '../utils/format';

export function MedicationDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { data: med, isLoading, isError, error, refetch } = useMedicationDetail(id);

  return (
    <div className="directory-page">
      <section className="units-top">
        <div className="section-width">
          <div className="unit-breadcrumb">
            <Link to="/">Início</Link> <span>›</span>{' '}
            <Link to="/medicamentos">Medicamentos</Link> <span>›</span>{' '}
            <span>{med?.name ?? 'Detalhes'}</span>
          </div>
          <div className="units-heading">
            <div>
              <span className="directory-kicker">
                <Icon name="pill" size={17} /> GUIA DE MEDICAMENTOS
              </span>
              <h1>{med?.name ?? 'Carregando medicamento...'}</h1>
              <p>{med?.subtitle ?? 'Informações oficiais do bulário eletrônico.'}</p>
            </div>
            <Link to="/medicamentos" className="detail-back-link">
              Voltar para medicamentos
            </Link>
          </div>
        </div>
      </section>

      <div className="unit-content section-width">
        {isLoading ? (
          <div className="unit-details-grid" aria-label="Carregando detalhes do medicamento">
            <Skeleton style={{ height: 220 }} />
            <Skeleton style={{ height: 220 }} />
          </div>
        ) : isError || !med ? (
          <ErrorState
            error={error}
            onRetry={() => void refetch()}
            fallbackTitle="Não foi possível carregar as informações deste medicamento"
          />
        ) : (
          <>
            <section className="unit-profile">
              <div className="detail-thumb">
                <img
                  src={med.image_url ?? FALLBACK_CARD_IMAGE}
                  alt={med.image_alt ?? med.name}
                  onError={(e) => {
                    e.currentTarget.src = FALLBACK_CARD_IMAGE;
                  }}
                />
              </div>
              <div className="unit-identity">
                <div className="detail-badges">
                  <span className="open-badge">{med.tag}</span>
                  {med.requires_prescription && (
                    <span className="provenance-tag">Requer receita médica</span>
                  )}
                  {med.adult_use && <span className="open-badge">Uso adulto</span>}
                  <ProvenanceTags meta={med.meta} />
                </div>
                <h2>{med.name}</h2>
                <p>{med.subtitle}</p>
              </div>
              <div className="unit-actions">
                {med.leaflet_url && (
                  <a
                    href={med.leaflet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="primary"
                  >
                    <Icon name="database" size={16} /> Consultar bula oficial (ANVISA)
                  </a>
                )}
              </div>
            </section>

            <section className="unit-details-grid">
              <article className="unit-panel detail-list-panel">
                <div className="unit-panel-head">
                  <div>
                    <h2>Indicações principais</h2>
                    <p>Para que este medicamento é utilizado</p>
                  </div>
                </div>
                <ul className="detail-list">
                  {med.indications.length > 0 ? (
                    med.indications.map((item) => <li key={item}>{item}</li>)
                  ) : (
                    <li>Consulte a bula oficial para indicações detalhadas.</li>
                  )}
                </ul>
              </article>

              <article className="unit-panel detail-list-panel">
                <div className="unit-panel-head">
                  <div>
                    <h2>Contraindicações e cuidados</h2>
                    <p>Situações em que o uso não é recomendado</p>
                  </div>
                </div>
                <ul className="detail-list">
                  {(med.contraindications ?? []).length > 0 ? (
                    med.contraindications?.map((item) => <li key={item}>{item}</li>)
                  ) : (
                    <li>Consulte um profissional de saúde antes de iniciar o uso.</li>
                  )}
                </ul>
              </article>
            </section>

            <section className="unit-details-grid">
              <article className="unit-panel detail-list-panel">
                <div className="unit-panel-head">
                  <div>
                    <h2>Reações adversas mais comuns</h2>
                    <p>Efeitos colaterais descritos em bula</p>
                  </div>
                </div>
                <ul className="detail-list">
                  {(med.side_effects ?? []).length > 0 ? (
                    med.side_effects?.map((item) => <li key={item}>{item}</li>)
                  ) : (
                    <li>Informe ao profissional de saúde qualquer reação indesejada.</li>
                  )}
                </ul>
              </article>

              <article className="unit-panel contact-card">
                <div className="unit-panel-head">
                  <div>
                    <h2>Onde retirar pelo SUS</h2>
                    <p>Farmácia Básica nas Unidades de Saúde</p>
                  </div>
                </div>
                <p>
                  <Icon name="hospital" size={16} />
                  <span>
                    <small>DISPONIBILIDADE NA REDE</small>
                    Consulte a UBS mais próxima com documento oficial e receita médica vigente.
                  </span>
                </p>
                <p>
                  <Link to="/unidades" className="detail-inline-cta">
                    Encontrar UBS próxima <Icon name="arrow" size={15} />
                  </Link>
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
