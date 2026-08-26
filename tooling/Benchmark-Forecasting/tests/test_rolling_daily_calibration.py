from __future__ import annotations

import unittest
from datetime import date, timedelta

from forecasting.contracts import Frequency, Observation, TimeSeries
from forecasting.models.naive import NaiveLastValueModel
from forecasting.rolling_daily_calibration import (
    CalibrationResultStatus,
    ResidualCalibrationRecord,
    build_calibration_summary_map,
    build_group_calibration_results,
    empirical_quantile_type7,
    select_available_residuals,
)
from forecasting.rolling_daily_contracts import BandStatus, CalibrationSummary, MaturityStatus
from forecasting.rolling_daily_policy import (
    ROLLING_DAILY_DEFAULT_CONFIGURED_CALIBRATION_MINIMUM_SAMPLES,
    ROLLING_DAILY_METHODOLOGICAL_CALIBRATION_MINIMUM_STATUS,
)
from forecasting.rolling_daily_point_in_time import RollingDailyPointInTimeConfig, RollingDailyPointInTimeService


def business_daily_series(length: int, start: date = date(2026, 1, 1), start_value: float = 100.0) -> TimeSeries:
    observations: list[Observation] = []
    current_date = start
    current_value = start_value
    while len(observations) < length:
        if current_date.weekday() < 5:
            observations.append(Observation(date=current_date, value=current_value))
            current_value += 1.0
        current_date += timedelta(days=1)
    return TimeSeries(
        series_id="wocaes0074",
        benchmark_name="Brent",
        description="Synthetic weekday-only daily series",
        frequency=Frequency.DAILY,
        observations=tuple(observations),
    )


def calibration_record(
    *,
    benchmark_id: str = "wocaes0074",
    model_id: str = "naive",
    method_id: str = "ROLLING_DAILY_POINT_IN_TIME",
    horizon: str = "1M",
    horizon_months: int = 1,
    forecast_origin: date = date(2026, 1, 5),
    target_calendar_date: date = date(2026, 2, 5),
    verification_observation_date: date | None = date(2026, 2, 5),
    maturity_status: MaturityStatus = MaturityStatus.MATURED,
    forecast_value: float = 100.0,
    actual_value: float | None = 95.0,
    residual: float | None = -5.0,
) -> ResidualCalibrationRecord:
    return ResidualCalibrationRecord(
        benchmark_id=benchmark_id,
        model_id=model_id,
        method_id=method_id,
        horizon=horizon,
        horizon_months=horizon_months,
        forecast_origin=forecast_origin,
        target_calendar_date=target_calendar_date,
        verification_observation_date=verification_observation_date,
        maturity_status=maturity_status,
        forecast_value=forecast_value,
        actual_value=actual_value,
        residual=residual,
    )


