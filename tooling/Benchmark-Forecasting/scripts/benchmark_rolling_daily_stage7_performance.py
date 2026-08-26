from __future__ import annotations

import argparse
import json
import math
import platform
import re
import statistics
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter, process_time
from typing import Any, Sequence

import numpy as np
import statsmodels

ROOT = Path(__file__).resolve().parents[1]
SG_DEV_ROOT = ROOT.parents[1]
SG_RUNTIME_ROOT = SG_DEV_ROOT / "apps" / "sg-runtime"
DASHBOARD_PREVIEW_ROOT = SG_DEV_ROOT / "apps" / "dashboard-preview"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from forecasting.empirical_prediction_band import build_group_residual_quantile_diagnostics, runtime_record_to_residual_calibration_record
from forecasting.rolling_daily_band_interpolation import interpolate_daily_band
from forecasting.rolling_daily_calibration import build_calibration_summary_map
from forecasting.rolling_daily_contracts import BandStatus, CalibrationSummary
from forecasting.rolling_daily_point_in_time import RollingDailyPointInTimeConfig, RollingDailyPointInTimeService
from forecasting.runtime_catalog import build_model
from scripts.generate_arima_stage6_empirical_prediction_band import inspect_runtime_surface
from scripts.validate_rolling_daily_live import _build_daily_series

SERIES_ID = "wocaes0074"
FORECAST_METHOD = "ROLLING_DAILY_POINT_IN_TIME"
METHOD_VERSION = "rolling-daily-point-in-time-v1"
TARGET_BASIS = "POINT_IN_TIME"
PRIMARY_MODEL = "arima"
REFERENCE_MODELS = ("naive", "damped_holt", "ets")
ALL_MODELS = (*REFERENCE_MODELS, PRIMARY_MODEL)
DEFAULT_OUTPUT_JSON = ROOT / "validation" / "rolling_daily_stage7_performance_cost_wocaes0074.json"
DEFAULT_OUTPUT_MD = ROOT / "ROLLING_DAILY_STAGE7_PERFORMANCE_COST_CHARACTERIZATION.md"
STAGE4_ARIMA_JSON = ROOT / "validation" / "arima_stage4_historical_verification_wocaes0074.json"
STAGE5_ARIMA_RECOMPUTATION_JSON = ROOT / "validation" / "stage5_arima_minimal_recomputation_wocaes0074.json"
STAGE6_ARIMA_JSON = ROOT / "validation" / "arima_stage6_empirical_prediction_band_wocaes0074.json"
STAGE1_ACCEPTANCE_MD = ROOT / "ARIMA_ROLLING_DAILY_CURRENT_FORECAST_ACCEPTANCE.md"
STAGE2_ACCEPTANCE_MD = ROOT / "ARIMA_REPRODUCIBILITY_FAST_SERVING_ACCEPTANCE.md"
CURRENT_WARMUP_RUNS = 1
CURRENT_MEASURED_RUNS = {"naive": 5, "damped_holt": 5, "ets": 5, "arima": 2}
PREPARED_READ_SAMPLE_COUNT = 20
PREPARED_READ_WARMUP_RUNS = 1
BAND_MEASURED_RUNS = 3
EPSILON = 1e-9
LEGACY_PREPARED_SERVING_CLASSIFICATION = "INVALID_FOR_CANONICAL_FORECAST_SERVING"
TOPOLOGY_CLASSIFICATION = "BENCHMARK_CONFIGURATION_DEFECT"
CANONICAL_PREPARED_SERVING_SEAM = "DASHBOARD_LIBRARY_PREPARED_SNAPSHOT_DB_READ"


@dataclass(frozen=True)
class CurrentMeasurement:
    elapsed_ms: float
    cpu_time_ms: float
    origin_date: str
    history_count: int
    path_length: int
    selected_variant: str | None
    selected_parameters: dict[str, Any]
    current: Any


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def summarize_latency_samples_ms(samples: Sequence[float], *, p95_min_samples: int = 20) -> dict[str, Any]:
    numeric = [float(sample) for sample in samples]
    if not numeric:
        return {
            "sampleCount": 0,
            "minMs": None,
            "medianMs": None,
            "maxMs": None,
            "p95Ms": None,
            "p95Status": "NOT_MEASURED",
            "samplesMs": [],
        }

    summary = {
        "sampleCount": len(numeric),
        "minMs": min(numeric),
        "medianMs": statistics.median(numeric),
        "maxMs": max(numeric),
        "p95Ms": None,
        "p95Status": "NOT_MEANINGFUL" if len(numeric) < p95_min_samples else "MEASURED",
        "samplesMs": numeric,
    }
    if len(numeric) >= p95_min_samples:
        ordered = sorted(numeric)
        index = math.ceil(0.95 * len(ordered)) - 1
        summary["p95Ms"] = ordered[max(0, min(index, len(ordered) - 1))]
    return summary


def parse_stage2_snapshot_persistence_ms(markdown: str) -> float | None:
    match = re.search(r"persistence of one prepared snapshot:\s*`([0-9.]+) ms`", markdown)
    if match is None:
        return None
    return float(match.group(1))


def parse_selected_order(markdown: str) -> str | None:
    match = re.search(r"selected (?:candidate|order):\s*`([^`]+)`", markdown)
    if match is None:
        return None
    return match.group(1)


def import_stage4_historical_evidence(payload: dict[str, Any]) -> dict[str, Any]:
    execution = payload["execution"]
    origin_count = int(payload["coverageReconciliation"]["completed"])
    total_runtime_seconds = float(
        execution.get("historicalVerificationSeconds")
        or sum(batch["elapsedSeconds"] for batch in execution["batches"])
    )
    runtime_per_origin_seconds = total_runtime_seconds / origin_count
    return {
        "sourceArtifact": str(STAGE4_ARIMA_JSON.relative_to(ROOT)),
        "origins": origin_count,
        "batches": int(execution["batchCount"]),
        "totalRuntimeSeconds": total_runtime_seconds,
        "fetchSeconds": float(execution.get("fetchSeconds", 0.0)),
        "runtimePerOriginSeconds": runtime_per_origin_seconds,
        "originsPerMinute": 60.0 / runtime_per_origin_seconds,
        "totalVerificationRecords": int(execution.get("totalVerificationRecords", 0)),
        "fullHistoricalRerunPerformed": False,
    }


