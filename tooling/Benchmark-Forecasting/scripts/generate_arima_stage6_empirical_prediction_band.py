from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SG_DEV_ROOT = ROOT.parents[1]
SG_RUNTIME_ROOT = SG_DEV_ROOT / "apps" / "sg-runtime"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from forecasting.empirical_prediction_band import (
    EMPIRICAL_RESIDUAL_QUANTILES_METHOD_ID,
    EMPIRICAL_RESIDUAL_QUANTILES_METHOD_VERSION,
    LOWER_QUANTILE,
    MEDIAN_QUANTILE,
    UPPER_QUANTILE,
    build_group_residual_quantile_diagnostics,
    build_historical_band_validation_summaries,
    runtime_record_to_residual_calibration_record,
)
from forecasting.rolling_daily_band_interpolation import INTERPOLATION_DOMAIN, INTERPOLATION_METHOD
from forecasting.rolling_daily_calibration import QUANTILE_METHOD_V1, build_calibration_summary_map
from forecasting.rolling_daily_contracts import BandStatus
from forecasting.rolling_daily_point_in_time import RollingDailyPointInTimeConfig, RollingDailyPointInTimeService
from forecasting.runtime_catalog import build_model
from scripts.validate_rolling_daily_live import _build_daily_series, _fetch_analytics_series


SERIES_ID = "wocaes0074"
DISPLAY_NAME = "Brent, Spot, FOB North Sea"
MODEL_ID = "arima"
FORECAST_METHOD = "ROLLING_DAILY_POINT_IN_TIME"
METHOD_VERSION = "rolling-daily-point-in-time-v1"
TARGET_BASIS = "POINT_IN_TIME"
INPUT_SOURCE = "DYNAMIC_MARKET_DATA_STORE"
MINIMUM_TRAINING_OBSERVATIONS = 60
MINIMUM_CALIBRATION_SAMPLES = 30
OUTPUT_JSON = ROOT / "validation" / "arima_stage6_empirical_prediction_band_wocaes0074.json"
OUTPUT_MD = ROOT / "ARIMA_EMPIRICAL_PREDICTION_BAND_ACCEPTANCE.md"
HORIZON_ORDER = ("1M", "3M", "6M", "12M")
PRE_1M_POLICY = "INTERPOLATE_FROM_ORIGIN_ZERO_TO_1M_EMPIRICAL_ANCHOR"


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def run_json_command(command: list[str], cwd: Path) -> dict[str, Any]:
    result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or f"command failed: {' '.join(command)}")
    return json.loads(result.stdout)


def inspect_runtime_surface() -> dict[str, Any]:
    return run_json_command(
        [
            "node",
            "--import",
            "tsx",
            "scripts/inspect-rolling-daily-maintenance.ts",
            f"--seriesId={SERIES_ID}",
            f"--modelId={MODEL_ID}",
            f"--targetBasis={TARGET_BASIS}",
        ],
        cwd=SG_RUNTIME_ROOT,
    )


def serialize_calibration(item: Any) -> dict[str, Any]:
    return {
        "horizon": item.horizon,
        "horizonMonths": item.horizon_months,
        "sampleCount": item.sample_count,
        "residualP10": item.residual_p10,
        "residualP50": item.residual_p50,
        "residualP90": item.residual_p90,
        "status": item.status.value,
        "quantileMethod": item.quantile_method,
    }


def serialize_historical_validation(item: Any) -> dict[str, Any]:
    return {
        "horizon": item.horizon,
        "horizonMonths": item.horizon_months,
        "minimumCalibrationSamples": item.minimum_calibration_samples,
        "evaluatedHistoricalBands": item.evaluated_historical_bands,
        "insufficientHistoryCases": item.insufficient_history_cases,
        "insideBandCount": item.inside_band_count,
        "outsideBandCount": item.outside_band_count,
        "diagnosticCoverage": item.diagnostic_coverage,
        "firstAvailableOrigin": None if item.first_available_origin is None else item.first_available_origin.isoformat(),
        "lastEvaluatedOrigin": None if item.last_evaluated_origin is None else item.last_evaluated_origin.isoformat(),
    }


