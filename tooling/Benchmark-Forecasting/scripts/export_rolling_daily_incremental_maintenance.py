from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from hashlib import sha256
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from forecasting.backtest import compute_mase_scale
from forecasting.contracts import ForecastMetadata, Frequency, Observation, TimeSeries
from forecasting.date_grid import add_calendar_months_clamped, resolve_latest_lawful_observation_on_or_before
from forecasting.models.base import ModelForecastError
from forecasting.rolling_daily_calibration import QUANTILE_METHOD_V1, build_group_calibration_results
from forecasting.rolling_daily_calibration import CalibrationGroupKey, ResidualCalibrationRecord
from forecasting.rolling_daily_contracts import MaturityStatus, RollingDailyBacktestRecord
from forecasting.rolling_daily_policy import ROLLING_DAILY_POINT_IN_TIME_METHOD_VERSION
from forecasting.rolling_daily_point_in_time import (
    ROLLING_DAILY_POINT_IN_TIME_METHOD_ID,
    RollingDailyPointInTimeConfig,
    _build_projected_step_counts,
    fit_path_model,
    infer_supported_weekdays,
)
from forecasting.runtime_catalog import build_model

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export incremental rolling-daily maintenance delta.")
    parser.add_argument("--input-json", required=True, help="Path to maintenance bridge input JSON.")
    parser.add_argument("--output-json", required=True, help="Path to maintenance bridge output JSON.")
    return parser.parse_args()


def normalize_date(value: Any) -> str:
    if not isinstance(value, str) or len(value.strip()) == 0:
        raise ValueError("Expected a non-empty ISO date string.")
    return date.fromisoformat(value[:10]).isoformat()


def build_history_fingerprint(series_id: str, frequency: str, observations: list[Observation]) -> str:
    digest = sha256()
    digest.update(series_id.encode("utf-8"))
    digest.update(b"\n")
    digest.update(frequency.encode("utf-8"))
    for observation in observations:
        digest.update(b"\n")
        digest.update(observation.date.isoformat().encode("utf-8"))
        digest.update(b"=")
        digest.update(str(observation.value).encode("utf-8"))
    return digest.hexdigest()


def build_time_series(history_payload: dict[str, Any]) -> tuple[TimeSeries, dict[str, int]]:
    points_payload = history_payload.get("points")
    if not isinstance(points_payload, list) or not points_payload:
        raise ValueError("History payload points must be a non-empty array.")

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
        if observed_at in seen_dates:
          filtered_duplicate_count += 1
          continue
        seen_dates.add(observed_at)
        observations.append(Observation(date=observed_at, value=float(value)))

    if not observations:
        raise ValueError("No lawful numeric DAILY observations remain after null/duplicate filtering.")

    frequency = Frequency(str(history_payload.get("frequency", "")).upper())
    series = TimeSeries(
        series_id=str(history_payload.get("seriesId", "")).strip(),
        benchmark_name=str(history_payload.get("displayName", "")).strip() or str(history_payload.get("seriesId", "")).strip(),
        description=str(history_payload.get("description") or history_payload.get("displayName") or history_payload.get("seriesId", "")).strip(),
        frequency=frequency,
        observations=tuple(observations),
    )
    return series, {
        "filteredNullCount": filtered_null_count,
        "filteredDuplicateCount": filtered_duplicate_count,
    }


def serialize_metadata(metadata: ForecastMetadata) -> dict[str, Any]:
    return metadata.to_dict()


