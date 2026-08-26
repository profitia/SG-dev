from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date
from enum import StrEnum
from typing import Any


class Frequency(StrEnum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    BIMONTHLY = "BIMONTHLY"
    QUARTERLY = "QUARTERLY"
    QUADMONTHLY = "QUADMONTHLY"
    SEMIANNUAL = "SEMIANNUAL"
    ANNUAL = "ANNUAL"


@dataclass(frozen=True)
class NativeCadenceExecutionPlan:
    frequency: Frequency
    historical_period_starts: tuple[date, ...]

    def __post_init__(self) -> None:
        if not self.historical_period_starts:
            raise ValueError("Native cadence execution plan requires historical target periods.")
        if any(
            current <= previous
            for previous, current in zip(self.historical_period_starts, self.historical_period_starts[1:])
        ):
            raise ValueError("Native cadence execution plan target periods must be strictly ordered.")


@dataclass(frozen=True)
class Observation:
    date: date
    value: float


@dataclass(frozen=True)
class TimeSeries:
    series_id: str
    benchmark_name: str
    description: str
    frequency: Frequency
    observations: tuple[Observation, ...]

    @property
    def start(self) -> date:
        return self.observations[0].date

    @property
    def end(self) -> date:
        return self.observations[-1].date

    @property
    def observation_count(self) -> int:
        return len(self.observations)


@dataclass(frozen=True)
class BenchmarkDefinition:
    series_id: str
    component: str
    description: str
    frequency: Frequency
    expected_observations: int


@dataclass(frozen=True)
class ForecastMetadata:
    model_family: str
    selected_variant: str
    selected_parameters: dict[str, Any] = field(default_factory=dict)
    selection_score: float | None = None
    selection_metric: str | None = None
    fit_status: str = "SUCCEEDED"
    failure_reason: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "modelFamily": self.model_family,
            "selectedVariant": self.selected_variant,
            "selectedParameters": self.selected_parameters,
            "selectionScore": self.selection_score,
            "selectionMetric": self.selection_metric,
            "fitStatus": self.fit_status,
            "failureReason": self.failure_reason,
        }


@dataclass(frozen=True)
class ModelForecast:
    forecast_value: float
    metadata: ForecastMetadata


@dataclass(frozen=True)
class BacktestRecord:
    benchmark_id: str
    model_id: str
    forecast_origin: date
    horizon: str
    horizon_steps: int
    forecast_date: date
    origin_value: float
    forecast_value: float
    actual_value: float
    error: float
    absolute_error: float
    delta: float
    delta_pct: float | None
    mase_scale: float
    metadata: ForecastMetadata


@dataclass(frozen=True)
class BacktestFailure:
    benchmark_id: str
    model_id: str
    forecast_origin: date
    horizon: str
    horizon_steps: int
    forecast_date: date
    failure_reason: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "benchmarkId": self.benchmark_id,
            "modelId": self.model_id,
            "forecastOrigin": self.forecast_origin.isoformat(),
            "horizon": self.horizon,
            "horizonSteps": self.horizon_steps,
            "forecastDate": self.forecast_date.isoformat(),
            "failureReason": self.failure_reason,
        }


@dataclass(frozen=True)
class BacktestRun:
    expected_origins: int
    records: tuple[BacktestRecord, ...]
    failures: tuple[BacktestFailure, ...]

    def __iter__(self):
        return iter(self.records)

    def __len__(self) -> int:
        return len(self.records)

    def __getitem__(self, index: int) -> BacktestRecord:
        return self.records[index]

    @property
    def successful_origins(self) -> int:
        return len(self.records)

    @property
    def failed_origins(self) -> int:
        return len(self.failures)

    @property
    def coverage(self) -> float:
        if self.expected_origins == 0:
            return 0.0
        return self.successful_origins / self.expected_origins


@dataclass(frozen=True)
class MetricsSummary:
    mae: float
    rmse: float
    mase: float
    smape: float
    directional_accuracy: float
    bias: float

    def to_dict(self) -> dict[str, float]:
        return asdict(self)


@dataclass(frozen=True)
class HorizonBacktestResult:
    origins: int
    expected_origins: int
    failed_origins: int
    coverage: float
    records: tuple[BacktestRecord, ...]
    failures: tuple[BacktestFailure, ...]
    metrics: MetricsSummary | None

    @property
    def successful_origins(self) -> int:
        return self.origins

    def to_dict(self) -> dict[str, Any]:
        return {
            "origins": self.origins,
            "expectedOrigins": self.expected_origins,
            "successfulOrigins": self.successful_origins,
            "failedOrigins": self.failed_origins,
            "coverage": self.coverage,
            "metrics": None if self.metrics is None else self.metrics.to_dict(),
        }


@dataclass(frozen=True)
class CurrentForecast:
    horizon: str
    horizon_steps: int
    forecast_date: date
    forecast_value: float | None
    metadata: ForecastMetadata | None = None
    failure_reason: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "horizon": self.horizon,
            "horizonSteps": self.horizon_steps,
            "forecastDate": self.forecast_date.isoformat(),
            "forecastValue": self.forecast_value,
            "metadata": None if self.metadata is None else self.metadata.to_dict(),
            "failureReason": self.failure_reason,
        }


@dataclass(frozen=True)
class NativeStepForecast:
    horizon_steps: int
    forecast_date: date
    forecast_value: float | None
    metadata: ForecastMetadata | None = None
    failure_reason: str | None = None


@dataclass(frozen=True)
class BenchmarkResult:
    benchmark_id: str
    component: str
    description: str
    frequency: Frequency
    model_id: str
    history: TimeSeries
    backtest: dict[str, HorizonBacktestResult]
    current_forecast: dict[str, CurrentForecast]
    runtime_seconds: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "benchmarkId": self.benchmark_id,
            "component": self.component,
            "description": self.description,
            "frequency": self.frequency.value,
            "model": self.model_id,
            "history": {
                "start": self.history.start.isoformat(),
                "end": self.history.end.isoformat(),
                "observations": self.history.observation_count,
            },
            "backtest": {
                horizon: result.to_dict()
                for horizon, result in self.backtest.items()
            },
            "currentForecast": {
                horizon: forecast.to_dict()
                for horizon, forecast in self.current_forecast.items()
            },
            "runtimeSeconds": self.runtime_seconds,
        }