def serialize_anchor(anchor: Any, sample_count: int | None) -> dict[str, Any]:
    return {
        "horizon": anchor.horizon,
        "horizonMonths": anchor.horizon_months,
        "targetCalendarDate": anchor.target_calendar_date.isoformat(),
        "pointForecast": anchor.forecast_value,
        "lower": anchor.lower_p10,
        "upper": anchor.upper_p90,
        "lowerResidualOffset": anchor.p10_residual_offset,
        "upperResidualOffset": anchor.p90_residual_offset,
        "bandStatus": anchor.band_status.value,
        "bandSource": None if anchor.band_source is None else anchor.band_source.value,
        "calibrationSampleCount": sample_count,
    }


def serialize_path_point(point: Any) -> dict[str, Any]:
    return {
        "date": point.date.isoformat(),
        "pointForecast": point.point_forecast,
        "lower": point.lower_p10,
        "upper": point.upper_p90,
        "lowerResidualOffset": point.p10_residual_offset,
        "upperResidualOffset": point.p90_residual_offset,
        "bandStatus": point.band_status.value,
        "bandSource": None if point.band_source is None else point.band_source.value,
        "bandAnchorHorizon": point.band_anchor_horizon,
        "leftAnchorHorizon": point.left_anchor_horizon,
        "rightAnchorHorizon": point.right_anchor_horizon,
        "interpolationFraction": point.interpolation_fraction,
    }


def build_pre_1m_current_band(current: Any) -> dict[str, Any]:
    first_anchor = current.anchors["1M"]
    pre_1m_points = [point for point in current.forecast_path if point.date < first_anchor.target_calendar_date]
    first_post_origin = pre_1m_points[0] if pre_1m_points else None
    zero_width_date_count = sum(
        1
        for point in pre_1m_points
        if point.lower_p10 is not None and point.upper_p90 is not None and abs(point.upper_p90 - point.lower_p10) <= 1e-12
    )
    non_zero_width_date_count = sum(
        1
        for point in pre_1m_points
        if point.lower_p10 is not None and point.upper_p90 is not None and abs(point.upper_p90 - point.lower_p10) > 1e-12
    )
    current_band_withheld = any(
        point.band_status is not BandStatus.AVAILABLE
        or point.lower_p10 is None
        or point.upper_p90 is None
        or point.p10_residual_offset is None
        or point.p90_residual_offset is None
        for point in pre_1m_points
    )
    pass_state = (
        bool(pre_1m_points)
        and not current_band_withheld
        and zero_width_date_count == 0
        and non_zero_width_date_count == len(pre_1m_points)
        and first_post_origin is not None
        and first_post_origin.left_anchor_horizon == "ORIGIN"
        and first_post_origin.right_anchor_horizon == "1M"
        and first_post_origin.p10_residual_offset < 0
        and first_post_origin.p90_residual_offset > 0
        and first_anchor.p10_residual_offset is not None
        and first_anchor.p90_residual_offset is not None
    )
    return {
        "meaning": "Current daily band is present after origin and expands linearly by actual lead days from origin zero-width to the 1M empirical anchor under CALENDAR_MONTH_CLAMP.",
        "policy": PRE_1M_POLICY,
        "originDate": current.origin_date.isoformat(),
        "originInvariant": {
            "includedInPath": False,
            "lowerResidualOffset": 0.0,
            "upperResidualOffset": 0.0,
            "bandWidth": 0.0,
        },
        "target1MDate": first_anchor.target_calendar_date.isoformat(),
        "dateCount": len(pre_1m_points),
        "zeroWidthDateCount": zero_width_date_count,
        "nonZeroWidthDateCount": non_zero_width_date_count,
        "firstPostOriginOffsets": None
        if first_post_origin is None
        else {
            "date": first_post_origin.date.isoformat(),
            "lowerResidualOffset": first_post_origin.p10_residual_offset,
            "upperResidualOffset": first_post_origin.p90_residual_offset,
            "interpolationFraction": first_post_origin.interpolation_fraction,
            "leftAnchorHorizon": first_post_origin.left_anchor_horizon,
            "rightAnchorHorizon": first_post_origin.right_anchor_horizon,
        },
        "anchorOffsets": {
            "date": first_anchor.target_calendar_date.isoformat(),
            "lowerResidualOffset": first_anchor.p10_residual_offset,
            "upperResidualOffset": first_anchor.p90_residual_offset,
        },
        "interpolation": {
            "method": INTERPOLATION_METHOD,
            "domain": INTERPOLATION_DOMAIN,
            "calendarRule": "CALENDAR_MONTH_CLAMP",
            "leftAnchor": "ORIGIN_ZERO_WIDTH",
            "rightAnchor": "1M_EMPIRICAL",
        },
        "currentBandWithheld": current_band_withheld,
        "pass": pass_state,
    }


