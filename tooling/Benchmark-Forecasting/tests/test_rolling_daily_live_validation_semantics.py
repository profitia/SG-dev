from __future__ import annotations

import unittest
from dataclasses import dataclass
from datetime import date
from unittest.mock import patch

from forecasting.contracts import ForecastMetadata, Observation, TimeSeries
from forecasting.models.naive import NaiveLastValueModel
from forecasting.rolling_daily_point_in_time import (
    HISTORICAL_FORECAST_ORIGIN_START_DATE,
    RollingDailyPointInTimeConfig,
    RollingDailyPointInTimeService,
    fit_path_model as original_fit_path_model,
)
from scripts.generate_rolling_daily_live_multi_benchmark_validation import summarize_validation_results
from scripts.validate_rolling_daily_live import _build_validation_origin_window, _measure_model
from tests.test_rolling_daily_method import business_daily_series


@dataclass(frozen=True)
class FakeModel:
    model_id: str


@dataclass(frozen=True)
class FakePathFit:
    metadata: ForecastMetadata

    def forecast_path(self, horizon_steps: int) -> tuple[float, ...]:
        return tuple(float(index + 1) for index in range(horizon_steps))


def _history(shape_start: str = "2025-01-01", shape_end: str = "2026-08-20", count: int = 400) -> dict:
    return {
        "sourceHistory": {
            "start": shape_start,
            "end": shape_end,
            "observationCount": 1000,
        },
        "validationOriginWindow": {
            "retainedObservationStart": "2025-01-01",
            "retainedObservationEnd": shape_end,
            "retainedObservationCount": count,
        },
    }


def _available_model(model_id: str, origins: int = 12) -> dict:
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
                "sampleCount": origins,
                "status": "AVAILABLE",
            }
            for horizon in ("1M", "3M", "6M", "12M")
        },
    }


