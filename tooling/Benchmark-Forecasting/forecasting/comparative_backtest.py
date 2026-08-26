from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any

from forecasting.contracts import BacktestRecord, ForecastMetadata
from forecasting.metrics import summarize_metrics


@dataclass(frozen=True)
class ComparableVerificationRecord:
    benchmark_id: str
    model_id: str
    forecast_method: str
    method_version: str
    target_basis: str
    forecast_origin_at: date
    horizon_label: str
    horizon_months: int
    target_calendar_date: date
    verification_observed_at: date | None
    maturity_status: str
    origin_value: float
    forecast_value: float
    actual_value: float | None
    error_value: float | None
    mase_scale: float
    target_semantics: str = ""
    residual_value: float | None = None
    evidence_method: str = "EXPANDING_WINDOW_ROLLING_ORIGIN"
    evidence_method_version: str = "expanding-window-rolling-origin-v1"


@dataclass(frozen=True)
class ComparativeIdentity:
    benchmark_id: str
    target_semantics: str
    forecast_method: str
    method_version: str
    target_basis: str
    evidence_method: str
    evidence_method_version: str
    forecast_origin_at: date
    horizon_label: str
    target_calendar_date: date


@dataclass(frozen=True)
class CrossModelIdentity:
    benchmark_id: str
    target_semantics: str
    forecast_method: str
    method_version: str
    target_basis: str
    evidence_method: str
    evidence_method_version: str
    forecast_origin_at: date
    horizon_label: str


class ComparativeBacktestError(ValueError):
    pass


def canonical_identity(record: ComparableVerificationRecord) -> ComparativeIdentity:
    return ComparativeIdentity(
        benchmark_id=record.benchmark_id,
        target_semantics=record.target_semantics,
        forecast_method=record.forecast_method,
        method_version=record.method_version,
        target_basis=record.target_basis,
        evidence_method=record.evidence_method,
        evidence_method_version=record.evidence_method_version,
        forecast_origin_at=record.forecast_origin_at,
        horizon_label=record.horizon_label,
        target_calendar_date=record.target_calendar_date,
    )


def cross_model_identity(record: ComparableVerificationRecord) -> CrossModelIdentity:
    return CrossModelIdentity(
        benchmark_id=record.benchmark_id,
        target_semantics=record.target_semantics,
        forecast_method=record.forecast_method,
        method_version=record.method_version,
        target_basis=record.target_basis,
        evidence_method=record.evidence_method,
        evidence_method_version=record.evidence_method_version,
        forecast_origin_at=record.forecast_origin_at,
        horizon_label=record.horizon_label,
    )


def matured_records(records: list[ComparableVerificationRecord]) -> list[ComparableVerificationRecord]:
    return [record for record in records if record.maturity_status == "MATURED"]


def verify_method_compatibility(records: list[ComparableVerificationRecord], models: list[str]) -> dict[str, Any]:
    records_by_model = _group_by_model(records)
    missing_models = [model for model in models if model not in records_by_model]
    if missing_models:
        raise ComparativeBacktestError(f"Missing comparable verification records for models: {', '.join(missing_models)}")

    benchmark_ids = {record.benchmark_id for record in records}
    forecast_methods = {record.forecast_method for record in records}
    method_versions = {record.method_version for record in records}
    target_bases = {record.target_basis for record in records}
    target_semantics = {record.target_semantics for record in records}
    evidence_methods = {record.evidence_method for record in records}
    evidence_method_versions = {record.evidence_method_version for record in records}

    error_convention_parity = True
    residual_convention_parity = True
    for record in matured_records(records):
        if record.actual_value is None or record.error_value is None:
            raise ComparativeBacktestError("Matured record is missing actualValue or errorValue.")
        if abs((record.forecast_value - record.actual_value) - record.error_value) > 1e-9:
            error_convention_parity = False
            break
        if record.residual_value is not None and abs((record.actual_value - record.forecast_value) - record.residual_value) > 1e-9:
            residual_convention_parity = False
            break

    compatible = (
        len(benchmark_ids) == 1
        and len(target_semantics) == 1
        and len(forecast_methods) == 1
        and len(method_versions) == 1
        and len(target_bases) == 1
        and len(evidence_methods) == 1
        and len(evidence_method_versions) == 1
    )
    return {
        "fourModelMethodCompatibility": compatible,
        "errorConventionParity": error_convention_parity,
        "residualConventionParity": residual_convention_parity,
        "benchmarkId": next(iter(benchmark_ids)) if len(benchmark_ids) == 1 else None,
        "targetSemantics": next(iter(target_semantics)) if len(target_semantics) == 1 else None,
        "forecastMethod": next(iter(forecast_methods)) if len(forecast_methods) == 1 else None,
        "methodVersion": next(iter(method_versions)) if len(method_versions) == 1 else None,
        "targetBasis": next(iter(target_bases)) if len(target_bases) == 1 else None,
        "evidenceMethod": next(iter(evidence_methods)) if len(evidence_methods) == 1 else None,
        "evidenceMethodVersion": next(iter(evidence_method_versions)) if len(evidence_method_versions) == 1 else None,
    }


