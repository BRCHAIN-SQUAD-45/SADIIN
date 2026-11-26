import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DidYouMean } from './DidYouMean';
import { foiCorrigido, normalizarBusca, outrasSugestoes } from '../../utils/busca';
import type { SearchSuggestion } from '../../api/types';

const sugestoes: SearchSuggestion[] = [
  { id: 'dipirona', label: 'Dipirona', kind: 'medication', score: 0.88 },
  { id: 'dipirona-mono', label: 'Dipirona Monoidratada', kind: 'medication', score: 0.88 },
  { id: 'dipirona-mono-2', label: 'dipirona monoidratada', kind: 'medication', score: 0.87 },
  { id: 'dipirona-cafeina', label: 'Dipirona, Cafeína', kind: 'medication', score: 0.86 },
  { id: 'dipirona-x', label: 'Dipirona X', kind: 'medication', score: 0.85 },
];

describe('busca tolerante a erros — "Você quis dizer" (issue #64)', () => {
  it('normaliza sem acento, caixa e pontuação', () => {
    expect(normalizarBusca('  Pressão-ALTA! ')).toBe('pressao alta');
  });

  it('só considera correção quando o termo não contém o que foi digitado', () => {
    expect(foiCorrigido('dprirona', 'Dipirona')).toBe(true);
    expect(foiCorrigido('pressao auta', 'Hipertensão (pressão alta)')).toBe(true);
    // Digitou certo (ou parte do nome): não é correção.
    expect(foiCorrigido('dipirona', 'Dipirona')).toBe(false);
    expect(foiCorrigido('pressão alta', 'Hipertensão (pressão alta)')).toBe(false);
    expect(foiCorrigido('dprirona', undefined)).toBe(false);
  });

  it('lista outras sugestões sem repetir o termo nem nomes iguais, no máximo 3', () => {
    expect(outrasSugestoes('Dipirona', sugestoes)).toEqual([
      'Dipirona Monoidratada',
      'Dipirona, Cafeína',
      'Dipirona X',
    ]);
  });

  it('mostra o termo corrigido como botão e refaz a busca ao clicar', async () => {
    const onPick = vi.fn();
    render(
      <DidYouMean
        query="dprirona"
        matchedTerm="Dipirona"
        suggestions={sugestoes}
        onPick={onPick}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Você quis dizer Dipirona?');
    await userEvent.click(screen.getByRole('button', { name: 'Dipirona' }));
    expect(onPick).toHaveBeenCalledWith('Dipirona');

    await userEvent.click(screen.getByRole('button', { name: 'Dipirona, Cafeína' }));
    expect(onPick).toHaveBeenLastCalledWith('Dipirona, Cafeína');
  });

  it('não mostra nada quando a palavra foi digitada certa', () => {
    const { container } = render(
      <DidYouMean
        query="Dipirona"
        matchedTerm="Dipirona"
        suggestions={sugestoes}
        onPick={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
