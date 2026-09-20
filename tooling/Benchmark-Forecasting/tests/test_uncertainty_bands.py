from __future__ import annotations

import math
import unittest
from datetime import date

from forecasting.backtest import generate_current_forecast
from forecasting.contracts import Frequency, Observation, TimeSeries
from forecasting.models.arima import ARIMAModelFamily
from forecasting.models.damped_holt import DampedHoltModel
from forecasting.models.ets import ETSModelFamily
from forecasting.models.naive import NaiveLastValueModel
from forecasting.uncertainty_bands import (
    ADAPTIVE_UNCERTAINTY_BANDS_POLICY_VERSION,
    build_empirical_exact_residual_band,
)


def monthly_series(length: int) -> TimeSeries:
    observations: list[Observation] = []
    year = 2020
    month = 1
    for index in range(length):
        value = 100.0 + index + ((index % 3) - 1) * 0.4
        observations.append(Observation(date(year, month, 1), value))
        month += 1
        if month == 13:
            month = 1
            year += 1
    return TimeSeries(
        series_id="uncertainty-test-series",
        benchmark_name="UNCERTAINTY TEST",
        description="Synthetic uncertainty-band series",
        frequency=Frequency.MONTHLY,
        observations=tuple(observations),
    )


class AdaptiveUncertaintyBandTests(unittest.TestCase):
    def test_exact_empirical_threshold_is_30(self) -> None:
        for sample_count, expected_status in ((29, "NOT_AVAILABLE"), (30, "AVAILABLE"), (31, "AVAILABLE")):
            residuals = [float((index % 7) - 3) for index in range(sample_count)]
            band = build_empirical_exact_residual_band(point_forecast=100.0, residuals=residuals)

            self.assertEqual(band.status.value, expected_status)
            self.assertEqual(band.sample_count, sample_count)
            self.assertEqual(band.policy_version, ADAPTIVE_UNCERTAINTY_BANDS_POLICY_VERSION)
            self.assertEqual(band.source.value, "EMPIRICAL_EXACT_RESIDUALS")
            self.assertEqual(band.calibration_status.value, "CALIBRATED" if sample_count >= 30 else "INSUFFICIENT_SAMPLE")

    def test_naive_one_observation_keeps_point_but_has_no_band(self) -> None:
        current = generate_current_forecast(monthly_series(1), NaiveLastValueModel(), "1M", 1)
        band = current.metadata.uncertainty_band

        self.assertIsNotNone(current.forecast_value)
        self.assertIsNotNone(band)
        self.assertEqual(band.status.value, "NOT_AVAILABLE")
        self.assertEqual(band.reason_code, "INSUFFICIENT_BAND_HISTORY")
        self.assertIsNone(band.lower)
        self.assertIsNone(band.upper)

    def test_naive_two_observations_has_lawful_non_calibrated_band(self) -> None:
        current = generate_current_forecast(monthly_series(2), NaiveLastValueModel(), "1M", 1)
        band = current.metadata.uncertainty_band

        self.assertEqual(band.status.value, "AVAILABLE")
        self.assertEqual(band.source.value, "MODEL_NATIVE_SHORT_HISTORY")
        self.assertEqual(band.calibration_status.value, "INSUFFICIENT_SAMPLE")
        self.assertTrue(math.isfinite(band.lower))
        self.assertTrue(math.isfinite(band.upper))
        self.assertLessEqual(band.lower, band.upper)

    def test_all_four_models_have_deterministic_short_history_bands(self) -> None:
        model_factories = (
            NaiveLastValueModel,
            DampedHoltModel,
            ETSModelFamily,
            ARIMAModelFamily,
        )
        for sample_count in (6, 9, 19):
            series = monthly_series(sample_count)
            for model_factory in model_factories:
                with self.subTest(sample_count=sample_count, model=model_factory.__name__):
                    first = generate_current_forecast(series, model_factory(), "1M", 1)
                    second = generate_current_forecast(series, model_factory(), "1M", 1)
                    direct_point = model_factory().forecast_with_metadata(series.observations, 1).forecast_value
                    first_band = first.metadata.uncertainty_band
                    second_band = second.metadata.uncertainty_band

                    self.assertAlmostEqual(first.forecast_value, direct_point, places=8)
                    self.assertEqual(first_band.status.value, "AVAILABLE")
                    self.assertEqual(first_band.source.value, "MODEL_NATIVE_SHORT_HISTORY")
                    self.assertEqual(first_band.calibration_status.value, "INSUFFICIENT_SAMPLE")
                    self.assertEqual(first_band.policy_version, ADAPTIVE_UNCERTAINTY_BANDS_POLICY_VERSION)
                    self.assertTrue(math.isfinite(first_band.lower))
                    self.assertTrue(math.isfinite(first_band.upper))
                    self.assertLessEqual(first_band.lower, first_band.upper)
                    self.assertAlmostEqual(first_band.lower, second_band.lower, places=10)
                    self.assertAlmostEqual(first_band.upper, second_band.upper, places=10)

    def test_ets_point_forecast_is_unchanged_for_every_current_horizon(self) -> None:
        series = monthly_series(19)

        for horizon, steps in (("1M", 1), ("3M", 3), ("6M", 6), ("12M", 12)):
            with self.subTest(horizon=horizon):
                expected = ETSModelFamily().forecast_with_metadata(series.observations, steps)
                current = generate_current_forecast(series, ETSModelFamily(), horizon, steps)

                self.assertAlmostEqual(current.forecast_value, expected.forecast_value, places=8)
                self.assertEqual(current.metadata.selected_variant, expected.metadata.selected_variant)
                self.assertEqual(current.metadata.uncertainty_band.status.value, "AVAILABLE")


if __name__ == "__main__":
    unittest.main()
