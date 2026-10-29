import { useEffect } from 'react';
import { getEnv } from '../../config/env';
import { useMeta } from '../../features/meta/useMeta';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { formatGovDate } from '../../utils/format';
import { Icon } from '../ui/Icon';

const A11Y_KEY = 'brchain.a11y';

export function GovBar() {
  const { isMock } = getEnv();
  const meta = useMeta();
  const [a11y, setA11y] = useLocalStorage<boolean>(A11Y_KEY, false, (v) =>
    typeof v === 'boolean' ? v : null,
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-a11y', a11y ? 'true' : 'false');
  }, [a11y]);

  const updatedLabel = meta.data
    ? `Dados atualizados em ${formatGovDate(meta.data.data_updated_at)}`
    : 'Dados públicos oficiais';

  return (
    <>
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
            title="Alternar modo de alto contraste e fonte ampliada (125%)"
          >
            <Icon name="accessibility" size={16} /> Acessibilidade
          </button>
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
