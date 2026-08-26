from __future__ import annotations

import unittest
from dataclasses import dataclass
from datetime import date, timedelta
from unittest.mock import patch

from forecasting.backtest import generate_current_forecast
from forecasting.contracts import ForecastMetadata, Frequency, ModelForecast, Observation, TimeSeries
from forecasting.models.base import ForecastModel
from forecasting.models.naive import NaiveLastValueModel
from forecasting.rolling_daily_point_in_time import RollingDailyPointInTimeConfig, RollingDailyPointInTimeService
from forecasting.runtime_catalog import SUPPORTED_MODEL_IDS, USER_FACING_MODEL_IDS, build_model


EXPECTED_MODEL_IDS = ("naive", "damped_holt", "ets", "arima")


class Phase4CurrentParityTests(unittest.TestCase):
    def test_user_facing_and_supported_catalogs_match_the_accepted_four_models(self) -> None:
        self.assertEqual(USER_FACING_MODEL_IDS, EXPECTED_MODEL_IDS)
        self.assertEqual(SUPPORTED_MODEL_IDS, EXPECTED_MODEL_IDS)
        self.assertEqual(tuple(build_model(model_id).model_id for model_id in EXPECTED_MODEL_IDS), EXPECTED_MODEL_IDS)

    def test_monthly_technical_minimum_does_not_cap_current_training_history(self) -> None:
        class RecordingModel(ForecastModel):
            model_id = "recording"

            def __init__(self) -> None:
                self.history_lengths: list[int] = []

            def forecast_with_metadata(self, history, horizon_steps):  # type: ignore[override]
                self.history_lengths.append(len(history))
                return ModelForecast(
                    forecast_value=float(history[-1].value),
                    metadata=ForecastMetadata(model_family=self.model_id, selected_variant="RECORDING"),
                )

        observations = []
        year = 2021
        month = 1
        for index in range(48):
            observations.append(Observation(date=date(year, month, 1), value=100.0 + index))
            month += 1
            if month == 13:
                month = 1
                year += 1
        series = TimeSeries(
            series_id="phase4-monthly",
            benchmark_name="PHASE4",
            description="Full monthly history guardrail",
            frequency=Frequency.MONTHLY,
            observations=tuple(observations),
        )
        model = RecordingModel()

        result = generate_current_forecast(series, model, "12M", 12)

        self.assertIsNone(result.failure_reason)
        self.assertEqual(model.history_lengths, [48])

    def test_rolling_daily_technical_minimum_does_not_cap_current_training_history(self) -> None:
        @dataclass(frozen=True)
        class FakePathFit:
            metadata: ForecastMetadata

            def forecast_path(self, horizon_steps: int) -> tuple[float, ...]:
                return tuple(150.0 + step for step in range(horizon_steps))

        observations = tuple(
            Observation(date=date(2024, 1, 1) + timedelta(days=index), value=100.0 + index)
            for index in range(98)
        )
        series = TimeSeries(
            series_id="phase4-daily",
            benchmark_name="PHASE4",
            description="Full daily history guardrail",
            frequency=Frequency.DAILY,
            observations=observations,
        )
        captured_lengths: list[int] = []

        def capture_history(model, history):
            captured_lengths.append(len(history))
            return FakePathFit(
                ForecastMetadata(model_family=model.model_id, selected_variant="FULL_HISTORY_PATH")
            )

        service = RollingDailyPointInTimeService(
            NaiveLastValueModel(),
            RollingDailyPointInTimeConfig(minimum_training_observations=60, minimum_calibration_samples=999),
        )

        with patch("forecasting.rolling_daily_point_in_time.fit_path_model", side_effect=capture_history):
            result = service.generate_current_forecast(series)

        self.assertEqual(result.status.value, "AVAILABLE")
        self.assertEqual(captured_lengths, [98])


if __name__ == "__main__":
    unittest.main()