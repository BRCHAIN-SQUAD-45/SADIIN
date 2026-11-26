import re
import unicodedata
from difflib import SequenceMatcher
from typing import Iterable


def normalize_search_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.casefold())
    without_accents = "".join(
        character for character in normalized if not unicodedata.combining(character)
    )
    return " ".join(re.sub(r"[^a-z0-9]+", " ", without_accents).split())


def fuzzy_threshold(query: str) -> float:
    length = len(normalize_search_text(query).replace(" ", ""))
    if length < 3:
        return 1.0
    if length < 5:
        return 0.82
    if length < 7:
        return 0.72
    return 0.66


def similarity(query: str, candidate: str) -> float:
    normalized_query = normalize_search_text(query)
    normalized_candidate = normalize_search_text(candidate)
    if not normalized_query or not normalized_candidate:
        return 0.0
    if normalized_query in normalized_candidate:
        return 1.0
    if normalized_candidate.startswith(normalized_query):
        return 0.92

    query_tokens = normalized_query.split()
    candidate_tokens = normalized_candidate.split()
    comparisons = [SequenceMatcher(None, normalized_query, normalized_candidate).ratio()]
    meaningful_query_tokens = [
        token for token in query_tokens if len(token) >= 3 or token.isdigit()
    ]
    if len(meaningful_query_tokens) > 1:
        token_scores = []
        for query_token in meaningful_query_tokens:
            if query_token.isdigit():
                token_scores.append(
                    1.0 if query_token in candidate_tokens else 0.0
                )
                continue
            token_scores.append(
                max(
                    (
                        SequenceMatcher(None, query_token, candidate_token).ratio()
                        for candidate_token in candidate_tokens
                        if len(candidate_token) >= 3 and not candidate_token.isdigit()
                    ),
                    default=0.0,
                )
            )
        comparisons.append(sum(token_scores) / len(token_scores))
    else:
        comparisons.extend(
            SequenceMatcher(None, query_token, candidate_token).ratio()
            for query_token in meaningful_query_tokens
            for candidate_token in candidate_tokens
            if min(len(query_token), len(candidate_token)) >= 3
        )
    return max(comparisons)


def rank_fuzzy_candidates(
    query: str,
    candidates: Iterable[tuple[str, str, Iterable[str]]],
    *,
    limit: int = 5,
) -> list[dict]:
    normalized_query = normalize_search_text(query)
    if len(normalized_query.replace(" ", "")) < 3 or limit < 1:
        return []

    threshold = fuzzy_threshold(normalized_query)
    best_by_label: dict[str, dict] = {}
    for candidate_id, label, aliases in candidates:
        normalized_label = normalize_search_text(label)
        score = max(
            (similarity(normalized_query, alias) for alias in (label, *aliases)),
            default=0.0,
        )
        if score >= threshold:
            current = best_by_label.get(normalized_label)
            if current is None or score > current["score"]:
                best_by_label[normalized_label] = {
                    "id": candidate_id,
                    "label": label,
                    "score": score,
                }

    ranked = list(best_by_label.values())
    ranked.sort(
        key=lambda result: (
            -result["score"],
            len(normalize_search_text(result["label"]).split()),
            len(normalize_search_text(result["label"])),
            normalize_search_text(result["label"]),
        )
    )
    return [
        {**result, "score": round(result["score"], 3)}
        for result in ranked[:limit]
    ]
