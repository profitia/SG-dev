from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date
from enum import StrEnum
from typing import Any, Iterable, Mapping

from forecasting.rolling_daily_contracts import BandStatus, CalibrationSummary, MaturityStatus


QUANTILE_METHOD_V1 = "HF7_LINEAR_INTERPOLATION"


class CalibrationResultStatus(StrEnum):
    AVAILABLE = "AVAILABLE"
    INSUFFICIENT_CALIBRATION_HISTORY = "INSUFFICIENT_CALIBRATION_HISTORY"


@dataclass(frozen=True)
class CalibrationGroupKey:
    benchmark_id: str
    model_id: str
    method_id: str
    horizon: str
    horizon_months: int


@dataclass(frozen=True)
class ResidualCalibrationRecord:
    benchmark_id: str
    model_id: str
    method_id: str
    horizon: str
    horizon_months: int
    forecast_origin: date
    target_calendar_date: date
    verification_observation_date: date | None
    maturity_status: MaturityStatus
    forecast_value: float
    actual_value: float | None
    residual: float | None

    @property
    def availability_date(self) -> date | None:
        return self.verification_observation_date

    @property
    def group_key(self) -> CalibrationGroupKey:
        return CalibrationGroupKey(
            benchmark_id=self.benchmark_id,
            model_id=self.model_id,
            method_id=self.method_id,
            horizon=self.horizon,
            horizon_months=self.horizon_months,
        )

    @classmethod
    def from_stage4_dict(cls, payload: Mapping[str, Any]) -> "ResidualCalibrationRecord":
        verification_date = payload.get("verificationObservationDate")
        actual_value = payload.get("actual")
        residual = payload.get("residual")
        return cls(
            benchmark_id=str(payload["benchmarkId"]),
            model_id=str(payload["model"]),
            method_id=str(payload["forecastMethod"]),
            horizon=str(payload["horizon"]),
            horizon_months=int(payload["horizonMonths"]),
            forecast_origin=date.fromisoformat(str(payload["originDate"])),
            target_calendar_date=date.fromisoformat(str(payload["targetCalendarDate"])),
            verification_observation_date=None if verification_date is None else date.fromisoformat(str(verification_date)),
            maturity_status=MaturityStatus(str(payload["maturityStatus"])),
            forecast_value=float(payload["forecast"]),
            actual_value=None if actual_value is None else float(actual_value),
            residual=None if residual is None else float(residual),
        )


@dataclass(frozen=True)
class EmpiricalCalibrationResult:
    benchmark_id: str
    model_id: str
    method_id: str
    horizon: str
    horizon_months: int
    sample_count: int
    residual_p10: float | None
    residual_p90: float | None
    status: CalibrationResultStatus
    quantile_method: str

    @property
    def band_status(self) -> BandStatus:
        if self.status is CalibrationResultStatus.AVAILABLE:
            return BandStatus.AVAILABLE
        return BandStatus.INSUFFICIENT_CALIBRATION_HISTORY


@dataclass(frozen=True)
class SampleSensitivityPoint:
    sample_count: int
    residual_p10: float
    residual_p90: float
    band_width: float
    delta_p10_vs_full: float
    delta_p90_vs_full: float


def empirical_quantile_type7(values: list[float], probability: float) -> float:
    if not values:
        raise ValueError("Empirical quantile requires at least one value.")
    if probability < 0.0 or probability > 1.0:
        raise ValueError("Quantile probability must be between 0 and 1.")
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * probability
    lower_index = int(math.floor(position))
    upper_index = int(math.ceil(position))
    lower = ordered[lower_index]
    upper = ordered[upper_index]
    if lower_index == upper_index:
        return lower
    weight = position - lower_index
    return lower + (upper - lower) * weight


def is_lawful_matured_residual(record: ResidualCalibrationRecord) -> bool:
    if record.maturity_status is not MaturityStatus.MATURED:
        return False
    if record.verification_observation_date is None:
        return False
    if record.actual_value is None:
        return False
    if record.residual is None or not math.isfinite(record.residual):
        return False
    return True


def sort_calibration_records(records: Iterable[ResidualCalibrationRecord]) -> list[ResidualCalibrationRecord]:
    return sorted(
        records,
        key=lambda record: (
            record.verification_observation_date or date.max,
            record.forecast_origin,
            record.target_calendar_date,
            record.model_id,
            record.horizon_months,
        ),
    )


def group_calibration_records(
    records: Iterable[ResidualCalibrationRecord],
) -> dict[CalibrationGroupKey, list[ResidualCalibrationRecord]]:
    grouped: dict[CalibrationGroupKey, list[ResidualCalibrationRecord]] = {}
    for record in records:
        key = record.group_key
        grouped.setdefault(key, []).append(record)
    for key, group_records in grouped.items():
        grouped[key] = sort_calibration_records(group_records)
    return grouped