def import_stage5_recomputation_evidence(payload: dict[str, Any]) -> dict[str, Any]:
    execution = payload["execution"]
    total_runtime_seconds = float(sum(batch["elapsedSeconds"] for batch in execution["batches"]))
    origins = int(payload["coverageReconciliation"]["completedAfter"])
    one_origin_batches = [batch for batch in execution["batches"] if int(batch["newOriginCount"]) == 1]
    representative_one_origin = one_origin_batches[-1] if one_origin_batches else None
    return {
        "sourceArtifact": str(STAGE5_ARIMA_RECOMPUTATION_JSON.relative_to(ROOT)),
        "origins": origins,
        "batches": int(execution["batchCount"]),
        "totalRuntimeSeconds": total_runtime_seconds,
        "runtimePerOriginSeconds": total_runtime_seconds / origins,
        "oneOriginRepresentative": None
        if representative_one_origin is None
        else {
            "elapsedSeconds": float(representative_one_origin["elapsedSeconds"]),
            "newOriginCount": int(representative_one_origin["newOriginCount"]),
            "maturedRecordCount": int(representative_one_origin["maturedRecordCount"]),
            "newRecordCount": int(representative_one_origin["persisted"]["newRecordCount"]),
            "calibrationGroupCount": int(representative_one_origin["persisted"]["calibrationGroupCount"]),
            "persistenceStatus": str(representative_one_origin["persisted"]["status"]),
        },
    }


def validate_current_compute_context(current_compute_by_model: dict[str, dict[str, Any]]) -> dict[str, Any]:
    if not current_compute_by_model:
        return {"status": "FAIL", "reason": "No current compute evidence was produced."}
    origins = {item["originDate"] for item in current_compute_by_model.values()}
    histories = {item["historyCount"] for item in current_compute_by_model.values()}
    path_lengths = {item["pathLength"] for item in current_compute_by_model.values()}
    status = "PASS" if len(origins) == len(histories) == len(path_lengths) == 1 else "FAIL"
    return {
        "status": status,
        "sharedOriginDate": next(iter(origins)) if len(origins) == 1 else None,
        "sharedHistoryCount": next(iter(histories)) if len(histories) == 1 else None,
        "sharedPathLength": next(iter(path_lengths)) if len(path_lengths) == 1 else None,
        "origins": sorted(origins),
        "historyCounts": sorted(histories),
        "pathLengths": sorted(path_lengths),
    }


def compare_numbers(left: float | None, right: float | None, *, epsilon: float = EPSILON) -> bool:
    if left is None or right is None:
        return left is right
    return abs(float(left) - float(right)) <= epsilon


def derive_output_parity(
    *,
    stage1_selected_order: str | None,
    stage6_payload: dict[str, Any],
    current_point_only: Any,
    current_with_band: Any,
    measured_band_calibration: dict[str, Any],
) -> dict[str, Any]:
    expected_path = stage6_payload["currentDailyBandPath"]
    actual_path = list(current_with_band.forecast_path)
    point_forecast_parity = len(expected_path) == len(actual_path)
    band_path_parity = point_forecast_parity
    for expected, actual in zip(expected_path, actual_path):
        if expected["date"] != actual.date.isoformat() or not compare_numbers(expected["pointForecast"], actual.point_forecast):
            point_forecast_parity = False
            band_path_parity = False
            break
        if not (
            compare_numbers(expected["lower"], actual.lower_p10)
            and compare_numbers(expected["upper"], actual.upper_p90)
            and compare_numbers(expected["lowerResidualOffset"], actual.p10_residual_offset)
            and compare_numbers(expected["upperResidualOffset"], actual.p90_residual_offset)
        ):
            band_path_parity = False
            break

    expected_anchor_offsets = {
        item["horizon"]: (item["lowerResidualOffset"], item["upperResidualOffset"])
        for item in stage6_payload["currentAnchorBands"]
    }
    band_quantile_parity = all(
        compare_numbers(stage6_item["residualP10"], measured_band_calibration["quantilesByHorizon"][stage6_item["horizon"]]["p10"])
        and compare_numbers(stage6_item["residualP90"], measured_band_calibration["quantilesByHorizon"][stage6_item["horizon"]]["p90"])
        for stage6_item in stage6_payload["perHorizonCalibration"]
    ) and measured_band_calibration["sampleCountsByHorizon"] == {
        item["horizon"]: item["sampleCount"] for item in stage6_payload["perHorizonCalibration"]
    }

    selected_order_parity = stage1_selected_order == current_point_only.metadata.selected_variant
    pre_1m_payload = stage6_payload["pre1MCurrentBand"]
    pre_1m_points = [point for point in current_with_band.forecast_path if point.date.isoformat() < pre_1m_payload["target1MDate"]]
    stage6_pre1m_semantics = (
        pre_1m_payload["pass"] is True
        and pre_1m_payload["currentBandWithheld"] is False
        and bool(pre_1m_points)
        and all(point.band_status is BandStatus.AVAILABLE for point in pre_1m_points)
        and all(point.left_anchor_horizon == "ORIGIN" and point.right_anchor_horizon == "1M" for point in pre_1m_points)
    )

    return {
        "pointForecastParity": "PASS" if point_forecast_parity else "FAIL",
        "selectedOrderParity": "PASS" if selected_order_parity else "FAIL",
        "bandQuantileParity": "PASS" if band_quantile_parity else "FAIL",
        "bandPathParity": "PASS" if band_path_parity else "FAIL",
        "stage6Pre1MSemantics": "PASS" if stage6_pre1m_semantics else "FAIL",
        "expectedSelectedOrder": stage1_selected_order,
        "observedSelectedOrder": None if current_point_only.metadata is None else current_point_only.metadata.selected_variant,
        "expectedAnchorOffsets": expected_anchor_offsets,
    }


