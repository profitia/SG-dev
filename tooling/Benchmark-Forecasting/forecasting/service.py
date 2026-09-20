from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from time import perf_counter

from data_sources.base import HistoricalSeriesSource
from forecasting.backtest import expected_origin_count, generate_backtest_records, generate_current_forecast
from forecasting.contracts import BenchmarkDefinition, BenchmarkResult, HorizonBacktestResult
from forecasting.metrics import summarize_metrics
from forecasting.models.base import ForecastModel


@dataclass(frozen=True)
class VerificationOriginSelection:
    validation_origin_dates: set[date] | None
    effective_origin_start_date: date | None
    minimum_verification_origins: int | None


class ForecastingService:
    def __init__(
        self,
        data_source: HistoricalSeriesSource,
        model: ForecastModel,
        run_id: str,
        horizons: dict[str, int],
        min_training_window: int | None = None,
        mase_scale_minimum_observations: int = 2,
        current_target_dates: dict[str, date] | None = None,
    ) -> None:
        self._data_source = data_source
        self._model = model
        self._run_id = run_id
        self._horizons = horizons
        self._min_training_window = min_training_window if min_training_window is not None else int(getattr(model, "min_history", 1))
        self._mase_scale_minimum_observations = mase_scale_minimum_observations
        self._current_target_dates = current_target_dates or {}

    def _resolve_validation_origin_dates(
        self,
        series,
        historical_origin_start_date: date | None,
        minimum_verification_origins: int | None,
        last_processed_origin_date: date | None,
        max_origins_per_run: int | None,
    ) -> VerificationOriginSelection:
        if minimum_verification_origins is not None and minimum_verification_origins < 1:
            raise ValueError("minimum_verification_origins must be >= 1 when provided.")
        if minimum_verification_origins is not None and historical_origin_start_date is None:
            raise ValueError("minimum_verification_origins requires historical_origin_start_date.")
        if historical_origin_start_date is None and minimum_verification_origins is None and last_processed_origin_date is None and max_origins_per_run is None:
            return VerificationOriginSelection(None, None, None)

        if max_origins_per_run is not None and max_origins_per_run < 1:
            raise ValueError("max_origins_per_run must be >= 1 when provided.")

        observations = list(series.observations)
        if not observations:
            return VerificationOriginSelection(set(), historical_origin_start_date, minimum_verification_origins)

        min_horizon_steps = min(self._horizons.values())
        last_origin_index = len(observations) - min_horizon_steps
        verification_origin_minimum = max(self._min_training_window, self._mase_scale_minimum_observations)
        candidate_origin_dates = [
            observations[origin_end - 1].date
            for origin_end in range(verification_origin_minimum, last_origin_index + 1)
        ]

        effective_origin_start_date = historical_origin_start_date
        if historical_origin_start_date is not None and minimum_verification_origins is not None:
            max_horizon_steps = max(self._horizons.values())
            last_longest_horizon_origin_index = len(observations) - max_horizon_steps
            longest_horizon_candidate_dates = [
                observations[origin_end - 1].date
                for origin_end in range(verification_origin_minimum, last_longest_horizon_origin_index + 1)
            ]
            preferred_longest_horizon_dates = [
                origin_date
                for origin_date in longest_horizon_candidate_dates
                if origin_date >= historical_origin_start_date
            ]
            if len(preferred_longest_horizon_dates) < minimum_verification_origins and longest_horizon_candidate_dates:
                effective_origin_start_date = (
                    longest_horizon_candidate_dates[0]
                    if len(longest_horizon_candidate_dates) <= minimum_verification_origins
                    else longest_horizon_candidate_dates[-minimum_verification_origins]
                )

        filtered_origin_dates = [
            origin_date
            for origin_date in candidate_origin_dates
            if (effective_origin_start_date is None or origin_date >= effective_origin_start_date)
            and (last_processed_origin_date is None or origin_date > last_processed_origin_date)
        ]

        if max_origins_per_run is not None:
            filtered_origin_dates = filtered_origin_dates[:max_origins_per_run]

        return VerificationOriginSelection(
            set(filtered_origin_dates),
            effective_origin_start_date,
            minimum_verification_origins,
        )

    def _expected_origins_for_policy(
        self,
        series,
        horizon_steps: int,
        selection: VerificationOriginSelection,
    ) -> int:
        if selection.validation_origin_dates is None or selection.minimum_verification_origins is None:
            return expected_origin_count(
                total_observations=series.observation_count,
                horizon_steps=horizon_steps,
                min_training_window=self._min_training_window,
                mase_scale_minimum_observations=self._mase_scale_minimum_observations,
            )

        observations = list(series.observations)
        last_origin_index = len(observations) - horizon_steps
        verification_origin_minimum = max(self._min_training_window, self._mase_scale_minimum_observations)
        return sum(
            1
            for origin_end in range(verification_origin_minimum, last_origin_index + 1)
            if selection.effective_origin_start_date is None
            or observations[origin_end - 1].date >= selection.effective_origin_start_date
        )

    def run_benchmark(
        self,
        benchmark: BenchmarkDefinition,
        historical_origin_start_date: date | None = None,
        minimum_verification_origins: int | None = None,
        last_processed_origin_date: date | None = None,
        max_origins_per_run: int | None = None,
    ) -> BenchmarkResult:
        started_at = perf_counter()
        series = self._data_source.load_series(benchmark, self._run_id)
        origin_selection = self._resolve_validation_origin_dates(
            series,
            historical_origin_start_date,
            minimum_verification_origins,
            last_processed_origin_date,
            max_origins_per_run,
        )

        backtest_results: dict[str, HorizonBacktestResult] = {}
        current_forecast = {}
        for horizon_label, horizon_steps in self._horizons.items():
            backtest_run = generate_backtest_records(
                series=series,
                model=self._model,
                horizon_label=horizon_label,
                horizon_steps=horizon_steps,
                min_training_window=self._min_training_window,
                validation_origin_dates=origin_selection.validation_origin_dates,
                mase_scale_minimum_observations=self._mase_scale_minimum_observations,
            )
            policy_expected_origins = self._expected_origins_for_policy(series, horizon_steps, origin_selection)
            expected_origins = policy_expected_origins if origin_selection.validation_origin_dates is not None else backtest_run.expected_origins
            coverage = 0.0 if expected_origins == 0 else backtest_run.successful_origins / expected_origins
            backtest_results[horizon_label] = HorizonBacktestResult(
                origins=backtest_run.successful_origins,
                expected_origins=expected_origins,
                failed_origins=backtest_run.failed_origins,
                coverage=coverage,
                records=backtest_run.records,
                failures=backtest_run.failures,
                metrics=summarize_metrics(backtest_run.records) if backtest_run.records else None,
            )
            current_forecast[horizon_label] = generate_current_forecast(
                series=series,
                model=self._model,
                horizon_label=horizon_label,
                horizon_steps=horizon_steps,
                forecast_date=self._current_target_dates.get(horizon_label),
            )

        return BenchmarkResult(
            benchmark_id=benchmark.series_id,
            component=benchmark.component,
            description=benchmark.description,
            frequency=benchmark.frequency,
            model_id=self._model.model_id,
            history=series,
            backtest=backtest_results,
            current_forecast=current_forecast,
            runtime_seconds=perf_counter() - started_at,
        )

    def run_many(self, benchmarks: list[BenchmarkDefinition]) -> list[BenchmarkResult]:
        return [self.run_benchmark(benchmark) for benchmark in benchmarks]