class RollingDailyLiveValidationSemanticsTests(unittest.TestCase):
    def test_validation_origin_window_bounds_origins_but_preserves_older_training_history(self) -> None:
        series = business_daily_series(1000, start=date(2021, 1, 4))
        config = RollingDailyPointInTimeConfig(minimum_training_observations=60)
        validation_origin_start_date, window = _build_validation_origin_window(
            series,
            max_observations=400,
            historical_origin_floor=HISTORICAL_FORECAST_ORIGIN_START_DATE,
        )
        captured_histories: list[tuple[Observation, ...]] = []

        def capture_history(model, history: tuple[Observation, ...]):
            captured_histories.append(history)
            return original_fit_path_model(model, history)

        service = RollingDailyPointInTimeService(NaiveLastValueModel(), config)
        with patch("forecasting.rolling_daily_point_in_time.fit_path_model", side_effect=capture_history):
            backtest = service.generate_backtest(series, validation_origin_start_date=validation_origin_start_date)

        retained_start = date.fromisoformat(window["retainedObservationStart"])
        effective_origin_start = date.fromisoformat(window["effectiveOriginStart"])

        self.assertTrue(window["bounded"])
        self.assertEqual(effective_origin_start, max(HISTORICAL_FORECAST_ORIGIN_START_DATE, retained_start))
        self.assertEqual(backtest["1M"].records[0].forecast_origin, effective_origin_start)
        self.assertLess(captured_histories[0][0].date, retained_start)
        self.assertEqual(captured_histories[0][-1].date, effective_origin_start)

    def test_pretruncating_series_exposes_legacy_training_truncation_defect(self) -> None:
        series = business_daily_series(1000, start=date(2021, 1, 4))
        retained_observations = series.observations[-400:]
        truncated_series = TimeSeries(
            series_id=series.series_id,
            benchmark_name=series.benchmark_name,
            description=series.description,
            frequency=series.frequency,
            observations=retained_observations,
        )
        captured_histories: list[tuple[Observation, ...]] = []

        def capture_history(model, history: tuple[Observation, ...]):
            captured_histories.append(history)
            return original_fit_path_model(model, history)

        service = RollingDailyPointInTimeService(
            NaiveLastValueModel(),
            RollingDailyPointInTimeConfig(minimum_training_observations=60),
        )
        with patch("forecasting.rolling_daily_point_in_time.fit_path_model", side_effect=capture_history):
            backtest = service.generate_backtest(truncated_series)

        self.assertTrue(backtest["1M"].records)
        self.assertEqual(captured_histories[0][0].date, retained_observations[0].date)
        self.assertGreater(captured_histories[0][0].date, series.start)

    def test_all_four_models_receive_full_history_under_bounded_origin_window(self) -> None:
        series = business_daily_series(1000, start=date(2021, 1, 4))
        config = RollingDailyPointInTimeConfig(minimum_training_observations=60, minimum_calibration_samples=20)
        validation_origin_start_date, window = _build_validation_origin_window(
            series,
            max_observations=400,
            historical_origin_floor=HISTORICAL_FORECAST_ORIGIN_START_DATE,
        )
        captured_histories: dict[str, list[tuple[Observation, ...]]] = {}

        def fake_build_model(model_id: str) -> FakeModel:
            return FakeModel(model_id=model_id)

        def fake_fit_path_model(model: FakeModel, history: tuple[Observation, ...]) -> FakePathFit:
            captured_histories.setdefault(model.model_id, []).append(history)
            return FakePathFit(
                metadata=ForecastMetadata(
                    model_family=model.model_id,
                    selected_variant=f"FAKE_{model.model_id.upper()}",
                    fit_status="SUCCEEDED",
                )
            )

        with patch("scripts.validate_rolling_daily_live.build_model", side_effect=fake_build_model), patch(
            "scripts.validate_rolling_daily_live.fit_path_model",
            side_effect=fake_fit_path_model,
        ), patch(
            "forecasting.rolling_daily_point_in_time.fit_path_model",
            side_effect=fake_fit_path_model,
        ):
            for model_id in ("naive", "damped_holt", "ets", "arima"):
                result = _measure_model(
                    series,
                    model_id,
                    config,
                    validation_origin_start_date=validation_origin_start_date,
                )
                self.assertEqual(result["status"], "AVAILABLE")
                self.assertEqual(result["originDate"], series.end.isoformat())

        retained_start = date.fromisoformat(window["retainedObservationStart"])
        for model_id in ("naive", "damped_holt", "ets", "arima"):
            histories = captured_histories[model_id]
            self.assertGreaterEqual(len(histories), 2)
            self.assertTrue(all(history[0].date == series.start for history in histories))
            self.assertTrue(all(history[-1].date >= HISTORICAL_FORECAST_ORIGIN_START_DATE for history in histories[1:]))
            self.assertLess(histories[0][0].date, retained_start)

    def test_summary_keeps_fixed_methodology_and_scope_guardrails(self) -> None:
        payload = summarize_validation_results(
            [
                {
                    "seriesId": "uscaes0301",
                    "displayName": "Energy",
                    "history": _history(),
                    "models": [
                        _available_model("naive"),
                        _available_model("damped_holt"),
                        _available_model("ets"),
                        _available_model("arima"),
                    ],
                    "failures": [],
                },
                {
                    "seriesId": "wocaes0280",
                    "displayName": "Dry Index",
                    "history": _history(shape_end="2026-08-16"),
                    "models": [
                        _available_model("naive"),
                        _available_model("damped_holt"),
                        _available_model("ets"),
                        _available_model("arima"),
                    ],
                    "failures": [],
                },
            ],
            ["naive", "damped_holt", "ets", "arima"],
            ["uscaes0301", "wocaes0280"],
            400,
        )

        self.assertEqual(payload["identity"]["forecastMethod"], "ROLLING_DAILY_POINT_IN_TIME")
        self.assertEqual(payload["identity"]["methodVersion"], "rolling-daily-point-in-time-v1")
        self.assertEqual(payload["scope"]["runtime"], "NOT MODIFIED")
        self.assertEqual(payload["scope"]["schema"], "NOT MODIFIED")
        self.assertEqual(payload["scope"]["deployment"], "NOT PERFORMED")
        self.assertEqual(payload["modelPolicy"]["champion"], "NOT DEFINED")
        self.assertEqual(payload["modelPolicy"]["preferredModel"], "NOT DEFINED")
        self.assertEqual(payload["modelPolicy"]["globalDefault"], "NOT DEFINED")
        self.assertEqual(payload["modelPolicy"]["automaticSelection"], "NOT BUILT")


if __name__ == "__main__":
    unittest.main()