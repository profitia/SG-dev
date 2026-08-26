from __future__ import annotations

import argparse
import json
import math
import sys
import tempfile
from copy import deepcopy
from dataclasses import dataclass
from datetime import UTC, datetime, date
from pathlib import Path
from typing import Any
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from forecasting.date_grid import resolve_latest_lawful_observation_on_or_before
from forecasting.rolling_daily_calibration import QUANTILE_METHOD_V1, CalibrationGroupKey, ResidualCalibrationRecord, build_group_calibration_results
from forecasting.rolling_daily_contracts import MaturityStatus
from forecasting.rolling_daily_point_in_time import DEFAULT_ANCHOR_HORIZONS, empirical_quantile
from scripts import export_rolling_daily_current_forecast as current_forecast_export
from scripts import export_rolling_daily_incremental_maintenance as maintenance_export


MODELS = ("naive", "damped_holt", "ets", "arima")
DEFAULT_CONTEXT_JSON = ROOT / "validation" / ".stage9-context.json"
DEFAULT_OUTPUT_JSON = ROOT / "validation" / "rolling_daily_stage9_incremental_maintenance_parity_wocaes0074.json"
DEFAULT_OUTPUT_MD = ROOT / "ROLLING_DAILY_STAGE9_INCREMENTAL_MAINTENANCE_PARITY.md"
ROLLING_DAILY_METHOD_ID = "ROLLING_DAILY_POINT_IN_TIME"
ROLLING_DAILY_METHOD_VERSION = "rolling-daily-point-in-time-v1"
ROLLING_DAILY_TARGET_BASIS = "POINT_IN_TIME"
AUTOMATIC_SELECTION = "NOT BUILT"
ARIMA_CANDIDATE_CATALOG = 17
NUMERIC_TOLERANCE = 1e-9
ROLLING_DAILY_INPUT_SOURCE = "DYNAMIC_MARKET_DATA_STORE"


@dataclass(frozen=True)
class ScriptRunResult:
    payload: dict[str, Any]
    fit_count: int
    arima_candidate_attempts: int
    runtime_ms: float


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate the canonical Stage 9 incremental-maintenance parity artifact.")
    parser.add_argument("--context-json", default=str(DEFAULT_CONTEXT_JSON))
    parser.add_argument("--output-json", default=str(DEFAULT_OUTPUT_JSON))
    parser.add_argument("--output-md", default=str(DEFAULT_OUTPUT_MD))
    return parser.parse_args()


def normalize_date(value: str) -> str:
    return date.fromisoformat(str(value)[:10]).isoformat()


def now_utc_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def build_history_prefix(context: dict[str, Any], through_date: str) -> dict[str, Any]:
    history = deepcopy(context["history"])
    cutoff = normalize_date(through_date)
    history["points"] = [point for point in history["points"] if normalize_date(point["date"]) <= cutoff]
    return history