def serialize_record(
    *,
    input_source: str,
    input_run_id: str | None,
    target_basis: str,
    method_version: str,
    record: RollingDailyBacktestRecord,
    history_fingerprint: str,
    training_history_start_at: date,
    training_history_end_at: date,
    training_observation_count: int,
) -> dict[str, Any]:
    return {
        "seriesId": record.benchmark_id,
        "inputSource": input_source,
        "inputRunId": input_run_id,
        "targetBasis": target_basis,
        "methodId": record.method_id,
        "methodVersion": method_version,
        "modelId": record.model_id,
        "forecastOriginAt": record.forecast_origin.isoformat(),
        "horizonLabel": record.horizon,
        "horizonMonths": record.horizon_months,
        "horizonSteps": record.horizon_steps,
        "targetCalendarDate": record.target_calendar_date.isoformat(),
        "verificationObservedAt": None if record.verification_observation_date is None else record.verification_observation_date.isoformat(),
        "maturityStatus": record.maturity_status.value,
        "originValue": record.origin_value,
        "forecastValue": record.forecast_value,
        "actualValue": record.actual_value,
        "errorValue": record.error,
        "absoluteErrorValue": record.absolute_error,
        "deltaValue": record.delta,
        "deltaPct": record.delta_pct,
        "residualValue": record.residual,
        "maseScale": record.mase_scale,
        "trainingHistoryStartAt": training_history_start_at.isoformat(),
        "trainingHistoryEndAt": training_history_end_at.isoformat(),
        "trainingObservationCount": training_observation_count,
        "sourceHistoryFingerprint": history_fingerprint,
        "metadata": serialize_metadata(record.metadata),
        "selectedVariant": record.metadata.selected_variant,
        "selectionMetric": record.metadata.selection_metric,
        "selectionScore": record.metadata.selection_score,
    }


def compute_origin_records(
    *,
    series: TimeSeries,
    model_id: str,
    method_version: str,
    input_source: str,
    input_run_id: str | None,
    target_basis: str,
    history_fingerprint: str,
    config: RollingDailyPointInTimeConfig,
    origin_indexes: list[int],
) -> list[dict[str, Any]]:
    observations = series.observations
    if not origin_indexes:
        return []

    model = build_model(model_id)
    source_last_observation_date = observations[-1].date
    serialized_records: list[dict[str, Any]] = []

    for origin_index in origin_indexes:
        history = observations[:origin_index + 1]
        origin_date = history[-1].date
        supported_weekdays = infer_supported_weekdays(history)
        max_target_date = add_calendar_months_clamped(origin_date, config.max_horizon_months)
        _, step_counts = _build_projected_step_counts(origin_date, max_target_date, supported_weekdays)

        plans: list[tuple[str, int, date, int, MaturityStatus, Observation | None]] = []
        for horizon_label, horizon_months in config.anchor_horizons.items():
            target_calendar_date = add_calendar_months_clamped(origin_date, horizon_months)
            projected_steps = step_counts[target_calendar_date]
            maturity_status = (
                MaturityStatus.MATURED
                if target_calendar_date <= source_last_observation_date
                else MaturityStatus.NOT_YET_MATURED
            )
            verification_observation = None
            if maturity_status is MaturityStatus.MATURED:
                verification_observation = resolve_latest_lawful_observation_on_or_before(
                    observations[origin_index + 1 :],
                    target_calendar_date,
                )
            plans.append((horizon_label, horizon_months, target_calendar_date, projected_steps, maturity_status, verification_observation))

        fit = fit_path_model(model, history)
        max_steps = max(plan[3] for plan in plans)
        forecast_values = fit.forecast_path(max_steps)
        mase_scale = compute_mase_scale(list(history))

        for horizon_label, horizon_months, target_calendar_date, projected_steps, maturity_status, verification_observation in plans:
            forecast_value = forecast_values[projected_steps - 1]
            actual_value = None if verification_observation is None else verification_observation.value
            error = None if actual_value is None else forecast_value - actual_value
            absolute_error = None if error is None else abs(error)
            residual = None if actual_value is None else actual_value - forecast_value
            delta_pct = None if actual_value in (None, 0) or error is None else error / actual_value
            serialized_records.append(
                serialize_record(
                    input_source=input_source,
                    input_run_id=input_run_id,
                    target_basis=target_basis,
                    method_version=method_version,
                    record=RollingDailyBacktestRecord(
                        benchmark_id=series.series_id,
                        model_id=model_id,
                        method_id=ROLLING_DAILY_POINT_IN_TIME_METHOD_ID,
                        forecast_origin=origin_date,
                        horizon=horizon_label,
                        horizon_months=horizon_months,
                        horizon_steps=projected_steps,
                        target_calendar_date=target_calendar_date,
                        verification_observation_date=None if verification_observation is None else verification_observation.date,
                        forecast_date=target_calendar_date,
                        origin_value=history[-1].value,
                        forecast_value=forecast_value,
                        actual_value=actual_value,
                        error=error,
                        residual=residual,
                        absolute_error=absolute_error,
                        delta=error,
                        delta_pct=delta_pct,
                        mase_scale=mase_scale,
                        metadata=fit.metadata,
                        maturity_status=maturity_status,
                    ),
                    history_fingerprint=history_fingerprint,
                    training_history_start_at=history[0].date,
                    training_history_end_at=history[-1].date,
                    training_observation_count=len(history),
                )
            )

    return serialized_records


