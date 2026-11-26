import type { SearchSuggestion } from '../../api/types';
import { foiCorrigido, outrasSugestoes } from '../../utils/busca';
import { Icon } from '../ui/Icon';

/**
 * "Você quis dizer…?" (issue #64).
 *
 * O back-end corrige erros de digitação (busca aproximada) e devolve o termo reconhecido
 * (`matched_term`) e as sugestões (`suggestions`). Quando o termo reconhecido não contém o que
 * foi digitado, houve correção: mostramos o termo como botão para refazer a busca com ele.
 */

interface DidYouMeanProps {
  query: string;
  matchedTerm?: string;
  suggestions?: SearchSuggestion[];
  onPick: (termo: string) => void;
  className?: string;
}

/** Só renderiza quando houve correção; caso contrário devolve `null`. */
export function DidYouMean({
  query,
  matchedTerm,
  suggestions,
  onPick,
  className,
}: DidYouMeanProps) {
  if (!foiCorrigido(query, matchedTerm)) return null;
  const outras = outrasSugestoes(matchedTerm, suggestions);

  return (
    <div className={`did-you-mean${className ? ` ${className}` : ''}`} role="status">
      <Icon name="search" size={15} />
      <span>
        Você quis dizer{' '}
        <button type="button" className="did-you-mean-term" onClick={() => onPick(matchedTerm)}>
          {matchedTerm}
        </button>
        ?
      </span>
      {outras.length > 0 && (
        <span className="did-you-mean-others">
          Outras sugestões:{' '}
          {outras.map((rotulo, i) => (
            <span key={rotulo}>
              {i > 0 && ' · '}
              <button type="button" onClick={() => onPick(rotulo)}>
                {rotulo}
              </button>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