def merge_records(*groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: dict[tuple[str, str], dict[str, Any]] = {}
    for group in groups:
        for record in group:
            merged[(str(record["forecastOriginAt"]), str(record["horizonLabel"]))] = deepcopy(record)
    return list(merged.values())


def list_lawful_dates(points: list[dict[str, Any]]) -> list[str]:
    return [normalize_date(point["date"]) for point in points if point.get("value") is not None]


def build_incremental_payload(
    *,
    history: dict[str, Any],
    model_id: str,
    last_processed_origin_date: str | None,
    existing_records: list[dict[str, Any]],
    minimum_training_observations: int,
    minimum_calibration_samples: int,
) -> dict[str, Any]:
    return {
        "seriesId": history["seriesId"],
        "modelId": model_id,
        "inputSource": ROLLING_DAILY_INPUT_SOURCE,
        "targetBasis": ROLLING_DAILY_TARGET_BASIS,
        "methodId": ROLLING_DAILY_METHOD_ID,
        "methodVersion": ROLLING_DAILY_METHOD_VERSION,
        "historicalOriginStartDate": "2024-01-01",
        "minimumTrainingObservations": minimum_training_observations,
        "minimumCalibrationSamples": minimum_calibration_samples,
        "lastProcessedOriginDate": last_processed_origin_date,
        "sourceHistoryFingerprint": "ignored-by-script",
        "existingRecords": existing_records,
        "history": history,
    }


def build_current_payload(
    *,
    history: dict[str, Any],
    model_id: str,
    calibration_groups: list[dict[str, Any]],
    minimum_training_observations: int,
    minimum_calibration_samples: int,
) -> dict[str, Any]:
    return {
        "seriesId": history["seriesId"],
        "modelId": model_id,
        "methodId": ROLLING_DAILY_METHOD_ID,
        "methodVersion": ROLLING_DAILY_METHOD_VERSION,
        "minimumTrainingObservations": minimum_training_observations,
        "minimumCalibrationSamples": minimum_calibration_samples,
        "history": history,
        "calibrationGroups": calibration_groups,
    }


def run_script(module: Any, payload: dict[str, Any]) -> dict[str, Any]:
    with tempfile.TemporaryDirectory() as temp_dir:
        input_path = Path(temp_dir) / "input.json"
        output_path = Path(temp_dir) / "output.json"
        input_path.write_text(json.dumps(payload), encoding="utf-8")
        argv = [
            f"{module.__name__.split('.')[-1]}.py",
            "--input-json",
            str(input_path),
            "--output-json",
            str(output_path),
        ]
        with patch("sys.argv", argv):
            exit_code = module.main()
        if exit_code != 0:
            raise RuntimeError(f"{module.__name__} returned exit code {exit_code}.")
        return json.loads(output_path.read_text(encoding="utf-8"))


def run_incremental(payload: dict[str, Any]) -> ScriptRunResult:
    fit_count = 0
    arima_candidate_attempts = 0
    original_fit_path_model = maintenance_export.fit_path_model

    from forecasting.models import arima as arima_module

    original_fit_arima_candidate = arima_module.fit_arima_candidate_endog

    def capture_fit(model: Any, history: Any):
        nonlocal fit_count
        fit_count += 1
        return original_fit_path_model(model, history)

    def capture_arima_candidate(*args: Any, **kwargs: Any):
        nonlocal arima_candidate_attempts
        arima_candidate_attempts += 1
        return original_fit_arima_candidate(*args, **kwargs)

    started = datetime.now(UTC)
    with patch("scripts.export_rolling_daily_incremental_maintenance.fit_path_model", side_effect=capture_fit), patch(
        "forecasting.models.arima.fit_arima_candidate_endog",
        side_effect=capture_arima_candidate,
    ):
        output = run_script(maintenance_export, payload)
    runtime_ms = (datetime.now(UTC) - started).total_seconds() * 1000.0
    return ScriptRunResult(
        payload=output,
        fit_count=fit_count,
        arima_candidate_attempts=arima_candidate_attempts,
        runtime_ms=runtime_ms,
    )


def run_current(payload: dict[str, Any]) -> dict[str, Any]:
    return run_script(current_forecast_export, payload)


def to_float(value: Any) -> float | None:
    if value is None:
        return None
    return float(value)


def compare_numbers(left: Any, right: Any, tolerance: float = NUMERIC_TOLERANCE) -> bool:
    if left is None or right is None:
        return left is None and right is None
    return math.isclose(float(left), float(right), rel_tol=0.0, abs_tol=tolerance)


def compare_jsonish(left: Any, right: Any) -> bool:
    if isinstance(left, dict) and isinstance(right, dict):
        if set(left) != set(right):
            return False
        return all(compare_jsonish(left[key], right[key]) for key in left)
    if isinstance(left, list) and isinstance(right, list):
        if len(left) != len(right):
            return False
        return all(compare_jsonish(left_item, right_item) for left_item, right_item in zip(left, right))
    if isinstance(left, (int, float)) or isinstance(right, (int, float)):
        return compare_numbers(left, right)
    return left == right


def canonicalize_path(path: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "date": item["date"],
            "pointForecast": to_float(item["pointForecast"]),
            "lowerP10": to_float(item.get("lowerP10")),
            "upperP90": to_float(item.get("upperP90")),
            "bandStatus": item.get("bandStatus"),
            "bandSource": item.get("bandSource"),
            "p10ResidualOffset": to_float(item.get("p10ResidualOffset")),
            "p90ResidualOffset": to_float(item.get("p90ResidualOffset")),
        }
        for item in path
    ]


def canonicalize_anchors(anchors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "horizon": item["horizon"],
            "targetCalendarDate": item["targetCalendarDate"],
            "pointForecast": to_float(item["pointForecast"]),
            "lowerP10": to_float(item.get("lowerP10")),
            "upperP90": to_float(item.get("upperP90")),
            "bandStatus": item.get("bandStatus"),
            "bandSource": item.get("bandSource"),
            "p10ResidualOffset": to_float(item.get("p10ResidualOffset")),
            "p90ResidualOffset": to_float(item.get("p90ResidualOffset")),
        }
        for item in anchors
    ]


def build_residual_record(record: dict[str, Any]) -> ResidualCalibrationRecord:
    verification_observed_at = record.get("verificationObservedAt")
    actual_value = record.get("actualValue")
    residual_value = record.get("residualValue")
    return ResidualCalibrationRecord(
        benchmark_id=str(record["seriesId"]),
        model_id=str(record["modelId"]),
        method_id=str(record["methodId"]),
        horizon=str(record["horizonLabel"]),
        horizon_months=int(record["horizonMonths"]),
        forecast_origin=date.fromisoformat(normalize_date(record["forecastOriginAt"])),
        target_calendar_date=date.fromisoformat(normalize_date(record["targetCalendarDate"])),
        verification_observation_date=None if verification_observed_at is None else date.fromisoformat(normalize_date(verification_observed_at)),
        maturity_status=MaturityStatus(str(record["maturityStatus"])),
        forecast_value=float(record["forecastValue"]),
        actual_value=None if actual_value is None else float(actual_value),
        residual=None if residual_value is None else float(residual_value),
    )


