from __future__ import annotations

import unittest
from dataclasses import dataclass
from datetime import date

from forecasting.backtest import generate_backtest_records
from forecasting.contracts import ForecastMetadata, Frequency, ModelForecast, Observation, TimeSeries
from forecasting.models.base import ModelForecastError
from forecasting.models.arima import ARIMA_CANDIDATE_GRID, ARIMACandidate, ARIMACandidateResult, ARIMAModelFamily
from forecasting.models.damped_holt import DampedHoltModel
from forecasting.models.ets import ETSCandidate, ETSCandidateResult, ETS_CANDIDATE_CATALOG, ETSModelFamily


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


class DampedHoltPhase2Tests(unittest.TestCase):
    def test_damped_holt_is_deterministic_on_same_history(self) -> None:
        model = DampedHoltModel()
        history = list(monthly_series(60, start_value=100.0, step=2.0).observations)

        first = model.forecast_with_metadata(history, 6)
        second = model.forecast_with_metadata(history, 6)

        self.assertEqual(first.metadata.selected_variant, second.metadata.selected_variant)
        self.assertAlmostEqual(first.forecast_value, second.forecast_value, places=9)

    def test_damped_holt_continues_upward_series(self) -> None:
        model = DampedHoltModel()
        history = list(monthly_series(60, start_value=100.0, step=3.0).observations)

        forecast = model.forecast_with_metadata(history, 1)

        self.assertGreater(forecast.forecast_value, history[-1].value)

    def test_damped_holt_long_horizon_is_damped(self) -> None:
        model = DampedHoltModel()
        history = list(monthly_series(60, start_value=100.0, step=3.0).observations)

        short_horizon = model.forecast_with_metadata(history, 1).forecast_value
        long_horizon = model.forecast_with_metadata(history, 12).forecast_value

        self.assertGreater(long_horizon, history[-1].value)
        self.assertGreaterEqual(long_horizon, short_horizon)
        self.assertLess(long_horizon - history[-1].value, 36.0)

    def test_damped_holt_stays_near_flat_on_flat_series(self) -> None:
        model = DampedHoltModel()
        history = list(monthly_series(60, start_value=50.0, step=0.0).observations)

        forecast = model.forecast_with_metadata(history, 12)

        self.assertAlmostEqual(forecast.forecast_value, 50.0, places=6)

    def test_damped_holt_rejects_non_finite_history(self) -> None:
        model = DampedHoltModel()
        history = list(monthly_series(36).observations)
        history[-1] = Observation(history[-1].date, float("nan"))

        with self.assertRaisesRegex(ModelForecastError, "NON_FINITE_HISTORY"):
            model.forecast_with_metadata(history, 1)

    def test_damped_holt_no_future_leakage_for_same_origin(self) -> None:
        model = DampedHoltModel()
        baseline = monthly_series(60, start_value=100.0, step=2.0)
        extended = TimeSeries(
            series_id=baseline.series_id,
            benchmark_name=baseline.benchmark_name,
            description=baseline.description,
            frequency=baseline.frequency,
            observations=baseline.observations
            + (
                Observation(date(2026, 1, 1), 5000.0),
                Observation(date(2026, 2, 1), 8000.0),
                Observation(date(2026, 3, 1), 13000.0),
            ),
        )

        baseline_records = generate_backtest_records(baseline, model, "1M", 1, 36)
        extended_records = generate_backtest_records(extended, model, "1M", 1, 36)

        baseline_first = baseline_records.records[0]
        matching_extended = next(
            record for record in extended_records.records if record.forecast_origin == baseline_first.forecast_origin
        )

        self.assertEqual(
            baseline_first.metadata.selected_variant,
            matching_extended.metadata.selected_variant,
        )
        self.assertAlmostEqual(baseline_first.forecast_value, matching_extended.forecast_value, places=8)