def build_native_view(records: list[ComparableVerificationRecord], models: list[str], horizons: list[str]) -> dict[str, dict[str, Any]]:
    records_by_model = _group_by_model(records)
    native_view: dict[str, dict[str, Any]] = {}
    for horizon in horizons:
        native_view[horizon] = {}
        for model in models:
            model_records = [record for record in records_by_model.get(model, []) if record.horizon_label == horizon]
            matured_model_records = matured_records(model_records)
            native_view[horizon][model] = {
                "generated": len(model_records),
                "mature": len(matured_model_records),
                "verified": len(matured_model_records),
                "unavailable": 0,
                "metrics": None if not matured_model_records else summarize_metrics(_to_backtest_records(matured_model_records)).to_dict(),
            }
    return native_view


def build_strict_common_cohort_view(records: list[ComparableVerificationRecord], models: list[str], horizons: list[str]) -> dict[str, Any]:
    compatibility = verify_method_compatibility(records, models)
    if not compatibility["fourModelMethodCompatibility"]:
        raise ComparativeBacktestError("Strict common cohort requires one benchmark, target semantics, method, version, target basis, and evidence method.")

    records_by_model = _group_by_model(records)
    result: dict[str, Any] = {}
    for horizon in horizons:
        matured_by_model = {
            model: [record for record in matured_records(records_by_model.get(model, [])) if record.horizon_label == horizon]
            for model in models
        }
        indices = {model: _index_records(model_records) for model, model_records in matured_by_model.items()}
        cross_model_indices = {model: _index_cross_model_records(model_records) for model, model_records in matured_by_model.items()}
        common_identities = None
        for model in models:
            identities = set(cross_model_indices[model].keys())
            common_identities = identities if common_identities is None else common_identities.intersection(identities)
        common_identities = set() if common_identities is None else common_identities

        target_date_parity = True
        actual_parity = True
        observed_at_parity = True
        per_model_common_records: dict[str, list[ComparableVerificationRecord]] = {model: [] for model in models}
        common_cohort_count = 0
        for identity in sorted(common_identities, key=lambda item: (item.forecast_origin_at, item.horizon_label)):
            cohort = [cross_model_indices[model][identity] for model in models]
            observed_dates = {record.verification_observed_at for record in cohort}
            if len({record.target_calendar_date for record in cohort}) != 1:
                target_date_parity = False
                continue
            actual_values = [record.actual_value for record in cohort]
            baseline_actual = actual_values[0]
            if baseline_actual is None or any(value is None or abs(value - baseline_actual) > 1e-9 for value in actual_values[1:]):
                actual_parity = False
                continue
            if len(observed_dates) != 1:
                observed_at_parity = False
                continue
            common_cohort_count += 1
            for model, record in zip(models, cohort):
                per_model_common_records[model].append(record)

        result[horizon] = {
            "verifiedCounts": {model: len(matured_by_model[model]) for model in models},
            "commonCohortCount": common_cohort_count,
            "targetDateParity": target_date_parity,
            "actualParity": actual_parity,
            "verificationObservedAtParity": observed_at_parity,
            "metricsByModel": {
                model: None if not per_model_common_records[model] else summarize_metrics(_to_backtest_records(per_model_common_records[model])).to_dict()
                for model in models
            },
        }
    return result


def _group_by_model(records: list[ComparableVerificationRecord]) -> dict[str, list[ComparableVerificationRecord]]:
    grouped: dict[str, list[ComparableVerificationRecord]] = {}
    for record in records:
        grouped.setdefault(record.model_id, []).append(record)
    return grouped


def _index_records(records: list[ComparableVerificationRecord]) -> dict[ComparativeIdentity, ComparableVerificationRecord]:
    index: dict[ComparativeIdentity, ComparableVerificationRecord] = {}
    for record in records:
        identity = canonical_identity(record)
        if identity in index:
            raise ComparativeBacktestError(
                "Duplicate canonical verification identity detected for "
                f"model={record.model_id}, origin={record.forecast_origin_at.isoformat()}, horizon={record.horizon_label}."
            )
        index[identity] = record
    return index


def _index_cross_model_records(records: list[ComparableVerificationRecord]) -> dict[CrossModelIdentity, ComparableVerificationRecord]:
    index: dict[CrossModelIdentity, ComparableVerificationRecord] = {}
    for record in records:
        identity = cross_model_identity(record)
        if identity in index:
            raise ComparativeBacktestError(
                "Duplicate cross-model verification identity detected for "
                f"model={record.model_id}, origin={record.forecast_origin_at.isoformat()}, horizon={record.horizon_label}."
            )
        index[identity] = record
    return index


def _to_backtest_records(records: list[ComparableVerificationRecord]) -> list[BacktestRecord]:
    converted: list[BacktestRecord] = []
    for record in records:
        if record.actual_value is None or record.error_value is None:
            raise ComparativeBacktestError("Cannot convert non-matured record into BacktestRecord.")
        converted.append(
            BacktestRecord(
                benchmark_id=record.benchmark_id,
                model_id=record.model_id,
                forecast_origin=record.forecast_origin_at,
                horizon=record.horizon_label,
                horizon_steps=record.horizon_months,
                forecast_date=record.target_calendar_date,
                origin_value=record.origin_value,
                forecast_value=record.forecast_value,
                actual_value=record.actual_value,
                error=record.error_value,
                absolute_error=abs(record.error_value),
                delta=record.forecast_value - record.origin_value,
                delta_pct=None,
                mase_scale=record.mase_scale,
                metadata=ForecastMetadata(model_family=record.model_id, selected_variant="COMPARATIVE_BACKTEST"),
            )
        )
    return converted