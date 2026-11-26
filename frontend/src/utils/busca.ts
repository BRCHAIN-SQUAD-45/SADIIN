import type { SearchSuggestion } from '../api/types';

/** Funções do "Você quis dizer…?" (issue #64), separadas do componente para testar isoladamente. */

const MAX_OUTRAS_SUGESTOES = 3;

export function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Houve correção quando o termo reconhecido não contém o texto digitado ("dprirona" -> "Dipirona"). */
export function foiCorrigido(consulta: string, termo?: string): termo is string {
  if (!termo) return false;
  const digitado = normalizarBusca(consulta);
  return digitado.length > 0 && !normalizarBusca(termo).includes(digitado);
}

export function outrasSugestoes(
  termo: string | undefined,
  sugestoes: SearchSuggestion[] | undefined,
): string[] {
  const vistos = new Set(termo ? [normalizarBusca(termo)] : []);
  const rotulos: string[] = [];
  for (const sugestao of sugestoes ?? []) {
    const chave = normalizarBusca(sugestao.label);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    rotulos.push(sugestao.label);
    if (rotulos.length === MAX_OUTRAS_SUGESTOES) break;
  }
  return rotulos;
}