def seasonal_monthly_series(length: int, base: float = 100.0, trend: float = 1.0) -> TimeSeries:
    observations = []
    year = 2021
    month = 1
    seasonal_pattern = [0.0, 1.5, 3.0, 4.5, 2.0, -1.0, -3.0, -4.0, -2.5, -1.0, 1.0, 3.5]
    for index in range(length):
        observations.append(
            Observation(
                date=date(year, month, 1),
                value=base + index * trend + seasonal_pattern[(month - 1) % 12],
            )
        )
        month += 1
        if month == 13:
            month = 1
            year += 1
    return TimeSeries(
        series_id="seasonal-series",
        benchmark_name="SEASONAL",
        description="Synthetic seasonal monthly test series",
        frequency=Frequency.MONTHLY,
        observations=tuple(observations),
    )


def ar_like_monthly_series(length: int) -> TimeSeries:
    observations = []
    year = 2021
    month = 1
    current = 100.0
    for index in range(length):
        current = 0.7 * current + 30.0 + ((index % 4) - 1.5)
        observations.append(Observation(date=date(year, month, 1), value=current))
        month += 1
        if month == 13:
            month = 1
            year += 1
    return TimeSeries(
        series_id="ar-series",
        benchmark_name="ARLIKE",
        description="Synthetic AR-like monthly test series",
        frequency=Frequency.MONTHLY,
        observations=tuple(observations),
    )


