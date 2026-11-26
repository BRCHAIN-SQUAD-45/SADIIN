"""Índice de busca em memória para catálogos grandes (issue #64).

Problema: a busca tolerante a erros comparava a palavra digitada com TODOS os registros do
catálogo da ANVISA (~6.500 grupos e seus apelidos) usando SequenceMatcher em toda busca, o
que levava de 5 a 30 s por requisição.

Solução: o índice é montado uma vez por carga do catálogo e guarda
- o texto normalizado de cada registro (para a busca por trecho exato, sem renormalizar);
- o vocabulário (palavra -> registros que a contêm).

Na busca aproximada, cada palavra digitada é comparada só com o VOCABULÁRIO
(`difflib.get_close_matches`, alguns milhares de palavras, rápido) e o ranking final
(`rank_fuzzy_candidates`, com o critério de nota original) roda apenas nos poucos registros
que contêm as palavras parecidas.
"""

from bisect import bisect_left
from collections.abc import Hashable, Iterable
from difflib import get_close_matches

from app.search.fuzzy import fuzzy_threshold, normalize_search_text

MIN_TOKEN = 3
PALAVRAS_PARECIDAS_POR_TOKEN = 8
PALAVRAS_POR_PREFIXO = 40
MAX_CANDIDATOS = 400


class IndiceBusca:
    def __init__(self, entradas: Iterable[tuple[Hashable, Iterable[str]]]):
        """`entradas`: (id do registro, textos pesquisáveis desse registro)."""
        self.texto: dict[Hashable, str] = {}
        self.vocabulario: dict[str, set[Hashable]] = {}
        for registro_id, textos in entradas:
            normalizados = [normalize_search_text(t) for t in textos if t]
            # " | " separa os campos para um trecho não "atravessar" de um campo para o outro.
            self.texto[registro_id] = " | ".join(n for n in normalizados if n)
            for normalizado in normalizados:
                for palavra in normalizado.split():
                    if len(palavra) >= MIN_TOKEN and not palavra.isdigit():
                        self.vocabulario.setdefault(palavra, set()).add(registro_id)
        self._palavras = sorted(self.vocabulario)

    def contem_trecho(self, consulta: str) -> set[Hashable]:
        """Registros cujo texto contém a consulta normalizada (busca exata por trecho)."""
        alvo = normalize_search_text(consulta)
        if not alvo:
            return set(self.texto)
        return {registro_id for registro_id, texto in self.texto.items() if alvo in texto}

    def _por_prefixo(self, palavra: str) -> list[str]:
        inicio = bisect_left(self._palavras, palavra)
        encontradas = []
        for candidata in self._palavras[inicio : inicio + PALAVRAS_POR_PREFIXO]:
            if not candidata.startswith(palavra):
                break
            encontradas.append(candidata)
        return encontradas

    def candidatos_aproximados(self, consulta: str) -> set[Hashable]:
        """Registros que têm palavras iguais, com o mesmo começo ou parecidas com as digitadas."""
        palavras = [
            p for p in normalize_search_text(consulta).split() if len(p) >= MIN_TOKEN and not p.isdigit()
        ]
        # Para cada palavra digitada: os registros que têm alguma palavra igual/parecida a ela.
        registros_por_palavra: list[set[Hashable]] = []
        for palavra in palavras:
            parecidas = set(self._por_prefixo(palavra))
            if palavra in self.vocabulario:
                parecidas.add(palavra)
            # Corte um pouco abaixo do limite final: o ranking original decide no fim.
            corte = max(0.55, fuzzy_threshold(palavra) - 0.08)
            parecidas.update(
                get_close_matches(palavra, self._palavras, n=PALAVRAS_PARECIDAS_POR_TOKEN, cutoff=corte)
            )
            registros: set[Hashable] = set()
            for parecida in parecidas:
                registros |= self.vocabulario[parecida]
            registros_por_palavra.append(registros)

        candidatos: set[Hashable] = set().union(*registros_por_palavra)
        if len(candidatos) > MAX_CANDIDATOS:
            # Palavra muito comum: ficam os registros que batem com mais palavras digitadas.
            def acertos(registro_id: Hashable) -> int:
                return sum(registro_id in registros for registros in registros_por_palavra)

            candidatos = set(sorted(candidatos, key=acertos, reverse=True)[:MAX_CANDIDATOS])
        return candidatos
