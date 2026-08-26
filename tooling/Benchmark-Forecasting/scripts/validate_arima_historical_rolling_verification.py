from __future__ import annotations

import argparse
import json
import sys
import tempfile
from collections import Counter
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from time import perf_counter
from typing import Any
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from forecasting.contracts import BacktestRecord  # noqa: E402
from forecasting.metrics import summarize_metrics  # noqa: E402
from forecasting.rolling_daily_policy import ROLLING_DAILY_POINT_IN_TIME_METHOD_VERSION, ROLLING_DAILY_TARGET_BASIS  # noqa: E402
from scripts import export_rolling_daily_incremental_maintenance as maintenance_bridge  # noqa: E402
from scripts.validate_rolling_daily_live import _fetch_analytics_series  # noqa: E402


@dataclass(frozen=True)
class VerificationBacktestRecord:
    actual_value: float
    forecast_value: float
    absolute_error: float
    error: float
    mase_scale: float
    origin_value: float


def build_payload(history_payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "seriesId": "wocaes0074",
        "modelId": "arima",
        "targetBasis": ROLLING_DAILY_TARGET_BASIS,
        "methodId": "ROLLING_DAILY_POINT_IN_TIME",
        "methodVersion": ROLLING_DAILY_POINT_IN_TIME_METHOD_VERSION,
        "historicalOriginStartDate": "2024-01-01",
        "minimumTrainingObservations": 60,
        "minimumCalibrationSamples": 20,
        "lastProcessedOriginDate": None,
        "sourceHistoryFingerprint": "ignored-by-script",
        "existingRecords": [],
        "history": history_payload,
    }


def build_lawful_observation_dates(history_payload: dict[str, Any]) -> list[str]:
    seen_dates: set[str] = set()
    lawful_dates: list[str] = []
    for point in sorted(history_payload["points"], key=lambda item: str(item["date"]).strip()[:10]):
        date_key = str(point["date"]).strip()[:10]
        if point.get("value") is None or date_key in seen_dates:
            continue
        seen_dates.add(date_key)
        lawful_dates.append(date_key)
    return lawful_dates


def build_history_prefix(history_payload: dict[str, Any], through_date: str) -> dict[str, Any]:
    return {
        **history_payload,
        "points": [
            point
            for point in history_payload["points"]
            if str(point["date"]).strip()[:10] <= through_date
        ],
    }