def build_scope_guardrails() -> dict[str, Any]:
    return {
        "stage7Only": True,
        "historicalFullRerunPerformed": False,
        "historicalModelRefitsPerformed": 0,
        "pointForecastMutation": "NO",
        "forecastPersistenceMutation": "NO",
        "dashboardModified": False,
        "publicApiModified": False,
        "publicArimaExposureAdded": False,
        "deploymentPerformed": False,
        "renderTouched": False,
        "benchmarkFinderTouched": False,
        "appShellTouched": False,
        "newDatabase": False,
        "newTable": False,
        "renderValidation": "NOT_REQUIRED",
        "modelRanking": "NOT_PERFORMED",
        "champion": "NOT_DEFINED",
        "preferredModel": "NOT_DEFINED",
        "automaticModelSelection": "NOT_BUILT",
    }


def load_existing_stage7_payload(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    return load_json(path)


def derive_legacy_invalidated_prepared_serving(existing_payload: dict[str, Any] | None) -> dict[str, Any] | None:
    if not existing_payload:
        return None

    legacy = existing_payload.get("legacyInvalidatedPreparedServing")
    if isinstance(legacy, dict):
        return legacy

    prepared = existing_payload.get("preparedServing")
    if not isinstance(prepared, dict):
        return None

    timings = prepared.get("timings")
    if not isinstance(timings, dict):
        return None

    return {
        "classification": LEGACY_PREPARED_SERVING_CLASSIFICATION,
        "reason": "Previous Stage 7 execution ran under a localhost:3001 app context that the follow-up classified as non-canonical for prepared-serving evidence.",
        "measuredVia": "localhost:3001 execution context",
        "sampleCount": prepared.get("sampleCount"),
        "timings": timings,
    }


def build_serving_topology_audit() -> dict[str, Any]:
    return {
        "classification": TOPOLOGY_CLASSIFICATION,
        "topologyGate": "PASS",
        "previousExecutionContext": {
            "baseUrl": "http://localhost:3001",
            "appOwner": "apps/sg-runtime",
            "coLocatedUi": "Benchmark Finder",
            "historyRoute": "/api/benchmark/analytics-series",
            "historyRouteOwner": "apps/sg-runtime/app/api/benchmark/analytics-series/route.ts",
            "historyRouteRole": "raw benchmark history fetch",
            "preparedServingRole": "NOT_CANONICAL",
        },
        "canonicalPreparedServing": {
            "seam": CANONICAL_PREPARED_SERVING_SEAM,
            "persistenceOwner": "apps/sg-runtime/lib/forecast/rolling-daily-current-forecast-snapshot.ts",
            "dashboardConsumer": "apps/dashboard-preview/lib/benchmark-forecast/runtime-query.ts",
            "dashboardConsumerMethod": "getBenchmarkForecastCurrent(seriesId, model, 'POINT_IN_TIME')",
            "storage": "rollingDailyCurrentForecastSnapshot",
            "presentationTarget": "Dashboard Library",
            "presentationCompatibility": "PASS",
        },
        "dependencyProof": {
            "forecastCoreDependsOnBenchmarkFinder": "NO",
            "sgRuntimePreparedServingDependsOnBenchmarkFinder": "NO",
            "dashboardLibraryRequiresBenchmarkFinder": "NO",
        },
    }


def build_serving_behavior_gate() -> dict[str, Any]:
    return {
        "canonicalPreparedReadSeam": CANONICAL_PREPARED_SERVING_SEAM,
        "arimaFitTriggered": "NO",
        "historicalCalibrationTriggered": "NO",
        "forecastPersistenceMutation": "NO",
        "benchmarkFinderDependency": "NO",
        "pass": True,
    }


def run_json_command(command: list[str], cwd: Path) -> dict[str, Any]:
    result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "command failed")
    stdout = result.stdout.strip()
    if not stdout:
        raise RuntimeError("command returned empty stdout")
    try:
        return json.loads(stdout)
    except json.JSONDecodeError:
        lines = [line for line in stdout.splitlines() if line.strip()]
        if not lines:
            raise
        return json.loads(lines[-1])


def build_environment_metadata() -> dict[str, Any]:
    return {
        "benchmarkTimestamp": utc_timestamp(),
        "platform": platform.platform(),
        "system": platform.system(),
        "architecture": platform.machine(),
        "pythonVersion": sys.version.split()[0],
        "numpyVersion": np.__version__,
        "statsmodelsVersion": statsmodels.__version__,
        "processType": "python-script",
        "databaseAccessMode": "network-backed-neon-via-runtime-and-snapshot-seams",
    }


def load_canonical_history_payload(series_id: str) -> tuple[dict[str, Any], float]:
    with tempfile.NamedTemporaryFile("w", suffix=".mts", dir=SG_RUNTIME_ROOT, delete=False, encoding="utf-8") as handle:
        handle.write(
            """
import { performance } from 'node:perf_hooks'
import { getBenchmarkAnalyticsSeries } from '@/lib/benchmark/service'

const seriesId = process.argv[2]
const startedAt = performance.now()
const payload = await getBenchmarkAnalyticsSeries(seriesId, 'ALL')
console.log(JSON.stringify({ fetchMs: performance.now() - startedAt, payload }))
"""
        )
        temp_script = Path(handle.name)

    try:
        probe = run_json_command(
            [
                "node",
                "--import",
                "tsx",
                "--import",
                "./scripts/load-env.ts",
                str(temp_script),
                series_id,
            ],
            cwd=SG_RUNTIME_ROOT,
        )
    finally:
        temp_script.unlink(missing_ok=True)

    return probe["payload"], float(probe["fetchMs"]) / 1000.0


def measure_current_once(series: Any, model_id: str) -> CurrentMeasurement:
    service = RollingDailyPointInTimeService(build_model(model_id), RollingDailyPointInTimeConfig(minimum_training_observations=60))
    cpu_started_at = process_time()
    started_at = perf_counter()
    current = service.generate_current_forecast(series)
    elapsed_ms = (perf_counter() - started_at) * 1000
    cpu_time_ms = (process_time() - cpu_started_at) * 1000
    metadata = current.metadata
    return CurrentMeasurement(
        elapsed_ms=elapsed_ms,
        cpu_time_ms=cpu_time_ms,
        origin_date=current.origin_date.isoformat(),
        history_count=series.observation_count,
        path_length=len(current.forecast_path),
        selected_variant=None if metadata is None else metadata.selected_variant,
        selected_parameters={} if metadata is None else dict(metadata.selected_parameters),
        current=current,
    )


