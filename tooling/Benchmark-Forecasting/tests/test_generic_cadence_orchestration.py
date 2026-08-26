from __future__ import annotations

import unittest
from datetime import date, timedelta
from unittest.mock import patch

from forecasting.backtest import generate_native_forecast_path
from forecasting.contracts import BenchmarkDefinition, ForecastMetadata, Frequency, ModelForecast, NativeCadenceExecutionPlan, Observation, TimeSeries
from forecasting.models.base import ForecastModel, ModelForecastError
from forecasting.models.arima import ARIMACandidateResult, ARIMAModelFamily
from forecasting.models.damped_holt import DampedHoltModel
from forecasting.models.ets import ETS_CANDIDATE_CATALOG, ETSCandidateResult, ETSModelFamily
from forecasting.models.naive import NaiveLastValueModel
from forecasting.models.statsmodels_utils import validate_regular_history
from forecasting.runtime_catalog import build_model
from forecasting.service import ForecastingService


def b1_fixture_period_starts(frequency: Frequency, length: int) -> tuple[date, ...]:
    if frequency is Frequency.DAILY:
        return tuple(date(2000, 1, 1) + timedelta(days=index) for index in range(length))
    if frequency is Frequency.WEEKLY:
        return tuple(date(2000, 1, 3) + timedelta(weeks=index) for index in range(length))

    months_per_period = {
        Frequency.MONTHLY: 1,
        Frequency.BIMONTHLY: 2,
        Frequency.QUARTERLY: 3,
        Frequency.QUADMONTHLY: 4,
        Frequency.SEMIANNUAL: 6,
        Frequency.ANNUAL: 12,
    }[frequency]
    starts = []
    for index in range(length):
        zero_based_month = index * months_per_period
        starts.append(date(2000 + zero_based_month // 12, zero_based_month % 12 + 1, 1))
    return tuple(starts)


def regular_history(frequency: Frequency, length: int = 36) -> tuple[Observation, ...]:
    return tuple(
        Observation(period_start, 100.0 + index)
        for index, period_start in enumerate(b1_fixture_period_starts(frequency, length))
    )


def execution_plan(
    frequency: Frequency,
    history: tuple[Observation, ...],
    expected_period_starts: tuple[date, ...] | None = None,
) -> NativeCadenceExecutionPlan:
    return NativeCadenceExecutionPlan(
        frequency=frequency,
        historical_period_starts=expected_period_starts or tuple(point.date for point in history),
    )


class ExecutionTransportContractTests(unittest.TestCase):
    def test_frozen_frequency_family_is_exact(self) -> None:
        self.assertEqual(
            tuple(frequency.value for frequency in Frequency),
            (
                "DAILY",
                "WEEKLY",
                "MONTHLY",
                "BIMONTHLY",
                "QUARTERLY",
                "QUADMONTHLY",
                "SEMIANNUAL",
                "ANNUAL",
            ),
        )

    def test_execution_plan_rejects_unordered_periods(self) -> None:
        with self.assertRaisesRegex(ValueError, "strictly ordered"):
            NativeCadenceExecutionPlan(
                frequency=Frequency.QUARTERLY,
                historical_period_starts=(date(2026, 4, 1), date(2026, 1, 1)),
            )


class CadenceAwareValidatorTests(unittest.TestCase):
    def test_quarterly_history_is_lawful_without_monthly_intermediate_points(self) -> None:
        history = regular_history(Frequency.QUARTERLY, 4)

        values = validate_regular_history(
            history,
            1,
            4,
            "TEST",
            Frequency.QUARTERLY,
            execution_plan(Frequency.QUARTERLY, history),
        )

        self.assertEqual(values.tolist(), [100.0, 101.0, 102.0, 103.0])

    def test_quarterly_history_with_missing_native_period_fails_closed(self) -> None:
        expected_starts = (date(2026, 1, 1), date(2026, 4, 1), date(2026, 7, 1))
        history = (Observation(expected_starts[0], 10.0), Observation(expected_starts[2], 12.0))

        with self.assertRaisesRegex(ModelForecastError, "BROKEN_CADENCE.*QUARTERLY"):
            validate_regular_history(
                history,
                1,
                2,
                "TEST",
                Frequency.QUARTERLY,
                execution_plan(Frequency.QUARTERLY, history, expected_starts),
            )

    def test_semantically_lawful_annual_history_can_remain_model_ineligible(self) -> None:
        history = (
            Observation(date(2024, 1, 1), 10.0),
            Observation(date(2025, 1, 1), 11.0),
        )

        with self.assertRaisesRegex(ModelForecastError, "INSUFFICIENT_HISTORY"):
            validate_regular_history(
                history,
                1,
                3,
                "TEST",
                Frequency.ANNUAL,
                execution_plan(Frequency.ANNUAL, history),
            )

    def test_non_monthly_history_requires_b1_execution_plan(self) -> None:
        history = regular_history(Frequency.WEEKLY, 2)

        with self.assertRaisesRegex(ModelForecastError, "CADENCE_PLAN_REQUIRED.*WEEKLY"):
            validate_regular_history(history, 1, 2, "TEST", Frequency.WEEKLY)


class ModelCadenceOrchestrationTests(unittest.TestCase):
    def test_model_factory_preserves_ids_and_carries_native_frequency(self) -> None:
        history = regular_history(Frequency.QUARTERLY)
        plan = execution_plan(Frequency.QUARTERLY, history)
        for model_id in ("naive", "damped_holt", "ets", "arima"):
            model = build_model(model_id, Frequency.QUARTERLY, plan)
            self.assertEqual(model.model_id, model_id)
            self.assertIs(model.frequency, Frequency.QUARTERLY)
            self.assertIs(model.cadence_plan, plan)

    def test_naive_math_is_unchanged_on_quarterly_history(self) -> None:
        history = regular_history(Frequency.QUARTERLY, 4)

        forecast = NaiveLastValueModel(
            Frequency.QUARTERLY,
            execution_plan(Frequency.QUARTERLY, history),
        ).forecast_with_metadata(history, 4)

        self.assertEqual(forecast.forecast_value, history[-1].value)
        self.assertEqual(forecast.metadata.selected_variant, "NAIVE_LAST_VALUE")

    def test_damped_holt_uses_quarterly_validator_without_equation_change(self) -> None:
        class FakeFit:
            metadata = ForecastMetadata(model_family="damped_holt", selected_variant="DAMPED_HOLT_ADDITIVE")

            def forecast_path(self, horizon_steps: int) -> tuple[float, ...]:
                return tuple(200.0 + step for step in range(horizon_steps))

        history = regular_history(Frequency.QUARTERLY)
        with patch("forecasting.models.damped_holt.fit_damped_holt_endog", return_value=FakeFit()):
            forecast = DampedHoltModel(
                Frequency.QUARTERLY,
                execution_plan(Frequency.QUARTERLY, history),
            ).forecast_with_metadata(history, 4)

        self.assertEqual(forecast.forecast_value, 203.0)
        self.assertEqual(forecast.metadata.selected_variant, "DAMPED_HOLT_ADDITIVE")

    def test_ets_sparse_cadences_use_only_existing_non_seasonal_candidates(self) -> None:
        expected = ["ETS(A,N,N)", "ETS(A,A,N)", "ETS(A,Ad,N)"]
        for frequency in (Frequency.QUARTERLY, Frequency.SEMIANNUAL, Frequency.ANNUAL):
            history = regular_history(frequency)
            model = ETSModelFamily(frequency, execution_plan(frequency, history))
            self.assertEqual([candidate.variant for candidate in model.eligible_candidates(history)], expected)
            with self.assertRaisesRegex(ModelForecastError, "SEASONAL_NOT_ELIGIBLE"):
                model.fit_candidate(history, ETS_CANDIDATE_CATALOG[3], 1)

    def test_ets_identity_remains_ets_for_quarterly_non_seasonal_selection(self) -> None:
        class ControlledETS(ETSModelFamily):
            def fit_candidate(self, history, candidate, horizon_steps):  # type: ignore[override]
                return ETSCandidateResult(candidate, 123.0, 10.0, {})

        history = regular_history(Frequency.QUARTERLY)
        forecast = ControlledETS(
            Frequency.QUARTERLY,
            execution_plan(Frequency.QUARTERLY, history),
        ).forecast_with_metadata(history, 1)

        self.assertEqual(forecast.metadata.model_family, "ets")
        self.assertEqual(forecast.metadata.selected_variant, "ETS(A,N,N)")

    def test_arima_candidate_policy_is_unchanged_for_quarterly_history(self) -> None:
        class ControlledARIMA(ARIMAModelFamily):
            def fit_candidate(self, history, candidate, horizon_steps):  # type: ignore[override]
                return ARIMACandidateResult(candidate, 123.0, 10.0, {})

        history = regular_history(Frequency.QUARTERLY)
        forecast = ControlledARIMA(
            Frequency.QUARTERLY,
            execution_plan(Frequency.QUARTERLY, history),
        ).forecast_with_metadata(history, 4)

        self.assertEqual(forecast.metadata.model_family, "arima")
        self.assertEqual(forecast.metadata.selected_parameters["candidateCount"], 17)

    def test_four_quarterly_steps_produce_four_values_and_four_targets(self) -> None:
        class RecordingModel(ForecastModel):
            model_id = "recording"

            def __init__(self) -> None:
                self.requested_steps: list[int] = []

            def forecast_with_metadata(self, history, horizon_steps):  # type: ignore[override]
                self.requested_steps.append(horizon_steps)
                return ModelForecast(
                    forecast_value=200.0 + horizon_steps,
                    metadata=ForecastMetadata(model_family=self.model_id, selected_variant="UNCHANGED_MATH"),
                )

        series = TimeSeries(
            series_id="quarterly",
            benchmark_name="QUARTERLY",
            description="Controlled quarterly sequence",
            frequency=Frequency.QUARTERLY,
            observations=regular_history(Frequency.QUARTERLY, 4),
        )
        model = RecordingModel()

        path = generate_native_forecast_path(
            series,
            model,
            (date(2001, 1, 1), date(2001, 4, 1), date(2001, 7, 1), date(2001, 10, 1)),
        )

        self.assertEqual(model.requested_steps, [1, 2, 3, 4])
        self.assertEqual([point.forecast_value for point in path], [201.0, 202.0, 203.0, 204.0])
        self.assertEqual(
            [point.forecast_date for point in path],
            [date(2001, 1, 1), date(2001, 4, 1), date(2001, 7, 1), date(2001, 10, 1)],
        )


class ForecastingServiceExecutionPlanTests(unittest.TestCase):
    class InMemorySource:
        def __init__(self, series: TimeSeries) -> None:
            self.series = series

        def load_series(self, benchmark: BenchmarkDefinition, run_id: str) -> TimeSeries:
            return self.series

    def test_service_consumes_preadapted_native_steps_and_target_dates(self) -> None:
        frequency = Frequency.QUARTERLY
        series = TimeSeries(
            series_id="controlled",
            benchmark_name="CONTROLLED",
            description="Controlled native cadence",
            frequency=frequency,
            observations=regular_history(frequency, 8),
        )
        benchmark = BenchmarkDefinition(
            series_id=series.series_id,
            component="CONTROLLED",
            description=series.description,
            frequency=frequency,
            expected_observations=8,
        )
        result = ForecastingService(
            data_source=self.InMemorySource(series),  # type: ignore[arg-type]
            model=NaiveLastValueModel(frequency, execution_plan(frequency, series.observations)),
            run_id="controlled",
            horizons={"3M": 1, "6M": 2, "12M": 4},
            min_training_window=4,
            current_target_dates={
                "3M": date(2002, 1, 1),
                "6M": date(2002, 4, 1),
                "12M": date(2002, 10, 1),
            },
        ).run_benchmark(benchmark)

        self.assertEqual(set(result.current_forecast), {"3M", "6M", "12M"})
        self.assertEqual(result.current_forecast["3M"].horizon_steps, 1)
        self.assertEqual(result.current_forecast["6M"].horizon_steps, 2)
        self.assertEqual(result.current_forecast["12M"].horizon_steps, 4)
        self.assertEqual(result.current_forecast["12M"].forecast_date, date(2002, 10, 1))


if __name__ == "__main__":
    unittest.main()