from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Iterable, Mapping

from forecasting.rolling_daily_calibration import (
    CalibrationGroupKey,
    CalibrationResultStatus,
    ResidualCalibrationRecord,
    empirical_quantile_type7,
    group_calibration_records,
    is_lawful_matured_residual,
    select_available_residuals,
)
from forecasting.rolling_daily_contracts import MaturityStatus


EMPIRICAL_RESIDUAL_QUANTILES_METHOD_ID = "EMPIRICAL_RESIDUAL_QUANTILES"
EMPIRICAL_RESIDUAL_QUANTILES_METHOD_VERSION = "empirical-residual-quantiles-v1"
LOWER_QUANTILE = 0.10
MEDIAN_QUANTILE = 0.50
UPPER_QUANTILE = 0.90


@dataclass(frozen=True)
class ResidualQuantileDiagnostics:
    benchmark_id: str
    model_id: str
    method_id: str
    horizon: str
    horizon_months: int
    sample_count: int
    residual_p10: float | None
    residual_p50: float | None
    residual_p90: float | None
    status: CalibrationResultStatus
    quantile_method: str


@dataclass(frozen=True)
class HistoricalBandValidationSummary:
    benchmark_id: str
    model_id: str
    method_id: str
    horizon: str
    horizon_months: int
    minimum_calibration_samples: int
    evaluated_historical_bands: int
    insufficient_history_cases: int
    inside_band_count: int
    outside_band_count: int
    diagnostic_coverage: float | None
    first_available_origin: date | None
    last_evaluated_origin: date | None


def runtime_record_to_residual_calibration_record(payload: Mapping[str, Any]) -> ResidualCalibrationRecord:
    verification_observed_at = payload.get("verificationObservedAt")
    actual_value = payload.get("actualValue")
    residual_value = payload.get("residualValue")
    return ResidualCalibrationRecord(
        benchmark_id=str(payload["seriesId"]),
        model_id=str(payload["modelId"]),
        method_id=str(payload["methodId"]),
        horizon=str(payload["horizonLabel"]),
        horizon_months=int(payload["horizonMonths"]),
        forecast_origin=date.fromisoformat(str(payload["forecastOriginAt"])[:10]),
        target_calendar_date=date.fromisoformat(str(payload["targetCalendarDate"])[:10]),
        verification_observation_date=None if verification_observed_at is None else date.fromisoformat(str(verification_observed_at)[:10]),
        maturity_status=MaturityStatus(str(payload["maturityStatus"])),
        forecast_value=float(payload["forecastValue"]),
        actual_value=None if actual_value is None else float(actual_value),
        residual=None if residual_value is None else float(residual_value),
    )


def build_residual_quantile_diagnostics(
    key: CalibrationGroupKey,
    records: Iterable[ResidualCalibrationRecord],
    calibration_origin: date,
    minimum_calibration_samples: int,
) -> ResidualQuantileDiagnostics:
    selected_records = select_available_residuals(records, calibration_origin)
    residuals = [record.residual for record in selected_records if record.residual is not None]
    if len(residuals) < minimum_calibration_samples:
        return ResidualQuantileDiagnostics(
            benchmark_id=key.benchmark_id,
            model_id=key.model_id,
            method_id=key.method_id,
            horizon=key.horizon,
            horizon_months=key.horizon_months,
            sample_count=len(residuals),
            residual_p10=None,
            residual_p50=None,
            residual_p90=None,
            status=CalibrationResultStatus.INSUFFICIENT_CALIBRATION_HISTORY,
            quantile_method="HF7_LINEAR_INTERPOLATION",
        )

    return ResidualQuantileDiagnostics(
        benchmark_id=key.benchmark_id,
        model_id=key.model_id,
        method_id=key.method_id,
        horizon=key.horizon,
        horizon_months=key.horizon_months,
        sample_count=len(residuals),
        residual_p10=empirical_quantile_type7(residuals, LOWER_QUANTILE),
        residual_p50=empirical_quantile_type7(residuals, MEDIAN_QUANTILE),
        residual_p90=empirical_quantile_type7(residuals, UPPER_QUANTILE),
        status=CalibrationResultStatus.AVAILABLE,
        quantile_method="HF7_LINEAR_INTERPOLATION",
    )


def build_group_residual_quantile_diagnostics(
    records: Iterable[ResidualCalibrationRecord],
    calibration_origin: date,
    minimum_calibration_samples: int,
) -> dict[CalibrationGroupKey, ResidualQuantileDiagnostics]:
    grouped = group_calibration_records(records)
    return {
        key: build_residual_quantile_diagnostics(
            key=key,
            records=group_records,
            calibration_origin=calibration_origin,
            minimum_calibration_samples=minimum_calibration_samples,
        )
        for key, group_records in grouped.items()
    }


def build_historical_band_validation_summaries(
    records: Iterable[ResidualCalibrationRecord],
    minimum_calibration_samples: int,
) -> tuple[HistoricalBandValidationSummary, ...]:
    grouped = group_calibration_records(records)
    summaries: list[HistoricalBandValidationSummary] = []
    for key, group_records in sorted(grouped.items(), key=lambda item: (item[0].horizon_months, item[0].horizon, item[0].model_id)):
        evaluated = 0
        insufficient = 0
        inside_band = 0
        outside_band = 0
        first_available_origin: date | None = None
        last_evaluated_origin: date | None = None

        for record in group_records:
            if not is_lawful_matured_residual(record):
                continue
            diagnostics = build_residual_quantile_diagnostics(
                key=key,
                records=group_records,
                calibration_origin=record.forecast_origin,
                minimum_calibration_samples=minimum_calibration_samples,
            )
            if diagnostics.status is not CalibrationResultStatus.AVAILABLE:
                insufficient += 1
                continue

            lower = record.forecast_value + float(diagnostics.residual_p10)
            upper = record.forecast_value + float(diagnostics.residual_p90)
            evaluated += 1
            last_evaluated_origin = record.forecast_origin
            if first_available_origin is None:
                first_available_origin = record.forecast_origin
            if lower <= float(record.actual_value) <= upper:
                inside_band += 1
            else:
                outside_band += 1

        summaries.append(
            HistoricalBandValidationSummary(
                benchmark_id=key.benchmark_id,
                model_id=key.model_id,
                method_id=key.method_id,
                horizon=key.horizon,
                horizon_months=key.horizon_months,
                minimum_calibration_samples=minimum_calibration_samples,
                evaluated_historical_bands=evaluated,
                insufficient_history_cases=insufficient,
                inside_band_count=inside_band,
                outside_band_count=outside_band,
                diagnostic_coverage=None if evaluated == 0 else inside_band / evaluated,
                first_available_origin=first_available_origin,
                last_evaluated_origin=last_evaluated_origin,
            )
        )

    return tuple(summaries)