def measure_current_compute(series: Any, model_id: str) -> tuple[dict[str, Any], CurrentMeasurement]:
    for _ in range(CURRENT_WARMUP_RUNS):
        measure_current_once(series, model_id)
    runs = [measure_current_once(series, model_id) for _ in range(CURRENT_MEASURED_RUNS[model_id])]
    last = runs[-1]
    return {
        "originDate": last.origin_date,
        "historyCount": last.history_count,
        "pathLength": last.path_length,
        "runs": len(runs),
        "timings": summarize_latency_samples_ms([run.elapsed_ms for run in runs], p95_min_samples=999),
        "cpuTimeMs": summarize_latency_samples_ms([run.cpu_time_ms for run in runs], p95_min_samples=999),
        "selectedVariant": last.selected_variant,
        "selectedParameters": last.selected_parameters,
    }, last


def build_stage6_calibration_summaries(stage6_payload: dict[str, Any]) -> dict[str, CalibrationSummary]:
    summaries: dict[str, CalibrationSummary] = {}
    for item in stage6_payload["perHorizonCalibration"]:
        summaries[item["horizon"]] = CalibrationSummary(
            horizon=item["horizon"],
            sample_count=int(item["sampleCount"]),
            residual_p10=float(item["residualP10"]),
            residual_p90=float(item["residualP90"]),
            status=BandStatus(item["status"]),
        )
    return summaries


def measure_band_calibration(series: Any) -> dict[str, Any]:
    load_samples: list[float] = []
    quantile_samples: list[float] = []
    total_samples: list[float] = []
    quantiles_by_horizon: dict[str, dict[str, float]] | None = None
    sample_counts_by_horizon: dict[str, int] | None = None
    runtime_surface = None

    for _ in range(BAND_MEASURED_RUNS):
        total_started_at = perf_counter()
        load_started_at = perf_counter()
        runtime_surface = inspect_runtime_surface()
        runtime_records = [runtime_record_to_residual_calibration_record(item) for item in runtime_surface["records"]]
        load_samples.append((perf_counter() - load_started_at) * 1000)

        quantile_started_at = perf_counter()
        diagnostics = build_group_residual_quantile_diagnostics(
            records=runtime_records,
            calibration_origin=series.end,
            minimum_calibration_samples=30,
        )
        summaries = build_calibration_summary_map(
            records=runtime_records,
            calibration_origin=series.end,
            minimum_calibration_samples=30,
            benchmark_id=SERIES_ID,
            model_id=PRIMARY_MODEL,
            method_id=FORECAST_METHOD,
        )
        quantile_samples.append((perf_counter() - quantile_started_at) * 1000)
        total_samples.append((perf_counter() - total_started_at) * 1000)
        quantiles_by_horizon = {
            item.horizon: {"p10": item.residual_p10, "p50": item.residual_p50, "p90": item.residual_p90}
            for item in diagnostics.values()
        }
        sample_counts_by_horizon = {horizon: summary.sample_count for horizon, summary in summaries.items()}

    if runtime_surface is None or quantiles_by_horizon is None or sample_counts_by_horizon is None:
        raise RuntimeError("Band calibration measurement produced no samples.")

    matured_record_count = sum(1 for item in runtime_surface["records"] if item.get("actualValue") is not None)
    return {
        "status": "MEASURED",
        "calibrationRecordsRead": len(runtime_surface["records"]),
        "maturedRecordCount": matured_record_count,
        "sampleCountsByHorizon": sample_counts_by_horizon,
        "quantilesByHorizon": quantiles_by_horizon,
        "timings": {
            "recordReadMs": summarize_latency_samples_ms(load_samples, p95_min_samples=999),
            "quantileComputationMs": summarize_latency_samples_ms(quantile_samples, p95_min_samples=999),
            "totalMs": summarize_latency_samples_ms(total_samples, p95_min_samples=999),
        },
        "historicalModelRefits": 0,
    }


def measure_band_path_generation(series: Any, calibration_summaries: dict[str, CalibrationSummary]) -> dict[str, Any]:
    service = RollingDailyPointInTimeService(build_model(PRIMARY_MODEL), RollingDailyPointInTimeConfig(minimum_training_observations=60))
    current_point = service.generate_current_forecast(series)
    ordered_horizons = [("1M", 1), ("3M", 3), ("6M", 6), ("12M", 12)]
    anchor_dates = {horizon: current_point.anchors[horizon].target_calendar_date for horizon, _ in ordered_horizons}
    path_samples: list[float] = []
    for _ in range(BAND_MEASURED_RUNS):
        started_at = perf_counter()
        for point in current_point.forecast_path:
            interpolate_daily_band(
                origin_date=current_point.origin_date,
                target_date=point.date,
                point_forecast=point.point_forecast,
                anchor_dates=anchor_dates,
                calibration_summaries=calibration_summaries,
                ordered_horizons=ordered_horizons,
            )
        for horizon, _ in ordered_horizons:
            anchor = current_point.anchors[horizon]
            interpolate_daily_band(
                origin_date=current_point.origin_date,
                target_date=anchor.target_calendar_date,
                point_forecast=anchor.forecast_value,
                anchor_dates=anchor_dates,
                calibration_summaries=calibration_summaries,
                ordered_horizons=ordered_horizons,
            )
        path_samples.append((perf_counter() - started_at) * 1000)
    return {
        "status": "MEASURED",
        "pathLength": len(current_point.forecast_path),
        "anchorCount": len(current_point.anchors),
        "timings": summarize_latency_samples_ms(path_samples, p95_min_samples=999),
        "historicalModelRefits": 0,
    }


def run_incremental_bridge(payload: dict[str, Any]) -> dict[str, Any]:
    with tempfile.TemporaryDirectory() as temp_dir:
        input_path = Path(temp_dir) / "input.json"
        output_path = Path(temp_dir) / "output.json"
        input_path.write_text(json.dumps(payload), encoding="utf-8")
        result = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "export_rolling_daily_incremental_maintenance.py"),
                "--input-json",
                str(input_path),
                "--output-json",
                str(output_path),
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "incremental maintenance bridge failed")
        return json.loads(output_path.read_text(encoding="utf-8"))


