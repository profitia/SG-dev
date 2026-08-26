from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import date
from pathlib import Path
from time import perf_counter
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from forecasting.contracts import Frequency, Observation, TimeSeries
from forecasting.models.base import ModelForecastError
from forecasting.rolling_daily_point_in_time import (
    HISTORICAL_FORECAST_ORIGIN_START_DATE,
    RollingDailyPointInTimeConfig,
    RollingDailyPointInTimeService,
    build_calibration_summaries,
    fit_path_model,
)
from forecasting.runtime_catalog import USER_FACING_MODEL_IDS, build_model


def _parse_iso_date(value: Any) -> date:
    if not isinstance(value, str) or len(value.strip()) < 10:
        raise ValueError("Historical point date must be a non-empty ISO date string.")
    return date.fromisoformat(value[:10])


def _fetch_analytics_series(base_url: str, series_id: str) -> tuple[dict[str, Any], float]:
    query = urlencode({"seriesId": series_id, "range": "ALL"})
    url = f"{base_url.rstrip('/')}/api/benchmark/analytics-series?{query}"
    started_at = perf_counter()
    try:
        with urlopen(url) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        raise RuntimeError(f"analytics-series HTTP {error.code} for {url}") from error
    except URLError as error:
        raise RuntimeError(f"analytics-series fetch failed for {url}: {error.reason}") from error
    return payload, perf_counter() - started_at


def _build_daily_series(payload: dict[str, Any]) -> tuple[TimeSeries, dict[str, Any], float]:
    started_at = perf_counter()
    historical = payload.get("historical")
    frequency = str(payload.get("frequency", "")).upper()
    if frequency != Frequency.DAILY.value:
        raise ValueError(f"Expected DAILY payload frequency, got {frequency or 'UNKNOWN'}.")
    if not isinstance(historical, list) or not historical:
        raise ValueError("analytics-series payload must include non-empty historical data.")

    observations: list[Observation] = []
    total_points = len(historical)
    null_placeholders = 0
    duplicate_dates = 0
    seen_dates: set[date] = set()

    for point in historical:
        if not isinstance(point, dict):
            raise ValueError("Historical points must be JSON objects.")

        point_date = _parse_iso_date(point.get("date"))
        raw_value = point.get("value")
        if raw_value is None:
            null_placeholders += 1
            continue

        value = float(raw_value)
        if not math.isfinite(value):
            raise ValueError(f"Non-finite DAILY value encountered on {point_date.isoformat()}.")
        if point_date in seen_dates:
            duplicate_dates += 1
            continue
        seen_dates.add(point_date)
        observations.append(Observation(date=point_date, value=value))

    if not observations:
        raise ValueError("No lawful numeric DAILY observations remained after excluding null placeholders.")

    series = TimeSeries(
        series_id=str(payload.get("providerSeries", {}).get("providerSeriesId") or payload.get("seriesId") or "").strip(),
        benchmark_name=str(payload.get("displayName") or "").strip() or "DAILY_SERIES",
        description=str(payload.get("displayName") or "").strip() or "DAILY_SERIES",
        frequency=Frequency.DAILY,
        observations=tuple(observations),
    )
    return (
        series,
        {
            "totalPoints": total_points,
            "numericObservations": len(observations),
            "nullPlaceholdersExcluded": null_placeholders,
            "duplicateDatesExcluded": duplicate_dates,
            "sourceFrequency": frequency,
        },
        perf_counter() - started_at,
    )


