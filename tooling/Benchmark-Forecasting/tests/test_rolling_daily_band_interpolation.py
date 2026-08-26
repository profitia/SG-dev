from __future__ import annotations

import unittest
from dataclasses import dataclass
from datetime import date, timedelta
from unittest.mock import patch

from forecasting.contracts import ForecastMetadata, Frequency, Observation, TimeSeries
from forecasting.models.naive import NaiveLastValueModel
from forecasting.rolling_daily_band_interpolation import interpolate_daily_band
from forecasting.rolling_daily_contracts import BandSource, BandStatus, CalibrationSummary
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


def summary(horizon: str, p10: float | None, p90: float | None, status: BandStatus, sample_count: int = 100) -> CalibrationSummary:
    return CalibrationSummary(
        horizon=horizon,
        sample_count=sample_count,
        residual_p10=p10,
        residual_p90=p90,
        status=status,
    )


class RollingDailyBandInterpolationTests(unittest.TestCase):
    def test_before_first_anchor_interpolates_from_origin_zero_offsets(self) -> None:
        ordered_horizons = [("1M", 1), ("3M", 3)]
        origin_date = date(2026, 1, 1)
        anchor_dates = {"1M": date(2026, 2, 1), "3M": date(2026, 4, 1)}
        result = interpolate_daily_band(
            origin_date=origin_date,
            target_date=date(2026, 1, 20),
            point_forecast=100.0,
            anchor_dates=anchor_dates,
            calibration_summaries={"1M": summary("1M", -4.0, 8.0, BandStatus.AVAILABLE), "3M": summary("3M", -10.0, 20.0, BandStatus.AVAILABLE)},
            ordered_horizons=ordered_horizons,
        )

        expected_fraction = 19 / 31
        self.assertEqual(result.band_status, BandStatus.AVAILABLE)
        self.assertEqual(result.band_source, BandSource.INTERPOLATED_BETWEEN_EMPIRICAL_ANCHORS)
        self.assertEqual(result.left_anchor_horizon, "ORIGIN")
        self.assertEqual(result.right_anchor_horizon, "1M")
        self.assertAlmostEqual(float(result.interpolation_fraction), expected_fraction)
        self.assertAlmostEqual(float(result.p10_residual_offset), expected_fraction * -4.0)
        self.assertAlmostEqual(float(result.p90_residual_offset), expected_fraction * 8.0)

    def test_origin_to_first_anchor_linear_fraction_uses_signed_offsets(self) -> None:
        ordered_horizons = [("1M", 1)]
        origin_date = date(2026, 1, 1)
        anchor_dates = {"1M": date(2026, 1, 11)}
        summaries = {"1M": summary("1M", -10.0, 20.0, BandStatus.AVAILABLE)}

        origin = interpolate_daily_band(
            origin_date=origin_date,
            target_date=origin_date,
            point_forecast=100.0,
            anchor_dates=anchor_dates,
            calibration_summaries=summaries,
            ordered_horizons=ordered_horizons,
        )
        midpoint = interpolate_daily_band(
            origin_date=origin_date,
            target_date=date(2026, 1, 6),
            point_forecast=100.0,
            anchor_dates=anchor_dates,
            calibration_summaries=summaries,
            ordered_horizons=ordered_horizons,
        )
        anchor = interpolate_daily_band(
            origin_date=origin_date,
            target_date=date(2026, 1, 11),
            point_forecast=100.0,
            anchor_dates=anchor_dates,
            calibration_summaries=summaries,
            ordered_horizons=ordered_horizons,
        )

        self.assertAlmostEqual(float(origin.p10_residual_offset), 0.0)
        self.assertAlmostEqual(float(origin.p90_residual_offset), 0.0)
        self.assertAlmostEqual(float(midpoint.p10_residual_offset), -5.0)
        self.assertAlmostEqual(float(midpoint.p90_residual_offset), 10.0)
        self.assertAlmostEqual(float(anchor.p10_residual_offset), -10.0)
        self.assertAlmostEqual(float(anchor.p90_residual_offset), 20.0)

    def test_exact_anchors_preserve_empirical_values(self) -> None:
        ordered_horizons = [("1M", 1), ("3M", 3), ("6M", 6), ("12M", 12)]
        anchor_dates = {
            "1M": date(2026, 2, 1),
            "3M": date(2026, 4, 1),
            "6M": date(2026, 7, 1),
            "12M": date(2027, 1, 1),
        }
        summaries = {
            "1M": summary("1M", -3.0, 7.0, BandStatus.AVAILABLE),
            "3M": summary("3M", -8.0, 20.0, BandStatus.AVAILABLE),
            "6M": summary("6M", -11.0, 30.0, BandStatus.AVAILABLE),
            "12M": summary("12M", -15.0, 35.0, BandStatus.AVAILABLE),
        }

        for horizon, point_forecast in (("1M", 100.0), ("3M", 110.0), ("6M", 120.0), ("12M", 130.0)):
            result = interpolate_daily_band(
                origin_date=date(2026, 2, 1),
                target_date=anchor_dates[horizon],
                point_forecast=point_forecast,
                anchor_dates=anchor_dates,
                calibration_summaries=summaries,
                ordered_horizons=ordered_horizons,
            )
            self.assertEqual(result.band_source, BandSource.EMPIRICAL_ANCHOR)
            self.assertEqual(result.p10_residual_offset, summaries[horizon].residual_p10)
            self.assertEqual(result.p90_residual_offset, summaries[horizon].residual_p90)
            self.assertEqual(result.lower_p10, point_forecast + float(summaries[horizon].residual_p10))
            self.assertEqual(result.upper_p90, point_forecast + float(summaries[horizon].residual_p90))

    def test_linear_interpolation_uses_calendar_elapsed_days(self) -> None:
        ordered_horizons = [("1M", 1), ("3M", 3)]
        anchor_dates = {"1M": date(2026, 2, 1), "3M": date(2026, 4, 1)}
        result = interpolate_daily_band(
            origin_date=date(2026, 1, 1),
            target_date=date(2026, 3, 2),
            point_forecast=100.0,
            anchor_dates=anchor_dates,
            calibration_summaries={"1M": summary("1M", -4.0, 8.0, BandStatus.AVAILABLE), "3M": summary("3M", -10.0, 20.0, BandStatus.AVAILABLE)},
            ordered_horizons=ordered_horizons,
        )

        expected_fraction = 29 / 59
        self.assertAlmostEqual(float(result.interpolation_fraction), expected_fraction)
        self.assertAlmostEqual(float(result.p10_residual_offset), -4.0 + expected_fraction * (-10.0 + 4.0))
        self.assertAlmostEqual(float(result.p90_residual_offset), 8.0 + expected_fraction * (20.0 - 8.0))

    def test_asymmetry_is_preserved_by_interpolating_offsets_independently(self) -> None:
        ordered_horizons = [("1M", 1), ("3M", 3)]
        anchor_dates = {"1M": date(2026, 2, 1), "3M": date(2026, 4, 1)}
        result = interpolate_daily_band(
            origin_date=date(2026, 1, 1),
            target_date=date(2026, 3, 2),
            point_forecast=100.0,
            anchor_dates=anchor_dates,
            calibration_summaries={"1M": summary("1M", -3.0, 7.0, BandStatus.AVAILABLE), "3M": summary("3M", -8.0, 20.0, BandStatus.AVAILABLE)},
            ordered_horizons=ordered_horizons,
        )

        self.assertEqual(result.band_source, BandSource.INTERPOLATED_BETWEEN_EMPIRICAL_ANCHORS)
        self.assertNotAlmostEqual(abs(float(result.p10_residual_offset)), abs(float(result.p90_residual_offset)))

    def test_month_length_interpolation_does_not_use_conceptual_month_fraction(self) -> None:
        ordered_horizons = [("1M", 1), ("3M", 3)]
        anchor_dates = {"1M": date(2026, 2, 28), "3M": date(2026, 4, 30)}
        result = interpolate_daily_band(
            origin_date=date(2026, 2, 1),
            target_date=date(2026, 3, 31),
            point_forecast=100.0,
            anchor_dates=anchor_dates,
            calibration_summaries={"1M": summary("1M", -4.0, 8.0, BandStatus.AVAILABLE), "3M": summary("3M", -10.0, 20.0, BandStatus.AVAILABLE)},
            ordered_horizons=ordered_horizons,
        )

        actual_fraction = 31 / 61
        self.assertAlmostEqual(float(result.interpolation_fraction), actual_fraction)
        self.assertNotAlmostEqual(float(result.interpolation_fraction), 0.5)

    def test_leap_year_fraction_uses_calendar_dates(self) -> None:
        ordered_horizons = [("1M", 1), ("3M", 3)]
        anchor_dates = {"1M": date(2024, 2, 29), "3M": date(2024, 3, 30)}
        result = interpolate_daily_band(
            origin_date=date(2024, 2, 1),
            target_date=date(2024, 3, 15),
            point_forecast=100.0,
            anchor_dates=anchor_dates,
            calibration_summaries={"1M": summary("1M", -4.0, 8.0, BandStatus.AVAILABLE), "3M": summary("3M", -10.0, 20.0, BandStatus.AVAILABLE)},
            ordered_horizons=ordered_horizons,
        )

        self.assertAlmostEqual(float(result.interpolation_fraction), 15 / 30)

    def test_missing_anchor_blocks_segment_without_skipping(self) -> None:
        ordered_horizons = [("1M", 1), ("3M", 3), ("6M", 6), ("12M", 12)]
        anchor_dates = {
            "1M": date(2026, 2, 1),
            "3M": date(2026, 4, 1),
            "6M": date(2026, 7, 1),
            "12M": date(2027, 1, 1),
        }
        summaries = {
            "1M": summary("1M", -3.0, 7.0, BandStatus.AVAILABLE),
            "3M": summary("3M", -8.0, 20.0, BandStatus.AVAILABLE),
            "6M": summary("6M", None, None, BandStatus.INSUFFICIENT_CALIBRATION_HISTORY, sample_count=10),
            "12M": summary("12M", -15.0, 35.0, BandStatus.AVAILABLE),
        }

        between_1m_3m = interpolate_daily_band(
            origin_date=date(2026, 1, 1),
            target_date=date(2026, 3, 2),
            point_forecast=100.0,
            anchor_dates=anchor_dates,
            calibration_summaries=summaries,
            ordered_horizons=ordered_horizons,
        )
        between_3m_6m = interpolate_daily_band(
            origin_date=date(2026, 1, 1),
            target_date=date(2026, 5, 15),
            point_forecast=100.0,
            anchor_dates=anchor_dates,
            calibration_summaries=summaries,
            ordered_horizons=ordered_horizons,
        )
        exact_6m = interpolate_daily_band(
            origin_date=date(2026, 1, 1),
            target_date=anchor_dates["6M"],
            point_forecast=100.0,
            anchor_dates=anchor_dates,
            calibration_summaries=summaries,
            ordered_horizons=ordered_horizons,
        )
        between_6m_12m = interpolate_daily_band(
            origin_date=date(2026, 1, 1),
            target_date=date(2026, 9, 15),
            point_forecast=100.0,
            anchor_dates=anchor_dates,
            calibration_summaries=summaries,
            ordered_horizons=ordered_horizons,
        )

        self.assertEqual(between_1m_3m.band_status, BandStatus.AVAILABLE)
        self.assertEqual(between_3m_6m.band_status, BandStatus.NOT_AVAILABLE_INSUFFICIENT_ANCHOR_CALIBRATION)
        self.assertEqual(exact_6m.band_status, BandStatus.INSUFFICIENT_CALIBRATION_HISTORY)
        self.assertEqual(between_6m_12m.band_status, BandStatus.NOT_AVAILABLE_INSUFFICIENT_ANCHOR_CALIBRATION)

    def test_final_band_formula_uses_base_plus_interpolated_offsets(self) -> None:
        ordered_horizons = [("1M", 1), ("3M", 3)]
        anchor_dates = {"1M": date(2026, 2, 1), "3M": date(2026, 4, 1)}
        result = interpolate_daily_band(
            origin_date=date(2026, 1, 1),
            target_date=date(2026, 3, 2),
            point_forecast=100.0,
            anchor_dates=anchor_dates,
            calibration_summaries={"1M": summary("1M", -4.0, 8.0, BandStatus.AVAILABLE), "3M": summary("3M", -8.068965517241379, 20.20689655172414, BandStatus.AVAILABLE)},
            ordered_horizons=ordered_horizons,
        )

        self.assertAlmostEqual(float(result.p10_residual_offset), -6.0)
        self.assertAlmostEqual(float(result.p90_residual_offset), 14.0)
        self.assertAlmostEqual(float(result.lower_p10), 94.0)
        self.assertAlmostEqual(float(result.upper_p90), 114.0)

    def test_does_not_interpolate_final_price_band_directly(self) -> None:
        ordered_horizons = [("1M", 1), ("3M", 3)]
        anchor_dates = {"1M": date(2026, 2, 1), "3M": date(2026, 4, 1)}
        result = interpolate_daily_band(
            origin_date=date(2026, 1, 1),
            target_date=date(2026, 3, 2),
            point_forecast=140.0,
            anchor_dates=anchor_dates,
            calibration_summaries={"1M": summary("1M", -10.0, 5.0, BandStatus.AVAILABLE), "3M": summary("3M", -20.0, 25.0, BandStatus.AVAILABLE)},
            ordered_horizons=ordered_horizons,
        )

        wrong_price_interpolation_lower = 90.0 + (29 / 59) * (180.0 - 90.0)
        self.assertAlmostEqual(float(result.lower_p10), 140.0 + (-10.0 + (29 / 59) * (-10.0)))
        self.assertNotAlmostEqual(float(result.lower_p10), wrong_price_interpolation_lower)

    def test_after_12m_no_extrapolation_is_generated(self) -> None:
        series = business_daily_series(70)
        service = RollingDailyPointInTimeService(
            NaiveLastValueModel(),
            RollingDailyPointInTimeConfig(minimum_training_observations=20),
        )
        summaries = {
            "1M": summary("1M", -3.0, 7.0, BandStatus.AVAILABLE),
            "3M": summary("3M", -8.0, 20.0, BandStatus.AVAILABLE),
            "6M": summary("6M", -11.0, 30.0, BandStatus.AVAILABLE),
            "12M": summary("12M", -15.0, 35.0, BandStatus.AVAILABLE),
        }

        current = service.generate_current_forecast(series, calibration_summaries=summaries)

        self.assertEqual(current.forecast_path[-1].date, current.anchors["12M"].target_calendar_date)
        self.assertFalse(any(point.date > current.anchors["12M"].target_calendar_date for point in current.forecast_path))

    def test_weekend_presentation_point_gets_interpolated_band_without_additional_fit(self) -> None:
        @dataclass(frozen=True)
        class FakePathFit:
            metadata: ForecastMetadata

            def forecast_path(self, horizon_steps: int) -> tuple[float, ...]:
                return tuple(float(step) for step in range(1, horizon_steps + 1))

        series = business_daily_series(70)
        service = RollingDailyPointInTimeService(
            NaiveLastValueModel(),
            RollingDailyPointInTimeConfig(minimum_training_observations=20),
        )
        summaries = {
            "1M": summary("1M", -3.0, 7.0, BandStatus.AVAILABLE),
            "3M": summary("3M", -8.0, 20.0, BandStatus.AVAILABLE),
            "6M": summary("6M", -11.0, 30.0, BandStatus.AVAILABLE),
            "12M": summary("12M", -15.0, 35.0, BandStatus.AVAILABLE),
        }

        fake_fit = FakePathFit(metadata=ForecastMetadata(model_family="fake", selected_variant="FAKE_PATH"))
        with patch("forecasting.rolling_daily_point_in_time.fit_path_model", return_value=fake_fit) as mocked_fit:
            current = service.generate_current_forecast(series, calibration_summaries=summaries)

        self.assertEqual(mocked_fit.call_count, 1)
        weekend_point = next(
            point
            for point in current.forecast_path
            if point.date.weekday() >= 5 and point.left_anchor_horizon == "1M" and point.right_anchor_horizon == "3M"
        )
        self.assertEqual(weekend_point.band_source, BandSource.INTERPOLATED_BETWEEN_EMPIRICAL_ANCHORS)
        self.assertIsNotNone(weekend_point.interpolation_fraction)


if __name__ == "__main__":
    unittest.main()