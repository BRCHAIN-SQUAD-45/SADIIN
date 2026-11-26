import { useEffect } from 'react';
import { getEnv } from '../../config/env';
import { useMeta } from '../../features/meta/useMeta';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { formatGovDate } from '../../utils/format';
import { Icon } from '../ui/Icon';

const A11Y_KEY = 'brchain.a11y';
const FONT_SCALE_KEY = 'brchain.fontScale';

export type FontScaleMode = 'normal' | 'large' | 'xlarge';

function validateFontScale(v: unknown): FontScaleMode | null {
  return v === 'normal' || v === 'large' || v === 'xlarge' ? v : null;
}

export function GovBar() {
  const { isMock } = getEnv();
  const meta = useMeta();
  const [a11y, setA11y] = useLocalStorage<boolean>(A11Y_KEY, false, (v) =>
    typeof v === 'boolean' ? v : null,
  );
  const [fontScale, setFontScale] = useLocalStorage<FontScaleMode>(
    FONT_SCALE_KEY,
    'normal',
    validateFontScale,
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-a11y', a11y ? 'true' : 'false');
  }, [a11y]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font-scale', fontScale);
  }, [fontScale]);

  const updatedAt = meta.data?.data_updated_at;
  const updatedLabel = updatedAt
    ? `Dados atualizados em ${formatGovDate(updatedAt)}`
    : 'Dados públicos oficiais';

  return (
    <>
      <a href="#conteudo-principal" className="skip-link">
        Pular para o conteúdo principal
      </a>
      <div className="gov-bar">
        <div>
          <strong>BRASIL</strong>
          <span>Portal de dados públicos em saúde</span>
        </div>
        <div>
          <button
            type="button"
            aria-pressed={a11y}
            onClick={() => setA11y(!a11y)}
            title="Alternar modo de alto contraste e fonte ampliada (115%)"
          >
            <Icon name="accessibility" size={16} /> Acessibilidade
          </button>
          <div className="a11y-font-controls" role="group" aria-label="Tamanho da fonte">
            <button
              type="button"
              className={fontScale === 'normal' ? 'active' : ''}
              aria-pressed={fontScale === 'normal'}
              aria-label="Fonte padrão (100%)"
              title="Fonte padrão (100%)"
              onClick={() => setFontScale('normal')}
            >
              A
            </button>
            <button
              type="button"
              className={fontScale === 'large' ? 'active' : ''}
              aria-pressed={fontScale === 'large'}
              aria-label="Aumentar fonte (115%)"
              title="Aumentar fonte (115%)"
              onClick={() => setFontScale('large')}
            >
              A+
            </button>
            <button
              type="button"
              className={fontScale === 'xlarge' ? 'active' : ''}
              aria-pressed={fontScale === 'xlarge'}
              aria-label="Fonte extra grande (130%)"
              title="Fonte extra grande (130%)"
              onClick={() => setFontScale('xlarge')}
            >
              A++
            </button>
          </div>
          <i />
          <span>{updatedLabel}</span>
          {isMock && (
            <span className="demo-pill" title="Ambiente com dados simulados (VITE_DATA_MODE=mock)">
              Dados de demonstração
            </span>
          )}
        </div>
      </div>
      {isMock && <span className="demo-floating">Dados de demonstração</span>}
    </>
  );
}
