from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from forecasting.contracts import Frequency, Observation, TimeSeries
from forecasting.rolling_daily_contracts import BandSource, BandStatus, CalibrationSummary, ForecastAvailabilityStatus
from forecasting.rolling_daily_policy import (
    ROLLING_DAILY_DEFAULT_CONFIGURED_CALIBRATION_MINIMUM_SAMPLES,
    ROLLING_DAILY_DEFAULT_TECHNICAL_MINIMUM_TRAINING_OBSERVATIONS,
    ROLLING_DAILY_POINT_IN_TIME_METHOD_ID,
    ROLLING_DAILY_POINT_IN_TIME_METHOD_VERSION,
)
from forecasting.rolling_daily_point_in_time import RollingDailyPointInTimeConfig, RollingDailyPointInTimeService
from forecasting.runtime_catalog import build_model


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export current rolling-daily forecast contract payload.")
    parser.add_argument("--input-json", required=True, help="Path to bridge input JSON.")
    parser.add_argument("--output-json", required=True, help="Path to bridge output JSON.")
    return parser.parse_args()


def normalize_date(value: Any) -> str:
    if not isinstance(value, str) or len(value.strip()) < 10:
        raise ValueError("Expected a non-empty ISO date string.")
    return date.fromisoformat(value[:10]).isoformat()


def build_time_series(history_payload: dict[str, Any]) -> tuple[TimeSeries, dict[str, int]]:
    points_payload = history_payload.get("points")
    if not isinstance(points_payload, list) or not points_payload:
        raise ValueError("History payload points must be a non-empty array.")

    frequency = Frequency(str(history_payload.get("frequency", "")).upper())
    seen_dates: set[date] = set()
    filtered_null_count = 0
    filtered_duplicate_count = 0
    observations: list[Observation] = []

    for point in sorted(points_payload, key=lambda candidate: normalize_date(candidate.get("date"))):
        observed_at = date.fromisoformat(normalize_date(point.get("date")))
        value = point.get("value")
        if value is None:
            filtered_null_count += 1
            continue

        numeric_value = float(value)
        if not math.isfinite(numeric_value):
            raise ValueError(f"Non-finite DAILY value encountered on {observed_at.isoformat()}.")
        if observed_at in seen_dates:
            filtered_duplicate_count += 1
            continue
        seen_dates.add(observed_at)
        observations.append(Observation(date=observed_at, value=numeric_value))

    if not observations:
        raise ValueError("No lawful numeric DAILY observations remain after null/duplicate filtering.")

    series_id = str(history_payload.get("seriesId", "")).strip()
    display_name = str(history_payload.get("displayName") or series_id).strip() or series_id
    description = str(history_payload.get("description") or display_name or series_id).strip()
    return (
        TimeSeries(
            series_id=series_id,
            benchmark_name=display_name,
            description=description,
            frequency=frequency,
            observations=tuple(observations),
        ),
        {
            "filteredNullCount": filtered_null_count,
            "filteredDuplicateCount": filtered_duplicate_count,
        },
    )


def build_calibration_summaries(payload: list[dict[str, Any]]) -> dict[str, CalibrationSummary]:
    summaries: dict[str, CalibrationSummary] = {}
    for item in payload:
        horizon_label = str(item["horizonLabel"])
        summaries[horizon_label] = CalibrationSummary(
            horizon=horizon_label,
            sample_count=int(item["sampleCount"]),
            residual_p10=None if item.get("residualP10") is None else float(item["residualP10"]),
            residual_p90=None if item.get("residualP90") is None else float(item["residualP90"]),
            status=BandStatus(str(item["status"])),
        )
    return summaries


def serialize_band_source(value: BandSource | None) -> str | None:
    return None if value is None else value.value


def serialize_status(value: BandStatus | ForecastAvailabilityStatus) -> str:
    return value.value


def serialize_path_point(point: Any) -> dict[str, Any]:
    return {
        "date": point.date.isoformat(),
        "pointForecast": point.point_forecast,
        "lowerP10": point.lower_p10,
        "upperP90": point.upper_p90,
        "bandStatus": serialize_status(point.band_status),
        "bandSource": serialize_band_source(point.band_source),
        "p10ResidualOffset": point.p10_residual_offset,
        "p90ResidualOffset": point.p90_residual_offset,
    }