def mature_existing_records(
    *,
    series: TimeSeries,
    existing_records: list[dict[str, Any]],
    history_fingerprint: str,
) -> list[dict[str, Any]]:
    observations = series.observations
    latest_observation_date = observations[-1].date
    observation_index = {observation.date: index for index, observation in enumerate(observations)}
    matured_records: list[dict[str, Any]] = []

    for record in existing_records:
        if str(record.get("maturityStatus")) != MaturityStatus.NOT_YET_MATURED.value:
            continue
        target_calendar_date = date.fromisoformat(normalize_date(record.get("targetCalendarDate")))
        if target_calendar_date > latest_observation_date:
            continue
        origin_date = date.fromisoformat(normalize_date(record.get("forecastOriginAt")))
        origin_index = observation_index.get(origin_date)
        if origin_index is None:
            continue

        verification_observation = resolve_latest_lawful_observation_on_or_before(
            observations[origin_index + 1 :],
            target_calendar_date,
        )
        if verification_observation is None:
            continue

        forecast_value = float(record["forecastValue"])
        actual_value = float(verification_observation.value)
        error = forecast_value - actual_value
        residual = actual_value - forecast_value
        matured_records.append(
            {
                **record,
                "verificationObservedAt": verification_observation.date.isoformat(),
                "maturityStatus": MaturityStatus.MATURED.value,
                "actualValue": actual_value,
                "errorValue": error,
                "absoluteErrorValue": abs(error),
                "deltaValue": error,
                "deltaPct": None if actual_value == 0 else error / actual_value,
                "residualValue": residual,
                "sourceHistoryFingerprint": history_fingerprint,
            }
        )

    return matured_records


def to_residual_record(record: dict[str, Any]) -> ResidualCalibrationRecord:
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


def record_matches_identity(
    record: dict[str, Any],
    *,
    series_id: str,
    input_source: str,
    target_basis: str,
    method_id: str,
    method_version: str,
    model_id: str,
) -> bool:
    return (
        str(record.get("seriesId")) == series_id
        and str(record.get("inputSource")) == input_source
        and str(record.get("targetBasis")) == target_basis
        and str(record.get("methodId")) == method_id
        and str(record.get("methodVersion")) == method_version
        and str(record.get("modelId")) == model_id
    )


def normalize_existing_records(
    records: list[dict[str, Any]],
    *,
    series_id: str,
    input_source: str,
    target_basis: str,
    method_id: str,
    method_version: str,
    model_id: str,
) -> list[dict[str, Any]]:
    def record_key(record: dict[str, Any]) -> tuple[str, str]:
        return str(record["forecastOriginAt"]), str(record["horizonLabel"])

    normalized: dict[tuple[str, str], dict[str, Any]] = {}
    for record in records:
        if not record_matches_identity(
            record,
            series_id=series_id,
            input_source=input_source,
            target_basis=target_basis,
            method_id=method_id,
            method_version=method_version,
            model_id=model_id,
        ):
            continue
        key = record_key(record)
        current = normalized.get(key)
        if current is None:
            normalized[key] = record
            continue

        current_matured = str(current.get("maturityStatus")) == MaturityStatus.MATURED.value
        candidate_matured = str(record.get("maturityStatus")) == MaturityStatus.MATURED.value
        if candidate_matured and not current_matured:
            normalized[key] = record
            continue

        current_observed_at = str(current.get("verificationObservedAt") or "")
        candidate_observed_at = str(record.get("verificationObservedAt") or "")
        if candidate_observed_at > current_observed_at:
            normalized[key] = record

    return list(normalized.values())


