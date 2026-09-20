from __future__ import annotations

import unittest
from datetime import date

from data_sources.base import HistoricalSeriesSource
from forecasting.contracts import BenchmarkDefinition, ForecastMetadata, Frequency, ModelForecast, Observation, TimeSeries
from forecasting.models.base import ForecastModel
from forecasting.service import ForecastingService


class StaticHistoricalSource(HistoricalSeriesSource):
    def __init__(self, series: TimeSeries) -> None:
        self._series = series

    def load_series(self, benchmark: BenchmarkDefinition, run_id: str) -> TimeSeries:
        del benchmark, run_id
        return self._series


class ConstantModel(ForecastModel):
    model_id = "constant"

    def __init__(self) -> None:
        self.training_lengths: list[int] = []

    def forecast_with_metadata(self, history, horizon_steps):  # type: ignore[override]
        self.training_lengths.append(len(history))
        return ModelForecast(
            forecast_value=history[-1].value + float(horizon_steps),
            metadata=ForecastMetadata(model_family=self.model_id, selected_variant="CONSTANT"),
        )


def monthly_series(length: int) -> TimeSeries:
    observations = tuple(
        Observation(date(2020 + ((index) // 12), (index % 12) + 1, 1), 100.0 + index)
        for index in range(length)
    )
    return TimeSeries(
        series_id="bounded.non.daily.series",
        benchmark_name="Bounded Non Daily",
        description="Bounded Non Daily",
        frequency=Frequency.MONTHLY,
        observations=observations,
    )


class BoundedNonDailyVerificationTests(unittest.TestCase):
    def test_bounded_verification_batches_selected_origins_but_preserves_full_expected_counts(self) -> None:
        series = monthly_series(8)
        benchmark = BenchmarkDefinition(
            series_id=series.series_id,
            component="BOUNDED_NON_DAILY",
            description="Bounded Non Daily",
            frequency=Frequency.MONTHLY,
            expected_observations=8,
        )
        service = ForecastingService(
            data_source=StaticHistoricalSource(series),
            model=ConstantModel(),
            run_id="test-run",
            horizons={"1M": 1, "3M": 3},
            min_training_window=3,
        )

        result = service.run_benchmark(
            benchmark,
            historical_origin_start_date=date(2020, 4, 1),
            last_processed_origin_date=date(2020, 4, 1),
            max_origins_per_run=2,
        )

        one_month = result.backtest["1M"]
        three_month = result.backtest["3M"]

        self.assertEqual([record.forecast_origin.isoformat() for record in one_month.records], [
            "2020-05-01",
            "2020-06-01",
        ])
        self.assertEqual(one_month.expected_origins, 5)
        self.assertEqual(one_month.origins, 2)

        self.assertEqual([record.forecast_origin.isoformat() for record in three_month.records], [
            "2020-05-01",
        ])
        self.assertEqual(three_month.expected_origins, 3)
        self.assertEqual(three_month.origins, 1)

    def test_adaptive_policy_moves_backward_only_enough_for_24_longest_horizon_origins(self) -> None:
        series = monthly_series(72)
        benchmark = BenchmarkDefinition(
            series_id=series.series_id,
            component="ADAPTIVE_BOUNDED_NON_DAILY",
            description="Adaptive Bounded Non Daily",
            frequency=Frequency.MONTHLY,
            expected_observations=72,
        )
        model = ConstantModel()
        service = ForecastingService(
            data_source=StaticHistoricalSource(series),
            model=model,
            run_id="test-run",
            horizons={"1M": 1, "12M": 12},
            min_training_window=3,
        )

        result = service.run_benchmark(
            benchmark,
            historical_origin_start_date=date(2024, 1, 1),
            minimum_verification_origins=24,
            max_origins_per_run=2,
        )

        one_month = result.backtest["1M"]
        twelve_month = result.backtest["12M"]
        self.assertEqual([record.forecast_origin.isoformat() for record in one_month.records], [
            "2023-01-01",
            "2023-02-01",
        ])
        self.assertEqual(one_month.expected_origins, 35)
        self.assertEqual(twelve_month.expected_origins, 24)
        self.assertEqual(model.training_lengths[0], 37)

    def test_adaptive_policy_keeps_preferred_floor_when_longest_horizon_has_enough_origins(self) -> None:
        series = monthly_series(96)
        benchmark = BenchmarkDefinition(
            series_id=series.series_id,
            component="PREFERRED_FLOOR_NON_DAILY",
            description="Preferred Floor Non Daily",
            frequency=Frequency.MONTHLY,
            expected_observations=96,
        )
        service = ForecastingService(
            data_source=StaticHistoricalSource(series),
            model=ConstantModel(),
            run_id="test-run",
            horizons={"1M": 1, "12M": 12},
            min_training_window=3,
        )

        result = service.run_benchmark(
            benchmark,
            historical_origin_start_date=date(2024, 1, 1),
            minimum_verification_origins=24,
            max_origins_per_run=1,
        )

        self.assertEqual(result.backtest["1M"].records[0].forecast_origin.isoformat(), "2024-01-01")
        self.assertEqual(result.backtest["1M"].expected_origins, 47)
        self.assertEqual(result.backtest["12M"].expected_origins, 36)

    def test_adaptive_policy_uses_all_lawful_origins_when_total_is_below_minimum(self) -> None:
        series = monthly_series(20)
        benchmark = BenchmarkDefinition(
            series_id=series.series_id,
            component="SHORT_NON_DAILY",
            description="Short Non Daily",
            frequency=Frequency.MONTHLY,
            expected_observations=20,
        )
        service = ForecastingService(
            data_source=StaticHistoricalSource(series),
            model=ConstantModel(),
            run_id="test-run",
            horizons={"1M": 1, "12M": 12},
            min_training_window=3,
        )

        result = service.run_benchmark(
            benchmark,
            historical_origin_start_date=date(2024, 1, 1),
            minimum_verification_origins=24,
        )

        self.assertEqual(result.backtest["1M"].expected_origins, 17)
        self.assertEqual(result.backtest["12M"].expected_origins, 6)
        self.assertEqual(result.backtest["1M"].records[0].forecast_origin.isoformat(), "2020-03-01")

    def test_adaptive_policy_preserves_exclusive_resume_and_expected_cohort(self) -> None:
        series = monthly_series(72)
        benchmark = BenchmarkDefinition(
            series_id=series.series_id,
            component="RESUMED_NON_DAILY",
            description="Resumed Non Daily",
            frequency=Frequency.MONTHLY,
            expected_observations=72,
        )
        service = ForecastingService(
            data_source=StaticHistoricalSource(series),
            model=ConstantModel(),
            run_id="test-run",
            horizons={"1M": 1, "12M": 12},
            min_training_window=3,
        )

        result = service.run_benchmark(
            benchmark,
            historical_origin_start_date=date(2024, 1, 1),
            minimum_verification_origins=24,
            last_processed_origin_date=date(2023, 1, 1),
            max_origins_per_run=1,
        )

        self.assertEqual(result.backtest["1M"].records[0].forecast_origin.isoformat(), "2023-02-01")
        self.assertEqual(result.backtest["1M"].expected_origins, 35)
        self.assertEqual(result.backtest["12M"].expected_origins, 24)


if __name__ == "__main__":
    unittest.main()