def serialize_anchor(horizon: str, anchor: Any) -> dict[str, Any]:
    return {
        "horizon": horizon,
        "horizonMonths": anchor.horizon_months,
        "targetCalendarDate": anchor.target_calendar_date.isoformat(),
        "projectedStepCount": anchor.projected_step_count,
        "pointForecast": anchor.forecast_value,
        "lowerP10": anchor.lower_p10,
        "upperP90": anchor.upper_p90,
        "bandStatus": serialize_status(anchor.band_status),
        "bandSource": serialize_band_source(anchor.band_source),
        "p10ResidualOffset": anchor.p10_residual_offset,
        "p90ResidualOffset": anchor.p90_residual_offset,
    }


def main() -> int:
    args = parse_args()
    payload = json.loads(Path(args.input_json).read_text(encoding="utf-8"))

    method_id = str(payload.get("methodId") or ROLLING_DAILY_POINT_IN_TIME_METHOD_ID)
    method_version = str(payload.get("methodVersion") or ROLLING_DAILY_POINT_IN_TIME_METHOD_VERSION)
    model_id = str(payload["modelId"])

    try:
        series, source_stats = build_time_series(payload["history"])
        calibration_summaries = build_calibration_summaries(payload.get("calibrationGroups", []))
        config = RollingDailyPointInTimeConfig(
            minimum_training_observations=int(payload.get("minimumTrainingObservations", ROLLING_DAILY_DEFAULT_TECHNICAL_MINIMUM_TRAINING_OBSERVATIONS)),
            minimum_calibration_samples=int(payload.get("minimumCalibrationSamples", ROLLING_DAILY_DEFAULT_CONFIGURED_CALIBRATION_MINIMUM_SAMPLES)),
        )
        current = RollingDailyPointInTimeService(build_model(model_id), config).generate_current_forecast(
            series,
            calibration_summaries=calibration_summaries,
        )
        metadata = current.metadata
        output = {
            "status": current.status.value,
            "reason": current.failure_reason,
            "methodId": method_id,
            "methodVersion": method_version,
            "modelId": model_id,
            "sourceHistory": {
                "startDate": series.start.isoformat(),
                "latestObservationDate": series.end.isoformat(),
                "observationCount": series.observation_count,
                "filteredNullCount": source_stats["filteredNullCount"],
                "filteredDuplicateCount": source_stats["filteredDuplicateCount"],
            },
            "currentForecast": {
                "originDate": current.origin_date.isoformat(),
                "calendarProjectionMode": current.calendar_projection_mode,
                "maxHorizonMonths": current.max_horizon_months,
                "selectedCandidate": None if metadata is None else metadata.selected_variant,
                "selectionMetric": None if metadata is None else metadata.selection_metric,
                "selectionScore": None if metadata is None else metadata.selection_score,
                "selectedParameters": None if metadata is None else metadata.selected_parameters,
                "path": [serialize_path_point(point) for point in current.forecast_path],
                "anchors": [
                    serialize_anchor(horizon, current.anchors[horizon])
                    for horizon in ("1M", "3M", "6M", "12M")
                    if horizon in current.anchors
                ],
            },
        }
    except Exception as error:
        output = {
            "status": "FAILED",
            "reason": str(error),
            "methodId": method_id,
            "methodVersion": method_version,
            "modelId": model_id,
            "sourceHistory": {
                "startDate": None,
                "latestObservationDate": None,
                "observationCount": 0,
                "filteredNullCount": 0,
                "filteredDuplicateCount": 0,
            },
            "currentForecast": {
                "originDate": None,
                "calendarProjectionMode": None,
                "maxHorizonMonths": 12,
                "selectedCandidate": None,
                "selectionMetric": None,
                "selectionScore": None,
                "path": [],
                "anchors": [],
            },
        }

    Path(args.output_json).write_text(json.dumps(output, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())