class ETSPhase2Tests(unittest.TestCase):
    def test_candidate_catalog_matches_canon(self) -> None:
        self.assertEqual(
            [candidate.variant for candidate in ETS_CANDIDATE_CATALOG],
            [
                "ETS(A,N,N)",
                "ETS(A,A,N)",
                "ETS(A,Ad,N)",
                "ETS(A,N,A)",
                "ETS(A,A,A)",
                "ETS(A,Ad,A)",
            ],
        )

    def test_ann_candidate_fits_gently_trending_series(self) -> None:
        model = ETSModelFamily()
        history = list(monthly_series(48, start_value=75.0, step=0.01).observations)

        result = model.fit_candidate(history, ETS_CANDIDATE_CATALOG[0], 3)

        self.assertEqual(result.candidate.variant, "ETS(A,N,N)")
        self.assertAlmostEqual(result.forecast_value, history[-1].value, places=3)

    def test_ets_flat_series_returns_controlled_failure(self) -> None:
        model = ETSModelFamily()
        history = list(monthly_series(48, start_value=75.0, step=0.0).observations)

        with self.assertRaisesRegex(ModelForecastError, "ALL_CANDIDATES_INVALID"):
            model.forecast_with_metadata(history, 3)

    def test_seasonal_candidates_rejected_when_history_too_short(self) -> None:
        model = ETSModelFamily()
        history = list(monthly_series(24).observations)

        variants = [candidate.variant for candidate in model.eligible_candidates(history)]

        self.assertEqual(variants, ["ETS(A,N,N)", "ETS(A,A,N)", "ETS(A,Ad,N)"])

    def test_seasonal_candidates_eligible_with_valid_monthly_history(self) -> None:
        model = ETSModelFamily()
        history = list(seasonal_monthly_series(48).observations)

        variants = [candidate.variant for candidate in model.eligible_candidates(history)]

        self.assertEqual(variants, [candidate.variant for candidate in ETS_CANDIDATE_CATALOG])

    def test_ets_selection_is_deterministic(self) -> None:
        model = ETSModelFamily()
        history = list(seasonal_monthly_series(48).observations)

        first = model.forecast_with_metadata(history, 6)
        second = model.forecast_with_metadata(history, 6)

        self.assertEqual(first.metadata.selected_variant, second.metadata.selected_variant)
        self.assertAlmostEqual(first.metadata.selection_score or 0.0, second.metadata.selection_score or 0.0, places=9)
        self.assertAlmostEqual(first.forecast_value, second.forecast_value, places=9)

    def test_ets_tie_break_is_deterministic(self) -> None:
        @dataclass(frozen=True)
        class DummyResult:
            candidate: ETSCandidate

        class TieBreakETS(ETSModelFamily):
            def fit_candidate(self, history, candidate, horizon_steps):  # type: ignore[override]
                return ETSCandidateResult(
                    candidate=candidate,
                    forecast_value=123.0,
                    aicc=10.0,
                    parameters={"dummy": 1.0},
                )

        model = TieBreakETS()
        history = list(seasonal_monthly_series(48).observations)

        forecast = model.forecast_with_metadata(history, 3)

        self.assertEqual(forecast.metadata.selected_variant, "ETS(A,N,N)")

    def test_ets_invalid_candidate_is_skipped(self) -> None:
        class SkipFirstETS(ETSModelFamily):
            def fit_candidate(self, history, candidate, horizon_steps):  # type: ignore[override]
                if candidate.variant == "ETS(A,N,N)":
                    raise ModelForecastError("FIT_EXCEPTION: forced invalid")
                return ETSCandidateResult(
                    candidate=candidate,
                    forecast_value=125.0,
                    aicc=5.0,
                    parameters={"dummy": 1.0},
                )

        model = SkipFirstETS()
        history = list(seasonal_monthly_series(48).observations)

        forecast = model.forecast_with_metadata(history, 1)

        self.assertEqual(forecast.metadata.selected_variant, "ETS(A,A,N)")

    def test_ets_all_invalid_marks_family_unavailable(self) -> None:
        class AllInvalidETS(ETSModelFamily):
            def fit_candidate(self, history, candidate, horizon_steps):  # type: ignore[override]
                raise ModelForecastError("FIT_EXCEPTION: forced invalid")

        model = AllInvalidETS()
        history = list(seasonal_monthly_series(48).observations)

        with self.assertRaisesRegex(ModelForecastError, "ALL_CANDIDATES_INVALID"):
            model.forecast_with_metadata(history, 1)

    def test_ets_no_future_leakage_for_same_origin(self) -> None:
        model = ETSModelFamily()
        baseline = seasonal_monthly_series(48)
        extended = TimeSeries(
            series_id=baseline.series_id,
            benchmark_name=baseline.benchmark_name,
            description=baseline.description,
            frequency=baseline.frequency,
            observations=baseline.observations
            + (
                Observation(date(2025, 1, 1), 9000.0),
                Observation(date(2025, 2, 1), 11000.0),
                Observation(date(2025, 3, 1), 15000.0),
            ),
        )

        baseline_records = generate_backtest_records(baseline, model, "1M", 1, 36)
        extended_records = generate_backtest_records(extended, model, "1M", 1, 36)
        baseline_first = baseline_records.records[0]
        matching_extended = next(
            record for record in extended_records.records if record.forecast_origin == baseline_first.forecast_origin
        )

        self.assertEqual(baseline_first.metadata.selected_variant, matching_extended.metadata.selected_variant)
        self.assertAlmostEqual(baseline_first.forecast_value, matching_extended.forecast_value, places=8)


