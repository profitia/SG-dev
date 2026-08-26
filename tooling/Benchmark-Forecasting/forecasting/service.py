from __future__ import annotations

from datetime import date
from time import perf_counter

from data_sources.base import HistoricalSeriesSource
from forecasting.backtest import generate_backtest_records, generate_current_forecast
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

    def run_benchmark(self, benchmark: BenchmarkDefinition) -> BenchmarkResult:
        started_at = perf_counter()
        series = self._data_source.load_series(benchmark, self._run_id)

        backtest_results: dict[str, HorizonBacktestResult] = {}
        current_forecast = {}
        for horizon_label, horizon_steps in self._horizons.items():
            backtest_run = generate_backtest_records(
                series=series,
                model=self._model,
                horizon_label=horizon_label,
                horizon_steps=horizon_steps,
                min_training_window=self._min_training_window,
            )
            backtest_results[horizon_label] = HorizonBacktestResult(
                origins=backtest_run.successful_origins,
                expected_origins=backtest_run.expected_origins,
                failed_origins=backtest_run.failed_origins,
                coverage=backtest_run.coverage,
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