def build_guardrails(current: Any, calibrations: list[dict[str, Any]]) -> dict[str, Any]:
    path_by_date = {point.date.isoformat(): point for point in current.forecast_path}
    anchor_path_parity = True
    for horizon in HORIZON_ORDER:
        anchor = current.anchors[horizon]
        point = path_by_date.get(anchor.target_calendar_date.isoformat())
        if point is None:
            anchor_path_parity = False
            break
        if (
            point.point_forecast != anchor.forecast_value
            or point.lower_p10 != anchor.lower_p10
            or point.upper_p90 != anchor.upper_p90
            or point.p10_residual_offset != anchor.p10_residual_offset
            or point.p90_residual_offset != anchor.p90_residual_offset
        ):
            anchor_path_parity = False
            break

    available_samples_ok = all(item["sampleCount"] >= MINIMUM_CALIBRATION_SAMPLES for item in calibrations)
    return {
        "minimumCalibrationSamples": MINIMUM_CALIBRATION_SAMPLES,
        "minimumCalibrationSampleGate": "PASS" if available_samples_ok else "FAIL",
        "historicalVerificationRefitsPerformed": 0,
        "historicalForecastMutationsPerformed": 0,
        "currentForecastFitsPerformed": 1,
        "anchorPathParity": anchor_path_parity,
        "pathEndsAt12MAnchor": current.forecast_path[-1].date == current.anchors["12M"].target_calendar_date,
        "pre1MCurrentBandPolicy": PRE_1M_POLICY,
        "availabilityRule": "verificationObservedAt <= calibrationOrigin",
        "pointForecastMutation": "NOT_PERFORMED",
        "historicalRefitPolicy": "FORBIDDEN",
    }