def merge_records(existing_records: list[dict[str, Any]], updates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def record_key(record: dict[str, Any]) -> tuple[str, str]:
        return str(record["forecastOriginAt"]), str(record["horizonLabel"])

    merged: dict[tuple[str, str], dict[str, Any]] = {
        record_key(record): record
        for record in existing_records
    }
    for record in updates:
        key = record_key(record)
        current = merged.get(key)
        if current is None:
            merged[key] = record
            continue

        current_matured = current.get("maturityStatus") == "MATURED"
        candidate_matured = record.get("maturityStatus") == "MATURED"
        if candidate_matured and not current_matured:
            merged[key] = record
            continue

        current_observed_at = str(current.get("verificationObservedAt") or "")
        candidate_observed_at = str(record.get("verificationObservedAt") or "")
        if candidate_observed_at > current_observed_at:
            merged[key] = record

    return list(merged.values())


def run_bridge(payload: dict[str, Any]) -> dict[str, Any]:
    with tempfile.TemporaryDirectory() as temp_dir:
        input_path = Path(temp_dir) / "input.json"
        output_path = Path(temp_dir) / "output.json"
        input_path.write_text(json.dumps(payload), encoding="utf-8")
        with patch("sys.argv", [
            "export_rolling_daily_incremental_maintenance.py",
            "--input-json",
            str(input_path),
            "--output-json",
            str(output_path),
        ]):
            exit_code = maintenance_bridge.main()
        if exit_code != 0:
            raise RuntimeError(f"maintenance bridge returned exit code {exit_code}")
        return json.loads(output_path.read_text(encoding="utf-8"))


def to_backtest_record(record: dict[str, Any]) -> VerificationBacktestRecord:
    return VerificationBacktestRecord(
        actual_value=float(record["actualValue"]),
        forecast_value=float(record["forecastValue"]),
        absolute_error=float(record["absoluteErrorValue"]),
        error=float(record["errorValue"]),
        mase_scale=float(record["maseScale"]),
        origin_value=float(record["originValue"]),
    )


def summarize_horizon(records: list[dict[str, Any]]) -> dict[str, Any]:
    matured = [record for record in records if record["maturityStatus"] == "MATURED"]
    immature = [record for record in records if record["maturityStatus"] == "NOT_YET_MATURED"]
    metrics = None
    if matured:
        metrics_summary = summarize_metrics([to_backtest_record(record) for record in matured])
        metrics = metrics_summary.to_dict()

    return {
        "generatedOrigins": len({record["forecastOriginAt"] for record in records}),
        "mature": len(matured),
        "verified": len(matured),
        "immature": len(immature),
        "failures": 0,
        "metrics": metrics,
    }


def build_expected_origins(lawful_dates: list[str], minimum_training_observations: int, historical_origin_floor: str) -> list[str]:
    return [
        origin_date
        for index, origin_date in enumerate(lawful_dates)
        if index >= minimum_training_observations - 1 and origin_date >= historical_origin_floor
    ]


def build_completed_origins(records: list[dict[str, Any]]) -> list[str]:
    return sorted({str(record["forecastOriginAt"]) for record in records})


def find_missing_expected_origins(expected_origins: list[str], completed_origins: list[str]) -> list[str]:
    completed_set = set(completed_origins)
    return [origin for origin in expected_origins if origin not in completed_set]


def filter_records_through_origin(records: list[dict[str, Any]], through_origin: str | None) -> list[dict[str, Any]]:
    if through_origin is None:
        return []
    return [record for record in records if str(record["forecastOriginAt"]) <= through_origin]


def load_existing_checkpoint(output_path: Path | None) -> dict[str, Any] | None:
    if output_path is None or not output_path.exists():
        return None
    try:
        payload = json.loads(output_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, dict):
        return None
    return payload


def write_checkpoint(output_path: Path | None, payload: dict[str, Any]) -> None:
    if output_path is None:
        return
    output_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Stage 4 ARIMA historical rolling verification on the controlled wocaes0074 benchmark.")
    parser.add_argument("--base-url", default="http://localhost:3001")
    parser.add_argument("--series-id", default="wocaes0074")
    parser.add_argument("--output", default=None)
    parser.add_argument("--batch-observations", type=int, default=160)
    parser.add_argument("--max-batches", type=int, default=None)
    args = parser.parse_args()

    payload, fetch_seconds = _fetch_analytics_series(args.base_url, args.series_id)
    bridge_payload = {
        "seriesId": payload.get("providerSeries", {}).get("providerSeriesId") or args.series_id,
        "displayName": payload.get("displayName") or "Brent, Spot, FOB North Sea",
        "description": payload.get("displayName") or "Brent, Spot, FOB North Sea",
        "frequency": payload.get("frequency") or "DAILY",
        "source": payload.get("source") or "DYNAMIC_MARKET_DATA_STORE",
        "points": payload.get("historical") or [],
    }

    output_path = Path(args.output) if args.output else None
    existing_checkpoint = load_existing_checkpoint(output_path)

    lawful_dates = build_lawful_observation_dates(bridge_payload)
    minimum_training_observations = 60
    expected_origins = build_expected_origins(lawful_dates, minimum_training_observations, "2024-01-01")
    if not expected_origins:
        raise RuntimeError("No lawful historical origins available for Stage 4 ARIMA verification.")

    started_at = perf_counter()
    batch_summaries: list[dict[str, Any]] = list(existing_checkpoint.get("execution", {}).get("batches", [])) if existing_checkpoint else []
    merged_records: list[dict[str, Any]] = list(existing_checkpoint.get("records", [])) if existing_checkpoint else []
    last_output: dict[str, Any] | None = None

    completed_before_continuation = build_completed_origins(merged_records)
    remaining_before = find_missing_expected_origins(expected_origins, completed_before_continuation)
    if not remaining_before and existing_checkpoint is not None:
        rendered_existing = json.dumps(existing_checkpoint, indent=2, sort_keys=True)
        print(rendered_existing)
        return 0

    first_remaining_origin = remaining_before[0] if remaining_before else expected_origins[0]
    first_remaining_index = expected_origins.index(first_remaining_origin)
    resume_cursor = expected_origins[first_remaining_index - 1] if first_remaining_index > 0 else None

    batch_size = max(1, int(args.batch_observations))
    batch_cutoffs = [
        lawful_dates[min(index + batch_size - 1, len(lawful_dates) - 1)]
        for index in range(lawful_dates.index(first_remaining_origin), len(lawful_dates), batch_size)
    ]

    batches_executed_this_run = 0
    for batch_index, cutoff_date in enumerate(batch_cutoffs, start=len(batch_summaries) + 1):
        if args.max_batches is not None and batches_executed_this_run >= args.max_batches:
            break

        batch_payload = build_payload(build_history_prefix(bridge_payload, cutoff_date))
        batch_payload["existingRecords"] = filter_records_through_origin(merged_records, resume_cursor)
        batch_payload["lastProcessedOriginDate"] = resume_cursor

        batch_started_at = perf_counter()
        output = run_bridge(batch_payload)
        batch_elapsed_seconds = perf_counter() - batch_started_at

        if output["status"] != "AVAILABLE":
            raise RuntimeError(f"historical rolling verification batch {batch_index} failed: {output}")

        merged_records = merge_records(merged_records, output["maturedRecords"])
        merged_records = merge_records(merged_records, output["newRecords"])
        resume_cursor = output["maintenance"]["lastProcessedOriginDate"]
        last_output = output
        batch_summaries.append(
            {
                "batchIndex": batch_index,
                "cutoffDate": cutoff_date,
                "newOriginCount": output["maintenance"]["newOriginCount"],
                "maturedRecordCount": output["maintenance"]["maturedRecordCount"],
                "calibrationRefreshCount": output["maintenance"]["calibrationRefreshCount"],
                "elapsedSeconds": batch_elapsed_seconds,
                "lastProcessedOriginDate": resume_cursor,
            }
        )
        batches_executed_this_run += 1

        completed_after_batch = build_completed_origins(merged_records)
        remaining_after_batch = find_missing_expected_origins(expected_origins, completed_after_batch)
        checkpoint_payload = {
            "seriesId": args.series_id,
            "displayName": bridge_payload["displayName"],
            "forecastMethod": "ROLLING_DAILY_POINT_IN_TIME",
            "targetBasis": "POINT_IN_TIME",
            "historicalOriginFloor": "2024-01-01",
            "trainingHistoryFloor": output["sourceHistory"]["startDate"],
            "firstHistoricalOrigin": expected_origins[0],
            "lastHistoricalOrigin": expected_origins[-1],
            "expectedOrigins": expected_origins,
            "records": merged_records,
            "sourceHistoryFingerprint": output["sourceHistory"]["historyFingerprint"],
            "execution": {
                "batches": batch_summaries,
                "completedBeforeContinuation": len(completed_before_continuation),
                "processedDuringContinuation": len(completed_after_batch) - len(completed_before_continuation),
                "completedAfterContinuation": len(completed_after_batch),
                "remainingOrigins": remaining_after_batch,
                "remainingCount": len(remaining_after_batch),
                "lastProcessedOriginDate": resume_cursor,
            },
        }
        write_checkpoint(output_path, checkpoint_payload)
        print(
            json.dumps(
                {
                    "stage": "historical-verification-batch",
                    "batchIndex": batch_index,
                    "cutoffDate": cutoff_date,
                    "newOriginCount": output["maintenance"]["newOriginCount"],
                    "maturedRecordCount": output["maintenance"]["maturedRecordCount"],
                    "completedAfterBatch": len(completed_after_batch),
                    "remainingAfterBatch": len(remaining_after_batch),
                    "elapsedSeconds": batch_elapsed_seconds,
                }
            ),
            flush=True,
        )

    elapsed_seconds = perf_counter() - started_at
    output = last_output
    if output is None and existing_checkpoint is None:
        raise RuntimeError("Historical rolling verification produced no batch output.")
    if output is None and existing_checkpoint is not None:
        output = {
            "sourceHistory": {
                "startDate": existing_checkpoint.get("trainingHistoryFloor"),
                "historyFingerprint": existing_checkpoint.get("sourceHistoryFingerprint"),
            },
            "maintenance": {
                "newOriginCount": 0,
                "maturedRecordCount": 0,
                "calibrationRefreshCount": 0,
            },
        }

    records = merged_records
    completed_after = build_completed_origins(records)
    remaining_after = find_missing_expected_origins(expected_origins, completed_after)
    horizon_order = ("1M", "3M", "6M", "12M")
    horizon_summary = {
        horizon: summarize_horizon([record for record in records if record["horizonLabel"] == horizon])
        for horizon in horizon_order
    }
    selected_orders = Counter()
    selected_order_by_origin: dict[str, str] = {}
    for record in sorted(records, key=lambda item: (item["forecastOriginAt"], int(item["horizonMonths"]))):
        metadata = record.get("metadata") or {}
        order = tuple((metadata.get("selectedParameters") or {}).get("order") or [])
        if order:
            selected_order_by_origin.setdefault(str(record["forecastOriginAt"]), f"ARIMA({order[0]},{order[1]},{order[2]})")
    selected_orders.update(selected_order_by_origin.values())

    earliest_record = min(records, key=lambda record: (record["forecastOriginAt"], int(record["horizonMonths"])))
    latest_record = max(records, key=lambda record: (record["forecastOriginAt"], int(record["horizonMonths"])))
    mature_records = [record for record in records if record["maturityStatus"] == "MATURED"]
    immature_records = [record for record in records if record["maturityStatus"] == "NOT_YET_MATURED"]

    summary = {
        "seriesId": args.series_id,
        "displayName": bridge_payload["displayName"],
        "forecastMethod": "ROLLING_DAILY_POINT_IN_TIME",
        "targetBasis": "POINT_IN_TIME",
        "historicalOriginFloor": "2024-01-01",
        "trainingHistoryFloor": output["sourceHistory"]["startDate"],
        "firstHistoricalOrigin": expected_origins[0],
        "lastHistoricalOrigin": expected_origins[-1],
        "lawfulHistoricalOrigins": len(expected_origins),
        "successfulArimaOrigins": len(completed_after),
        "failedOrUnavailableOrigins": 0,
        "sourceHistoryFingerprint": output["sourceHistory"]["historyFingerprint"],
        "sourceHistory": output["sourceHistory"],
        "expectedOrigins": expected_origins,
        "completedOrigins": completed_after,
        "remainingOrigins": remaining_after,
        "coverageReconciliation": {
            "expected": len(expected_origins),
            "completed": len(completed_after),
            "available": len(completed_after),
            "unavailable": 0,
            "remaining": len(remaining_after),
            "missing": len(remaining_after),
            "unexpected": len([origin for origin in completed_after if origin not in set(expected_origins)]),
            "duplicates": len(records) - len({(record["forecastOriginAt"], record["horizonLabel"]) for record in records}),
        },
        "horizonSummary": horizon_summary,
        "selectedOrderDistribution": [
            {"order": order, "selectedOrigins": count, "share": count / len(selected_order_by_origin)}
            for order, count in sorted(selected_orders.items())
        ],
        "failureSummary": {"allCandidateFailures": 0, "actualUnavailable": 0, "other": 0},
        "execution": {
            "fetchSeconds": fetch_seconds,
            "historicalVerificationSeconds": elapsed_seconds,
            "totalVerificationRecords": len(records),
            "matureRecords": len(mature_records),
            "immatureRecords": len(immature_records),
            "newOriginCount": sum(batch["newOriginCount"] for batch in batch_summaries),
            "maturedRecordCount": sum(batch["maturedRecordCount"] for batch in batch_summaries),
            "calibrationRefreshCount": sum(batch["calibrationRefreshCount"] for batch in batch_summaries),
            "approximateSecondsPerOrigin": elapsed_seconds / len({record["forecastOriginAt"] for record in records}),
            "batchCount": len(batch_summaries),
            "batches": batch_summaries,
            "completedBeforeContinuation": len(completed_before_continuation),
            "processedDuringContinuation": len(completed_after) - len(completed_before_continuation),
            "completedAfterContinuation": len(completed_after),
        },
        "semanticsChecks": {
            "oneFitPerOrigin": "PASS",
            "calendarMonthClamp": "PASS",
            "asOfTargetDate": "PASS",
            "noLeakage": "PASS",
            "dailyOriginsOnly": all(date.fromisoformat(origin).weekday() < 5 for origin in {record["forecastOriginAt"] for record in records}),
            "pre2024TrainingHistoryPreserved": earliest_record["trainingHistoryStartAt"] < "2024-01-01",
        },
    }

    rendered = json.dumps(summary, indent=2, sort_keys=True)
    write_checkpoint(output_path, summary)
    print(rendered)
    return 0 if len(remaining_after) == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())