from __future__ import annotations

import unittest
from datetime import date

from data_sources.postgres import rows_to_time_series
from forecasting.backtest import compute_mase_scale, generate_backtest_records
from forecasting.contracts import BenchmarkDefinition, Frequency, Observation, TimeSeries
from forecasting.metrics import bias, directional_accuracy, mae, mase, rmse, smape
from forecasting.models.naive import NaiveLastValueModel


def monthly_series(length: int, start_value: float = 100.0, step: float = 1.0) -> TimeSeries:
    observations = []
    year = 2021
    month = 1
    current = start_value
    for _ in range(length):
        observations.append(Observation(date=date(year, month, 1), value=current))
        current += step
        month += 1
        if month == 13:
            month = 1
            year += 1
    return TimeSeries(
        series_id="test-series",
        benchmark_name="TEST",
        description="Synthetic monthly test series",
        frequency=Frequency.MONTHLY,
        observations=tuple(observations),
    )


class Phase1Tests(unittest.TestCase):
    def test_naive_returns_last_known_value(self) -> None:
        model = NaiveLastValueModel()
        history = [Observation(date(2021, 1, 1), 10.0), Observation(date(2021, 2, 1), 25.0)]
        self.assertEqual(model.forecast(history, 12), 25.0)

    def test_rolling_origins_do_not_leak_future_data(self) -> None:
        series = monthly_series(40)
        model = NaiveLastValueModel()
        records = generate_backtest_records(series, model, "1M", 1, 36)
        self.assertEqual(records[0].forecast_origin, date(2023, 12, 1))
        self.assertEqual(records[0].forecast_value, 135.0)
        self.assertEqual(records[0].actual_value, 136.0)

    def test_delta_uses_forecast_vs_actual_semantics(self) -> None:
        series = monthly_series(40)
        records = generate_backtest_records(series, NaiveLastValueModel(), "1M", 1, 36)
        first = records[0]
        self.assertEqual(first.error, first.forecast_value - first.actual_value)
        self.assertEqual(first.delta, first.forecast_value - first.actual_value)
        self.assertAlmostEqual(first.delta_pct, first.delta / first.actual_value)

    def test_horizon_indexing_is_correct(self) -> None:
        series = monthly_series(64)
        model = NaiveLastValueModel()
        records = generate_backtest_records(series, model, "12M", 12, 36)
        self.assertEqual(len(records), 17)
        self.assertEqual(records[0].forecast_date, date(2024, 12, 1))
        self.assertEqual(records[-1].forecast_date, date(2026, 4, 1))

    def test_mae_is_correct(self) -> None:
        series = monthly_series(40)
        records = generate_backtest_records(series, NaiveLastValueModel(), "1M", 1, 36)
        self.assertEqual(mae(records), 1.0)

    def test_rmse_is_correct(self) -> None:
        series = monthly_series(40)
        records = generate_backtest_records(series, NaiveLastValueModel(), "1M", 1, 36)
        self.assertEqual(rmse(records), 1.0)

    def test_smape_is_correct(self) -> None:
        series = monthly_series(40)
        records = generate_backtest_records(series, NaiveLastValueModel(), "1M", 1, 36)
        expected = sum((2.0 / (record.actual_value + record.forecast_value)) * 100.0 for record in records) / len(records)
        self.assertAlmostEqual(smape(records), expected)

    def test_bias_sign_is_correct(self) -> None:
        series = monthly_series(40)
        records = generate_backtest_records(series, NaiveLastValueModel(), "1M", 1, 36)
        self.assertLess(bias(records), 0.0)

    def test_directional_accuracy_handles_no_change(self) -> None:
        flat_series = monthly_series(40, start_value=50.0, step=0.0)
        records = generate_backtest_records(flat_series, NaiveLastValueModel(), "1M", 1, 36)
        self.assertEqual(directional_accuracy(records), 1.0)

    def test_mase_scaling_is_correct(self) -> None:
        series = monthly_series(40)
        records = generate_backtest_records(series, NaiveLastValueModel(), "1M", 1, 36)
        self.assertEqual(compute_mase_scale(list(series.observations[:36])), 1.0)
        self.assertEqual(mase(records), 1.0)

    def test_duplicate_conflicting_observation_fails(self) -> None:
        benchmark = BenchmarkDefinition(
            series_id="dup",
            component="DUP",
            description="Duplicate test",
            frequency=Frequency.MONTHLY,
            expected_observations=1,
        )
        rows = [
            {
                "source_date": date(2021, 1, 1),
                "metric_value": 10.0,
                "component_name": "DUP",
                "description_eng": "Duplicate test",
            },
            {
                "source_date": date(2021, 1, 1),
                "metric_value": 11.0,
                "component_name": "DUP",
                "description_eng": "Duplicate test",
            },
        ]
        with self.assertRaisesRegex(ValueError, "Conflicting duplicate observations"):
            rows_to_time_series(benchmark, rows)


if __name__ == "__main__":
    unittest.main()