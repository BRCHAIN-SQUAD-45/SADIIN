import unittest
from unittest.mock import AsyncMock, patch

from app.integrations.anvisa import _group_records, _to_record, listar_medicamentos
from app.search.fuzzy import rank_fuzzy_candidates, similarity


class FuzzySearchTests(unittest.TestCase):
    def test_corrects_transposition_and_typo_in_medicine_name(self):
        suggestions = rank_fuzzy_candidates(
            "dprirona",
            [("dipirona", "Dipirona", ["metamizol sódico"])],
        )

        self.assertEqual(suggestions[0]["label"], "Dipirona")
        self.assertGreaterEqual(suggestions[0]["score"], 0.8)

    def test_prefers_single_ingredient_over_combination_products(self):
        suggestions = rank_fuzzy_candidates(
            "diprirona",
            [
                (
                    "combo",
                    "Brometo De Escopolamina, Dipirona",
                    ["Butilbrometo de escopolamina + dipirona"],
                ),
                ("dipirona", "Dipirona", ["Dipirona"]),
            ],
        )

        self.assertEqual(suggestions[0]["id"], "dipirona")
        self.assertEqual(suggestions[0]["label"], "Dipirona")

    def test_matches_accented_aliases_without_accent(self):
        self.assertEqual(similarity("rinite alergica", "Rinite alérgica"), 1.0)

    def test_numeric_presentation_tokens_must_match(self):
        score = similarity("dipirona 500 mg", "dipirona 250 mg comprimidos")

        self.assertLess(score, 0.8)

    def test_does_not_suggest_for_short_or_unrelated_queries(self):
        candidates = [("dipirona", "Dipirona", [])]

        self.assertEqual(rank_fuzzy_candidates("di", candidates), [])
        self.assertEqual(rank_fuzzy_candidates("xqzvnm", candidates), [])


class AnvisaFuzzySearchTests(unittest.IsolatedAsyncioTestCase):
    async def test_medication_listing_falls_back_to_fuzzy_results(self):
        source_record = _to_record(
            {
                "CO_SEQ_PRODUTO": "dipirona",
                "NO_PRODUTO": "DIPIRONA 500 mg COMPRIMIDO",
                "CO_TIPO_PRODUTO": "1",
                "TIPO_AUTORIZACAO": "Registrado",
                "VALIDADE_SITUACAO": "Ativo",
                "CO_ATC": "N02",
                "CO_FORMA_FISICA": "1",
                "SUBSTANCIAS_MEDICAMENTOS": "DIPIRONA",
                "NO_RAZAO_SOCIAL_EMPRESA": "Laboratório A",
            }
        )
        records = _group_records([source_record])

        with patch(
            "app.integrations.anvisa._load_records",
            new=AsyncMock(return_value=records),
        ):
            matches = await listar_medicamentos("dprirona", None)

        self.assertEqual([record["name"] for record in matches], ["Dipirona"])