class ARIMAPhase2Tests(unittest.TestCase):
    def test_candidate_grid_matches_canon(self) -> None:
        self.assertEqual(len(ARIMA_CANDIDATE_GRID), 17)
        self.assertNotIn((0, 0, 0), [candidate.order for candidate in ARIMA_CANDIDATE_GRID])

    def test_trend_policy_matches_differencing_policy(self) -> None:
        for candidate in ARIMA_CANDIDATE_GRID:
            if candidate.order[1] == 0:
                self.assertEqual(candidate.trend, "c")
            if candidate.order[1] == 1:
                self.assertEqual(candidate.trend, "t")
            self.assertEqual(candidate.seasonal_order, (0, 0, 0, 0))

    def test_arima_selection_is_deterministic(self) -> None:
        model = ARIMAModelFamily()
        history = list(ar_like_monthly_series(48).observations)

        first = model.forecast_with_metadata(history, 6)
        second = model.forecast_with_metadata(history, 6)

        self.assertEqual(first.metadata.selected_variant, second.metadata.selected_variant)
        self.assertAlmostEqual(first.metadata.selection_score or 0.0, second.metadata.selection_score or 0.0, places=9)
        self.assertAlmostEqual(first.forecast_value, second.forecast_value, places=9)

    def test_arima_tie_break_is_deterministic(self) -> None:
        class TieBreakARIMA(ARIMAModelFamily):
            def fit_candidate(self, history, candidate, horizon_steps):  # type: ignore[override]
                return ARIMACandidateResult(
                    candidate=candidate,
                    forecast_value=110.0,
                    aicc=7.0,
                    parameters={"dummy": 1.0},
                )

        model = TieBreakARIMA()
        history = list(ar_like_monthly_series(48).observations)

        forecast = model.forecast_with_metadata(history, 3)

        self.assertEqual(forecast.metadata.selected_variant, "ARIMA(0,0,1)")

    def test_arima_skips_invalid_candidates(self) -> None:
        class SkipFirstARIMA(ARIMAModelFamily):
            def fit_candidate(self, history, candidate, horizon_steps):  # type: ignore[override]
                if candidate.order == (0, 0, 1):
                    raise ModelForecastError("FIT_EXCEPTION: forced invalid")
                return ARIMACandidateResult(
                    candidate=candidate,
                    forecast_value=111.0,
                    aicc=5.0,
                    parameters={"dummy": 1.0},
                )

        model = SkipFirstARIMA()
        history = list(ar_like_monthly_series(48).observations)

        forecast = model.forecast_with_metadata(history, 1)

        self.assertEqual(forecast.metadata.selected_variant, "ARIMA(1,0,0)")

    def test_arima_all_invalid_marks_family_unavailable(self) -> None:
        class AllInvalidARIMA(ARIMAModelFamily):
            def fit_candidate(self, history, candidate, horizon_steps):  # type: ignore[override]
                raise ModelForecastError("FIT_EXCEPTION: forced invalid")

        model = AllInvalidARIMA()
        history = list(ar_like_monthly_series(48).observations)

        with self.assertRaisesRegex(ModelForecastError, "ALL_CANDIDATES_INVALID"):
            model.forecast_with_metadata(history, 1)

    def test_arima_forecast_is_finite_on_stable_series(self) -> None:
        model = ARIMAModelFamily()
        history = list(ar_like_monthly_series(48).observations)

        forecast = model.forecast_with_metadata(history, 3)

        self.assertTrue(float(forecast.forecast_value) == forecast.forecast_value)
        self.assertEqual(forecast.metadata.model_family, "arima")

    def test_arima_no_future_leakage_for_same_origin(self) -> None:
        model = ARIMAModelFamily()
        baseline = ar_like_monthly_series(48)
        extended = TimeSeries(
            series_id=baseline.series_id,
            benchmark_name=baseline.benchmark_name,
            description=baseline.description,
            frequency=baseline.frequency,
            observations=baseline.observations
            + (
                Observation(date(2025, 1, 1), 6000.0),
                Observation(date(2025, 2, 1), 9000.0),
                Observation(date(2025, 3, 1), 14000.0),
            ),
        )

        baseline_records = generate_backtest_records(baseline, model, "1M", 1, 36)
        extended_records = generate_backtest_records(extended, model, "1M", 1, 36)
        baseline_first = baseline_records.records[0]
        matching_extended = next(
            record for record in extended_records.records if record.forecast_origin == baseline_first.forecast_origin
        )

        self.assertEqual(baseline_first.metadata.selected_variant, matching_extended.metadata.selected_variant)
        self.assertAlmostEqual(baseline_first.forecast_value, matching_extended.forecast_value, places=8)


if __name__ == "__main__":
    unittest.main()