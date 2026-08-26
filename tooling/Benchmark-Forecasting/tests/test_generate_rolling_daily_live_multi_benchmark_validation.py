from __future__ import annotations

import unittest

from scripts.generate_rolling_daily_live_multi_benchmark_validation import (
    CONTROL_SERIES_ID,
    DEFAULT_SERIES_IDS,
    summarize_validation_results,
    render_markdown_report,
)


def _available_model(model_id: str, origins: int = 12, calibration_samples: int = 8) -> dict:
    return {
        "modelId": model_id,
        "status": "AVAILABLE",
        "failureReason": None,
        "selectedVariant": "TEST_VARIANT",
        "originDate": "2026-08-20",
        "anchorForecasts": {
            horizon: {
                "bandStatus": "AVAILABLE",
                "forecastValue": 1.0,
            }
            for horizon in ("1M", "3M", "6M", "12M")
        },
        "backtest": {
            horizon: {
                "origins": origins,
                "expectedOrigins": origins,
                "coverage": 1.0,
                "metrics": {
                    "mae": 1.0,
                    "rmse": 2.0,
                    "mase": 3.0,
                    "smape": 4.0,
                    "directional_accuracy": 0.0,
                    "bias": -0.5,
                },
            }
            for horizon in ("1M", "3M", "6M", "12M")
        },
        "calibration": {
            horizon: {
                "sampleCount": calibration_samples,
                "status": "AVAILABLE",
            }
            for horizon in ("1M", "3M", "6M", "12M")
        },
    }


class GenerateRollingDailyLiveMultiBenchmarkValidationTests(unittest.TestCase):
    def test_default_cohort_includes_control_and_multiple_non_control_series(self) -> None:
        self.assertEqual(DEFAULT_SERIES_IDS[0], CONTROL_SERIES_ID)
        self.assertGreaterEqual(len(DEFAULT_SERIES_IDS), 6)
        self.assertGreaterEqual(len([series_id for series_id in DEFAULT_SERIES_IDS if series_id != CONTROL_SERIES_ID]), 5)

    def test_summary_marks_pass_and_counts_non_control_successes(self) -> None:
        results = [
            {
                "seriesId": "wocaes0074",
                "displayName": "Control",
                "history": {"start": "2025-01-01", "end": "2026-08-20", "observationCount": 400},
                "models": [_available_model("naive"), _available_model("ets")],
                "failures": [],
            },
            {
                "seriesId": "uscaes0302",
                "displayName": "Probe",
                "history": {"start": "2025-01-01", "end": "2026-08-20", "observationCount": 400},
                "models": [_available_model("naive"), _available_model("ets")],
                "failures": [],
            },
        ]

        payload = summarize_validation_results(results, ["naive", "ets"], ["wocaes0074", "uscaes0302"], 400)

        self.assertEqual(payload["status"], "PASS")
        self.assertEqual(payload["summary"]["seriesPassed"], 2)
        self.assertEqual(payload["summary"]["nonControlSeriesPassed"], 1)
        self.assertEqual(payload["modelPolicy"]["champion"], "NOT DEFINED")
        self.assertEqual(payload["horizonSummary"]["1M"]["naive"]["seriesPassed"], 2)

    def test_summary_fails_when_model_output_is_missing(self) -> None:
        results = [
            {
                "seriesId": "wocaes0074",
                "displayName": "Control",
                "history": {"start": "2025-01-01", "end": "2026-08-20", "observationCount": 400},
                "models": [_available_model("naive")],
                "failures": [],
            }
        ]

        payload = summarize_validation_results(results, ["naive", "ets"], ["wocaes0074"], 400)

        self.assertEqual(payload["status"], "FAIL")
        self.assertEqual(payload["seriesSummaries"][0]["missingModels"], ["ets"])
        self.assertEqual(payload["seriesSummaries"][0]["status"], "FAIL")

    def test_rendered_markdown_keeps_no_ranking_and_no_overall_score(self) -> None:
        payload = summarize_validation_results(
            [
                {
                    "seriesId": "wocaes0074",
                    "displayName": "Control",
                    "history": {"start": "2025-01-01", "end": "2026-08-20", "observationCount": 400},
                    "models": [_available_model("naive"), _available_model("ets")],
                    "failures": [],
                }
            ],
            ["naive", "ets"],
            ["wocaes0074"],
            400,
        )

        rendered = render_markdown_report(payload)

        self.assertIn("Model Ranking:\nNOT PERFORMED", rendered)
        self.assertIn("Champion: NOT DEFINED", rendered)
        self.assertNotIn("Overall Score", rendered)


if __name__ == "__main__":
    unittest.main()