def _build_validation_origin_window(
    series: TimeSeries,
    max_observations: int | None,
    historical_origin_floor: date,
) -> tuple[date | None, dict[str, Any]]:
    if max_observations is None or max_observations <= 0 or series.observation_count <= max_observations:
        return None, {
            "maxObservations": max_observations,
            "bounded": False,
            "retainedObservationCount": series.observation_count,
            "retainedObservationStart": series.start.isoformat(),
            "retainedObservationEnd": series.end.isoformat(),
            "effectiveOriginStart": historical_origin_floor.isoformat(),
        }

    retained_observations = series.observations[-max_observations:]
    retained_start = retained_observations[0].date
    effective_origin_start = max(historical_origin_floor, retained_start)
    return effective_origin_start, {
        "maxObservations": max_observations,
        "bounded": True,
        "retainedObservationCount": len(retained_observations),
        "retainedObservationStart": retained_start.isoformat(),
        "retainedObservationEnd": retained_observations[-1].date.isoformat(),
        "effectiveOriginStart": effective_origin_start.isoformat(),
        "originalObservationCount": series.observation_count,
    }


def _serialize_metrics(metrics: Any) -> dict[str, Any] | None:
    if metrics is None:
        return None
    return metrics.to_dict()


def _measure_model(
    series: TimeSeries,
    model_id: str,
    config: RollingDailyPointInTimeConfig,
    validation_origin_start_date: date | None = None,
) -> dict[str, Any]:
    service = RollingDailyPointInTimeService(build_model(model_id), config)

    current_unbanded_started_at = perf_counter()
    current_unbanded = service.generate_current_forecast(series)
    current_unbanded_seconds = perf_counter() - current_unbanded_started_at

    if current_unbanded.status.value != "AVAILABLE":
        return {
            "modelId": model_id,
            "status": current_unbanded.status.value,
            "failureReason": current_unbanded.failure_reason,
            "timings": {
                "currentForecastUnbandedSeconds": current_unbanded_seconds,
            },
        }

    fit_started_at = perf_counter()
    fit = fit_path_model(build_model(model_id), series.observations)
    fit_seconds = perf_counter() - fit_started_at

    three_month_steps = current_unbanded.anchors["3M"].projected_step_count
    twelve_month_steps = current_unbanded.anchors["12M"].projected_step_count

    path_3m_started_at = perf_counter()
    fit.forecast_path(three_month_steps)
    path_3m_seconds = perf_counter() - path_3m_started_at

    path_12m_started_at = perf_counter()
    fit.forecast_path(twelve_month_steps)
    path_12m_seconds = perf_counter() - path_12m_started_at

    backtest_started_at = perf_counter()
    backtest = service.generate_backtest(series, validation_origin_start_date=validation_origin_start_date)
    backtest_seconds = perf_counter() - backtest_started_at

    calibration_started_at = perf_counter()
    calibration = build_calibration_summaries(backtest, series.end, config.minimum_calibration_samples)
    calibration_seconds = perf_counter() - calibration_started_at

    current_banded_started_at = perf_counter()
    current_banded = service.generate_current_forecast(series, calibration_summaries=calibration)
    current_banded_seconds = perf_counter() - current_banded_started_at

    return {
        "modelId": model_id,
        "status": current_banded.status.value,
        "failureReason": current_banded.failure_reason,
        "selectedVariant": None if current_banded.metadata is None else current_banded.metadata.selected_variant,
        "selectionMetric": None if current_banded.metadata is None else current_banded.metadata.selection_metric,
        "selectionScore": None if current_banded.metadata is None else current_banded.metadata.selection_score,
        "originDate": current_banded.origin_date.isoformat(),
        "pathPoints": len(current_banded.forecast_path),
        "calendarProjectionMode": current_banded.calendar_projection_mode,
        "anchorForecasts": {
            horizon: {
                "targetCalendarDate": anchor.target_calendar_date.isoformat(),
                "projectedStepCount": anchor.projected_step_count,
                "forecastValue": anchor.forecast_value,
                "lowerP10": anchor.lower_p10,
                "upperP90": anchor.upper_p90,
                "bandStatus": anchor.band_status.value,
            }
            for horizon, anchor in current_banded.anchors.items()
        },
        "backtest": {
            horizon: {
                "origins": result.origins,
                "expectedOrigins": result.expected_origins,
                "failedOrigins": result.failed_origins,
                "coverage": result.coverage,
                "metrics": _serialize_metrics(result.metrics),
            }
            for horizon, result in backtest.items()
        },
        "calibration": {
            horizon: {
                "sampleCount": summary.sample_count,
                "residualP10": summary.residual_p10,
                "residualP90": summary.residual_p90,
                "status": summary.status.value,
            }
            for horizon, summary in calibration.items()
        },
        "timings": {
            "currentForecastUnbandedSeconds": current_unbanded_seconds,
            "modelFitSeconds": fit_seconds,
            "pathGeneration3MSeconds": path_3m_seconds,
            "pathGeneration12MSeconds": path_12m_seconds,
            "historicalRollingBacktestSeconds": backtest_seconds,
            "predictionBandCalibrationSeconds": calibration_seconds,
            "currentForecastBandedSeconds": current_banded_seconds,
            "totalMeasuredSeconds": fit_seconds + path_3m_seconds + path_12m_seconds + backtest_seconds + calibration_seconds + current_banded_seconds,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate ROLLING_DAILY_POINT_IN_TIME against live sg-runtime analytics-series data.")
    parser.add_argument("--base-url", default="http://localhost:3001", help="Base URL for sg-runtime.")
    parser.add_argument("--series-id", default="wocaes0074", help="Provider series id to validate.")
    parser.add_argument("--models", nargs="+", default=list(USER_FACING_MODEL_IDS), help="Forecast model ids to validate.")
    parser.add_argument("--minimum-training-observations", type=int, default=60)
    parser.add_argument("--minimum-calibration-samples", type=int, default=20)
    parser.add_argument("--max-observations", type=int, default=1500, help="Legacy compatibility alias for the retained validation-origin window size. This no longer truncates model training history.")
    parser.add_argument("--output", default=None, help="Optional JSON output path.")
    args = parser.parse_args()

    payload, fetch_seconds = _fetch_analytics_series(args.base_url, args.series_id)
    series, preparation_stats, preparation_seconds = _build_daily_series(payload)
    config = RollingDailyPointInTimeConfig(
        minimum_training_observations=args.minimum_training_observations,
        minimum_calibration_samples=args.minimum_calibration_samples,
    )
    validation_origin_start_date, validation_window_stats = _build_validation_origin_window(
        series,
        args.max_observations,
        config.historical_forecast_origin_start_date,
    )

    results: list[dict[str, Any]] = []
    failures: list[str] = []
    for model_id in args.models:
        try:
            results.append(
                _measure_model(
                    series,
                    model_id,
                    config,
                    validation_origin_start_date=validation_origin_start_date,
                )
            )
        except (ModelForecastError, ValueError, RuntimeError) as error:
            failures.append(f"{model_id}: {error}")
            results.append(
                {
                    "modelId": model_id,
                    "status": "FAILED",
                    "failureReason": str(error),
                }
            )

    output = {
        "seriesId": series.series_id,
        "displayName": series.benchmark_name,
        "sourceBaseUrl": args.base_url,
        "sourceRoute": "/api/benchmark/analytics-series",
        "sourceRange": "ALL",
        "history": {
            "sourceHistory": {
                "frequency": series.frequency.value,
                "start": series.start.isoformat(),
                "end": series.end.isoformat(),
                "observationCount": series.observation_count,
                **preparation_stats,
            },
            "validationOriginWindow": {
                **validation_window_stats,
                "historicalOriginFloor": config.historical_forecast_origin_start_date.isoformat(),
            },
            "trainingHistorySemantics": {
                "policy": "ALL_LAWFUL_OBSERVATIONS_LEQ_ORIGIN",
                "currentForecastTrainingStart": series.start.isoformat(),
            },
        },
        "timings": {
            "fetchSeconds": fetch_seconds,
            "dataPreparationSeconds": preparation_seconds,
        },
        "models": results,
        "failures": failures,
    }

    rendered = json.dumps(output, indent=2, sort_keys=True)
    if args.output:
        Path(args.output).write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())