from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date
from pathlib import Path
from time import perf_counter
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from data_sources.base import HistoricalSeriesSource
from data_sources.postgres import PostgresHistoricalSource
from forecasting.backtest import generate_current_forecast
from forecasting.contracts import (
    BacktestFailure,
    BacktestRecord,
    BenchmarkDefinition,
    BenchmarkResult,
    CurrentForecast,
    Frequency,
    HorizonBacktestResult,
    NativeCadenceExecutionPlan,
    Observation,
    TimeSeries,
)
from forecasting.runtime_catalog import (
    BENCHMARKS,
    HORIZONS,
    METHOD_VERSION,
    RUN_ID,
    SOURCE_KIND,
    SUPPORTED_MODEL_IDS,
    USER_FACING_MODEL_IDS,
    build_model,
    get_benchmark_definition,
    load_default_env_files,
)
from forecasting.service import ForecastingService


def serialize_observation(observation: Observation) -> dict[str, Any]:
    return {
        "date": observation.date.isoformat(),
        "value": observation.value,
    }


def serialize_time_series(
    series: TimeSeries,
    canonicalization: dict[str, Any] | None = None,
    point_overrides: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    payload = {
        "seriesId": series.series_id,
        "benchmarkName": series.benchmark_name,
        "description": series.description,
        "frequency": series.frequency.value,
        "start": series.start.isoformat(),
        "end": series.end.isoformat(),
        "observations": series.observation_count,
        "points": point_overrides if point_overrides is not None else [serialize_observation(observation) for observation in series.observations],
    }

    if canonicalization is not None:
        payload["canonicalization"] = canonicalization

    return payload


class InMemoryHistoricalSource(HistoricalSeriesSource):
    def __init__(self, series: TimeSeries) -> None:
        self._series = series

    def load_series(self, benchmark: BenchmarkDefinition, run_id: str) -> TimeSeries:
        if benchmark.series_id != self._series.series_id:
            raise ValueError(
                f"In-memory benchmark mismatch: expected {benchmark.series_id}, received {self._series.series_id}."
            )
        return self._series


def parse_history_date(value: Any) -> date:
    if not isinstance(value, str) or len(value.strip()) == 0:
        raise ValueError("History point date must be a non-empty ISO string.")
    return date.fromisoformat(value[:10])


def load_history_payload_context(history_json_path: str) -> dict[str, Any]:
    payload = json.loads(Path(history_json_path).read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("History payload must be a JSON object.")

    benchmark_payload = payload.get("benchmark")
    source_payload = payload.get("source")
    history_payload = payload.get("history")
    if not isinstance(benchmark_payload, dict) or not isinstance(source_payload, dict) or not isinstance(history_payload, dict):
        raise ValueError("History payload must include benchmark, source, and history objects.")

    points_payload = history_payload.get("points")
    if not isinstance(points_payload, list) or not points_payload:
        raise ValueError("History payload must include at least one canonical observation.")

    frequency = Frequency(str(benchmark_payload.get("frequency", "")).upper())

    benchmark = BenchmarkDefinition(
        series_id=str(benchmark_payload.get("seriesId", "")).strip(),
        component=str(benchmark_payload.get("component", "")).strip(),
        description=str(benchmark_payload.get("description", "")).strip(),
        frequency=frequency,
        expected_observations=int(benchmark_payload.get("expectedObservations", len(points_payload))),
    )

    observations = tuple(
        Observation(
            date=parse_history_date(point.get("date")),
            value=float(point.get("value")),
        )
        for point in points_payload
    )

    history_points = []
    for point in points_payload:
        normalized_point = {
            "date": parse_history_date(point.get("date")).isoformat(),
            "value": float(point.get("value")),
        }
        source_observed_at = point.get("sourceObservedAt")
        if isinstance(source_observed_at, str) and len(source_observed_at.strip()) > 0:
            normalized_point["sourceObservedAt"] = source_observed_at
        history_points.append(normalized_point)

    if benchmark.series_id == "":
        raise ValueError("History payload benchmark.seriesId is required.")

    if len(observations) != benchmark.expected_observations:
        raise ValueError(
            f"History payload expected {benchmark.expected_observations} observations, got {len(observations)}."
        )

    execution_payload = payload.get("execution")
    if execution_payload is None:
        if frequency is not Frequency.MONTHLY:
            raise ValueError(f"B1 cadence execution plan is required for {frequency.value} live Forecast input.")
        cadence_plan = None
        horizons = HORIZONS
        current_target_dates = {}
    else:
        if not isinstance(execution_payload, dict):
            raise ValueError("History payload execution must be an object.")
        execution_frequency = Frequency(str(execution_payload.get("frequency", "")).upper())
        if execution_frequency is not frequency:
            raise ValueError("History payload execution frequency must match benchmark frequency.")
        period_starts_payload = execution_payload.get("historicalPeriodStarts")
        if not isinstance(period_starts_payload, list) or not period_starts_payload:
            raise ValueError("History payload execution requires historicalPeriodStarts.")
        historical_period_starts = tuple(parse_history_date(value) for value in period_starts_payload)
        if historical_period_starts != tuple(observation.date for observation in observations):
            raise ValueError("History observations must exactly match B1 historicalPeriodStarts.")
        cadence_plan = NativeCadenceExecutionPlan(
            frequency=execution_frequency,
            historical_period_starts=historical_period_starts,
        )

        horizons_payload = execution_payload.get("horizons")
        if not isinstance(horizons_payload, dict) or not horizons_payload:
            raise ValueError("History payload execution requires native horizons.")
        horizons = {str(label): int(steps) for label, steps in horizons_payload.items()}
        if any(steps < 1 for steps in horizons.values()):
            raise ValueError("History payload native horizons must use positive steps.")

        target_dates_payload = execution_payload.get("currentTargetDates")
        if not isinstance(target_dates_payload, dict) or set(target_dates_payload) != set(horizons):
            raise ValueError("History payload currentTargetDates must exactly cover native horizons.")
        current_target_dates = {
            str(label): parse_history_date(value)
            for label, value in target_dates_payload.items()
        }

    series = TimeSeries(
        series_id=benchmark.series_id,
        benchmark_name=str(history_payload.get("benchmarkName", benchmark.component)).strip() or benchmark.component,
        description=str(history_payload.get("description", benchmark.description)).strip() or benchmark.description,
        frequency=frequency,
        observations=observations,
    )

    return {
        "benchmark": benchmark,
        "source": {
            "kind": str(source_payload.get("kind", SOURCE_KIND)).strip() or SOURCE_KIND,
            "runId": source_payload.get("runId"),
        },
        "canonicalization": history_payload.get("canonicalization"),
        "history_points": history_points,
        "cadence_plan": cadence_plan,
        "horizons": horizons,
        "current_target_dates": current_target_dates,
        "series": series,
    }


def serialize_backtest_record(record: BacktestRecord) -> dict[str, Any]:
    return {
        "benchmarkId": record.benchmark_id,
        "modelId": record.model_id,
        "forecastOrigin": record.forecast_origin.isoformat(),
        "horizon": record.horizon,
        "horizonSteps": record.horizon_steps,
        "forecastDate": record.forecast_date.isoformat(),
        "originValue": record.origin_value,
        "forecastValue": record.forecast_value,
        "actualValue": record.actual_value,
        "error": record.error,
        "absoluteError": record.absolute_error,
        "delta": record.delta,
        "deltaPct": record.delta_pct,
        "maseScale": record.mase_scale,
        "metadata": record.metadata.to_dict(),
    }


def serialize_backtest_failure(failure: BacktestFailure) -> dict[str, Any]:
    return failure.to_dict()


def serialize_current_forecast(forecast: CurrentForecast) -> dict[str, Any]:
    return forecast.to_dict()


def serialize_horizon_result(result: HorizonBacktestResult) -> dict[str, Any]:
    return {
        "origins": result.origins,
        "expectedOrigins": result.expected_origins,
        "successfulOrigins": result.successful_origins,
        "failedOrigins": result.failed_origins,
        "coverage": result.coverage,
        "metrics": None if result.metrics is None else result.metrics.to_dict(),
        "records": [serialize_backtest_record(record) for record in result.records],
        "failures": [serialize_backtest_failure(failure) for failure in result.failures],
    }


def serialize_benchmark_result(
    result: BenchmarkResult,
    canonicalization: dict[str, Any] | None = None,
    history_points: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "benchmarkId": result.benchmark_id,
        "component": result.component,
        "description": result.description,
        "frequency": result.frequency.value,
        "model": result.model_id,
        "history": {
            **serialize_time_series(result.history, canonicalization=canonicalization, point_overrides=history_points),
        },
        "backtest": {
            horizon: serialize_horizon_result(horizon_result)
            for horizon, horizon_result in result.backtest.items()
        },
        "currentForecast": {
            horizon: serialize_current_forecast(forecast)
            for horizon, forecast in result.current_forecast.items()
        },
        "runtimeSeconds": result.runtime_seconds,
    }


def serialize_current_forecast_result(
    *,
    benchmark,
    model_id: str,
    series: TimeSeries,
    runtime_seconds: float,
    cadence_plan: NativeCadenceExecutionPlan | None = None,
    horizons: dict[str, int] = HORIZONS,
    current_target_dates: dict[str, date] | None = None,
    canonicalization: dict[str, Any] | None = None,
    history_points: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    model = build_model(model_id, series.frequency, cadence_plan)
    current_forecast = {}
    for horizon, horizon_steps in horizons.items():
        current_forecast[horizon] = serialize_current_forecast(
            generate_current_forecast(
                series=series,
                model=model,
                horizon_label=horizon,
                horizon_steps=horizon_steps,
                forecast_date=(current_target_dates or {}).get(horizon),
            )
        )

    return {
        "benchmarkId": benchmark.series_id,
        "component": benchmark.component,
        "description": benchmark.description,
        "frequency": series.frequency.value,
        "model": model_id,
        "history": serialize_time_series(series, canonicalization=canonicalization, point_overrides=history_points),
        "currentForecast": current_forecast,
        "runtimeSeconds": runtime_seconds,
    }


def serialize_verification_result(
    result: BenchmarkResult,
    canonicalization: dict[str, Any] | None = None,
    history_points: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "benchmarkId": result.benchmark_id,
        "component": result.component,
        "description": result.description,
        "frequency": result.frequency.value,
        "model": result.model_id,
        "history": {
            **serialize_time_series(result.history, canonicalization=canonicalization, point_overrides=history_points),
        },
        "backtest": {
            horizon: serialize_horizon_result(horizon_result)
            for horizon, horizon_result in result.backtest.items()
        },
        "runtimeSeconds": result.runtime_seconds,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export machine-readable Forecast Core output for one benchmark/model.")
    parser.add_argument(
        "--mode",
        choices=("history", "current", "verification", "forecast"),
        default="forecast",
        help="Export lawful history, current forecast only, verification only, or the full forecast bundle.",
    )
    parser.add_argument("--series-id", required=True, help="Canonical benchmark series identifier.")
    parser.add_argument("--model", choices=SUPPORTED_MODEL_IDS, help="Forecast model family id.")
    parser.add_argument("--history-json", help="Path to a pre-canonicalized MONTHLY history payload for live forecast input.")
    args = parser.parse_args()

    if args.mode in {"current", "verification", "forecast"} and not args.model:
        parser.error("--model is required when --mode=forecast")

    if args.mode == "history" and args.model:
        parser.error("--model cannot be used when --mode=history")

    return args


def main() -> int:
    args = parse_args()
    history_payload = load_history_payload_context(args.history_json) if args.history_json else None
    benchmark = history_payload["benchmark"] if history_payload is not None else get_benchmark_definition(args.series_id)

    if benchmark is None:
        json.dump(
            {
                "status": "UNSUPPORTED",
                "reason": "Unsupported benchmark series for the current forecasting laboratory phase.",
                "seriesId": args.series_id,
                "supportedSeriesIds": [candidate.series_id for candidate in BENCHMARKS],
                "supportedModels": list(SUPPORTED_MODEL_IDS),
                "methodVersion": METHOD_VERSION,
                "source": {
                    "kind": SOURCE_KIND,
                    "runId": RUN_ID,
                },
            },
            sys.stdout,
            indent=2,
        )
        sys.stdout.write("\n")
        return 0

    try:
        if history_payload is None:
            load_default_env_files()
            database_url = os.environ.get("DATABASE_URL")
            if not database_url:
                raise RuntimeError(
                    "DATABASE_URL is missing from tooling/Benchmark-Forecasting/.env and apps/data-runtime/.env.local."
                )

            data_source: HistoricalSeriesSource = PostgresHistoricalSource(database_url)
            source = {
                "kind": SOURCE_KIND,
                "runId": RUN_ID,
            }
            canonicalization = None
        else:
            data_source = InMemoryHistoricalSource(history_payload["series"])
            source = history_payload["source"]
            canonicalization = history_payload["canonicalization"]
            history_points = history_payload["history_points"]

        if history_payload is None:
            history_points = None

        if args.mode == "history":
            history = data_source.load_series(benchmark, RUN_ID)
            json.dump(
                {
                    "status": "AVAILABLE",
                    "methodVersion": METHOD_VERSION,
                    "source": source,
                    "benchmark": {
                        "seriesId": benchmark.series_id,
                        "component": benchmark.component,
                        "description": benchmark.description,
                        "frequency": benchmark.frequency.value,
                        "expectedObservations": benchmark.expected_observations,
                    },
                    "history": serialize_time_series(history, canonicalization=canonicalization, point_overrides=history_points),
                },
                sys.stdout,
                indent=2,
            )
            sys.stdout.write("\n")
            return 0

        if args.mode == "current":
            started_at = perf_counter()
            history = data_source.load_series(benchmark, RUN_ID)
            payload = serialize_current_forecast_result(
                benchmark=benchmark,
                model_id=args.model,
                series=history,
                runtime_seconds=perf_counter() - started_at,
                cadence_plan=history_payload["cadence_plan"] if history_payload is not None else None,
                horizons=history_payload["horizons"] if history_payload is not None else HORIZONS,
                current_target_dates=history_payload["current_target_dates"] if history_payload is not None else None,
                canonicalization=canonicalization,
                history_points=history_points,
            )

            json.dump(
                {
                    "status": "AVAILABLE",
                    "methodVersion": METHOD_VERSION,
                    "source": source,
                    "benchmark": {
                        "seriesId": benchmark.series_id,
                        "component": benchmark.component,
                        "description": benchmark.description,
                        "frequency": benchmark.frequency.value,
                        "expectedObservations": benchmark.expected_observations,
                    },
                    "model": {
                        "id": args.model,
                        "userFacing": args.model in USER_FACING_MODEL_IDS,
                    },
                    "result": payload,
                },
                sys.stdout,
                indent=2,
            )
            sys.stdout.write("\n")
            return 0

        model = build_model(
            args.model,
            benchmark.frequency,
            history_payload["cadence_plan"] if history_payload is not None else None,
        )
        service = ForecastingService(
            data_source=data_source,
            model=model,
            run_id=RUN_ID,
            horizons=history_payload["horizons"] if history_payload is not None else HORIZONS,
            min_training_window=36,
            current_target_dates=history_payload["current_target_dates"] if history_payload is not None else None,
        )
        result = service.run_benchmark(benchmark)

        if args.mode == "verification":
            json.dump(
                {
                    "status": "AVAILABLE",
                    "methodVersion": METHOD_VERSION,
                    "source": source,
                    "benchmark": {
                        "seriesId": benchmark.series_id,
                        "component": benchmark.component,
                        "description": benchmark.description,
                        "frequency": benchmark.frequency.value,
                        "expectedObservations": benchmark.expected_observations,
                    },
                    "model": {
                        "id": model.model_id,
                        "userFacing": model.model_id in USER_FACING_MODEL_IDS,
                    },
                    "result": serialize_verification_result(
                        result,
                        canonicalization=canonicalization,
                        history_points=history_points,
                    ),
                },
                sys.stdout,
                indent=2,
            )
            sys.stdout.write("\n")
            return 0

        json.dump(
            {
                "status": "AVAILABLE",
                "methodVersion": METHOD_VERSION,
                "source": source,
                "benchmark": {
                    "seriesId": benchmark.series_id,
                    "component": benchmark.component,
                    "description": benchmark.description,
                    "frequency": benchmark.frequency.value,
                    "expectedObservations": benchmark.expected_observations,
                },
                "model": {
                    "id": model.model_id,
                    "userFacing": model.model_id in USER_FACING_MODEL_IDS,
                },
                "result": serialize_benchmark_result(
                    result,
                    canonicalization=canonicalization,
                    history_points=history_points,
                ),
            },
            sys.stdout,
            indent=2,
        )
        sys.stdout.write("\n")
        return 0
    except Exception as error:
        json.dump(
            {
                "status": "FAILED",
                "reason": str(error),
                "seriesId": args.series_id,
                "model": args.model,
                "methodVersion": METHOD_VERSION,
                "source": {
                    "kind": SOURCE_KIND,
                    "runId": RUN_ID,
                },
            },
            sys.stdout,
            indent=2,
        )
        sys.stdout.write("\n")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())