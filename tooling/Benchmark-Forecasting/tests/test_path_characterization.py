from __future__ import annotations

import hashlib
import unittest
from dataclasses import dataclass
from datetime import date, timedelta

from forecasting.contracts import Frequency, Observation, TimeSeries
from forecasting.path_characterization import (
    DEFAULT_PATH_CHARACTERIZATION_TOLERANCE,
    characterize_forecast_path,
)
from forecasting.rolling_daily_point_in_time import RollingDailyPointInTimeConfig, RollingDailyPointInTimeService
from forecasting.runtime_catalog import SUPPORTED_MODEL_IDS, build_model


@dataclass(frozen=True)
class FakePathPoint:
    date: date
    point_forecast: float


def make_path(values: list[float], start: date = date(2026, 1, 1)):
    return tuple(
        FakePathPoint(date=start + timedelta(days=index), point_forecast=value)
        for index, value in enumerate(values)
    )


def business_daily_series(
    length: int,
    start: date = date(2025, 1, 1),
    start_value: float = 100.0,
    step: float = 1.0,
) -> TimeSeries:
    observations: list[Observation] = []
    current_date = start
    current_value = start_value
    while len(observations) < length:
        if current_date.weekday() < 5:
            observations.append(Observation(date=current_date, value=current_value))
            current_value += step
        current_date += timedelta(days=1)
    return TimeSeries(
        series_id="daily-series",
        benchmark_name="DAILY",
        description="Synthetic weekday-only daily series",
        frequency=Frequency.DAILY,
        observations=tuple(observations),
    )


class PathCharacterizationTests(unittest.TestCase):
    def test_flat_path_metrics_are_zero(self) -> None:
        result = characterize_forecast_path(make_path([5.0, 5.0, 5.0, 5.0]))

        self.assertEqual(result.path_length, 4)
        self.assertEqual(result.unique_forecast_values, 1)
        self.assertEqual(result.forecast_range, 0.0)
        self.assertEqual(result.direction_changes, 0)
        self.assertEqual(result.median_absolute_daily_change, 0.0)
        self.assertEqual(result.maximum_absolute_daily_change, 0.0)
        self.assertEqual(result.path_volatility, 0.0)

    def test_monotonic_path_has_no_direction_changes(self) -> None:
        result = characterize_forecast_path(make_path([1.0, 2.0, 3.0, 4.0]))

        self.assertEqual(result.direction_changes, 0)
        self.assertEqual(result.number_of_up_days, 3)
        self.assertEqual(result.number_of_down_days, 0)

    def test_one_reversal_counts_once(self) -> None:
        result = characterize_forecast_path(make_path([1.0, 2.0, 3.0, 2.0, 1.0]))

        self.assertEqual(result.direction_changes, 1)
        self.assertEqual(result.direction_change_indexes, (3,))

    def test_zero_plateau_does_not_create_false_direction_changes(self) -> None:
        result = characterize_forecast_path(make_path([1.0, 2.0, 2.0, 2.0, 1.0]))

        self.assertEqual(result.direction_changes, 1)
        self.assertEqual(result.number_of_flat_days, 2)

    def test_tiny_noise_within_tolerance_is_treated_as_flat(self) -> None:
        tolerance = DEFAULT_PATH_CHARACTERIZATION_TOLERANCE
        result = characterize_forecast_path(make_path([1.0, 1.0 + tolerance / 2, 1.0, 1.0 - tolerance / 2]))

        self.assertEqual(result.unique_forecast_values, 1)
        self.assertEqual(result.direction_changes, 0)
        self.assertEqual(result.maximum_absolute_daily_change, 0.0)

    def test_four_models_can_be_characterized_with_same_helper(self) -> None:
        series = business_daily_series(70, start=date(2025, 1, 6), step=1.5)
        config = RollingDailyPointInTimeConfig(minimum_training_observations=60, minimum_calibration_samples=999)

        signatures: dict[str, str] = {}
        for model_id in SUPPORTED_MODEL_IDS:
            with self.subTest(model_id=model_id):
                current = RollingDailyPointInTimeService(build_model(model_id), config).generate_current_forecast(series)
                self.assertEqual(current.status.value, "AVAILABLE")
                metrics = characterize_forecast_path(current.forecast_path)
                self.assertEqual(metrics.path_length, len(current.forecast_path))
                self.assertGreaterEqual(metrics.unique_forecast_values, 1)
                self.assertTrue(all(point.point_forecast == point.point_forecast for point in current.forecast_path))
                signatures[model_id] = hashlib.sha256(str(metrics).encode("utf-8")).hexdigest()

        self.assertEqual(tuple(signatures.keys()), SUPPORTED_MODEL_IDS)


if __name__ == "__main__":
    unittest.main()