def build_calibration_groups(
    *,
    records: list[dict[str, Any]],
    changed_records: list[dict[str, Any]],
    input_source: str,
    input_run_id: str | None,
    target_basis: str,
    method_version: str,
    calibration_origin: date,
    minimum_calibration_samples: int,
    refreshed_at: date,
    force_calibration_refresh: bool = False,
) -> list[dict[str, Any]]:
    touched_group_keys = {
        CalibrationGroupKey(
            benchmark_id=str(record["seriesId"]),
            model_id=str(record["modelId"]),
            method_id=str(record["methodId"]),
            horizon=str(record["horizonLabel"]),
            horizon_months=int(record["horizonMonths"]),
        )
        for record in changed_records
    }
    if not touched_group_keys and force_calibration_refresh:
        touched_group_keys = {
            CalibrationGroupKey(
                benchmark_id=str(record["seriesId"]),
                model_id=str(record["modelId"]),
                method_id=str(record["methodId"]),
                horizon=str(record["horizonLabel"]),
                horizon_months=int(record["horizonMonths"]),
            )
            for record in records
        }
    if not touched_group_keys:
        return []

    calibration_results = build_group_calibration_results(
        records=[to_residual_record(record) for record in records],
        calibration_origin=calibration_origin,
        minimum_calibration_samples=minimum_calibration_samples,
    )
    serialized_groups: list[dict[str, Any]] = []
    for key in sorted(touched_group_keys, key=lambda candidate: (candidate.horizon_months, candidate.horizon)):
        result = calibration_results.get(key)
        if result is None:
            continue
        selected_records = [
            to_residual_record(record)
            for record in records
            if record["horizonLabel"] == key.horizon
            and int(record["horizonMonths"]) == key.horizon_months
            and str(record["seriesId"]) == key.benchmark_id
            and str(record["modelId"]) == key.model_id
            and str(record["methodId"]) == key.method_id
            and str(record["inputSource"]) == input_source
            and str(record["targetBasis"]) == target_basis
            and str(record["methodVersion"]) == method_version
        ]
        last_residual_observed_at = max(
            (record.availability_date for record in selected_records if record.availability_date is not None),
            default=None,
        )
        serialized_groups.append(
            {
                "seriesId": key.benchmark_id,
                "inputSource": input_source,
                "inputRunId": input_run_id,
                "targetBasis": target_basis,
                "methodId": key.method_id,
                "methodVersion": method_version,
                "modelId": key.model_id,
                "horizonLabel": key.horizon,
                "horizonMonths": key.horizon_months,
                "calibrationOriginAt": calibration_origin.isoformat(),
                "sampleCount": result.sample_count,
                "residualP10": result.residual_p10,
                "residualP90": result.residual_p90,
                "quantileMethod": QUANTILE_METHOD_V1,
                "status": result.status.value,
                "lastResidualObservedAt": None if last_residual_observed_at is None else last_residual_observed_at.isoformat(),
                "refreshedAt": refreshed_at.isoformat(),
            }
        )
    return serialized_groups