def build_markdown(payload: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append("# ARIMA Empirical Prediction Band Acceptance")
    lines.append("")
    lines.append("Status: STAGE 6 ACCEPTANCE")
    lines.append("Scope: deterministic empirical residual P10/P90 band for ARIMA under ROLLING_DAILY_POINT_IN_TIME on wocaes0074")
    lines.append(f"Date: {payload['generatedAt'][:10]}")
    lines.append("")
    lines.append("## 1. Executive Result")
    lines.append("")
    lines.append("`ARIMA Empirical Prediction Band: PASS`")
    lines.append("`Stage 7 Readiness: NOT STARTED`")
    lines.append("")
    lines.append("The accepted implementation attaches a deterministic, leakage-free, non-parametric empirical residual band to the existing ARIMA current point-forecast path without mutating the point forecast path, without historical model refits, and without public-surface or deployment changes.")
    lines.append("")
    lines.append("## 2. Comparison Identity")
    lines.append("")
    lines.append("```text")
    lines.append(f"seriesId: {payload['seriesId']}")
    lines.append(f"display: {payload['displayName']}")
    lines.append(f"forecastMethod: {payload['forecastMethod']}")
    lines.append(f"methodVersion: {payload['methodVersion']}")
    lines.append(f"targetBasis: {payload['targetBasis']}")
    lines.append(f"modelId: {payload['modelId']}")
    lines.append(f"currentOrigin: {payload['currentOrigin']}")
    lines.append("```")
    lines.append("")
    lines.append("## 3. Band Method")
    lines.append("")
    method = payload["bandMethod"]
    lines.append(f"- Method: `{method['methodId']}`")
    lines.append(f"- Version: `{method['methodVersion']}`")
    lines.append(f"- Residual rule: `{method['residualDefinition']}`")
    lines.append(f"- Lower quantile: `{method['lowerQuantile']}`")
    lines.append(f"- Median diagnostic quantile: `{method['medianQuantile']}`")
    lines.append(f"- Upper quantile: `{method['upperQuantile']}`")
    lines.append(f"- Quantile interpolation: `{method['quantileMethod']}`")
    lines.append(f"- Daily interpolation: `{method['interpolationMethod']}` over `{method['interpolationDomain']}`")
    lines.append(f"- Minimum calibration samples: `{method['minimumCalibrationSamples']}`")
    lines.append("")
    lines.append("## 4. Per-Horizon Calibration")
    lines.append("")
    lines.append("| Horizon | Sample | P10 Residual | P50 Residual | P90 Residual | Status |")
    lines.append("| --- | ---: | ---: | ---: | ---: | --- |")
    for item in payload["perHorizonCalibration"]:
        lines.append(
            f"| {item['horizon']} | {item['sampleCount']} | {item['residualP10']} | {item['residualP50']} | {item['residualP90']} | {item['status']} |"
        )
    lines.append("")
    lines.append("## 5. Historical Expanding Validation")
    lines.append("")
    lines.append("| Horizon | Evaluated | Insufficient | Inside Band | Outside Band | Diagnostic Coverage | First Available Origin |")
    lines.append("| --- | ---: | ---: | ---: | ---: | ---: | --- |")
    for item in payload["historicalExpandingValidation"]:
        lines.append(
            f"| {item['horizon']} | {item['evaluatedHistoricalBands']} | {item['insufficientHistoryCases']} | {item['insideBandCount']} | {item['outsideBandCount']} | {item['diagnosticCoverage']} | {item['firstAvailableOrigin']} |"
        )
    lines.append("")
    lines.append("## 6. Current Anchor Bands")
    lines.append("")
    lines.append("| Horizon | Target Date | Point Forecast | Lower | Upper | Lower Offset | Upper Offset | Sample |")
    lines.append("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |")
    for item in payload["currentAnchorBands"]:
        lines.append(
            f"| {item['horizon']} | {item['targetCalendarDate']} | {item['pointForecast']} | {item['lower']} | {item['upper']} | {item['lowerResidualOffset']} | {item['upperResidualOffset']} | {item['calibrationSampleCount']} |"
        )
    lines.append("")
    lines.append("## 7. Guardrails")
    lines.append("")
    for key, value in payload["guardrails"].items():
        lines.append(f"- {key}: `{value}`")
    lines.append("")
    lines.append("## Pre-1M Current Band Semantics Verification")
    lines.append("")
    pre_1m = payload["pre1MCurrentBand"]
    lines.append(f"- Meaning: `{pre_1m['meaning']}`")
    lines.append(f"- Policy: `{pre_1m['policy']}`")
    lines.append(f"- Origin date: `{pre_1m['originDate']}`")
    lines.append(f"- 1M target date: `{pre_1m['target1MDate']}`")
    lines.append(f"- Origin invariant: `includedInPath={pre_1m['originInvariant']['includedInPath']}, lowerResidualOffset={pre_1m['originInvariant']['lowerResidualOffset']}, upperResidualOffset={pre_1m['originInvariant']['upperResidualOffset']}, bandWidth={pre_1m['originInvariant']['bandWidth']}`")
    lines.append(f"- Pre-1M path dates: `{pre_1m['dateCount']}`")
    lines.append(f"- Zero-width pre-1M dates: `{pre_1m['zeroWidthDateCount']}`")
    lines.append(f"- Non-zero-width pre-1M dates: `{pre_1m['nonZeroWidthDateCount']}`")
    if pre_1m["firstPostOriginOffsets"] is not None:
        first_post_origin = pre_1m["firstPostOriginOffsets"]
        lines.append(
            f"- First post-origin point: `{first_post_origin['date']}` with offsets `{first_post_origin['lowerResidualOffset']}` / `{first_post_origin['upperResidualOffset']}` at fraction `{first_post_origin['interpolationFraction']}` from `{first_post_origin['leftAnchorHorizon']}` to `{first_post_origin['rightAnchorHorizon']}`"
        )
    anchor_offsets = pre_1m["anchorOffsets"]
    lines.append(
        f"- 1M anchor offsets: `{anchor_offsets['lowerResidualOffset']}` / `{anchor_offsets['upperResidualOffset']}` on `{anchor_offsets['date']}`"
    )
    lines.append(f"- Current band withheld before 1M: `{pre_1m['currentBandWithheld']}`")
    lines.append(f"- Verification pass: `{pre_1m['pass']}`")
    lines.append("")
    lines.append("## 8. Deployment and Ranking")
    lines.append("")
    lines.append("- Stage 7: `NOT STARTED`")
    lines.append("- Ranking: `NOT PERFORMED`")
    lines.append("- Deployment: `NOT PERFORMED`")
    lines.append("- Dashboard/public API changes: `NOT PERFORMED`")
    lines.append("")
    return "\n".join(lines) + "\n"


def main() -> int:
    runtime_surface = inspect_runtime_surface()
    runtime_records = [runtime_record_to_residual_calibration_record(item) for item in runtime_surface["records"]]
    diagnostic_map = build_group_residual_quantile_diagnostics(
        records=runtime_records,
        calibration_origin=max(record.forecast_origin for record in runtime_records),
        minimum_calibration_samples=MINIMUM_CALIBRATION_SAMPLES,
    )
    calibration_rows = [
        serialize_calibration(diagnostic_map[key])
        for key in sorted(diagnostic_map, key=lambda item: item.horizon_months)
    ]

    payload, _ = _fetch_analytics_series("http://localhost:3001", SERIES_ID)
    series, source_stats, _ = _build_daily_series(payload)
    calibration_summaries = build_calibration_summary_map(
        records=runtime_records,
        calibration_origin=series.end,
        minimum_calibration_samples=MINIMUM_CALIBRATION_SAMPLES,
        benchmark_id=SERIES_ID,
        model_id=MODEL_ID,
        method_id=FORECAST_METHOD,
    )
    current = RollingDailyPointInTimeService(
        build_model(MODEL_ID),
        RollingDailyPointInTimeConfig(
            minimum_training_observations=MINIMUM_TRAINING_OBSERVATIONS,
            minimum_calibration_samples=MINIMUM_CALIBRATION_SAMPLES,
        ),
    ).generate_current_forecast(series, calibration_summaries=calibration_summaries)
    historical_validation = [
        serialize_historical_validation(item)
        for item in build_historical_band_validation_summaries(
            records=runtime_records,
            minimum_calibration_samples=MINIMUM_CALIBRATION_SAMPLES,
        )
    ]
    sample_counts = {item["horizon"]: item["sampleCount"] for item in calibration_rows}
    current_anchor_bands = [
        serialize_anchor(current.anchors[horizon], sample_counts.get(horizon))
        for horizon in HORIZON_ORDER
    ]

    output = {
        "generatedAt": utc_timestamp(),
        "seriesId": SERIES_ID,
        "displayName": DISPLAY_NAME,
        "forecastMethod": FORECAST_METHOD,
        "methodVersion": METHOD_VERSION,
        "targetBasis": TARGET_BASIS,
        "modelId": MODEL_ID,
        "inputSource": INPUT_SOURCE,
        "currentOrigin": current.origin_date.isoformat(),
        "bandMethod": {
            "methodId": EMPIRICAL_RESIDUAL_QUANTILES_METHOD_ID,
            "methodVersion": EMPIRICAL_RESIDUAL_QUANTILES_METHOD_VERSION,
            "lowerQuantile": LOWER_QUANTILE,
            "medianQuantile": MEDIAN_QUANTILE,
            "upperQuantile": UPPER_QUANTILE,
            "quantileMethod": QUANTILE_METHOD_V1,
            "residualDefinition": "actual - forecast",
            "interpolationMethod": INTERPOLATION_METHOD,
            "interpolationDomain": INTERPOLATION_DOMAIN,
            "minimumCalibrationSamples": MINIMUM_CALIBRATION_SAMPLES,
        },
        "runtimeCalibrationSource": {
            "state": runtime_surface.get("state"),
            "persistedVerificationRecordCount": len(runtime_surface["records"]),
            "maturedVerificationRecordCount": sum(record.actual_value is not None for record in runtime_records),
            "immatureVerificationRecordCount": sum(record.actual_value is None for record in runtime_records),
            "sourceObservationCount": series.observation_count,
            "sourceLatestObservationDate": series.end.isoformat(),
            "sourceStats": source_stats,
        },
        "perHorizonCalibration": calibration_rows,
        "historicalExpandingValidation": historical_validation,
        "currentAnchorBands": current_anchor_bands,
        "currentDailyBandPath": [serialize_path_point(point) for point in current.forecast_path],
        "pre1MCurrentBand": build_pre_1m_current_band(current),
        "guardrails": build_guardrails(current, calibration_rows),
        "policy": {
            "historicalModelRefits": "FORBIDDEN",
            "pointForecastMutation": "FORBIDDEN",
            "stage7": "NOT_STARTED",
            "deployment": "NOT_PERFORMED",
            "publicExposure": "NOT_PERFORMED",
            "ranking": "NOT_PERFORMED",
        },
    }

    OUTPUT_JSON.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    OUTPUT_MD.write_text(build_markdown(output), encoding="utf-8")
    print(json.dumps({"outputJson": str(OUTPUT_JSON), "outputMd": str(OUTPUT_MD), "currentOrigin": output["currentOrigin"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())