class RollingDailyCalibrationTests(unittest.TestCase):
    def test_stage4_record_parser_uses_canonical_field_names(self) -> None:
        record = ResidualCalibrationRecord.from_stage4_dict(
            {
                "benchmarkId": "wocaes0074",
                "model": "naive",
                "forecastMethod": "ROLLING_DAILY_POINT_IN_TIME",
                "horizon": "1M",
                "horizonMonths": 1,
                "originDate": "2026-01-05",
                "targetCalendarDate": "2026-02-05",
                "verificationObservationDate": "2026-02-05",
                "maturityStatus": "MATURED",
                "forecast": 100.0,
                "actual": 95.0,
                "residual": -5.0,
            }
        )

        self.assertEqual(record.forecast_origin, date(2026, 1, 5))
        self.assertEqual(record.forecast_value, 100.0)
        self.assertEqual(record.residual, -5.0)

    def test_grouping_preserves_benchmark_model_method_and_horizon(self) -> None:
        records = [
            calibration_record(residual=-5.0),
            calibration_record(model_id="damped_holt", residual=-7.0),
            calibration_record(horizon="3M", horizon_months=3, residual=11.0),
            calibration_record(benchmark_id="other-benchmark", residual=4.0),
            calibration_record(method_id="OTHER_METHOD", residual=3.0),
            calibration_record(maturity_status=MaturityStatus.NOT_YET_MATURED, verification_observation_date=None, actual_value=None, residual=None),
        ]

        grouped = build_group_calibration_results(
            records=records,
            calibration_origin=date(2026, 12, 31),
            minimum_calibration_samples=1,
        )

        self.assertEqual(len(grouped), 5)
        self.assertEqual(grouped[next(key for key in grouped if key.model_id == "naive" and key.horizon == "1M" and key.benchmark_id == "wocaes0074" and key.method_id == "ROLLING_DAILY_POINT_IN_TIME")].sample_count, 1)
        self.assertEqual(grouped[next(key for key in grouped if key.model_id == "damped_holt")].sample_count, 1)
        self.assertEqual(grouped[next(key for key in grouped if key.horizon == "3M")].sample_count, 1)
        self.assertEqual(grouped[next(key for key in grouped if key.benchmark_id == "other-benchmark")].sample_count, 1)
        self.assertEqual(grouped[next(key for key in grouped if key.method_id == "OTHER_METHOD")].sample_count, 1)

    def test_quantile_convention_type7_is_deterministic(self) -> None:
        values = [0.0, 10.0, 20.0, 30.0, 40.0]

        self.assertAlmostEqual(empirical_quantile_type7(values, 0.10), 4.0)
        self.assertAlmostEqual(empirical_quantile_type7(values, 0.90), 36.0)

    def test_calibration_no_leakage_uses_verification_availability_date(self) -> None:
        calibration_origin = date(2026, 3, 1)
        available_record = calibration_record(
            verification_observation_date=date(2026, 2, 15),
            target_calendar_date=date(2026, 2, 15),
            residual=-2.0,
        )
        future_record = calibration_record(
            forecast_origin=date(2026, 2, 20),
            target_calendar_date=date(2026, 3, 20),
            verification_observation_date=date(2026, 3, 20),
            residual=9.0,
        )

        selected = select_available_residuals([available_record, future_record], calibration_origin)

        self.assertEqual(selected, [available_record])

    def test_insufficient_history_status_does_not_remove_point_forecast(self) -> None:
        series = business_daily_series(70)
        summaries = build_calibration_summary_map(
            records=[calibration_record(residual=-5.0)],
            calibration_origin=series.end,
            minimum_calibration_samples=2,
            benchmark_id="wocaes0074",
            model_id="naive",
            method_id="ROLLING_DAILY_POINT_IN_TIME",
        )
        service = RollingDailyPointInTimeService(
            NaiveLastValueModel(),
            RollingDailyPointInTimeConfig(minimum_training_observations=20),
        )

        current = service.generate_current_forecast(series, calibration_summaries=summaries)

        self.assertEqual(current.status.value, "AVAILABLE")
        self.assertEqual(current.anchors["1M"].band_status, BandStatus.INSUFFICIENT_CALIBRATION_HISTORY)
        self.assertIsNone(current.anchors["1M"].lower_p10)
        self.assertIsNone(current.anchors["1M"].upper_p90)
        self.assertIsNotNone(current.anchors["1M"].forecast_value)

    def test_asymmetric_residual_distribution_produces_asymmetric_band(self) -> None:
        series = business_daily_series(70, start_value=100.0)
        service = RollingDailyPointInTimeService(
            NaiveLastValueModel(),
            RollingDailyPointInTimeConfig(minimum_training_observations=20),
        )
        summaries = {
            "1M": CalibrationSummary(
                horizon="1M",
                sample_count=100,
                residual_p10=-5.0,
                residual_p90=20.0,
                status=BandStatus.AVAILABLE,
            )
        }

        current = service.generate_current_forecast(series, calibration_summaries=summaries)

        self.assertEqual(current.anchors["1M"].forecast_value, 169.0)
        self.assertEqual(current.anchors["1M"].lower_p10, 164.0)
        self.assertEqual(current.anchors["1M"].upper_p90, 189.0)

    def test_current_band_formula_uses_point_plus_empirical_quantiles(self) -> None:
        series = business_daily_series(70, start_value=100.0)
        service = RollingDailyPointInTimeService(
            NaiveLastValueModel(),
            RollingDailyPointInTimeConfig(minimum_training_observations=20),
        )
        summaries = {
            "1M": CalibrationSummary(
                horizon="1M",
                sample_count=100,
                residual_p10=-7.0,
                residual_p90=11.0,
                status=BandStatus.AVAILABLE,
            )
        }

        current = service.generate_current_forecast(series, calibration_summaries=summaries)

        self.assertEqual(current.anchors["1M"].forecast_value, 169.0)
        self.assertEqual(current.anchors["1M"].lower_p10, 162.0)
        self.assertEqual(current.anchors["1M"].upper_p90, 180.0)

    def test_group_result_reports_insufficient_history(self) -> None:
        result = build_group_calibration_results(
            records=[calibration_record(residual=-1.0)],
            calibration_origin=date(2026, 12, 31),
            minimum_calibration_samples=2,
        )

        only_result = next(iter(result.values()))
        self.assertEqual(only_result.status, CalibrationResultStatus.INSUFFICIENT_CALIBRATION_HISTORY)
        self.assertIsNone(only_result.residual_p10)
        self.assertIsNone(only_result.residual_p90)

    def test_calibration_availability_is_driven_by_policy_input_not_hidden_threshold(self) -> None:
        records = [
            calibration_record(residual=-4.0),
            calibration_record(forecast_origin=date(2026, 1, 6), verification_observation_date=date(2026, 2, 6), residual=-1.0),
            calibration_record(forecast_origin=date(2026, 1, 7), verification_observation_date=date(2026, 2, 7), residual=3.0),
        ]

        available = next(iter(build_group_calibration_results(
            records=records,
            calibration_origin=date(2026, 12, 31),
            minimum_calibration_samples=1,
        ).values()))
        insufficient = next(iter(build_group_calibration_results(
            records=records,
            calibration_origin=date(2026, 12, 31),
            minimum_calibration_samples=4,
        ).values()))

        self.assertEqual(ROLLING_DAILY_DEFAULT_CONFIGURED_CALIBRATION_MINIMUM_SAMPLES, 30)
        self.assertEqual(ROLLING_DAILY_METHODOLOGICAL_CALIBRATION_MINIMUM_STATUS, 'OPEN_REQUIRES_MORE_BENCHMARK_VALIDATION')
        self.assertEqual(available.status, CalibrationResultStatus.AVAILABLE)
        self.assertEqual(insufficient.status, CalibrationResultStatus.INSUFFICIENT_CALIBRATION_HISTORY)


if __name__ == "__main__":
    unittest.main()