def main() -> int:
    args = parse_args()
    payload = json.loads(Path(args.input_json).read_text(encoding="utf-8"))

    try:
        history_payload = payload["history"]
        series, filter_counts = build_time_series(history_payload)
        if series.frequency is not Frequency.DAILY:
            raise ValueError("Rolling daily maintenance requires DAILY history input.")

        history_fingerprint = build_history_fingerprint(series.series_id, series.frequency.value, list(series.observations))
        input_source = str(payload.get("inputSource") or payload.get("history", {}).get("source") or "DYNAMIC_MARKET_DATA_STORE")
        input_run_id = payload.get("inputRunId")
        method_id = str(payload["methodId"])
        method_version = str(payload["methodVersion"])
        model_id = str(payload["modelId"])
        target_basis = str(payload["targetBasis"])
        existing_records = normalize_existing_records(
            list(payload.get("existingRecords") or []),
            series_id=series.series_id,
            input_source=input_source,
            target_basis=target_basis,
            method_id=method_id,
            method_version=method_version,
            model_id=model_id,
        )
        minimum_training_observations = int(payload["minimumTrainingObservations"])
        minimum_calibration_samples = int(payload["minimumCalibrationSamples"])
        force_calibration_refresh = bool(payload.get("forceCalibrationRefresh"))
        historical_origin_start_date = date.fromisoformat(str(payload["historicalOriginStartDate"]))
        last_processed_origin_date = payload.get("lastProcessedOriginDate")
        last_processed_origin = None if last_processed_origin_date is None else date.fromisoformat(str(last_processed_origin_date))

        config = RollingDailyPointInTimeConfig(
            minimum_training_observations=minimum_training_observations,
            minimum_calibration_samples=minimum_calibration_samples,
            historical_forecast_origin_start_date=historical_origin_start_date,
        )

        eligible_origin_indexes = [
            index
            for index in range(config.minimum_training_observations - 1, len(series.observations))
            if series.observations[index].date >= historical_origin_start_date
            and (last_processed_origin is None or series.observations[index].date > last_processed_origin)
        ]

        new_records = compute_origin_records(
            series=series,
            model_id=model_id,
            method_version=method_version,
            input_source=input_source,
            input_run_id=input_run_id,
            target_basis=target_basis,
            history_fingerprint=history_fingerprint,
            config=config,
            origin_indexes=eligible_origin_indexes,
        )
        matured_records = mature_existing_records(
            series=series,
            existing_records=existing_records,
            history_fingerprint=history_fingerprint,
        )

        record_identity = lambda record: (record["forecastOriginAt"], record["horizonLabel"])
        merged_records = {
            record_identity(record): record
            for record in existing_records
        }
        for record in matured_records:
            merged_records[record_identity(record)] = record
        for record in new_records:
            merged_records[record_identity(record)] = record

        latest_observation_date = series.observations[-1].date
        calibration_groups = build_calibration_groups(
            records=list(merged_records.values()),
            changed_records=[*matured_records, *new_records],
            input_source=input_source,
            input_run_id=input_run_id,
            target_basis=target_basis,
            method_version=method_version,
            calibration_origin=latest_observation_date,
            minimum_calibration_samples=minimum_calibration_samples,
            refreshed_at=latest_observation_date,
            force_calibration_refresh=force_calibration_refresh,
        )

        latest_matured_observed_at = max(
            (
                date.fromisoformat(normalize_date(record["verificationObservedAt"]))
                for record in merged_records.values()
                if record.get("verificationObservedAt")
            ),
            default=None,
        )

        output = {
            "status": "AVAILABLE",
            "methodId": method_id,
            "methodVersion": method_version,
            "sourceHistory": {
                "startDate": series.start.isoformat(),
                "endDate": series.end.isoformat(),
                "latestObservationDate": latest_observation_date.isoformat(),
                "observationCount": series.observation_count,
                "filteredNullCount": filter_counts["filteredNullCount"],
                "filteredDuplicateCount": filter_counts["filteredDuplicateCount"],
                "historyFingerprint": history_fingerprint,
            },
            "maintenance": {
                "newOriginCount": len({record["forecastOriginAt"] for record in new_records}),
                "maturedRecordCount": len(matured_records),
                "affectedCalibrationGroupCount": len(calibration_groups),
                "calibrationRefreshCount": len(calibration_groups),
                "lastProcessedOriginDate": None if not eligible_origin_indexes and last_processed_origin is None else series.observations[-1].date.isoformat(),
                "lastMaturedObservedAt": None if latest_matured_observed_at is None else latest_matured_observed_at.isoformat(),
                "newOriginDates": sorted({record["forecastOriginAt"] for record in new_records}),
            },
            "newRecords": new_records,
            "maturedRecords": matured_records,
            "calibrationGroups": calibration_groups,
        }
    except Exception as error:
        output = {
            "status": "FAILED",
            "reason": str(error),
            "methodId": str(payload.get("methodId") or ROLLING_DAILY_POINT_IN_TIME_METHOD_ID),
            "methodVersion": str(payload.get("methodVersion") or ROLLING_DAILY_POINT_IN_TIME_METHOD_VERSION),
            "sourceHistory": {
                "startDate": None,
                "endDate": None,
                "latestObservationDate": None,
                "observationCount": 0,
                "filteredNullCount": 0,
                "filteredDuplicateCount": 0,
                "historyFingerprint": str(payload.get("sourceHistoryFingerprint") or ""),
            },
            "maintenance": {
                "newOriginCount": 0,
                "maturedRecordCount": 0,
                "affectedCalibrationGroupCount": 0,
                "calibrationRefreshCount": 0,
                "lastProcessedOriginDate": None,
                "lastMaturedObservedAt": None,
                "newOriginDates": [],
            },
            "newRecords": [],
            "maturedRecords": [],
            "calibrationGroups": [],
        }

    Path(args.output_json).write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())