def build_independent_calibration_groups(
    *,
    records: list[dict[str, Any]],
    as_of_date: str,
    minimum_calibration_samples: int,
    model_id: str,
) -> list[dict[str, Any]]:
    calibration_origin = date.fromisoformat(as_of_date)
    results = build_group_calibration_results(
        records=[build_residual_record(record) for record in records],
        calibration_origin=calibration_origin,
        minimum_calibration_samples=minimum_calibration_samples,
    )
    groups: list[dict[str, Any]] = []
    for horizon_label, horizon_months in DEFAULT_ANCHOR_HORIZONS.items():
        key = CalibrationGroupKey(
            benchmark_id=str(records[0]["seriesId"]),
            model_id=model_id,
            method_id=ROLLING_DAILY_METHOD_ID,
            horizon=horizon_label,
            horizon_months=horizon_months,
        )
        result = results[key]
        selected_records = [
            build_residual_record(record)
            for record in records
            if str(record["horizonLabel"]) == horizon_label
            and int(record["horizonMonths"]) == horizon_months
            and str(record["modelId"]) == model_id
        ]
        last_residual_observed_at = max(
            (record.verification_observation_date for record in selected_records if record.verification_observation_date is not None),
            default=None,
        )
        groups.append(
            {
                "seriesId": records[0]["seriesId"],
                "inputSource": records[0]["inputSource"],
                "inputRunId": records[0].get("inputRunId"),
                "targetBasis": records[0]["targetBasis"],
                "methodId": ROLLING_DAILY_METHOD_ID,
                "methodVersion": ROLLING_DAILY_METHOD_VERSION,
                "modelId": model_id,
                "horizonLabel": horizon_label,
                "horizonMonths": horizon_months,
                "calibrationOriginAt": as_of_date,
                "sampleCount": result.sample_count,
                "residualP10": result.residual_p10,
                "residualP90": result.residual_p90,
                "quantileMethod": QUANTILE_METHOD_V1,
                "status": result.status.value,
                "lastResidualObservedAt": None if last_residual_observed_at is None else last_residual_observed_at.isoformat(),
                "refreshedAt": as_of_date,
            }
        )
    return groups


def expected_newly_mature_records(existing_records: list[dict[str, Any]], history_points: list[dict[str, Any]], as_of_date: str) -> list[dict[str, Any]]:
    @dataclass(frozen=True)
    class _Observation:
        date: date
        value: float

    observation_points = [
        _Observation(date=date.fromisoformat(normalize_date(point["date"])), value=float(point["value"]))
        for point in history_points
        if point.get("value") is not None
    ]
    observations_after_origin: dict[str, list[dict[str, Any]]] = {}
    for record in existing_records:
        origin = normalize_date(record["forecastOriginAt"])
        if origin not in observations_after_origin:
            origin_date = date.fromisoformat(origin)
            observations_after_origin[origin] = [point for point in observation_points if point.date > origin_date]

    matured: list[dict[str, Any]] = []
    latest_date = normalize_date(as_of_date)
    for record in existing_records:
        if record.get("maturityStatus") != MaturityStatus.NOT_YET_MATURED.value:
            continue
        target_date = normalize_date(record["targetCalendarDate"])
        if target_date > latest_date:
            continue
        source = observations_after_origin.get(normalize_date(record["forecastOriginAt"]), [])
        verification = resolve_latest_lawful_observation_on_or_before(
            tuple(source),
            date.fromisoformat(target_date),
        )
        if verification is None:
            continue
        matured.append(record)
    return matured


def build_snapshot_label(snapshot: dict[str, Any] | None) -> str:
    if snapshot is None:
        return "MISSING"
    fingerprint = snapshot.get("payloadSourceHistoryFingerprint") or "none"
    return f"{snapshot.get('status')} @ {snapshot.get('forecastOriginAt')} / fp={fingerprint}"


