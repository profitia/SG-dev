from __future__ import annotations

from datetime import date
from time import perf_counter

from data_sources.base import HistoricalSeriesSource
from forecasting.backtest import expected_origin_count, generate_backtest_records, generate_current_forecast
from forecasting.contracts import BenchmarkDefinition, BenchmarkResult, HorizonBacktestResult
from forecasting.metrics import summarize_metrics
from forecasting.models.base import ForecastModel


class ForecastingService:
    def __init__(
        self,
        data_source: HistoricalSeriesSource,
        model: ForecastModel,
        run_id: str,
        horizons: dict[str, int],
        min_training_window: int = 36,
        current_target_dates: dict[str, date] | None = None,
    ) -> None:
        self._data_source = data_source
        self._model = model
        self._run_id = run_id
        self._horizons = horizons
        self._min_training_window = min_training_window
        self._current_target_dates = current_target_dates or {}

    def _resolve_validation_origin_dates(
        self,
        series,
        historical_origin_start_date: date | None,
        last_processed_origin_date: date | None,
        max_origins_per_run: int | None,
    ) -> set[date] | None:
        if historical_origin_start_date is None and last_processed_origin_date is None and max_origins_per_run is None:
            return None

        if max_origins_per_run is not None and max_origins_per_run < 1:
            raise ValueError("max_origins_per_run must be >= 1 when provided.")

        observations = list(series.observations)
        if not observations:
            return set()

        min_horizon_steps = min(self._horizons.values())
        last_origin_index = len(observations) - min_horizon_steps
        candidate_origin_dates = [
            observations[origin_end - 1].date
            for origin_end in range(self._min_training_window, last_origin_index + 1)
        ]

        filtered_origin_dates = [
            origin_date
            for origin_date in candidate_origin_dates
            if (historical_origin_start_date is None or origin_date >= historical_origin_start_date)
            and (last_processed_origin_date is None or origin_date > last_processed_origin_date)
        ]

        if max_origins_per_run is not None:
            filtered_origin_dates = filtered_origin_dates[:max_origins_per_run]

        return set(filtered_origin_dates)

    def run_benchmark(
        self,
        benchmark: BenchmarkDefinition,
        historical_origin_start_date: date | None = None,
        last_processed_origin_date: date | None = None,
        max_origins_per_run: int | None = None,
    ) -> BenchmarkResult:
        started_at = perf_counter()
        series = self._data_source.load_series(benchmark, self._run_id)
        validation_origin_dates = self._resolve_validation_origin_dates(
            series,
            historical_origin_start_date,
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
                validation_origin_dates=validation_origin_dates,
            )
            full_expected_origins = expected_origin_count(
                total_observations=series.observation_count,
                horizon_steps=horizon_steps,
                min_training_window=self._min_training_window,
            )
            expected_origins = full_expected_origins if validation_origin_dates is not None else backtest_run.expected_origins
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