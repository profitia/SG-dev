from __future__ import annotations

import unittest
from dataclasses import dataclass
from datetime import date, timedelta
from unittest.mock import patch

from forecasting.contracts import ForecastMetadata, Frequency, Observation, TimeSeries
from forecasting.models.damped_holt import DampedHoltModel
from forecasting.models.ets import ETSModelFamily
from forecasting.models.naive import NaiveLastValueModel
from forecasting.models.arima import ARIMAModelFamily
from forecasting.rolling_daily_contracts import BandStatus, ForecastAvailabilityStatus, MaturityStatus, RollingDailyHorizonBacktestResult
from forecasting.rolling_daily_point_in_time import (
    HISTORICAL_FORECAST_ORIGIN_START_DATE,
    NON_SEASONAL_ETS_CANDIDATES,
    ROLLING_DAILY_POINT_IN_TIME_METHOD_ID,
    RollingDailyPointInTimeConfig,
    RollingDailyPointInTimeService,
    build_calibration_summaries,
    empirical_quantile,
)
from scripts.validate_rolling_daily_live import _build_daily_series


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


def monthly_series(length: int) -> TimeSeries:
    observations = []
    year = 2021
    month = 1
    value = 100.0
    for _ in range(length):
        observations.append(Observation(date=date(year, month, 1), value=value))
        value += 1.0
        month += 1
        if month == 13:
            month = 1
            year += 1
    return TimeSeries(
        series_id="monthly-series",
        benchmark_name="MONTHLY",
        description="Synthetic monthly series",
        frequency=Frequency.MONTHLY,
        observations=tuple(observations),
    )


def daily_series_from_dates(
    dates: list[date],
    start_value: float = 100.0,
    step: float = 1.0,
) -> TimeSeries:
    observations: list[Observation] = []
    current_value = start_value
    for current_date in dates:
        observations.append(Observation(date=current_date, value=current_value))
        current_value += step
    return TimeSeries(
        series_id="dated-daily-series",
        benchmark_name="DAILY",
        description="Synthetic lawful dated daily series",
        frequency=Frequency.DAILY,
        observations=tuple(observations),
    )


