import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch
from urllib.parse import urlsplit

import httpx
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.testclient import TestClient

from app.api.routers import conditions, dashboard, medications
from app.integrations.anvisa import _group_records, _to_record


def anvisa_row(
    product_id: str,
    name: str,
    manufacturer: str,
    active_ingredient: str = "ACEBROFILINA",
) -> dict[str, str]:
    return {
        "CO_SEQ_PRODUTO": product_id,
        "NO_PRODUTO": name,
        "CO_TIPO_PRODUTO": "1",
        "TIPO_AUTORIZACAO": "Registrado",
        "VALIDADE_SITUACAO": "Ativo",
        "CO_ATC": "R05",
        "CO_FORMA_FISICA": "1",
        "SUBSTANCIAS_MEDICAMENTOS": active_ingredient,
        "NO_RAZAO_SOCIAL_EMPRESA": manufacturer,
        "DS_TIPO_CATEGORIA_REGULATORIA": "Genérico",
        "NU_REGISTRO_PRODUTO": product_id,
        "NU_PROCESSO": "253510000000000",
    }


class AnvisaCatalogTests(unittest.TestCase):
    def test_groups_manufacturer_duplicates_without_losing_variants(self):
        records = [
            _to_record(
                anvisa_row("1", "ACEBROFILINA 100 mg COMPRIMIDO", "Laboratório A")
            ),
            _to_record(
                anvisa_row("2", "Acebrofilina 100 mg comprimidos", "Laboratório B")
            ),
        ]

        grouped = _group_records([record for record in records if record is not None])

        self.assertEqual(len(grouped), 1)
        self.assertEqual(grouped[0]["name"], "Acebrofilina")
        self.assertEqual(grouped[0]["variant_count"], 2)
        self.assertEqual(grouped[0]["manufacturer_count"], 2)
        self.assertEqual(
            {variant["manufacturer"] for variant in grouped[0]["variants"]},
            {"Laboratório A", "Laboratório B"},
        )

    def test_keeps_different_strengths_as_separate_groups(self):
        records = [
            _to_record(anvisa_row("1", "ACEBROFILINA 100 mg COMPRIMIDO", "Lab A")),
            _to_record(anvisa_row("2", "ACEBROFILINA 200 mg COMPRIMIDO", "Lab B")),
        ]

        grouped = _group_records([record for record in records if record is not None])

        self.assertEqual(len(grouped), 2)

    def test_assigns_illustration_from_pharmaceutical_form(self):
        record = _to_record(
            anvisa_row("1", "ACEBROFILINA 100 mg CÁPSULAS", "Lab A")
        )

        self.assertIsNotNone(record)
        self.assertEqual(record["image_asset"], "capsulas.svg")

    def test_list_response_uses_a_served_image_url(self):
        record = _group_records(
            [
                _to_record(
                    anvisa_row("1", "ACEBROFILINA 100 mg CÁPSULAS", "Lab A")
                )
            ]
        )[0]
        app = FastAPI()
        static_dir = Path(__file__).resolve().parents[1] / "app" / "static" / "medications"
        app.mount(
            "/assets/medications",
            StaticFiles(directory=static_dir),
            name="medication-assets",
        )
        app.include_router(medications.router, prefix="/api/v1/medications")

        with patch.object(
            medications, "listar_medicamentos", new=AsyncMock(return_value=[record])
        ):
            with TestClient(app) as client:
                response = client.get("/api/v1/medications")
                self.assertEqual(response.status_code, 200)
                item = response.json()["items"][0]
                self.assertEqual(item["image_url"], "http://testserver/assets/medications/capsulas.svg")
                image_response = client.get(urlsplit(item["image_url"]).path)
                self.assertEqual(image_response.status_code, 200)

    def test_global_search_returns_fuzzy_medication_suggestions(self):
        record = _group_records(
            [
                _to_record(
                    anvisa_row(
                        "1",
                        "DIPIRONA 500 mg COMPRIMIDO",
                        "Lab A",
                        active_ingredient="DIPIRONA",
                    )
                )
            ]
        )[0]
        app = FastAPI()
        app.mount(
            "/assets/medications",
            StaticFiles(
                directory=Path(__file__).resolve().parents[1]
                / "app"
                / "static"
                / "medications"
            ),
            name="medication-assets",
        )
        app.include_router(dashboard.router, prefix="/api/v1")

        with (
            patch.object(
                dashboard, "listar_medicamentos", new=AsyncMock(return_value=[record])
            ),
            patch.object(
                dashboard,
                "sugerir_medicamentos",
                new=AsyncMock(
                    return_value=[
                        {
                            "id": record["id"],
                            "label": "Dipirona",
                            "score": 0.875,
                            "kind": "medication",
                        }
                    ]
                ),
            ),
            patch.object(
                dashboard, "sugerir_indicacoes", new=AsyncMock(return_value=[])
            ),
        ):
            with TestClient(app) as client:
                response = client.get(
                    "/api/v1/search",
                    params={"q": "dprirona", "type": "medications"},
                )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["matched_term"], "Dipirona")
        self.assertEqual(payload["suggestions"][0]["kind"], "medication")
        self.assertEqual(payload["results"]["medications"][0]["name"], "Dipirona")

    def test_condition_search_labels_anvisa_indications_as_suggestions_only(self):
        app = FastAPI()
        app.include_router(dashboard.router, prefix="/api/v1")
        with patch.object(
            dashboard,
            "sugerir_indicacoes",
            new=AsyncMock(
                return_value=[
                    {
                        "id": "indication-headache",
                        "label": "Alívio temporário de dor de cabeça",
                        "score": 0.82,
                        "kind": "indication",
                    }
                ]
            ),
        ):
            with TestClient(app) as client:
                response = client.get(
                    "/api/v1/search",
                    params={"q": "dor de cabeca", "type": "conditions"},
                )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["suggestions"][0]["kind"], "indication")
        self.assertEqual(payload["results"]["conditions"], [])

    def test_condition_suggestions_endpoint_exposes_indications_without_diagnosing(self):
        app = FastAPI()
        app.include_router(conditions.router, prefix="/api/v1/conditions")
        with patch.object(
            conditions,
            "sugerir_indicacoes",
            new=AsyncMock(
                return_value=[
                    {
                        "id": "indication-headache",
                        "label": "Alívio temporário de dor de cabeça",
                        "score": 0.82,
                        "kind": "indication",
                    }
                ]
            ),
        ):
            with TestClient(app) as client:
                response = client.get(
                    "/api/v1/conditions/suggestions",
                    params={"q": "dor de cabeca"},
                )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["suggestions"][0]["kind"], "indication")
        self.assertEqual(payload["meta"]["source"], "ANVISA - Consulta de medicamentos")

    def test_global_search_keeps_unit_results_when_anvisa_is_unavailable(self):
        app = FastAPI()
        app.include_router(dashboard.router, prefix="/api/v1")
        with (
            patch.object(
                dashboard,
                "listar_medicamentos",
                new=AsyncMock(side_effect=httpx.RequestError("offline")),
            ),
            patch.object(
                dashboard,
                "buscar_todas_unidades_municipais",
                new=AsyncMock(
                    return_value=(
                        {"name": "São Paulo", "uf": "SP"},
                        [{"nome_fantasia": "UBS Centro"}],
                    )
                ),
            ),
            patch.object(
                dashboard, "unidade_resumo", return_value={"cnes_code": "1234567"}
            ),
            patch.object(
                dashboard,
                "metadados_cnes",
                return_value={
                    "source": "CNES",
                    "fetched_at": "2025-01-01T00:00:00Z",
                    "is_estimate": False,
                    "is_stale": False,
                },
            ),
        ):
            with TestClient(app) as client:
                response = client.get(
                    "/api/v1/search",
                    params={"q": "centro", "type": "all"},
                )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["results"]["units"][0]["cnes_code"], "1234567")
        self.assertEqual(payload["warnings"][0]["source"], "ANVISA - Consulta de medicamentos")
