from __future__ import annotations

import unittest
from datetime import date, timedelta

from forecasting.contracts import Frequency, Observation, TimeSeries
from forecasting.empirical_prediction_band import (
    build_group_residual_quantile_diagnostics,
    build_historical_band_validation_summaries,
    runtime_record_to_residual_calibration_record,
)
from forecasting.models.naive import NaiveLastValueModel
from forecasting.rolling_daily_calibration import ResidualCalibrationRecord
from forecasting.rolling_daily_contracts import BandStatus, CalibrationSummary, MaturityStatus
from forecasting.rolling_daily_point_in_time import RollingDailyPointInTimeConfig, RollingDailyPointInTimeService


def business_daily_series(length: int, start: date = date(2025, 1, 6), start_value: float = 100.0) -> TimeSeries:
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


def record(
    *,
    forecast_origin: date,
    verification_observation_date: date,
    target_calendar_date: date,
    forecast_value: float,
    actual_value: float,
    residual: float,
    horizon: str = "1M",
    horizon_months: int = 1,
) -> ResidualCalibrationRecord:
    return ResidualCalibrationRecord(
        benchmark_id="wocaes0074",
        model_id="arima",
        method_id="ROLLING_DAILY_POINT_IN_TIME",
        horizon=horizon,
        horizon_months=horizon_months,
        forecast_origin=forecast_origin,
        target_calendar_date=target_calendar_date,
        verification_observation_date=verification_observation_date,
        maturity_status=MaturityStatus.MATURED,
        forecast_value=forecast_value,
        actual_value=actual_value,
        residual=residual,
    )