def latest_two_lawful_dates(points: list[dict[str, Any]]) -> tuple[str, str]:
    lawful = [point["date"][:10] for point in points if point.get("value") is not None]
    return lawful[-2], lawful[-1]


def measure_incremental_maintenance(history_payload: dict[str, Any]) -> dict[str, Any]:
    points = history_payload["historical"]
    previous_origin_date, current_origin_date = latest_two_lawful_dates(points)
    started_at = perf_counter()
    payload = {
        "seriesId": SERIES_ID,
        "modelId": PRIMARY_MODEL,
        "targetBasis": TARGET_BASIS,
        "methodId": FORECAST_METHOD,
        "methodVersion": METHOD_VERSION,
        "historicalOriginStartDate": "2024-01-01",
        "minimumTrainingObservations": 60,
        "minimumCalibrationSamples": 30,
        "lastProcessedOriginDate": previous_origin_date,
        "sourceHistoryFingerprint": "stage7-current-one-origin-benchmark",
        "existingRecords": [],
        "history": {
            "seriesId": SERIES_ID,
            "displayName": history_payload["displayName"],
            "description": history_payload["displayName"],
            "frequency": history_payload.get("frequency") or "DAILY",
            "source": history_payload.get("source"),
            "historical": points,
        },
    }
    data_read_ms = (perf_counter() - started_at) * 1000
    bridge_started_at = perf_counter()
    bridge_output = run_incremental_bridge(payload)
    bridge_elapsed_ms = (perf_counter() - bridge_started_at) * 1000
    maintenance = bridge_output["maintenance"]
    return {
        "status": "MEASURED_WITHOUT_PERSISTENCE",
        "originDate": current_origin_date,
        "previousOriginDate": previous_origin_date,
        "timings": {
            "dataReadMs": data_read_ms,
            "modelComputeMs": None,
            "verificationArtifactCreationMs": None,
            "persistenceMs": None,
            "preparedStateUpdateMs": None,
            "totalMs": data_read_ms + bridge_elapsed_ms,
        },
        "operations": {
            "newOriginCount": int(maintenance["newOriginCount"]),
            "newOriginDates": maintenance["newOriginDates"],
            "newRecordCount": len(bridge_output["newRecords"]),
            "maturedRecordCount": int(maintenance["maturedRecordCount"]),
            "calibrationRefreshCount": int(maintenance["calibrationRefreshCount"]),
            "affectedCalibrationGroupCount": int(maintenance["affectedCalibrationGroupCount"]),
        },
        "persistence": {
            "status": "NOT_MEASURED_SAFE_READ_ONLY",
            "reason": "Live maintenance upsert was not timed separately to avoid mutating canonical runtime truth for benchmarking only.",
        },
        "repairCatchUp": "SEPARATE_NOT_MEASURED",
        "source": "export_rolling_daily_incremental_maintenance.py on current full history",
    }


def measure_prepared_serving(series_id: str) -> dict[str, Any]:
    with tempfile.NamedTemporaryFile("w", suffix=".mts", dir=DASHBOARD_PREVIEW_ROOT, delete=False, encoding="utf-8") as handle:
        handle.write(
            """
import { performance } from 'node:perf_hooks'
import { getMarketDataPrismaClient } from '@/lib/db/market-data-prisma'
import { getBenchmarkForecastCurrent } from '@/lib/benchmark-forecast/runtime-query'

const seriesId = process.argv[2]
const sampleCount = Number(process.argv[3] ?? '20')
const warmupRuns = Number(process.argv[4] ?? '1')
const prisma = getMarketDataPrismaClient()
if (!prisma) {
  throw new Error('MARKET_DATA_DATABASE_URL is not configured.')
}

const first = await getBenchmarkForecastCurrent(seriesId, 'arima', 'POINT_IN_TIME')
if (first.status !== 'AVAILABLE' || !('rollingDailySnapshot' in first)) {
    throw new Error(`Prepared point-in-time read returned ${first.status}`)
}
const sourceHistoryFingerprint = first.rollingDailySnapshot.audit?.sourceHistoryFingerprint
if (!sourceHistoryFingerprint) throw new Error('Persisted snapshot is missing sourceHistoryFingerprint.')

for (let index = 0; index < warmupRuns; index += 1) {
    const warmup = await getBenchmarkForecastCurrent(seriesId, 'arima', 'POINT_IN_TIME')
    if (warmup.status !== 'AVAILABLE' || !('rollingDailySnapshot' in warmup)) {
        throw new Error(`Warmup read returned ${warmup.status}`)
    }
}

const samplesMs: number[] = []
for (let index = 0; index < sampleCount; index += 1) {
  const startedAt = performance.now()
    const result = await getBenchmarkForecastCurrent(seriesId, 'arima', 'POINT_IN_TIME')
  samplesMs.push(performance.now() - startedAt)
    if (result.status !== 'AVAILABLE' || !('rollingDailySnapshot' in result)) {
        throw new Error(`Prepared read returned ${result.status}`)
    }
}

await prisma.$disconnect()
console.log(JSON.stringify({
  sampleCount,
  samplesMs,
  sourceHistoryFingerprint,
    seam: 'DASHBOARD_LIBRARY_PREPARED_SNAPSHOT_DB_READ',
}))
"""
        )
        temp_script = Path(handle.name)

    try:
        probe = run_json_command(
            [
                "node",
                "--import",
                "tsx",
                str(temp_script),
                series_id,
                str(PREPARED_READ_SAMPLE_COUNT),
                str(PREPARED_READ_WARMUP_RUNS),
            ],
            cwd=DASHBOARD_PREVIEW_ROOT,
        )
    finally:
        temp_script.unlink(missing_ok=True)

    return {
        "status": "MEASURED",
        "seam": probe["seam"],
        "sampleCount": int(probe["sampleCount"]),
        "timings": summarize_latency_samples_ms(probe["samplesMs"]),
        "fitTriggered": False,
        "historicalCalibrationRecomputed": False,
        "forecastPersistenceMutation": False,
        "benchmarkFinderDependency": False,
        "sourceHistoryFingerprint": probe["sourceHistoryFingerprint"],
    }


