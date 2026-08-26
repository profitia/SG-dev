from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from enum import StrEnum
from typing import Any

from forecasting.contracts import ForecastMetadata, Frequency, MetricsSummary, TimeSeries


class ForecastAvailabilityStatus(StrEnum):
    AVAILABLE = "AVAILABLE"
    UNSUPPORTED_FREQUENCY = "UNSUPPORTED_FREQUENCY"
    INSUFFICIENT_HISTORY = "INSUFFICIENT_HISTORY"
    MODEL_NOT_AVAILABLE = "MODEL_NOT_AVAILABLE"
    INSUFFICIENT_CALIBRATION_HISTORY = "INSUFFICIENT_CALIBRATION_HISTORY"
    FAILED = "FAILED"


class BandStatus(StrEnum):
    AVAILABLE = "AVAILABLE"
    INSUFFICIENT_CALIBRATION_HISTORY = "INSUFFICIENT_CALIBRATION_HISTORY"
    NOT_AVAILABLE = "NOT_AVAILABLE"
    NOT_AVAILABLE_BEFORE_FIRST_EMPIRICAL_ANCHOR = "NOT_AVAILABLE_BEFORE_FIRST_EMPIRICAL_ANCHOR"
    NOT_AVAILABLE_INSUFFICIENT_ANCHOR_CALIBRATION = "NOT_AVAILABLE_INSUFFICIENT_ANCHOR_CALIBRATION"


class BandSource(StrEnum):
    EMPIRICAL_ANCHOR = "EMPIRICAL_ANCHOR"
    INTERPOLATED_BETWEEN_EMPIRICAL_ANCHORS = "INTERPOLATED_BETWEEN_EMPIRICAL_ANCHORS"


class MaturityStatus(StrEnum):
    MATURED = "MATURED"
    NOT_YET_MATURED = "NOT_YET_MATURED"


@dataclass(frozen=True)
class ForecastPathPoint:
    date: date
    point_forecast: float
    lower_p10: float | None
    upper_p90: float | None
    band_status: BandStatus
    band_anchor_horizon: str | None
    p10_residual_offset: float | None = None
    p90_residual_offset: float | None = None
    band_source: BandSource | None = None
    left_anchor_horizon: str | None = None
    right_anchor_horizon: str | None = None
    interpolation_fraction: float | None = None


@dataclass(frozen=True)
class ForecastAnchorPoint:
    horizon: str
    horizon_months: int
    target_calendar_date: date
    projected_step_count: int
    forecast_value: float
    lower_p10: float | None
    upper_p90: float | None
    band_status: BandStatus
    p10_residual_offset: float | None = None
    p90_residual_offset: float | None = None
    band_source: BandSource | None = None


@dataclass(frozen=True)
class CalibrationSummary:
    horizon: str
    sample_count: int
    residual_p10: float | None
    residual_p90: float | None
    status: BandStatus


@dataclass(frozen=True)
class RollingDailyCurrentForecast:
    method: str
    model: str
    origin_date: date
    max_horizon_months: int
    frequency: Frequency
    status: ForecastAvailabilityStatus
    forecast_path: tuple[ForecastPathPoint, ...]
    anchors: dict[str, ForecastAnchorPoint]
    metadata: ForecastMetadata | None
    calendar_projection_mode: str
    failure_reason: str | None = None


@dataclass(frozen=True)
class RollingDailyBacktestRecord:
    benchmark_id: str
    model_id: str
    method_id: str
    forecast_origin: date
    horizon: str
    horizon_months: int
    horizon_steps: int
    target_calendar_date: date
    verification_observation_date: date | None
    forecast_date: date
    origin_value: float
    forecast_value: float
    actual_value: float | None
    error: float | None
    residual: float | None
    absolute_error: float | None
    delta: float | None
    delta_pct: float | None
    mase_scale: float
    metadata: ForecastMetadata
    maturity_status: MaturityStatus


@dataclass(frozen=True)
class RollingDailyBacktestFailure:
    benchmark_id: str
    model_id: str
    method_id: str
    forecast_origin: date
    horizon: str
    horizon_months: int
    target_calendar_date: date
    verification_observation_date: date | None
    failure_reason: str


@dataclass(frozen=True)
class RollingDailyHorizonBacktestResult:
    origins: int
    expected_origins: int
    failed_origins: int
    coverage: float
    records: tuple[RollingDailyBacktestRecord, ...]
    failures: tuple[RollingDailyBacktestFailure, ...]
    metrics: MetricsSummary | None

    @property
    def total_forecasts(self) -> int:
        return self.origins

    @property
    def matured_forecasts(self) -> int:
        return sum(record.maturity_status is MaturityStatus.MATURED for record in self.records)

    @property
    def not_yet_matured_forecasts(self) -> int:
        return self.total_forecasts - self.matured_forecasts


@dataclass(frozen=True)
class RollingDailyBenchmarkResult:
    benchmark_id: str
    component: str
    description: str
    frequency: Frequency
    model_id: str
    method_id: str
    history: TimeSeries
    backtest: dict[str, RollingDailyHorizonBacktestResult]
    current_forecast: RollingDailyCurrentForecast
    runtime_seconds: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "benchmarkId": self.benchmark_id,
            "component": self.component,
            "description": self.description,
            "frequency": self.frequency.value,
            "model": self.model_id,
            "method": self.method_id,
            "history": {
                "start": self.history.start.isoformat(),
                "end": self.history.end.isoformat(),
                "observations": self.history.observation_count,
            },
            "runtimeSeconds": self.runtime_seconds,
        }