class EmpiricalPredictionBandTests(unittest.TestCase):
    def test_runtime_record_conversion_preserves_canonical_residual_fields(self) -> None:
        converted = runtime_record_to_residual_calibration_record(
            {
                "seriesId": "wocaes0074",
                "modelId": "arima",
                "methodId": "ROLLING_DAILY_POINT_IN_TIME",
                "horizonLabel": "1M",
                "horizonMonths": 1,
                "forecastOriginAt": "2026-01-05T00:00:00.000Z",
                "targetCalendarDate": "2026-02-05",
                "verificationObservedAt": "2026-02-05T00:00:00.000Z",
                "maturityStatus": "MATURED",
                "forecastValue": 100.0,
                "actualValue": 95.0,
                "residualValue": -5.0,
            }
        )

        self.assertEqual(converted.forecast_origin, date(2026, 1, 5))
        self.assertEqual(converted.verification_observation_date, date(2026, 2, 5))
        self.assertEqual(converted.forecast_value, 100.0)
        self.assertEqual(converted.actual_value, 95.0)
        self.assertEqual(converted.residual, -5.0)

    def test_quantile_diagnostics_are_order_independent_and_include_median(self) -> None:
        records = [
            record(forecast_origin=date(2026, 1, 5), verification_observation_date=date(2026, 2, 1), target_calendar_date=date(2026, 2, 1), forecast_value=100.0, actual_value=97.0, residual=-3.0),
            record(forecast_origin=date(2026, 1, 6), verification_observation_date=date(2026, 2, 2), target_calendar_date=date(2026, 2, 2), forecast_value=100.0, actual_value=99.0, residual=-1.0),
            record(forecast_origin=date(2026, 1, 7), verification_observation_date=date(2026, 2, 3), target_calendar_date=date(2026, 2, 3), forecast_value=100.0, actual_value=104.0, residual=4.0),
            record(forecast_origin=date(2026, 1, 8), verification_observation_date=date(2026, 2, 4), target_calendar_date=date(2026, 2, 4), forecast_value=100.0, actual_value=110.0, residual=10.0),
        ]
        reversed_records = list(reversed(records))

        forward = build_group_residual_quantile_diagnostics(records, calibration_origin=date(2026, 3, 1), minimum_calibration_samples=4)
        backward = build_group_residual_quantile_diagnostics(reversed_records, calibration_origin=date(2026, 3, 1), minimum_calibration_samples=4)

        forward_item = next(iter(forward.values()))
        backward_item = next(iter(backward.values()))
        self.assertEqual(forward_item.sample_count, 4)
        self.assertEqual(forward_item.residual_p50, 1.5)
        self.assertEqual(forward_item.residual_p10, backward_item.residual_p10)
        self.assertEqual(forward_item.residual_p50, backward_item.residual_p50)
        self.assertEqual(forward_item.residual_p90, backward_item.residual_p90)

    def test_historical_validation_uses_availability_cutoff_without_model_fit(self) -> None:
        records = [
            record(forecast_origin=date(2026, 1, 5), verification_observation_date=date(2026, 2, 1), target_calendar_date=date(2026, 2, 1), forecast_value=100.0, actual_value=97.0, residual=-3.0),
            record(forecast_origin=date(2026, 1, 6), verification_observation_date=date(2026, 2, 2), target_calendar_date=date(2026, 2, 2), forecast_value=100.0, actual_value=99.0, residual=-1.0),
            record(forecast_origin=date(2026, 2, 10), verification_observation_date=date(2026, 3, 10), target_calendar_date=date(2026, 3, 10), forecast_value=100.0, actual_value=98.0, residual=-2.0),
        ]

        summary = build_historical_band_validation_summaries(records, minimum_calibration_samples=2)[0]

        self.assertEqual(summary.insufficient_history_cases, 2)
        self.assertEqual(summary.evaluated_historical_bands, 1)
        self.assertEqual(summary.first_available_origin, date(2026, 2, 10))
        self.assertAlmostEqual(float(summary.diagnostic_coverage), 1.0)

    def test_point_forecast_may_sit_outside_band_without_recentering(self) -> None:
        series = business_daily_series(70)
        service = RollingDailyPointInTimeService(
            NaiveLastValueModel(),
            RollingDailyPointInTimeConfig(minimum_training_observations=20),
        )
        summaries = {
            "1M": CalibrationSummary(
                horizon="1M",
                sample_count=100,
                residual_p10=4.0,
                residual_p90=10.0,
                status=BandStatus.AVAILABLE,
            )
        }

        current = service.generate_current_forecast(series, calibration_summaries=summaries)

        self.assertGreater(float(current.anchors["1M"].lower_p10), float(current.anchors["1M"].forecast_value))
        self.assertGreater(float(current.anchors["1M"].upper_p90), float(current.anchors["1M"].forecast_value))

    def test_band_attachment_preserves_point_date_grid_and_point_values(self) -> None:
        series = business_daily_series(70)
        service = RollingDailyPointInTimeService(
            NaiveLastValueModel(),
            RollingDailyPointInTimeConfig(minimum_training_observations=20),
        )
        without_bands = service.generate_current_forecast(series, calibration_summaries=None)
        with_bands = service.generate_current_forecast(
            series,
            calibration_summaries={
                "1M": CalibrationSummary(horizon="1M", sample_count=100, residual_p10=-3.0, residual_p90=7.0, status=BandStatus.AVAILABLE),
                "3M": CalibrationSummary(horizon="3M", sample_count=100, residual_p10=-8.0, residual_p90=20.0, status=BandStatus.AVAILABLE),
                "6M": CalibrationSummary(horizon="6M", sample_count=100, residual_p10=-11.0, residual_p90=30.0, status=BandStatus.AVAILABLE),
                "12M": CalibrationSummary(horizon="12M", sample_count=100, residual_p10=-15.0, residual_p90=35.0, status=BandStatus.AVAILABLE),
            },
        )

        self.assertEqual(
            [point.date for point in without_bands.forecast_path],
            [point.date for point in with_bands.forecast_path],
        )
        self.assertEqual(
            [point.point_forecast for point in without_bands.forecast_path],
            [point.point_forecast for point in with_bands.forecast_path],
        )

    def test_canonical_origin_to_1m_path_has_no_pre_1m_missing_rows(self) -> None:
        series = business_daily_series(80)
        config = RollingDailyPointInTimeConfig(minimum_training_observations=20)
        service = RollingDailyPointInTimeService(NaiveLastValueModel(), config)
        summaries = {
            "1M": CalibrationSummary(horizon="1M", sample_count=659, residual_p10=-7.447065428, residual_p90=7.427345650000007, status=BandStatus.AVAILABLE),
            "3M": CalibrationSummary(horizon="3M", sample_count=615, residual_p10=-12.584608044, residual_p90=16.89735407600004, status=BandStatus.AVAILABLE),
            "6M": CalibrationSummary(horizon="6M", sample_count=553, residual_p10=-12.408579959999999, residual_p90=30.986183802000003, status=BandStatus.AVAILABLE),
            "12M": CalibrationSummary(horizon="12M", sample_count=423, residual_p10=-19.512656728, residual_p90=31.017605450000012, status=BandStatus.AVAILABLE),
        }

        current = service.generate_current_forecast(series, calibration_summaries=summaries)
        pre_1m_points = [point for point in current.forecast_path if point.date < current.anchors["1M"].target_calendar_date]
        first_post_origin = pre_1m_points[0]

        self.assertTrue(pre_1m_points)
        self.assertEqual(first_post_origin.band_status, BandStatus.AVAILABLE)
        self.assertIsNotNone(first_post_origin.lower_p10)
        self.assertIsNotNone(first_post_origin.upper_p90)
        self.assertLess(float(first_post_origin.p10_residual_offset), 0.0)
        self.assertGreater(float(first_post_origin.p90_residual_offset), 0.0)
        self.assertEqual(current.anchors["1M"].p10_residual_offset, -7.447065428)
        self.assertEqual(current.anchors["1M"].p90_residual_offset, 7.427345650000007)


if __name__ == "__main__":
    unittest.main()