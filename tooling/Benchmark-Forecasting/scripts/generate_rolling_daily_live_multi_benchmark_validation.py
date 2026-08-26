from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from statistics import mean
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from forecasting.models.base import ModelForecastError
from forecasting.rolling_daily_point_in_time import RollingDailyPointInTimeConfig
from scripts.validate_rolling_daily_live import (
    _build_daily_series,
    _build_validation_origin_window,
    _fetch_analytics_series,
    _measure_model,
)

HORIZONS = ("1M", "3M", "6M", "12M")
DEFAULT_MODELS = ("naive", "damped_holt", "ets", "arima")
DEFAULT_SERIES_IDS = (
    "wocaes0074",
    "uscaes0302",
    "uscaes0301",
    "wocaes0280",
    "lmeofcucashask",
    "lmeofalcashask",
)
CONTROL_SERIES_ID = "wocaes0074"


def validate_series(
    base_url: str,
    series_id: str,
    models: list[str],
    minimum_training_observations: int,
    minimum_calibration_samples: int,
    max_observations: int | None,
) -> dict[str, Any]:
    payload, fetch_seconds = _fetch_analytics_series(base_url, series_id)
    series, preparation_stats, preparation_seconds = _build_daily_series(payload)
    config = RollingDailyPointInTimeConfig(
        minimum_training_observations=minimum_training_observations,
        minimum_calibration_samples=minimum_calibration_samples,
    )
    validation_origin_start_date, validation_window_stats = _build_validation_origin_window(
        series,
        max_observations,
        config.historical_forecast_origin_start_date,
    )

    results: list[dict[str, Any]] = []
    failures: list[str] = []
    for model_id in models:
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

    return {
        "seriesId": series.series_id,
        "displayName": series.benchmark_name,
        "sourceBaseUrl": base_url,
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


def summarize_validation_results(
    series_results: list[dict[str, Any]],
    models: list[str],
    requested_series_ids: list[str],
    max_observations: int | None,
) -> dict[str, Any]:
    requested_set = set(requested_series_ids)
    aggregate_by_horizon: dict[str, dict[str, dict[str, Any]]] = {
        horizon: {
            model_id: {
                "seriesPassed": 0,
                "origins": [],
                "calibrationSamples": [],
                "bandAvailability": 0,
            }
            for model_id in models
        }
        for horizon in HORIZONS
    }

    series_summaries: list[dict[str, Any]] = []
    passed_series = 0
    non_control_passed = 0

    for result in series_results:
        model_results = {item["modelId"]: item for item in result["models"]}
        missing_models = [model_id for model_id in models if model_id not in model_results]
        model_statuses = {model_id: model_results[model_id]["status"] for model_id in models if model_id in model_results}
        series_pass = not result["failures"] and not missing_models and all(status == "AVAILABLE" for status in model_statuses.values())
        if series_pass:
            passed_series += 1
            if result["seriesId"] != CONTROL_SERIES_ID:
                non_control_passed += 1

        model_summaries: dict[str, Any] = {}
        for model_id in models:
            model_result = model_results.get(model_id)
            if model_result is None:
                model_summaries[model_id] = {"status": "MISSING", "failureReason": "Model result missing from validation output."}
                continue

            horizon_summary: dict[str, Any] = {}
            if model_result["status"] == "AVAILABLE":
                for horizon in HORIZONS:
                    backtest = model_result["backtest"][horizon]
                    calibration = model_result["calibration"][horizon]
                    anchor = model_result["anchorForecasts"][horizon]
                    aggregate = aggregate_by_horizon[horizon][model_id]
                    aggregate["seriesPassed"] += 1
                    aggregate["origins"].append(backtest["origins"])
                    aggregate["calibrationSamples"].append(calibration["sampleCount"])
                    if anchor["bandStatus"] == "AVAILABLE":
                        aggregate["bandAvailability"] += 1

                    horizon_summary[horizon] = {
                        "origins": backtest["origins"],
                        "expectedOrigins": backtest["expectedOrigins"],
                        "coverage": backtest["coverage"],
                        "metrics": backtest["metrics"],
                        "calibrationStatus": calibration["status"],
                        "calibrationSampleCount": calibration["sampleCount"],
                        "bandStatus": anchor["bandStatus"],
                        "forecastValue": anchor["forecastValue"],
                    }

            model_summaries[model_id] = {
                "status": model_result["status"],
                "failureReason": model_result.get("failureReason"),
                "selectedVariant": model_result.get("selectedVariant"),
                "originDate": model_result.get("originDate"),
                "horizons": horizon_summary,
            }

        series_summaries.append(
            {
                "seriesId": result["seriesId"],
                "displayName": result["displayName"],
                "status": "PASS" if series_pass else "FAIL",
                "history": result["history"],
                "failures": list(result["failures"]),
                "missingModels": missing_models,
                "models": model_summaries,
            }
        )

    horizon_summary: dict[str, Any] = {}
    for horizon in HORIZONS:
        horizon_summary[horizon] = {}
        for model_id in models:
            aggregate = aggregate_by_horizon[horizon][model_id]
            origins = aggregate["origins"]
            calibration_samples = aggregate["calibrationSamples"]
            horizon_summary[horizon][model_id] = {
                "seriesPassed": aggregate["seriesPassed"],
                "minOrigins": min(origins) if origins else 0,
                "maxOrigins": max(origins) if origins else 0,
                "averageOrigins": mean(origins) if origins else 0.0,
                "minCalibrationSamples": min(calibration_samples) if calibration_samples else 0,
                "allBandsAvailable": aggregate["bandAvailability"] == aggregate["seriesPassed"],
            }

    observed_series_ids = {result["seriesId"] for result in series_results}
    missing_series_ids = [series_id for series_id in requested_series_ids if series_id not in observed_series_ids]
    status = "PASS" if passed_series == len(series_results) and not missing_series_ids and observed_series_ids == requested_set else "FAIL"

    return {
        "status": status,
        "identity": {
            "forecastMethod": "ROLLING_DAILY_POINT_IN_TIME",
            "methodVersion": "rolling-daily-point-in-time-v1",
            "targetBasis": "POINT_IN_TIME",
            "models": models,
            "requestedSeriesIds": requested_series_ids,
            "controlSeriesId": CONTROL_SERIES_ID,
            "maxObservations": max_observations,
        },
        "scope": {
            "runtime": "NOT MODIFIED",
            "schema": "NOT MODIFIED",
            "deployment": "NOT PERFORMED",
            "benchmarkFinder": "NOT TOUCHED",
            "automaticSelection": "NOT BUILT",
        },
        "modelPolicy": {
            "champion": "NOT DEFINED",
            "preferredModel": "NOT DEFINED",
            "globalDefault": "NOT DEFINED",
            "automaticSelection": "NOT BUILT",
            "modelRanking": "NOT PERFORMED",
        },
        "summary": {
            "seriesRequested": len(requested_series_ids),
            "seriesValidated": len(series_results),
            "seriesPassed": passed_series,
            "nonControlSeriesPassed": non_control_passed,
            "missingSeriesIds": missing_series_ids,
        },
        "horizonSummary": horizon_summary,
        "seriesSummaries": series_summaries,
    }


def render_markdown_report(payload: dict[str, Any]) -> str:
    identity = payload["identity"]
    summary = payload["summary"]

    def source_history(history: dict[str, Any]) -> dict[str, Any]:
        return history.get("sourceHistory", history)

    def validation_window(history: dict[str, Any]) -> dict[str, Any]:
        return history.get(
            "validationOriginWindow",
            {
                "retainedObservationStart": history.get("start", "UNKNOWN"),
                "retainedObservationEnd": history.get("end", "UNKNOWN"),
                "retainedObservationCount": history.get("observationCount", 0),
            },
        )

    lines = [
        "# Rolling Daily Live Multi-Benchmark Validation",
        "",
        "## Scope",
        "",
        f"- Forecast method: `{identity['forecastMethod']}`",
        f"- Method version: `{identity['methodVersion']}`",
        f"- Target basis: `{identity['targetBasis']}`",
        f"- Models: `{', '.join(identity['models'])}`",
        f"- Requested series ids: `{', '.join(identity['requestedSeriesIds'])}`",
        f"- Control series id: `{identity['controlSeriesId']}`",
        f"- Max observations per series: `{identity['maxObservations']}`",
        "",
        "## Decision",
        "",
        f"Final status: `{payload['status']}`",
        "",
    ]

    if payload["status"] == "PASS":
        lines.append(
            f"The bounded live validation cohort passed for {summary['seriesPassed']} of {summary['seriesRequested']} requested DAILY series, including {summary['nonControlSeriesPassed']} non-control series beyond `{identity['controlSeriesId']}`."
        )
    else:
        lines.append(
            f"The bounded live validation cohort did not fully pass. {summary['seriesPassed']} of {summary['seriesRequested']} requested DAILY series completed with all requested models available."
        )
    lines.extend([
        "",
        "## Cohort Summary",
        "",
        "| Series | Display | History End | Retained Obs | Status |",
        "| --- | --- | --- | ---: | --- |",
    ])
    for series in payload["seriesSummaries"]:
        history = series["history"]
        source = source_history(history)
        window = validation_window(history)
        lines.append(
            f"| {series['seriesId']} | {series['displayName']} | {source['end']} | {window['retainedObservationCount']} | {series['status']} |"
        )

    lines.extend([
        "",
        "## Horizon Coverage",
        "",
        "| Horizon | Model | Passed Series | Min Origins | Avg Origins | Min Calibration Samples | Bands Available For All Passed Series |",
        "| --- | --- | ---: | ---: | ---: | ---: | --- |",
    ])
    for horizon in HORIZONS:
        for model_id in identity["models"]:
            node = payload["horizonSummary"][horizon][model_id]
            lines.append(
                f"| {horizon} | {model_id} | {node['seriesPassed']} | {node['minOrigins']} | {node['averageOrigins']:.2f} | {node['minCalibrationSamples']} | {'PASS' if node['allBandsAvailable'] else 'FAIL'} |"
            )

    lines.extend([
        "",
        "## Model Policy Guardrails",
        "",
        f"Champion: {payload['modelPolicy']['champion']}",
        f"Preferred Model: {payload['modelPolicy']['preferredModel']}",
        f"Global Default: {payload['modelPolicy']['globalDefault']}",
        "Automatic Selection:",
        payload["modelPolicy"]["automaticSelection"],
        "Model Ranking:",
        payload["modelPolicy"]["modelRanking"],
        "",
    ])

    for series in payload["seriesSummaries"]:
        history = series["history"]
        source = source_history(history)
        window = validation_window(history)
        lines.extend([
            f"## {series['seriesId']} - {series['displayName']}",
            "",
            f"- Status: `{series['status']}`",
            f"- Source history: `{source['start']}` to `{source['end']}` over `{source['observationCount']}` lawful DAILY observations",
            f"- Validation origin window: `{window['retainedObservationStart']}` to `{window['retainedObservationEnd']}` over `{window['retainedObservationCount']}` retained observations",
        ])
        if series["failures"]:
            lines.append(f"- Failures: `{'; '.join(series['failures'])}`")
        lines.extend([
            "",
            "| Model | Status | 1M Origins | 3M Origins | 6M Origins | 12M Origins | Selected Variant |",
            "| --- | --- | ---: | ---: | ---: | ---: | --- |",
        ])
        for model_id in identity["models"]:
            model = series["models"][model_id]
            if model["status"] == "AVAILABLE":
                lines.append(
                    f"| {model_id} | {model['status']} | {model['horizons']['1M']['origins']} | {model['horizons']['3M']['origins']} | {model['horizons']['6M']['origins']} | {model['horizons']['12M']['origins']} | {model['selectedVariant'] or 'N/A'} |"
                )
            else:
                lines.append(
                    f"| {model_id} | {model['status']} | 0 | 0 | 0 | 0 | {model['failureReason'] or 'N/A'} |"
                )
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def build_payload(
    base_url: str,
    series_ids: list[str],
    models: list[str],
    minimum_training_observations: int,
    minimum_calibration_samples: int,
    max_observations: int | None,
) -> dict[str, Any]:
    series_results = []
    for index, series_id in enumerate(series_ids, start=1):
        print(
            f"[{index}/{len(series_ids)}] validating {series_id}",
            file=sys.stderr,
            flush=True,
        )
        series_results.append(
            validate_series(
            base_url=base_url,
            series_id=series_id,
            models=models,
            minimum_training_observations=minimum_training_observations,
            minimum_calibration_samples=minimum_calibration_samples,
            max_observations=max_observations,
        )
        )
    summary = summarize_validation_results(series_results, models, series_ids, max_observations)
    return {
        **summary,
        "seriesResults": series_results,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate bounded live multi-benchmark validation evidence for ROLLING_DAILY_POINT_IN_TIME.")
    parser.add_argument("--base-url", default="http://localhost:3001", help="Base URL for sg-runtime.")
    parser.add_argument("--series-id", nargs="+", default=list(DEFAULT_SERIES_IDS), help="Provider series ids to validate as a cohort.")
    parser.add_argument("--models", nargs="+", default=list(DEFAULT_MODELS), help="Forecast model ids to validate.")
    parser.add_argument("--minimum-training-observations", type=int, default=60)
    parser.add_argument("--minimum-calibration-samples", type=int, default=20)
    parser.add_argument("--max-observations", type=int, default=400)
    parser.add_argument("--output", default=None, help="Optional JSON output path.")
    parser.add_argument("--report", default=None, help="Optional Markdown report output path.")
    args = parser.parse_args()

    payload = build_payload(
        base_url=args.base_url,
        series_ids=args.series_id,
        models=args.models,
        minimum_training_observations=args.minimum_training_observations,
        minimum_calibration_samples=args.minimum_calibration_samples,
        max_observations=args.max_observations,
    )
    rendered_json = json.dumps(payload, indent=2, sort_keys=True)
    rendered_report = render_markdown_report(payload)

    if args.output:
        Path(args.output).write_text(rendered_json + "\n", encoding="utf-8")
    if args.report:
        Path(args.report).write_text(rendered_report, encoding="utf-8")

    print(rendered_json)
    return 0 if payload["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())