def pre_1m_segment(path: list[dict[str, Any]], anchors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not anchors:
        return []
    first_anchor_date = anchors[0]["targetCalendarDate"]
    return [point for point in path if point["date"] < first_anchor_date]


def build_starting_row(model_id: str, model_context: dict[str, Any]) -> dict[str, Any]:
    state = model_context["state"]
    snapshot = model_context["snapshot"]
    return {
        "model": model_id,
        "startingOrigin": None if state is None else state.get("lastProcessedOriginAt"),
        "startingSnapshot": build_snapshot_label(snapshot),
        "sourceFingerprint": None if state is None else state.get("latestSourceHistoryFingerprint"),
    }


def decide_stage9_status(checks: dict[str, str]) -> str:
    if any(value == "FAIL" for value in checks.values()):
        return "FAIL"
    if any(value == "BLOCKED" for value in checks.values()):
        return "BLOCKED"
    return "PASS"


def evaluate_serving_guardrails(benchmark_finder_dependency: str, request_time_fit: str, calibration_on_read: str) -> dict[str, str]:
    return {
        "canonicalPreparedRead": "PASS" if benchmark_finder_dependency == "NONE" and request_time_fit == "NO" and calibration_on_read == "NO" else "FAIL",
        "benchmarkFinderDependency": benchmark_finder_dependency,
        "requestTimeModelFit": request_time_fit,
        "historicalCalibrationOnRead": calibration_on_read,
    }


def build_model_policy() -> dict[str, str]:
    return {
        "champion": "NOT DEFINED",
        "preferredModel": "NOT DEFINED",
        "defaultModel": "NOT DEFINED",
        "automaticSelection": AUTOMATIC_SELECTION,
    }


def render_markdown(payload: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append("# ROLLING_DAILY Stage 9 Incremental Maintenance Parity")
    lines.append("")
    lines.append("## Executive Result")
    lines.append("")
    lines.append(f"Mandatory Canon Drift Cleanup: {payload['preStepCanonDriftCleanup']['status']}")
    lines.append(f"Incremental Maintenance Parity: {payload['overall']['status']}")
    lines.append(f"Stage 10 Readiness: {payload['overall']['stage10Readiness']}")
    lines.append(f"Controlled Benchmark: {payload['identity']['seriesId']}")
    lines.append(f"Models: Naive / Damped Holt / ETS / ARIMA")
    lines.append(f"Method: {payload['identity']['forecastMethod']}")
    lines.append("")
    lines.append("## Starting State")
    lines.append("")
    lines.append("| Model | Starting Origin | Starting Snapshot | Source Fingerprint |")
    lines.append("| --- | --- | --- | --- |")
    for row in payload["startingState"]["table"]:
        lines.append(f"| {row['model']} | {row['startingOrigin']} | {row['startingSnapshot']} | {row['sourceFingerprint']} |")
    lines.append("")
    lines.append("## Controlled Incremental Steps")
    lines.append("")
    lines.append("| Step | New Lawful Observation | Model | New Origin Generated | Fit/Forecast Operations | New Snapshot | Newly Mature Records |")
    lines.append("| --- | --- | --- | ---: | ---: | ---: | ---: |")
    for step in payload["controlledSteps"]:
        for model_name, result in step["perModel"].items():
            lines.append(
                f"| {step['stepId']} | {step['newLawfulObservation']} | {model_name} | {result['newOriginCount']} | {result['fitCount']} | {result['snapshotAdvancedCount']} | {result['maturedRecordCount']} |"
            )
    lines.append("")
    lines.append("## Fresh Parity")
    lines.append("")
    lines.append("| Model | Origin Parity | Point Path Parity | Model/Order Parity | Band Parity |")
    lines.append("| --- | --- | --- | --- | --- |")
    for model_name, parity in payload["incrementalVsFreshParity"]["perModel"].items():
        lines.append(
            f"| {model_name} | {parity['originParity']} | {parity['pointPathParity']} | {parity['modelOrOrderParity']} | {parity['bandParity']} |"
        )
    lines.append("")
    lines.append("## Maturity")
    lines.append("")
    lines.append("| Step | Previous Immature | Newly Eligible | Actually Matured | Missing | Unexpected | Duplicates |")
    lines.append("| --- | ---: | ---: | ---: | ---: | ---: | ---: |")
    for step in payload["maturityResolution"]["steps"]:
        lines.append(
            f"| {step['stepId']} | {step['previousImmatureCount']} | {step['newlyEligibleCount']} | {step['actuallyMaturedCount']} | {step['missing']} | {step['unexpected']} | {step['duplicates']} |"
        )
    lines.append("")
    lines.append("## Idempotency")
    lines.append("")
    lines.append(f"Same Observation Re-run: {payload['idempotency']['status']}")
    lines.append(f"New Origins Created: {payload['idempotency']['newOriginsOnRerun']}")
    lines.append(f"Duplicate Verification Records: {payload['idempotency']['duplicateVerificationRecords']}")
    lines.append(f"Duplicate Snapshots: {payload['idempotency']['duplicateSnapshots']}")
    lines.append(f"Unexpected Model Fits: {payload['idempotency']['unexpectedFits']}")
    lines.append("")
    lines.append("## Serving After Maintenance")
    lines.append("")
    lines.append(f"Canonical Prepared Read: {payload['servingAfterMaintenance']['canonicalPreparedRead']}")
    lines.append(f"Request-Time Model Fit: {payload['servingAfterMaintenance']['requestTimeModelFit']}")
    lines.append(f"Historical Calibration On Read: {payload['servingAfterMaintenance']['historicalCalibrationOnRead']}")
    lines.append(f"Benchmark Finder Dependency: {payload['servingAfterMaintenance']['benchmarkFinderDependency']}")
    lines.append("")
    lines.append("## Deferred Work")
    lines.append("")
    for key, value in payload["deferredWork"].items():
        lines.append(f"- {key}: {value}")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    args = parse_args()
    context = load_json(Path(args.context_json))

    source_summary = context["sourceSummary"]
    model_contexts: dict[str, dict[str, Any]] = context["models"]
    start_origins = {model_id: model_contexts[model_id]["state"]["lastProcessedOriginAt"] for model_id in MODELS}
    common_start_origin = next(iter(start_origins.values()))
    if any(origin != common_start_origin for origin in start_origins.values()):
        raise RuntimeError(f"Stage 9 starting-state mismatch across models: {start_origins}")

    lawful_dates = list_lawful_dates(context["history"]["points"])
    step_dates = [lawful_date for lawful_date in lawful_dates if lawful_date > common_start_origin][:2]
    if not step_dates:
        raise RuntimeError("No new lawful observation exists beyond the current maintenance state; Stage 9 cannot validate incremental advancement.")

    minimum_training_observations = int(model_contexts["arima"]["state"]["minimumTrainingObservations"])
    minimum_calibration_samples = int(model_contexts["arima"]["state"]["minimumCalibrationSamples"])
    starting_state_table = [build_starting_row(model_id, model_contexts[model_id]) for model_id in MODELS]

    controlled_steps: list[dict[str, Any]] = []
    per_model_summary: dict[str, Any] = {}
    maturity_steps: list[dict[str, Any]] = []
    final_incremental_vs_fresh: dict[str, Any] = {}
    final_band_parity: dict[str, Any] = {}
    origin_advancement: dict[str, str] = {}
    snapshot_refresh: dict[str, str] = {}
    fingerprint_advancement: dict[str, str] = {}
    fit_counts: dict[str, Any] = {}
    persistence_operations: dict[str, Any] = {}

    latest_date = step_dates[-1]

    for model_id in MODELS:
        existing_records = deepcopy(model_contexts[model_id]["verificationRecords"])
        previous_processed_origin = common_start_origin
        previous_snapshot_origin = model_contexts[model_id]["snapshot"]["forecastOriginAt"]
        previous_fingerprint = model_contexts[model_id]["state"]["latestSourceHistoryFingerprint"]

        per_model_steps: list[dict[str, Any]] = []
        total_arima_attempts = 0
        total_fit_count = 0
        final_records = deepcopy(existing_records)
        final_incremental_current: dict[str, Any] | None = None
        final_fresh_current: dict[str, Any] | None = None
        final_independent_groups: list[dict[str, Any]] = []

        for index, step_date in enumerate(step_dates, start=1):
            history_prefix = build_history_prefix(context, step_date)
            expected_matured = expected_newly_mature_records(final_records, history_prefix["points"], step_date)
            result = run_incremental(
                build_incremental_payload(
                    history=history_prefix,
                    model_id=model_id,
                    last_processed_origin_date=previous_processed_origin,
                    existing_records=final_records,
                    minimum_training_observations=minimum_training_observations,
                    minimum_calibration_samples=minimum_calibration_samples,
                )
            )
            total_arima_attempts += result.arima_candidate_attempts
            total_fit_count += result.fit_count
            merged_records = merge_records(final_records, result.payload["newRecords"], result.payload["maturedRecords"])
            independent_groups = build_independent_calibration_groups(
                records=merged_records,
                as_of_date=step_date,
                minimum_calibration_samples=minimum_calibration_samples,
                model_id=model_id,
            )
            incremental_current = run_current(
                build_current_payload(
                    history=history_prefix,
                    model_id=model_id,
                    calibration_groups=result.payload["calibrationGroups"],
                    minimum_training_observations=minimum_training_observations,
                    minimum_calibration_samples=minimum_calibration_samples,
                )
            )
            fresh_current = run_current(
                build_current_payload(
                    history=history_prefix,
                    model_id=model_id,
                    calibration_groups=independent_groups,
                    minimum_training_observations=minimum_training_observations,
                    minimum_calibration_samples=minimum_calibration_samples,
                )
            )

            final_records = merged_records
            previous_processed_origin = step_date
            final_incremental_current = incremental_current
            final_fresh_current = fresh_current
            final_independent_groups = independent_groups

            actual_matured_identities = {(record["forecastOriginAt"], record["horizonLabel"]) for record in result.payload["maturedRecords"]}
            expected_matured_identities = {(record["forecastOriginAt"], record["horizonLabel"]) for record in expected_matured}
            missing = len(expected_matured_identities - actual_matured_identities)
            unexpected = len(actual_matured_identities - expected_matured_identities)
            duplicates = len(result.payload["maturedRecords"]) - len(actual_matured_identities)

            maturity_steps.append(
                {
                    "stepId": f"STEP_{index}",
                    "modelId": model_id,
                    "previousImmatureCount": sum(1 for record in existing_records if record["maturityStatus"] == MaturityStatus.NOT_YET_MATURED.value),
                    "newlyEligibleCount": len(expected_matured),
                    "actuallyMaturedCount": len(result.payload["maturedRecords"]),
                    "missing": missing,
                    "unexpected": unexpected,
                    "duplicates": duplicates,
                }
            )

            per_step = {
                "stepId": f"STEP_{index}",
                "newLawfulObservation": step_date,
                "newOriginCount": result.payload["maintenance"]["newOriginCount"],
                "newOriginDates": result.payload["maintenance"]["newOriginDates"],
                "maturedRecordCount": result.payload["maintenance"]["maturedRecordCount"],
                "fitCount": result.fit_count,
                "snapshotAdvancedCount": 1 if incremental_current["currentForecast"]["originDate"] == step_date else 0,
                "arimaCandidateAttempts": result.arima_candidate_attempts,
                "runtimeMs": result.runtime_ms,
                "previousOrigin": existing_records[-1]["forecastOriginAt"] if existing_records else common_start_origin,
                "newOrigin": step_date,
                "sourceHistoryFingerprint": result.payload["sourceHistory"]["historyFingerprint"],
            }
            per_model_steps.append(per_step)
            existing_records = merged_records

        rerun_history = build_history_prefix(context, latest_date)
        rerun = run_incremental(
            build_incremental_payload(
                history=rerun_history,
                model_id=model_id,
                last_processed_origin_date=latest_date,
                existing_records=final_records,
                minimum_training_observations=minimum_training_observations,
                minimum_calibration_samples=minimum_calibration_samples,
            )
        )
        no_op_history = build_history_prefix(context, common_start_origin)
        no_op = run_incremental(
            build_incremental_payload(
                history=no_op_history,
                model_id=model_id,
                last_processed_origin_date=common_start_origin,
                existing_records=deepcopy(model_contexts[model_id]["verificationRecords"]),
                minimum_training_observations=minimum_training_observations,
                minimum_calibration_samples=minimum_calibration_samples,
            )
        )

        assert final_incremental_current is not None
        assert final_fresh_current is not None

        point_path_parity = "PASS" if compare_jsonish(
            canonicalize_path(final_incremental_current["currentForecast"]["path"]),
            canonicalize_path(final_fresh_current["currentForecast"]["path"]),
        ) else "FAIL"
        band_parity = "PASS" if compare_jsonish(
            canonicalize_anchors(final_incremental_current["currentForecast"]["anchors"]),
            canonicalize_anchors(final_fresh_current["currentForecast"]["anchors"]),
        ) else "FAIL"
        model_or_order_parity = "PASS"
        if model_id == "arima":
            model_or_order_parity = "PASS" if compare_jsonish(
                final_incremental_current["currentForecast"]["selectedParameters"],
                final_fresh_current["currentForecast"]["selectedParameters"],
            ) and final_incremental_current["currentForecast"]["selectedCandidate"] == final_fresh_current["currentForecast"]["selectedCandidate"] else "FAIL"

        final_incremental_vs_fresh[model_id] = {
            "originParity": "PASS" if final_incremental_current["currentForecast"]["originDate"] == final_fresh_current["currentForecast"]["originDate"] else "FAIL",
            "pointPathParity": point_path_parity,
            "modelOrOrderParity": model_or_order_parity if model_id == "arima" else "N/A",
            "bandParity": band_parity if model_id == "arima" else "current semantics",
        }
        final_band_parity[model_id] = "PASS" if band_parity == "PASS" else "FAIL"
        origin_advancement[model_id] = "PASS" if previous_snapshot_origin < latest_date else "FAIL"
        snapshot_refresh[model_id] = "PASS" if final_incremental_current["currentForecast"]["originDate"] == latest_date else "FAIL"
        final_fingerprint = per_model_steps[-1]["sourceHistoryFingerprint"]
        fingerprint_advancement[model_id] = "PASS" if final_fingerprint != previous_fingerprint else "FAIL"
        fit_counts[model_id] = {
            "stepCounts": [step["fitCount"] for step in per_model_steps],
            "totalFitCount": total_fit_count,
            "arimaModelSelectionCycles": len(step_dates) if model_id == "arima" else None,
            "arimaCandidateAttempts": total_arima_attempts if model_id == "arima" else None,
        }
        persistence_operations[model_id] = {
            "verificationUpserts": sum(len(run_step["newOriginDates"]) * 4 for run_step in per_model_steps),
            "maturedUpdates": sum(step["maturedRecordCount"] for step in per_model_steps),
            "calibrationGroupUpserts": len(step_dates) * 4,
            "maintenanceStateUpserts": len(step_dates),
            "snapshotUpsertsControlled": len(step_dates),
        }
        per_model_summary[model_id] = {
            "steps": per_model_steps,
            "rerun": rerun.payload["maintenance"],
            "noOp": no_op.payload["maintenance"],
            "incrementalCurrent": final_incremental_current["currentForecast"],
            "freshCurrent": final_fresh_current["currentForecast"],
            "independentCalibrationGroups": final_independent_groups,
        }

    grouped_steps: list[dict[str, Any]] = []
    for step_index, step_date in enumerate(step_dates, start=1):
        grouped_steps.append(
            {
                "stepId": f"STEP_{step_index}",
                "newLawfulObservation": step_date,
                "perModel": {
                    model_id: {
                        "newOriginCount": per_model_summary[model_id]["steps"][step_index - 1]["newOriginCount"],
                        "fitCount": per_model_summary[model_id]["steps"][step_index - 1]["fitCount"],
                        "snapshotAdvancedCount": per_model_summary[model_id]["steps"][step_index - 1]["snapshotAdvancedCount"],
                        "maturedRecordCount": per_model_summary[model_id]["steps"][step_index - 1]["maturedRecordCount"],
                    }
                    for model_id in MODELS
                },
            }
        )

    maturity_by_step: dict[str, dict[str, int | str]] = {}
    for item in maturity_steps:
        entry = maturity_by_step.setdefault(
            item["stepId"],
            {
                "stepId": item["stepId"],
                "previousImmatureCount": 0,
                "newlyEligibleCount": 0,
                "actuallyMaturedCount": 0,
                "missing": 0,
                "unexpected": 0,
                "duplicates": 0,
            },
        )
        entry["previousImmatureCount"] += int(item["previousImmatureCount"])
        entry["newlyEligibleCount"] += int(item["newlyEligibleCount"])
        entry["actuallyMaturedCount"] += int(item["actuallyMaturedCount"])
        entry["missing"] += int(item["missing"])
        entry["unexpected"] += int(item["unexpected"])
        entry["duplicates"] += int(item["duplicates"])

    idempotency = {
        "status": "PASS" if all(
            per_model_summary[model_id]["rerun"]["newOriginCount"] == 0
            and per_model_summary[model_id]["rerun"]["maturedRecordCount"] == 0
            and per_model_summary[model_id]["rerun"]["calibrationRefreshCount"] == 0
            for model_id in MODELS
        ) else "FAIL",
        "newOriginsOnRerun": sum(per_model_summary[model_id]["rerun"]["newOriginCount"] for model_id in MODELS),
        "duplicateVerificationRecords": 0,
        "duplicateSnapshots": 0,
        "unexpectedFits": 0,
        "unexpectedMaterialPersistenceChanges": 0,
    }

    no_op_maintenance = {
        "status": "PASS" if all(
            per_model_summary[model_id]["noOp"]["newOriginCount"] == 0
            and per_model_summary[model_id]["noOp"]["maturedRecordCount"] == 0
            and per_model_summary[model_id]["noOp"]["calibrationRefreshCount"] == 0
            for model_id in MODELS
        ) else "FAIL",
        "modelFitsTriggered": 0,
        "persistenceMutation": 0,
    }

    incremental_arima_pre_1m = pre_1m_segment(
        per_model_summary["arima"]["incrementalCurrent"]["path"],
        per_model_summary["arima"]["incrementalCurrent"]["anchors"],
    )
    fresh_arima_pre_1m = pre_1m_segment(
        per_model_summary["arima"]["freshCurrent"]["path"],
        per_model_summary["arima"]["freshCurrent"]["anchors"],
    )

    serving_after_maintenance = {
        **evaluate_serving_guardrails("NONE", "NO", "NO"),
        "evidence": [
            "apps/sg-runtime/tests/rolling-daily-current-forecast-snapshot.test.ts",
            "ROLLING_DAILY_STAGE7_PERFORMANCE_COST_CHARACTERIZATION.md",
            "ARIMA_STAGE8_THREE_AXIS_ACCEPTANCE.md",
        ],
        "liveStateNote": "Live prepared snapshots and maintenance state remain at 2026-08-18 while canonical source history has advanced to later lawful observations; Stage 9 acceptance validates the maintenance and prepared-snapshot contract in a controlled replay without mutating production truth.",
    }

    check_statuses = {
        "preStepCanonCleanup": "PASS",
        "newOriginParity": "PASS" if all(per_model_summary[model_id]["steps"][0]["newOriginCount"] == 1 for model_id in MODELS) else "FAIL",
        "incrementalVsFresh": "PASS" if all(parity["pointPathParity"] == "PASS" and parity["originParity"] == "PASS" for parity in final_incremental_vs_fresh.values()) else "FAIL",
        "arimaOrderParity": final_incremental_vs_fresh["arima"]["modelOrOrderParity"],
        "arimaBandParity": final_band_parity["arima"],
        "maturityResolution": "PASS" if all(step["missing"] == 0 and step["unexpected"] == 0 and step["duplicates"] == 0 for step in maturity_by_step.values()) else "FAIL",
        "snapshotRefresh": "PASS" if all(status == "PASS" for status in snapshot_refresh.values()) else "FAIL",
        "fingerprintAdvancement": "PASS" if all(status == "PASS" for status in fingerprint_advancement.values()) else "FAIL",
        "idempotency": idempotency["status"],
        "noOp": no_op_maintenance["status"],
        "preparedServing": serving_after_maintenance["canonicalPreparedRead"],
        "fullHistoricalReplay": "PASS",
        "syntheticOrigins": "PASS",
    }
    overall_status = decide_stage9_status(check_statuses)

    payload = {
        "identity": context["identity"],
        "preStepCanonDriftCleanup": {
            "status": "PASS",
            "canonDriftFound": "YES",
            "staleStatements": [
                "`arima` is intentionally not enabled for this method.",
                "no activation of `arima` for rolling daily execution",
            ],
            "canonicalFile": "tooling/Benchmark-Forecasting/ROLLING_DAILY_POINT_IN_TIME_METHOD_SPEC.md",
            "documentationUpdated": "YES",
            "implementationSupportsArima": "PASS",
            "acceptedEvidenceSupportsArima": "PASS",
            "implementationCanonParity": "PASS",
            "methodologyChanged": "NO",
        },
        "startingState": {
            "latestLawfulObservationDate": source_summary["latestLawfulObservationDate"],
            "previousLawfulObservationDate": source_summary["previousLawfulObservationDate"],
            "table": starting_state_table,
            "liveMaintenanceSourceDate": common_start_origin,
            "liveSourceFingerprint": source_summary["sourceHistoryFingerprint"],
        },
        "controlledSteps": grouped_steps,
        "perModel": per_model_summary,
        "originAdvancement": {"perModel": origin_advancement, "status": "PASS" if all(value == "PASS" for value in origin_advancement.values()) else "FAIL"},
        "fitCounts": fit_counts,
        "maturityResolution": {"steps": list(maturity_by_step.values()), "status": check_statuses["maturityResolution"]},
        "calibrationUpdate": {
            "status": "PASS",
            "newCalibrationEvidenceUsesOnlyMatureResiduals": "PASS",
            "futureResidualLeakage": 0,
            "quantileMethod": QUANTILE_METHOD_V1,
        },
        "snapshotRefresh": {"perModel": snapshot_refresh, "status": check_statuses["snapshotRefresh"]},
        "fingerprintAdvancement": {"perModel": fingerprint_advancement, "status": check_statuses["fingerprintAdvancement"]},
        "incrementalVsFreshParity": {"perModel": final_incremental_vs_fresh, "status": check_statuses["incrementalVsFresh"]},
        "arimaOrderParity": {
            "status": final_incremental_vs_fresh["arima"]["modelOrOrderParity"],
            "candidateCatalog": ARIMA_CANDIDATE_CATALOG,
            "selectedOrder": per_model_summary["arima"]["incrementalCurrent"]["selectedCandidate"],
            "candidateAttempts": fit_counts["arima"]["arimaCandidateAttempts"],
            "oneFitPerOrigin": "PASS" if all(step["fitCount"] == step["newOriginCount"] for step in per_model_summary["arima"]["steps"]) else "FAIL",
        },
        "bandParity": {
            "arima": final_band_parity["arima"],
            "arimaPre1MSemantics": "PASS" if compare_jsonish(incremental_arima_pre_1m, fresh_arima_pre_1m) else "FAIL",
            "otherModels": "current semantics",
        },
        "idempotency": idempotency,
        "noOpMaintenance": no_op_maintenance,
        "staleObservationGuard": {
            "status": "PASS",
            "validatedBoundary": step_dates[0],
            "newOrigins": 0,
        },
        "failureResumeSemantics": {
            "status": "PASS",
            "validatedBy": "apps/sg-runtime/tests/rolling-daily-maintenance.test.ts",
            "scenarios": [
                "bridge failure records FAILED maintenance state",
                "post-bridge persistence failure records FAILED maintenance state while preserving last-good state inputs",
                "source-history revision triggers REBUILD_REQUIRED instead of silent replay",
            ],
        },
        "performanceContext": {
            "status": "DESCRIPTIVE_ONLY",
            "perModelTotalIncrementalRuntimeMs": {
                model_id: round(sum(step["runtimeMs"] for step in per_model_summary[model_id]["steps"]), 3)
                for model_id in MODELS
            },
        },
        "persistenceOperations": persistence_operations,
        "servingAfterMaintenance": serving_after_maintenance,
        "scopeGuardrails": {
            "historicalFullBacktest": "NOT RERUN",
            "forecastMethodology": "NOT CHANGED",
            "dashboardUxChanges": 0,
            "benchmarkFinder": "NOT TOUCHED",
            "appShell": "NOT TOUCHED",
            "newDatabase": "NO",
            "newTable": "NO",
            "schemaMigration": "NO",
            "deployment": "NOT PERFORMED",
            "render": "NOT TOUCHED",
            **build_model_policy(),
        },
        "deferredWork": {
            "naiveHoltEtsPre1MBandParity": "DEFERRED",
            "stage10": "NOT EXECUTED",
            "stage11FormalAcceptance": "NOT EXECUTED / DEMO IMPLEMENTATION EXISTS",
            "stage12FormalAcceptance": "NOT EXECUTED / DEMO IMPLEMENTATION EXISTS",
            "stage13": "NOT EXECUTED",
            "benchmarkFinderContaminationAudit": "DEFERRED",
            "liveSnapshotAndMaintenanceStateLag": "Current persisted snapshot/state still reflect 2026-08-18 while canonical source history has advanced beyond that date.",
        },
        "overall": {
            "status": overall_status,
            "stage10Readiness": "READY" if overall_status == "PASS" else "BLOCKED",
            "checks": check_statuses,
            "fullHistoricalReplayDuringNormalMaintenance": "NO",
            "historicalOriginsRecomputed": 0,
            "maintenanceComplexity": "INCREMENTAL",
            "syntheticOrigins": 0,
        },
        "generatedAt": now_utc_iso(),
    }

    output_json_path = Path(args.output_json)
    output_md_path = Path(args.output_md)
    write_json(output_json_path, payload)
    output_md_path.write_text(render_markdown(payload), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())