def select_available_residuals(
    records: Iterable[ResidualCalibrationRecord],
    calibration_origin: date,
) -> list[ResidualCalibrationRecord]:
    selected: list[ResidualCalibrationRecord] = []
    for record in records:
        if not is_lawful_matured_residual(record):
            continue
        if record.verification_observation_date is None or record.verification_observation_date > calibration_origin:
            continue
        selected.append(record)
    return sort_calibration_records(selected)


def build_empirical_calibration_result(
    key: CalibrationGroupKey,
    records: Iterable[ResidualCalibrationRecord],
    calibration_origin: date,
    minimum_calibration_samples: int,
) -> EmpiricalCalibrationResult:
    selected_records = select_available_residuals(records, calibration_origin)
    residuals = [record.residual for record in selected_records if record.residual is not None]
    if len(residuals) < minimum_calibration_samples:
        return EmpiricalCalibrationResult(
            benchmark_id=key.benchmark_id,
            model_id=key.model_id,
            method_id=key.method_id,
            horizon=key.horizon,
            horizon_months=key.horizon_months,
            sample_count=len(residuals),
            residual_p10=None,
            residual_p90=None,
            status=CalibrationResultStatus.INSUFFICIENT_CALIBRATION_HISTORY,
            quantile_method=QUANTILE_METHOD_V1,
        )

    return EmpiricalCalibrationResult(
        benchmark_id=key.benchmark_id,
        model_id=key.model_id,
        method_id=key.method_id,
        horizon=key.horizon,
        horizon_months=key.horizon_months,
        sample_count=len(residuals),
        residual_p10=empirical_quantile_type7(residuals, 0.10),
        residual_p90=empirical_quantile_type7(residuals, 0.90),
        status=CalibrationResultStatus.AVAILABLE,
        quantile_method=QUANTILE_METHOD_V1,
    )


def build_group_calibration_results(
    records: Iterable[ResidualCalibrationRecord],
    calibration_origin: date,
    minimum_calibration_samples: int,
) -> dict[CalibrationGroupKey, EmpiricalCalibrationResult]:
    grouped = group_calibration_records(records)
    return {
        key: build_empirical_calibration_result(
            key=key,
            records=group_records,
            calibration_origin=calibration_origin,
            minimum_calibration_samples=minimum_calibration_samples,
        )
        for key, group_records in grouped.items()
    }


def build_calibration_summary_map(
    records: Iterable[ResidualCalibrationRecord],
    calibration_origin: date,
    minimum_calibration_samples: int,
    *,
    benchmark_id: str,
    model_id: str,
    method_id: str,
) -> dict[str, CalibrationSummary]:
    summaries: dict[str, CalibrationSummary] = {}
    for key, result in build_group_calibration_results(
        records=records,
        calibration_origin=calibration_origin,
        minimum_calibration_samples=minimum_calibration_samples,
    ).items():
        if key.benchmark_id != benchmark_id or key.model_id != model_id or key.method_id != method_id:
            continue
        summaries[key.horizon] = CalibrationSummary(
            horizon=key.horizon,
            sample_count=result.sample_count,
            residual_p10=result.residual_p10,
            residual_p90=result.residual_p90,
            status=result.band_status,
        )
    return summaries


def build_sample_sensitivity(
    records: Iterable[ResidualCalibrationRecord],
    sample_sizes: Iterable[int],
) -> tuple[SampleSensitivityPoint, ...]:
    lawful_records = [record for record in sort_calibration_records(records) if is_lawful_matured_residual(record)]
    residuals = [record.residual for record in lawful_records if record.residual is not None]
    if not residuals:
        return ()

    full_p10 = empirical_quantile_type7(residuals, 0.10)
    full_p90 = empirical_quantile_type7(residuals, 0.90)
    sensitivity_points: list[SampleSensitivityPoint] = []
    for sample_count in sample_sizes:
        if sample_count <= 0 or sample_count > len(residuals):
            continue
        prefix = residuals[:sample_count]
        prefix_p10 = empirical_quantile_type7(prefix, 0.10)
        prefix_p90 = empirical_quantile_type7(prefix, 0.90)
        sensitivity_points.append(
            SampleSensitivityPoint(
                sample_count=sample_count,
                residual_p10=prefix_p10,
                residual_p90=prefix_p90,
                band_width=prefix_p90 - prefix_p10,
                delta_p10_vs_full=prefix_p10 - full_p10,
                delta_p90_vs_full=prefix_p90 - full_p90,
            )
        )

    if sensitivity_points and sensitivity_points[-1].sample_count != len(residuals):
        sensitivity_points.append(
            SampleSensitivityPoint(
                sample_count=len(residuals),
                residual_p10=full_p10,
                residual_p90=full_p90,
                band_width=full_p90 - full_p10,
                delta_p10_vs_full=0.0,
                delta_p90_vs_full=0.0,
            )
        )

    return tuple(sensitivity_points)