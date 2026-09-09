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

    def forecast_with_metadata(self, history, horizon_steps):  # type: ignore[override]
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


if __name__ == "__main__":
    unittest.main()