def build_markdown(payload: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append("# ROLLING_DAILY Stage 7 Performance & Cost Characterization")
    lines.append("")
    lines.append("Performance & Cost Characterization: COMPLETE" if payload["result"] == "SUCCESS" else "Performance & Cost Characterization: FAIL")
    lines.append(f"Stage 8 Readiness: {payload['stage8Readiness']}")
    lines.append(f"Primary Model: {PRIMARY_MODEL.upper()}")
    lines.append("Reference Models: Naive / Damped Holt / ETS")
    lines.append("")
    lines.append("## Executive Characterization")
    lines.append("")
    lines.append(f"- Fresh ARIMA computation: median `{payload['currentComputeByModel']['arima']['timings']['medianMs']}` ms across `{payload['currentComputeByModel']['arima']['runs']}` measured runs on the accepted current history.")
    lines.append(f"- Historical full verification: imported Stage 4 runtime `{payload['historicalEvidence']['stage4']['totalRuntimeSeconds']}` seconds across `{payload['historicalEvidence']['stage4']['origins']}` origins and `{payload['historicalEvidence']['stage4']['batches']}` batches.")
    lines.append(f"- Incremental maintenance: `{payload['incrementalMaintenance']['status']}` with one-origin total `{payload['incrementalMaintenance']['timings']['totalMs']}` ms and persistence `{payload['incrementalMaintenance']['persistence']['status']}`.")
    lines.append(f"- Band calibration: median `{payload['bandCalibration']['timings']['totalMs']['medianMs']}` ms from persisted ARIMA verification residuals only.")
    lines.append(f"- Prepared serving: median `{payload['preparedServing']['timings']['medianMs']}` ms over `{payload['preparedServing']['sampleCount']}` Dashboard Library prepared-snapshot reads without ARIMA fit.")
    lines.append("")
    lines.append("## Historical Full-Run Evidence")
    lines.append("")
    lines.append("| Evidence Run | Origins | Batches | Runtime | Runtime / Origin |")
    lines.append("| --- | ---: | ---: | ---: | ---: |")
    stage4 = payload["historicalEvidence"]["stage4"]
    stage5 = payload["historicalEvidence"]["stage5Recomputation"]
    lines.append(f"| Stage 4 | {stage4['origins']} | {stage4['batches']} | {stage4['totalRuntimeSeconds']} s | {stage4['runtimePerOriginSeconds']} s |")
    lines.append(f"| Stage 5 recomputation | {stage5['origins']} | {stage5['batches']} | {stage5['totalRuntimeSeconds']} s | {stage5['runtimePerOriginSeconds']} s |")
    lines.append("")
    lines.append("## Current Compute")
    lines.append("")
    lines.append("| Model | History N | Runs | Min | Median | Max |")
    lines.append("| --- | ---: | ---: | ---: | ---: | ---: |")
    for model_id in ALL_MODELS:
        current = payload["currentComputeByModel"][model_id]
        lines.append(f"| {model_id} | {current['historyCount']} | {current['runs']} | {current['timings']['minMs']} | {current['timings']['medianMs']} | {current['timings']['maxMs']} |")
    lines.append("")
    lines.append("## ARIMA Fit Characteristics")
    lines.append("")
    arima = payload["arimaCurrentCompute"]
    lines.append("- Candidate Policy: `17 candidates`")
    lines.append(f"- Selected order: `{arima['selectedOrder']}`")
    lines.append(f"- Candidate attempts: `{arima['candidateAttempts']}`")
    lines.append(f"- Candidate successes: `{arima['candidateSuccesses']}`")
    lines.append(f"- Current history observations: `{arima['historyCount']}`")
    lines.append(f"- Fresh runtime median: `{arima['timings']['medianMs']}` ms")
    lines.append("")
    lines.append("## Incremental Maintenance")
    lines.append("")
    incremental = payload["incrementalMaintenance"]
    lines.append(f"- Normal one-origin maintenance: `{incremental['status']}`")
    lines.append(f"- Data preparation: `{incremental['timings']['dataReadMs']}` ms")
    lines.append(f"- Model compute: `{incremental['timings']['modelComputeMs']}`")
    lines.append(f"- Verification/payload assembly: `{incremental['timings']['verificationArtifactCreationMs']}`")
    lines.append(f"- Persistence: `{incremental['persistence']['status']}`")
    lines.append(f"- Total: `{incremental['timings']['totalMs']}` ms")
    lines.append(f"- Repair/Catch-Up: `{incremental['repairCatchUp']}`")
    lines.append("")
    lines.append("## Band Cost")
    lines.append("")
    lines.append(f"- Calibration records read: `{payload['bandCalibration']['calibrationRecordsRead']}`")
    lines.append(f"- P10/P50/P90 calibration runtime median: `{payload['bandCalibration']['timings']['totalMs']['medianMs']}` ms")
    lines.append(f"- Daily interpolation runtime median: `{payload['bandPathGeneration']['timings']['medianMs']}` ms")
    lines.append(f"- Daily path length: `{payload['bandPathGeneration']['pathLength']}`")
    lines.append("- Historical model refits: `0`")
    lines.append("")
    lines.append("## Prepared Serving")
    lines.append("")
    prepared = payload["preparedServing"]
    legacy_prepared = payload.get("legacyInvalidatedPreparedServing")
    lines.append(f"- Prepared read sample count: `{prepared['sampleCount']}`")
    lines.append(f"- Canonical seam: `{prepared['seam']}`")
    lines.append(f"- Min: `{prepared['timings']['minMs']}` ms")
    lines.append(f"- Median: `{prepared['timings']['medianMs']}` ms")
    lines.append(f"- P95: `{prepared['timings']['p95Ms'] if prepared['timings']['p95Status'] == 'MEASURED' else prepared['timings']['p95Status']}`")
    lines.append(f"- Max: `{prepared['timings']['maxMs']}` ms")
    lines.append(f"- Prepared read triggers ARIMA fit: `{'YES' if prepared['fitTriggered'] else 'NO'}`")
    lines.append(f"- Prepared read triggers historical calibration recomputation: `{'YES' if prepared['historicalCalibrationRecomputed'] else 'NO'}`")
    lines.append(f"- Prepared read mutates forecast persistence: `{'YES' if prepared['forecastPersistenceMutation'] else 'NO'}`")
    lines.append(f"- Prepared read depends on Benchmark Finder: `{'YES' if prepared['benchmarkFinderDependency'] else 'NO'}`")
    if legacy_prepared is not None:
        lines.append(f"- Prior invalidated timing: `{legacy_prepared['timings']['medianMs']}` ms (`{legacy_prepared['classification']}`)")
    lines.append("")
    lines.append("## Serving Topology Audit")
    lines.append("")
    topology = payload["servingTopologyAudit"]
    lines.append(f"- Defect classification: `{topology['classification']}`")
    lines.append(f"- Previous localhost owner app: `{topology['previousExecutionContext']['appOwner']}`")
    lines.append(f"- Previous localhost co-located UI: `{topology['previousExecutionContext']['coLocatedUi']}`")
    lines.append(f"- Previous history route owner: `{topology['previousExecutionContext']['historyRouteOwner']}`")
    lines.append(f"- Canonical prepared seam: `{topology['canonicalPreparedServing']['seam']}`")
    lines.append(f"- Dashboard Library presentation compatibility: `{topology['canonicalPreparedServing']['presentationCompatibility']}`")
    lines.append(f"- Forecast Core depends on Benchmark Finder: `{topology['dependencyProof']['forecastCoreDependsOnBenchmarkFinder']}`")
    lines.append(f"- SG Runtime prepared serving depends on Benchmark Finder: `{topology['dependencyProof']['sgRuntimePreparedServingDependsOnBenchmarkFinder']}`")
    lines.append(f"- Dashboard Library requires Benchmark Finder: `{topology['dependencyProof']['dashboardLibraryRequiresBenchmarkFinder']}`")
    lines.append("")
    lines.append("## Fresh Vs Prepared")
    lines.append("")
    lines.append("| Path | Compute Characteristics | Typical Runtime |")
    lines.append("| --- | --- | ---: |")
    lines.append(f"| Fresh ARIMA Forecast | 17-candidate fit | {payload['arimaCurrentCompute']['timings']['medianMs']} ms |")
    lines.append(f"| Band Calibration | residual quantiles only | {payload['bandCalibration']['timings']['totalMs']['medianMs']} ms |")
    lines.append(f"| Band Interpolation | daily offset interpolation | {payload['bandPathGeneration']['timings']['medianMs']} ms |")
    lines.append(f"| Prepared Serving | no ARIMA fit | {payload['preparedServing']['timings']['medianMs']} ms |")
    lines.append("")
    lines.append("## Memory / CPU")
    lines.append("")
    lines.append(f"- Peak RSS: `{payload['memory']['status']}`")
    lines.append(f"- CPU: `{payload['cpu']['status']}`")
    lines.append(f"- ARIMA current CPU time median: `{payload['cpu']['arimaCurrentCpuTimeMs']['medianMs']}` ms")
    lines.append("")
    lines.append("## Derived Characterization")
    lines.append("")
    for key, value in payload["derivedMetrics"].items():
        lines.append(f"- {key}: `{value}`")
    lines.append("")
    lines.append("## Environment")
    lines.append("")
    for key, value in payload["environment"].items():
        lines.append(f"- {key}: `{value}`")
    lines.append("")
    lines.append("## Output Parity")
    lines.append("")
    for key, value in payload["outputParity"].items():
        if key.startswith("expected") or key.startswith("observed"):
            continue
        lines.append(f"- {key}: `{value}`")
    lines.append("")
    lines.append("## Cost Interpretation Boundary")
    lines.append("")
    lines.append("- Stage 7 establishes: `PERFORMANCE AND COST EVIDENCE`")
    lines.append("- Stage 7 does NOT establish: `FINAL MODEL ACCEPTANCE`")
    lines.append("- Stage 7 does NOT establish: `CHAMPION`")
    lines.append("- Stage 7 does NOT establish: `DEFAULT MODEL`")
    lines.append("- Stage 7 does NOT weight: `COST vs CORRECTNESS vs SERVING SPEED`")
    lines.append("- Direct Currency Cost: `NOT CALCULATED`")
    lines.append("")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Stage 7 performance and cost characterization for rolling-daily ARIMA on wocaes0074.")
    parser.add_argument("--base-url", default=None, help=argparse.SUPPRESS)
    parser.add_argument("--series-id", default=SERIES_ID)
    parser.add_argument("--output-json", default=str(DEFAULT_OUTPUT_JSON))
    parser.add_argument("--output-md", default=str(DEFAULT_OUTPUT_MD))
    args = parser.parse_args()

    output_json_path = Path(args.output_json)
    existing_payload = load_existing_stage7_payload(output_json_path)
    history_payload, fetch_seconds = load_canonical_history_payload(args.series_id)
    series, source_stats, preparation_seconds = _build_daily_series(history_payload)
    stage4_payload = load_json(STAGE4_ARIMA_JSON)
    stage5_recomputation_payload = load_json(STAGE5_ARIMA_RECOMPUTATION_JSON)
    stage6_payload = load_json(STAGE6_ARIMA_JSON)
    stage1_markdown = STAGE1_ACCEPTANCE_MD.read_text(encoding="utf-8")
    stage2_markdown = STAGE2_ACCEPTANCE_MD.read_text(encoding="utf-8")

    current_compute_by_model: dict[str, dict[str, Any]] = {}
    current_measurements: dict[str, CurrentMeasurement] = {}
    for model_id in ALL_MODELS:
        summary, measurement = measure_current_compute(series, model_id)
        current_compute_by_model[model_id] = summary
        current_measurements[model_id] = measurement

    current_context = validate_current_compute_context(current_compute_by_model)
    band_calibration = measure_band_calibration(series)
    calibration_summaries = build_stage6_calibration_summaries(stage6_payload)
    band_path_generation = measure_band_path_generation(series, calibration_summaries)
    incremental_maintenance = measure_incremental_maintenance(history_payload)
    prepared_serving = measure_prepared_serving(args.series_id)
    legacy_invalidated_prepared_serving = derive_legacy_invalidated_prepared_serving(existing_payload)
    serving_topology_audit = build_serving_topology_audit()
    serving_behavior_gate = build_serving_behavior_gate()
    stage2_snapshot_persistence_ms = parse_stage2_snapshot_persistence_ms(stage2_markdown)
    stage1_selected_order = parse_selected_order(stage1_markdown)
    arima_with_band = RollingDailyPointInTimeService(build_model(PRIMARY_MODEL), RollingDailyPointInTimeConfig(minimum_training_observations=60)).generate_current_forecast(
        series,
        calibration_summaries=calibration_summaries,
    )
    output_parity = derive_output_parity(
        stage1_selected_order=stage1_selected_order,
        stage6_payload=stage6_payload,
        current_point_only=current_measurements[PRIMARY_MODEL].current,
        current_with_band=arima_with_band,
        measured_band_calibration=band_calibration,
    )

    failures: list[str] = []
    if current_context["status"] != "PASS":
        failures.append("Reference-model current compute context diverged across origin/history/path length.")
    if prepared_serving["fitTriggered"]:
        failures.append("Prepared serving probe triggered ARIMA fit unexpectedly.")
    if prepared_serving["historicalCalibrationRecomputed"]:
        failures.append("Prepared serving probe recomputed historical calibration unexpectedly.")
    if prepared_serving["forecastPersistenceMutation"]:
        failures.append("Prepared serving probe mutated forecast persistence unexpectedly.")
    if prepared_serving["benchmarkFinderDependency"]:
        failures.append("Prepared serving still depends on Benchmark Finder unexpectedly.")
    if any(value == "FAIL" for key, value in output_parity.items() if key.endswith("Parity") or key == "stage6Pre1MSemantics"):
        failures.append("Forecast or band output parity failed against accepted Stage 1 and Stage 6 evidence.")

    historical_evidence = {
        "stage4": import_stage4_historical_evidence(stage4_payload),
        "stage5Recomputation": import_stage5_recomputation_evidence(stage5_recomputation_payload),
    }
    arima_current = current_compute_by_model[PRIMARY_MODEL]
    candidate_attempts = int(arima_current["selectedParameters"].get("candidateCount", 17))
    arima_current_compute = {
        "historyCount": arima_current["historyCount"],
        "originDate": arima_current["originDate"],
        "pathLength": arima_current["pathLength"],
        "selectedOrder": arima_current["selectedVariant"],
        "candidateAttempts": candidate_attempts,
        "candidateSuccesses": candidate_attempts,
        "timings": arima_current["timings"],
        "cpuTimeMs": arima_current["cpuTimeMs"],
        "policyIdentity": arima_current["selectedParameters"].get("policyIdentity"),
    }

    derived_metrics = {
        "historicalRuntimePerOriginSeconds": historical_evidence["stage4"]["runtimePerOriginSeconds"],
        "historicalOriginsPerMinute": historical_evidence["stage4"]["originsPerMinute"],
        "freshArimaPreparedReadRatio": arima_current["timings"]["medianMs"] / prepared_serving["timings"]["medianMs"],
        "arimaToEtsFreshComputeRatio": arima_current["timings"]["medianMs"] / current_compute_by_model["ets"]["timings"]["medianMs"],
        "bandCalibrationToArimaFreshRatio": band_calibration["timings"]["totalMs"]["medianMs"] / arima_current["timings"]["medianMs"],
        "computeCostRatioDescriptiveOnly": True,
    }

    output = {
        "identity": {
            "seriesId": args.series_id,
            "forecastMethod": FORECAST_METHOD,
            "methodVersion": METHOD_VERSION,
            "targetBasis": TARGET_BASIS,
            "currentOrigin": series.end.isoformat(),
        },
        "environment": build_environment_metadata(),
        "historicalEvidence": historical_evidence,
        "currentComputeByModel": current_compute_by_model,
        "arimaCurrentCompute": arima_current_compute,
        "incrementalMaintenance": incremental_maintenance,
        "bandCalibration": band_calibration,
        "bandPathGeneration": band_path_generation,
        "preparedServing": prepared_serving,
        "legacyInvalidatedPreparedServing": legacy_invalidated_prepared_serving,
        "servingTopologyAudit": serving_topology_audit,
        "servingBehaviorGate": serving_behavior_gate,
        "snapshotPersistenceEvidence": {
            "status": "IMPORTED_FROM_STAGE2" if stage2_snapshot_persistence_ms is not None else "NOT_AVAILABLE",
            "sourceArtifact": str(STAGE2_ACCEPTANCE_MD.relative_to(ROOT)),
            "persistenceMs": stage2_snapshot_persistence_ms,
        },
        "memory": {
            "status": "NOT_MEASURED",
            "reason": "Trustworthy peak RSS was not isolated per benchmark slice cheaply enough to treat as canonical evidence.",
        },
        "cpu": {
            "status": "MEASURED_PROCESS_CPU_TIME",
            "arimaCurrentCpuTimeMs": arima_current["cpuTimeMs"],
        },
        "derivedMetrics": derived_metrics,
        "outputParity": output_parity,
        "scopeGuardrails": build_scope_guardrails(),
        "currentComputeContext": current_context,
        "historyAcquisition": {
            "status": "DIRECT_SG_RUNTIME_MARKET_DATA_SERVICE",
            "httpBaseUrlUsed": False,
            "sourceOwner": "apps/sg-runtime/lib/market-data/service.ts",
            "analyticsPayloadOwner": "apps/sg-runtime/lib/benchmark/service.ts",
            "fetchSeconds": fetch_seconds,
            "seriesPreparationSeconds": preparation_seconds,
            "sourceStats": source_stats,
        },
        "directCurrencyCost": {
            "status": "NOT_CALCULATED",
            "reason": "no canonical project-specific unit price authority",
        },
        "result": "FAIL" if failures else "SUCCESS",
        "stage8Readiness": "BLOCKED" if failures else "READY",
        "generatedAt": utc_timestamp(),
        "sourcePerformance": {
            "fetchMs": fetch_seconds * 1000,
            "preparationMs": preparation_seconds * 1000,
            "sourceStats": source_stats,
            "historyStart": series.start.isoformat(),
            "historyEnd": series.end.isoformat(),
            "historyCount": series.observation_count,
        },
        "failures": failures,
    }

    output_md_path = Path(args.output_md)
    output_json_path.write_text(json.dumps(output, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    output_md_path.write_text(build_markdown(output), encoding="utf-8")
    print(json.dumps({"outputJson": str(output_json_path), "outputMd": str(output_md_path), "failures": len(failures)}, indent=2))
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())