class RollingDailyMethodTests(unittest.TestCase):
    def test_rejects_non_daily_frequency(self) -> None:
        service = RollingDailyPointInTimeService(NaiveLastValueModel())
        result = service.generate_current_forecast(monthly_series(64))

        self.assertEqual(result.status, ForecastAvailabilityStatus.UNSUPPORTED_FREQUENCY)
        self.assertEqual(result.forecast_path, ())

    def test_generates_daily_calendar_path_and_anchor_points(self) -> None:
        series = business_daily_series(90)
        service = RollingDailyPointInTimeService(
            NaiveLastValueModel(),
            RollingDailyPointInTimeConfig(minimum_training_observations=60, minimum_calibration_samples=999),
        )

        result = service.generate_current_forecast(series)

        self.assertEqual(result.status, ForecastAvailabilityStatus.AVAILABLE)
        self.assertEqual(result.method, ROLLING_DAILY_POINT_IN_TIME_METHOD_ID)
        self.assertEqual(result.origin_date, series.end)
        self.assertEqual(result.forecast_path[0].date, series.end + timedelta(days=1))
        self.assertEqual(result.forecast_path[-1].date, date(2026, 5, 6))
        self.assertEqual(set(result.anchors), {"1M", "3M", "6M", "12M"})
        self.assertTrue(all(point.point_forecast == series.observations[-1].value for point in result.forecast_path[:3]))

    def test_fits_once_per_origin_not_per_anchor(self) -> None:
        series = business_daily_series(80)
        service = RollingDailyPointInTimeService(
            NaiveLastValueModel(),
            RollingDailyPointInTimeConfig(minimum_training_observations=60),
        )

        with patch("forecasting.rolling_daily_point_in_time.fit_path_model", wraps=__import__("forecasting.rolling_daily_point_in_time", fromlist=["fit_path_model"]).fit_path_model) as mocked_fit:
            backtest = service.generate_backtest(series)

        expected_origins = backtest["1M"].expected_origins
        self.assertEqual(mocked_fit.call_count, expected_origins)

    def test_historical_origin_floor_excludes_pre_2024_origins_but_keeps_older_training_history(self) -> None:
        series = business_daily_series(110, start=date(2023, 11, 1))
        service = RollingDailyPointInTimeService(
            NaiveLastValueModel(),
            RollingDailyPointInTimeConfig(minimum_training_observations=20),
        )
        captured_histories: list[tuple[Observation, ...]] = []
        original_fit_path_model = __import__("forecasting.rolling_daily_point_in_time", fromlist=["fit_path_model"]).fit_path_model

        def capture_history(model, history):
            captured_histories.append(history)
            return original_fit_path_model(model, history)

        with patch("forecasting.rolling_daily_point_in_time.fit_path_model", side_effect=capture_history):
            backtest = service.generate_backtest(series)

        self.assertTrue(backtest["1M"].records)
        self.assertTrue(all(record.forecast_origin >= HISTORICAL_FORECAST_ORIGIN_START_DATE for record in backtest["1M"].records))
        self.assertEqual(backtest["1M"].records[0].forecast_origin, HISTORICAL_FORECAST_ORIGIN_START_DATE)
        self.assertLess(captured_histories[0][0].date, HISTORICAL_FORECAST_ORIGIN_START_DATE)
        self.assertEqual(captured_histories[0][-1].date, HISTORICAL_FORECAST_ORIGIN_START_DATE)

    def test_missing_days_do_not_create_synthetic_origins(self) -> None:
        series = business_daily_series(70, start=date(2025, 1, 1))
        service = RollingDailyPointInTimeService(
            NaiveLastValueModel(),
            RollingDailyPointInTimeConfig(minimum_training_observations=20),
        )

        backtest = service.generate_backtest(series)

        origins = {record.forecast_origin for record in backtest["1M"].records}
        self.assertNotIn(date(2025, 2, 1), origins)
        self.assertNotIn(date(2025, 2, 2), origins)
        self.assertTrue(all(origin.weekday() < 5 for origin in origins))

    def test_weekend_calendar_dates_do_not_consume_model_steps(self) -> None:
        @dataclass(frozen=True)
        class FakePathFit:
            metadata: ForecastMetadata

            def forecast_path(self, horizon_steps: int) -> tuple[float, ...]:
                return tuple(float(step) for step in range(1, horizon_steps + 1))

        series = business_daily_series(65, start=date(2025, 1, 6))
        service = RollingDailyPointInTimeService(
            NaiveLastValueModel(),
            RollingDailyPointInTimeConfig(minimum_training_observations=20, minimum_calibration_samples=999),
        )
        fake_fit = FakePathFit(
            metadata=ForecastMetadata(
                model_family="fake",
                selected_variant="FAKE_PATH",
            )
        )

        with patch("forecasting.rolling_daily_point_in_time.fit_path_model", return_value=fake_fit):
            current = service.generate_current_forecast(series)

        self.assertEqual(series.end.weekday(), 4)
        self.assertEqual(current.forecast_path[0].date.weekday(), 5)
        self.assertEqual(current.forecast_path[1].date.weekday(), 6)
        self.assertEqual(current.forecast_path[2].date.weekday(), 0)
        self.assertEqual(current.forecast_path[0].point_forecast, series.observations[-1].value)
        self.assertEqual(current.forecast_path[1].point_forecast, series.observations[-1].value)
        self.assertEqual(current.forecast_path[2].point_forecast, 1.0)

    def test_current_forecast_damped_holt_fits_once_for_full_path_and_all_anchors(self) -> None:
        @dataclass(frozen=True)
        class FakePathFit:
            metadata: ForecastMetadata

            def forecast_path(self, horizon_steps: int) -> tuple[float, ...]:
                return tuple(float(step) for step in range(1, horizon_steps + 1))

        series = business_daily_series(70, start=date(2025, 1, 6))
        service = RollingDailyPointInTimeService(
            DampedHoltModel(),
            RollingDailyPointInTimeConfig(minimum_training_observations=20, minimum_calibration_samples=999),
        )
        fake_fit = FakePathFit(
            metadata=ForecastMetadata(
                model_family="damped_holt",
                selected_variant="DAMPED_HOLT_ADDITIVE",
            )
        )

        with patch("forecasting.rolling_daily_point_in_time.fit_damped_holt_endog", return_value=fake_fit) as mocked_fit:
            current = service.generate_current_forecast(series)

        self.assertEqual(mocked_fit.call_count, 1)
        self.assertEqual(current.status, ForecastAvailabilityStatus.AVAILABLE)
        self.assertEqual(set(current.anchors), {"1M", "3M", "6M", "12M"})
        self.assertEqual(current.metadata.selected_variant, "DAMPED_HOLT_ADDITIVE")

    def test_current_forecast_ets_uses_non_seasonal_catalog_once_for_full_path_and_all_anchors(self) -> None:
        @dataclass(frozen=True)
        class FakePathFit:
            metadata: ForecastMetadata

            def forecast_path(self, horizon_steps: int) -> tuple[float, ...]:
                return tuple(float(step) for step in range(1, horizon_steps + 1))

        series = business_daily_series(70, start=date(2025, 1, 6))
        service = RollingDailyPointInTimeService(
            ETSModelFamily(),
            RollingDailyPointInTimeConfig(minimum_training_observations=20, minimum_calibration_samples=999),
        )
        fake_fit = FakePathFit(
            metadata=ForecastMetadata(
                model_family="ets",
                selected_variant="ETS(A,N,N)",
                selection_metric="AICc",
                selection_score=123.0,
            )
        )

        with patch("forecasting.rolling_daily_point_in_time.fit_selected_ets_endog", return_value=fake_fit) as mocked_fit:
            current = service.generate_current_forecast(series)

        self.assertEqual(mocked_fit.call_count, 1)
        _, kwargs = mocked_fit.call_args
        self.assertEqual(kwargs["candidates"], NON_SEASONAL_ETS_CANDIDATES)
        self.assertEqual(kwargs["seasonal_periods"], 0)
        self.assertEqual(current.status, ForecastAvailabilityStatus.AVAILABLE)
        self.assertEqual(current.metadata.selected_variant, "ETS(A,N,N)")

    def test_current_forecast_arima_fits_once_for_full_path_and_all_anchors(self) -> None:
        series = business_daily_series(70, start=date(2025, 1, 6))
        service = RollingDailyPointInTimeService(
            ARIMAModelFamily(),
            RollingDailyPointInTimeConfig(minimum_training_observations=60, minimum_calibration_samples=999),
        )

        with patch("forecasting.rolling_daily_point_in_time.fit_selected_arima_endog", wraps=__import__("forecasting.models.arima", fromlist=["fit_selected_arima_endog"]).fit_selected_arima_endog) as mocked_fit:
            current = service.generate_current_forecast(series)

        self.assertEqual(mocked_fit.call_count, 1)
        self.assertEqual(current.status, ForecastAvailabilityStatus.AVAILABLE)
        self.assertEqual(set(current.anchors), {"1M", "3M", "6M", "12M"})
        self.assertEqual(current.metadata.model_family, "arima")

    def test_arima_same_origin_ignores_future_shock(self) -> None:
        baseline = business_daily_series(70, start=date(2025, 1, 6), step=2.0)
        extended = TimeSeries(
            series_id=baseline.series_id,
            benchmark_name=baseline.benchmark_name,
            description=baseline.description,
            frequency=baseline.frequency,
            observations=baseline.observations + (
                Observation(date=baseline.end + timedelta(days=3), value=5000.0),
                Observation(date=baseline.end + timedelta(days=4), value=8000.0),
                Observation(date=baseline.end + timedelta(days=7), value=13000.0),
            ),
        )

        baseline_fit = __import__("forecasting.rolling_daily_point_in_time", fromlist=["fit_path_model"]).fit_path_model(
            ARIMAModelFamily(),
            baseline.observations,
        )
        matching_fit = __import__("forecasting.rolling_daily_point_in_time", fromlist=["fit_path_model"]).fit_path_model(
            ARIMAModelFamily(),
            extended.observations[: len(baseline.observations)],
        )

        self.assertEqual(baseline_fit.metadata.selected_variant, matching_fit.metadata.selected_variant)
        self.assertEqual(baseline_fit.metadata.selection_metric, matching_fit.metadata.selection_metric)
        self.assertAlmostEqual(baseline_fit.metadata.selection_score or 0.0, matching_fit.metadata.selection_score or 0.0, places=9)
        self.assertEqual(baseline_fit.forecast_path(40), matching_fit.forecast_path(40))

    def test_current_forecast_arima_is_deterministic_for_same_input(self) -> None:
        series = business_daily_series(70, start=date(2025, 1, 6), step=1.5)
        service = RollingDailyPointInTimeService(
            ARIMAModelFamily(),
            RollingDailyPointInTimeConfig(minimum_training_observations=60, minimum_calibration_samples=999),
        )

        first = service.generate_current_forecast(series)
        second = service.generate_current_forecast(series)

        self.assertEqual(first.status, ForecastAvailabilityStatus.AVAILABLE)
        self.assertEqual(second.status, ForecastAvailabilityStatus.AVAILABLE)
        self.assertEqual(first.metadata.selected_variant, second.metadata.selected_variant)
        self.assertAlmostEqual(first.metadata.selection_score or 0.0, second.metadata.selection_score or 0.0, places=9)
        self.assertEqual(first.forecast_path, second.forecast_path)
        self.assertEqual(first.anchors, second.anchors)

    def test_current_forecast_anchors_are_resolved_from_same_generated_path(self) -> None:
        @dataclass(frozen=True)
        class FakePathFit:
            metadata: ForecastMetadata

            def forecast_path(self, horizon_steps: int) -> tuple[float, ...]:
                return tuple(float(step) for step in range(1, horizon_steps + 1))

        series = business_daily_series(70, start=date(2025, 1, 6))
        service = RollingDailyPointInTimeService(
            NaiveLastValueModel(),
            RollingDailyPointInTimeConfig(minimum_training_observations=20, minimum_calibration_samples=999),
        )
        fake_fit = FakePathFit(
            metadata=ForecastMetadata(
                model_family="fake",
                selected_variant="FAKE_PATH",
            )
        )

        with patch("forecasting.rolling_daily_point_in_time.fit_path_model", return_value=fake_fit) as mocked_fit:
            current = service.generate_current_forecast(series)

        self.assertEqual(mocked_fit.call_count, 1)
        path_by_date = {point.date: point for point in current.forecast_path}
        for horizon_label, anchor in current.anchors.items():
            self.assertIn(anchor.target_calendar_date, path_by_date)
            self.assertEqual(anchor.forecast_value, path_by_date[anchor.target_calendar_date].point_forecast, horizon_label)

    def test_current_forecast_covers_full_12m_calendar_horizon_at_month_end(self) -> None:
        series = daily_series_from_dates(
            [
                date(2024, 11, 25),
                date(2024, 11, 26),
                date(2024, 11, 27),
                date(2024, 11, 28),
                date(2024, 11, 29),
                date(2024, 12, 2),
                date(2024, 12, 3),
                date(2024, 12, 4),
                date(2024, 12, 5),
                date(2024, 12, 6),
                date(2024, 12, 9),
                date(2024, 12, 10),
                date(2024, 12, 11),
                date(2024, 12, 12),
                date(2024, 12, 13),
                date(2024, 12, 16),
                date(2024, 12, 17),
                date(2024, 12, 18),
                date(2024, 12, 19),
                date(2024, 12, 20),
                date(2024, 12, 23),
                date(2024, 12, 24),
                date(2024, 12, 25),
                date(2024, 12, 26),
                date(2024, 12, 27),
                date(2024, 12, 30),
                date(2024, 12, 31),
                date(2025, 1, 1),
                date(2025, 1, 2),
                date(2025, 1, 3),
                date(2025, 1, 6),
                date(2025, 1, 7),
                date(2025, 1, 8),
                date(2025, 1, 9),
                date(2025, 1, 10),
                date(2025, 1, 13),
                date(2025, 1, 14),
                date(2025, 1, 15),
                date(2025, 1, 16),
                date(2025, 1, 17),
                date(2025, 1, 20),
                date(2025, 1, 21),
                date(2025, 1, 22),
                date(2025, 1, 23),
                date(2025, 1, 24),
                date(2025, 1, 27),
                date(2025, 1, 28),
                date(2025, 1, 29),
                date(2025, 1, 30),
                date(2025, 1, 31),
            ]
        )
        service = RollingDailyPointInTimeService(
            NaiveLastValueModel(),
            RollingDailyPointInTimeConfig(minimum_training_observations=20, minimum_calibration_samples=999),
        )

        current = service.generate_current_forecast(series)

        self.assertEqual(current.origin_date, date(2025, 1, 31))
        self.assertEqual(current.anchors["1M"].target_calendar_date, date(2025, 2, 28))
        self.assertEqual(current.anchors["12M"].target_calendar_date, date(2026, 1, 31))
        self.assertEqual(current.forecast_path[-1].date, date(2026, 1, 31))
        self.assertEqual(current.anchors["12M"].target_calendar_date, current.forecast_path[-1].date)

    def test_damped_holt_future_shock_does_not_change_same_origin_forecast(self) -> None:
        baseline = business_daily_series(90, step=2.0)
        extended = TimeSeries(
            series_id=baseline.series_id,
            benchmark_name=baseline.benchmark_name,
            description=baseline.description,
            frequency=baseline.frequency,
            observations=baseline.observations + (
                Observation(date=baseline.end + timedelta(days=1), value=5000.0),
                Observation(date=baseline.end + timedelta(days=2), value=8000.0),
                Observation(date=baseline.end + timedelta(days=5), value=13000.0),
            ),
        )
        service = RollingDailyPointInTimeService(DampedHoltModel(), RollingDailyPointInTimeConfig(minimum_training_observations=60))

        baseline_backtest = service.generate_backtest(baseline)
        extended_backtest = service.generate_backtest(extended)

        baseline_first = baseline_backtest["1M"].records[0]
        matching_extended = next(record for record in extended_backtest["1M"].records if record.forecast_origin == baseline_first.forecast_origin)
        self.assertAlmostEqual(baseline_first.forecast_value, matching_extended.forecast_value, places=8)
        self.assertEqual(baseline_first.metadata.selected_variant, matching_extended.metadata.selected_variant)

    def test_ets_future_shock_does_not_change_same_origin_forecast(self) -> None:
        baseline = business_daily_series(90, step=0.5)
        extended = TimeSeries(
            series_id=baseline.series_id,
            benchmark_name=baseline.benchmark_name,
            description=baseline.description,
            frequency=baseline.frequency,
            observations=baseline.observations + (
                Observation(date=baseline.end + timedelta(days=1), value=5000.0),
                Observation(date=baseline.end + timedelta(days=2), value=8000.0),
                Observation(date=baseline.end + timedelta(days=5), value=13000.0),
            ),
        )
        service = RollingDailyPointInTimeService(ETSModelFamily(), RollingDailyPointInTimeConfig(minimum_training_observations=60))

        baseline_backtest = service.generate_backtest(baseline)
        extended_backtest = service.generate_backtest(extended)

        baseline_first = baseline_backtest["1M"].records[0]
        matching_extended = next(record for record in extended_backtest["1M"].records if record.forecast_origin == baseline_first.forecast_origin)
        self.assertAlmostEqual(baseline_first.forecast_value, matching_extended.forecast_value, places=8)
        self.assertEqual(baseline_first.metadata.selected_variant, matching_extended.metadata.selected_variant)

    def test_future_targets_are_not_yet_matured_and_do_not_receive_fake_actuals(self) -> None:
        series = business_daily_series(90, start=date(2026, 1, 5))
        service = RollingDailyPointInTimeService(
            NaiveLastValueModel(),
            RollingDailyPointInTimeConfig(minimum_training_observations=20),
        )

        backtest = service.generate_backtest(series)
        latest_record = max(backtest["12M"].records, key=lambda record: record.forecast_origin)

        self.assertEqual(latest_record.maturity_status, MaturityStatus.NOT_YET_MATURED)
        self.assertIsNone(latest_record.verification_observation_date)
        self.assertIsNone(latest_record.actual_value)
        self.assertIsNone(latest_record.error)
        self.assertIsNone(latest_record.residual)

    def test_past_weekend_target_is_matured_and_resolves_previous_lawful_observation(self) -> None:
        series = daily_series_from_dates(
            [
                date(2024, 2, 5),
                date(2024, 2, 6),
                date(2024, 2, 7),
                date(2024, 2, 8),
                date(2024, 2, 9),
                date(2024, 2, 12),
                date(2024, 2, 13),
                date(2024, 2, 14),
                date(2024, 2, 15),
                date(2024, 2, 16),
                date(2024, 3, 15),
                date(2024, 3, 18),
            ],
            start_value=100.0,
            step=1.0,
        )
        service = RollingDailyPointInTimeService(
            NaiveLastValueModel(),
            RollingDailyPointInTimeConfig(minimum_training_observations=5),
        )

        backtest = service.generate_backtest(series)
        record = next(record for record in backtest["1M"].records if record.forecast_origin == date(2024, 2, 16))

        self.assertEqual(record.target_calendar_date, date(2024, 3, 16))
        self.assertEqual(record.maturity_status, MaturityStatus.MATURED)
        self.assertEqual(record.verification_observation_date, date(2024, 3, 15))
        self.assertIsNotNone(record.error)
        self.assertIsNotNone(record.residual)
        self.assertAlmostEqual(record.residual, -record.error)

    def test_metrics_exclude_not_yet_matured_records_and_report_horizon_counts(self) -> None:
        series = business_daily_series(330, start=date(2025, 1, 1))
        service = RollingDailyPointInTimeService(
            NaiveLastValueModel(),
            RollingDailyPointInTimeConfig(minimum_training_observations=20),
        )

        backtest = service.generate_backtest(series)

        self.assertGreater(backtest["1M"].matured_forecasts, backtest["12M"].matured_forecasts)
        self.assertGreater(backtest["12M"].not_yet_matured_forecasts, 0)
        self.assertEqual(backtest["12M"].total_forecasts, len(backtest["12M"].records))
        self.assertEqual(
            backtest["12M"].matured_forecasts + backtest["12M"].not_yet_matured_forecasts,
            backtest["12M"].total_forecasts,
        )
        matured_records = [record for record in backtest["12M"].records if record.maturity_status is MaturityStatus.MATURED]
        if matured_records:
            self.assertIsNotNone(backtest["12M"].metrics)
            self.assertEqual(len(matured_records), backtest["12M"].matured_forecasts)


