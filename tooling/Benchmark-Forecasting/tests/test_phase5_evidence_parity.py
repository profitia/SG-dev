from __future__ import annotations

import unittest
from dataclasses import dataclass
from datetime import date
from datetime import timedelta
from unittest.mock import patch

from forecasting.backtest import generate_backtest_records
from forecasting.contracts import ForecastMetadata, Frequency, ModelForecast, Observation, TimeSeries
from forecasting.models.base import ForecastModel
from forecasting.models.naive import NaiveLastValueModel
from forecasting.rolling_daily_point_in_time import RollingDailyPointInTimeConfig, RollingDailyPointInTimeService


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


def monthly_series(length: int = 60) -> TimeSeries:
    observations: list[Observation] = []
    year = 2021
    month = 1
    for index in range(length):
        observations.append(Observation(date=date(year, month, 1), value=100.0 + index))
        month += 1
        if month == 13:
            month = 1
            year += 1
    return TimeSeries(
        series_id="phase5-monthly",
        benchmark_name="PHASE5",
        description="Bounded origins with full monthly history",
        frequency=Frequency.MONTHLY,
        observations=tuple(observations),
    )


class Phase5EvidenceParityTests(unittest.TestCase):
    def test_monthly_origin_bound_filters_workload_without_truncating_training_history(self) -> None:
        series = monthly_series()
        selected_origins = {
            series.observations[36].date,
            series.observations[41].date,
            series.observations[47].date,
        }
        model = RecordingModel()

        result = generate_backtest_records(
            series,
            model,
            "12M",
            12,
            36,
            validation_origin_dates=selected_origins,
        )

        self.assertEqual(result.expected_origins, 3)
        self.assertEqual(len(result.records), 3)
        self.assertEqual(model.history_lengths, [37, 42, 48])
        self.assertEqual({record.forecast_origin for record in result.records}, selected_origins)

    def test_rolling_daily_origin_bound_filters_workload_without_truncating_training_history(self) -> None:
        @dataclass(frozen=True)
        class FakePathFit:
            metadata: ForecastMetadata

            def forecast_path(self, horizon_steps: int) -> tuple[float, ...]:
                return tuple(200.0 + step for step in range(horizon_steps))

        observations = tuple(
            Observation(date=date(2024, 1, 1) + timedelta(days=index), value=100.0 + index)
            for index in range(500)
        )
        series = TimeSeries(
            series_id="phase5-daily",
            benchmark_name="PHASE5",
            description="Bounded origins with full daily history",
            frequency=Frequency.DAILY,
            observations=observations,
        )
        selected_origins = {
            series.observations[70].date,
            series.observations[80].date,
            series.observations[90].date,
        }
        captured_lengths: list[int] = []

        def capture_history(model, history):
            captured_lengths.append(len(history))
            return FakePathFit(
                ForecastMetadata(model_family=model.model_id, selected_variant="FULL_HISTORY_PATH")
            )

        service = RollingDailyPointInTimeService(
            NaiveLastValueModel(),
            RollingDailyPointInTimeConfig(minimum_training_observations=60),
        )

        with patch("forecasting.rolling_daily_point_in_time.fit_path_model", side_effect=capture_history):
            result = service.generate_backtest(series, validation_origin_dates=selected_origins)

        self.assertEqual(captured_lengths, [71, 81, 91])
        self.assertEqual(result["12M"].expected_origins, 3)
        self.assertEqual({record.forecast_origin for record in result["12M"].records}, selected_origins)


if __name__ == "__main__":
    unittest.main()