class PredictionBandTests(unittest.TestCase):
    def test_empirical_quantile_is_deterministic_and_asymmetric(self) -> None:
        residuals = [-4.0, -2.0, -1.0, 0.0, 3.0, 7.0, 10.0]
        self.assertAlmostEqual(empirical_quantile(residuals, 0.10), -2.8)
        self.assertAlmostEqual(empirical_quantile(residuals, 0.90), 8.2)

    def test_builds_horizon_specific_calibration_and_insufficient_state(self) -> None:
        record_template = lambda horizon, origin, actual, forecast: type(
            "Record",
            (),
            {
                "horizon": horizon,
                "verification_observation_date": origin,
                "actual_value": actual,
                "forecast_value": forecast,
            },
        )()
        backtest = {
            "1M": RollingDailyHorizonBacktestResult(
                origins=3,
                expected_origins=3,
                failed_origins=0,
                coverage=1.0,
                records=(
                    record_template("1M", date(2026, 1, 1), 10.0, 12.0),
                    record_template("1M", date(2026, 1, 2), 10.0, 9.0),
                    record_template("1M", date(2026, 1, 3), 10.0, 8.0),
                ),
                failures=(),
                metrics=None,
            ),
            "3M": RollingDailyHorizonBacktestResult(
                origins=1,
                expected_origins=1,
                failed_origins=0,
                coverage=1.0,
                records=(record_template("3M", date(2026, 1, 1), 10.0, 9.0),),
                failures=(),
                metrics=None,
            ),
        }

        summaries = build_calibration_summaries(backtest, date(2026, 1, 31), minimum_calibration_samples=2)

        self.assertEqual(summaries["1M"].status, BandStatus.AVAILABLE)
        self.assertEqual(summaries["1M"].sample_count, 3)
        self.assertEqual(summaries["3M"].status, BandStatus.INSUFFICIENT_CALIBRATION_HISTORY)


class RollingDailyLivePreparationTests(unittest.TestCase):
    def test_null_placeholders_and_duplicate_dates_are_not_lawful_observations(self) -> None:
        payload = {
            "frequency": "daily",
            "seriesId": "wocaes0074",
            "displayName": "Brent",
            "historical": [
                {"date": "2026-01-01T00:00:00.000Z", "value": 10.0},
                {"date": "2026-01-02T00:00:00.000Z", "value": None},
                {"date": "2026-01-05T00:00:00.000Z", "value": 11.0},
                {"date": "2026-01-05T00:00:00.000Z", "value": 12.0},
            ],
        }

        series, stats, _ = _build_daily_series(payload)

        self.assertEqual(series.observation_count, 2)
        self.assertEqual([observation.date for observation in series.observations], [date(2026, 1, 1), date(2026, 1, 5)])
        self.assertEqual(stats["nullPlaceholdersExcluded"], 1)
        self.assertEqual(stats["duplicateDatesExcluded"], 1)


if __name__ == "__main__":
    unittest.main()