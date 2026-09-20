from __future__ import annotations

import math
from dataclasses import dataclass
from enum import StrEnum
from typing import Iterable

import numpy as np


ADAPTIVE_UNCERTAINTY_BANDS_POLICY_VERSION = "ADAPTIVE_UNCERTAINTY_BANDS_V1"
UNCERTAINTY_BAND_COVERAGE = 0.8
MIN_EMPIRICAL_BAND_RESIDUALS = 30
MODEL_NATIVE_SIMULATION_REPETITIONS = 1000
MODEL_NATIVE_SIMULATION_SEED = 1729
NORMAL_P90 = 1.2815515655446004


class UncertaintyBandStatus(StrEnum):
    AVAILABLE = "AVAILABLE"
    NOT_AVAILABLE = "NOT_AVAILABLE"


class UncertaintyBandSource(StrEnum):
    EMPIRICAL_EXACT_RESIDUALS = "EMPIRICAL_EXACT_RESIDUALS"
    MODEL_NATIVE_SHORT_HISTORY = "MODEL_NATIVE_SHORT_HISTORY"


class UncertaintyBandCalibrationStatus(StrEnum):
    CALIBRATED = "CALIBRATED"
    INSUFFICIENT_SAMPLE = "INSUFFICIENT_SAMPLE"
    NOT_AVAILABLE = "NOT_AVAILABLE"


@dataclass(frozen=True)
class ForecastUncertaintyBand:
    status: UncertaintyBandStatus
    source: UncertaintyBandSource | None
    policy_version: str
    coverage: float
    lower: float | None
    upper: float | None
    sample_count: int
    calibration_status: UncertaintyBandCalibrationStatus
    calibration_method: str | None
    calibration_version: str | None
    reason_code: str | None

    def __post_init__(self) -> None:
        if self.coverage != UNCERTAINTY_BAND_COVERAGE:
            raise ValueError("Uncertainty band coverage must equal 0.8.")
        if self.sample_count < 0:
            raise ValueError("Uncertainty band sample count cannot be negative.")
        if self.status is UncertaintyBandStatus.AVAILABLE:
            if self.source is None or self.lower is None or self.upper is None:
                raise ValueError("Available uncertainty band requires source, lower, and upper.")
            if not math.isfinite(self.lower) or not math.isfinite(self.upper):
                raise ValueError("Available uncertainty band bounds must be finite.")
            if self.lower > self.upper:
                raise ValueError("Uncertainty band lower bound cannot exceed upper bound.")
            if self.reason_code is not None:
                raise ValueError("Available uncertainty band cannot expose a reason code.")
        else:
            if self.lower is not None or self.upper is not None:
                raise ValueError("Unavailable uncertainty band cannot expose numerical bounds.")
            if self.reason_code is None:
                raise ValueError("Unavailable uncertainty band requires a reason code.")
        if self.source is UncertaintyBandSource.MODEL_NATIVE_SHORT_HISTORY:
            if self.calibration_status is UncertaintyBandCalibrationStatus.CALIBRATED:
                raise ValueError("Model-native uncertainty band cannot be marked calibrated.")
        if (
            self.source is UncertaintyBandSource.EMPIRICAL_EXACT_RESIDUALS
            and self.status is UncertaintyBandStatus.AVAILABLE
        ):
            if self.sample_count < MIN_EMPIRICAL_BAND_RESIDUALS:
                raise ValueError("Available empirical uncertainty band requires at least 30 exact residuals.")
            if self.calibration_status is not UncertaintyBandCalibrationStatus.CALIBRATED:
                raise ValueError("Available empirical uncertainty band must be marked calibrated.")

    def to_dict(self) -> dict[str, object]:
        return {
            "status": self.status.value,
            "source": None if self.source is None else self.source.value,
            "policyVersion": self.policy_version,
            "coverage": self.coverage,
            "lower": self.lower,
            "upper": self.upper,
            "sampleCount": self.sample_count,
            "calibrationStatus": self.calibration_status.value,
            "calibrationMethod": self.calibration_method,
            "calibrationVersion": self.calibration_version,
            "reasonCode": self.reason_code,
        }


def unavailable_model_native_band(
    *,
    sample_count: int,
    reason_code: str,
    calibration_method: str,
    calibration_version: str,
) -> ForecastUncertaintyBand:
    return ForecastUncertaintyBand(
        status=UncertaintyBandStatus.NOT_AVAILABLE,
        source=UncertaintyBandSource.MODEL_NATIVE_SHORT_HISTORY,
        policy_version=ADAPTIVE_UNCERTAINTY_BANDS_POLICY_VERSION,
        coverage=UNCERTAINTY_BAND_COVERAGE,
        lower=None,
        upper=None,
        sample_count=sample_count,
        calibration_status=UncertaintyBandCalibrationStatus.INSUFFICIENT_SAMPLE,
        calibration_method=calibration_method,
        calibration_version=calibration_version,
        reason_code=reason_code,
    )


def available_model_native_band(
    *,
    lower: float,
    upper: float,
    sample_count: int,
    calibration_method: str,
    calibration_version: str,
) -> ForecastUncertaintyBand:
    return ForecastUncertaintyBand(
        status=UncertaintyBandStatus.AVAILABLE,
        source=UncertaintyBandSource.MODEL_NATIVE_SHORT_HISTORY,
        policy_version=ADAPTIVE_UNCERTAINTY_BANDS_POLICY_VERSION,
        coverage=UNCERTAINTY_BAND_COVERAGE,
        lower=float(lower),
        upper=float(upper),
        sample_count=sample_count,
        calibration_status=UncertaintyBandCalibrationStatus.INSUFFICIENT_SAMPLE,
        calibration_method=calibration_method,
        calibration_version=calibration_version,
        reason_code=None,
    )


def build_empirical_exact_residual_band(
    *,
    point_forecast: float,
    residuals: Iterable[float],
) -> ForecastUncertaintyBand:
    lawful_residuals = [float(value) for value in residuals if math.isfinite(float(value))]
    sample_count = len(lawful_residuals)
    method = "EMPIRICAL_RESIDUAL_QUANTILES_HF7"
    version = "empirical-exact-residual-quantiles-v1"
    if sample_count < MIN_EMPIRICAL_BAND_RESIDUALS:
        return ForecastUncertaintyBand(
            status=UncertaintyBandStatus.NOT_AVAILABLE,
            source=UncertaintyBandSource.EMPIRICAL_EXACT_RESIDUALS,
            policy_version=ADAPTIVE_UNCERTAINTY_BANDS_POLICY_VERSION,
            coverage=UNCERTAINTY_BAND_COVERAGE,
            lower=None,
            upper=None,
            sample_count=sample_count,
            calibration_status=UncertaintyBandCalibrationStatus.INSUFFICIENT_SAMPLE,
            calibration_method=method,
            calibration_version=version,
            reason_code="INSUFFICIENT_EXACT_RESIDUALS",
        )

    residual_p10, residual_p90 = np.quantile(
        np.asarray(lawful_residuals, dtype=float),
        [0.10, 0.90],
        method="linear",
    )
    return ForecastUncertaintyBand(
        status=UncertaintyBandStatus.AVAILABLE,
        source=UncertaintyBandSource.EMPIRICAL_EXACT_RESIDUALS,
        policy_version=ADAPTIVE_UNCERTAINTY_BANDS_POLICY_VERSION,
        coverage=UNCERTAINTY_BAND_COVERAGE,
        lower=float(point_forecast + residual_p10),
        upper=float(point_forecast + residual_p90),
        sample_count=sample_count,
        calibration_status=UncertaintyBandCalibrationStatus.CALIBRATED,
        calibration_method=method,
        calibration_version=version,
        reason_code=None,
    )


def build_naive_model_native_band(
    *,
    history_values: Iterable[float],
    point_forecast: float,
    horizon_steps: int,
) -> ForecastUncertaintyBand:
    values = [float(value) for value in history_values]
    method = "NAIVE_RANDOM_WALK_INNOVATION_RMS_NORMAL"
    version = "naive-random-walk-innovation-rms-normal-v1"
    if len(values) < 2:
        return unavailable_model_native_band(
            sample_count=len(values),
            reason_code="INSUFFICIENT_BAND_HISTORY",
            calibration_method=method,
            calibration_version=version,
        )

    innovations = np.diff(np.asarray(values, dtype=float))
    scale = float(np.sqrt(np.mean(np.square(innovations))))
    if not math.isfinite(scale):
        return unavailable_model_native_band(
            sample_count=len(values),
            reason_code="NON_FINITE_MODEL_NATIVE_SCALE",
            calibration_method=method,
            calibration_version=version,
        )
    half_width = NORMAL_P90 * scale * math.sqrt(horizon_steps)
    return available_model_native_band(
        lower=point_forecast - half_width,
        upper=point_forecast + half_width,
        sample_count=len(values),
        calibration_method=method,
        calibration_version=version,
    )


def build_simulated_model_native_band(
    *,
    fitted: object,
    horizon_steps: int,
    sample_count: int,
    calibration_method: str,
    calibration_version: str,
) -> ForecastUncertaintyBand:
    try:
        simulated = fitted.simulate(
            horizon_steps,
            anchor="end",
            repetitions=MODEL_NATIVE_SIMULATION_REPETITIONS,
            rng=np.random.default_rng(MODEL_NATIVE_SIMULATION_SEED),
        )
        simulations = np.asarray(simulated, dtype=float)
        final_horizon = simulations[-1] if simulations.ndim > 1 else simulations
        lower, upper = np.quantile(final_horizon, [0.10, 0.90], method="linear")
    except Exception as error:
        return unavailable_model_native_band(
            sample_count=sample_count,
            reason_code=f"MODEL_NATIVE_INTERVAL_FAILED:{type(error).__name__}",
            calibration_method=calibration_method,
            calibration_version=calibration_version,
        )

    return available_model_native_band(
        lower=float(lower),
        upper=float(upper),
        sample_count=sample_count,
        calibration_method=calibration_method,
        calibration_version=calibration_version,
    )


def build_simulated_model_native_band_path(
    *,
    fitted: object,
    horizon_steps: int,
    sample_count: int,
    calibration_method: str,
    calibration_version: str,
) -> tuple[ForecastUncertaintyBand, ...]:
    try:
        simulated = fitted.simulate(
            horizon_steps,
            anchor="end",
            repetitions=MODEL_NATIVE_SIMULATION_REPETITIONS,
            rng=np.random.default_rng(MODEL_NATIVE_SIMULATION_SEED),
        )
        simulations = np.asarray(simulated, dtype=float)
        if simulations.ndim == 1:
            simulations = simulations.reshape(horizon_steps, -1)
        quantiles = np.quantile(simulations, [0.10, 0.90], axis=1, method="linear")
    except Exception as error:
        unavailable = unavailable_model_native_band(
            sample_count=sample_count,
            reason_code=f"MODEL_NATIVE_INTERVAL_FAILED:{type(error).__name__}",
            calibration_method=calibration_method,
            calibration_version=calibration_version,
        )
        return tuple(unavailable for _ in range(horizon_steps))

    return tuple(
        available_model_native_band(
            lower=float(quantiles[0, index]),
            upper=float(quantiles[1, index]),
            sample_count=sample_count,
            calibration_method=calibration_method,
            calibration_version=calibration_version,
        )
        for index in range(horizon_steps)
    )


def build_arima_model_native_band(
    *,
    fitted: object,
    horizon_steps: int,
    sample_count: int,
) -> ForecastUncertaintyBand:
    method = "STATSMODELS_ARIMA_FORECAST_DISTRIBUTION"
    version = "statsmodels-arima-conf-int-alpha-0.2-v1"
    try:
        prediction = fitted.get_forecast(steps=horizon_steps)
        confidence_interval = np.asarray(prediction.conf_int(alpha=0.2), dtype=float)
        lower, upper = confidence_interval[-1]
    except Exception as error:
        return unavailable_model_native_band(
            sample_count=sample_count,
            reason_code=f"MODEL_NATIVE_INTERVAL_FAILED:{type(error).__name__}",
            calibration_method=method,
            calibration_version=version,
        )

    return available_model_native_band(
        lower=float(lower),
        upper=float(upper),
        sample_count=sample_count,
        calibration_method=method,
        calibration_version=version,
    )


def build_arima_model_native_band_path(
    *,
    fitted: object,
    horizon_steps: int,
    sample_count: int,
) -> tuple[ForecastUncertaintyBand, ...]:
    method = "STATSMODELS_ARIMA_FORECAST_DISTRIBUTION"
    version = "statsmodels-arima-conf-int-alpha-0.2-v1"
    try:
        prediction = fitted.get_forecast(steps=horizon_steps)
        confidence_intervals = np.asarray(prediction.conf_int(alpha=0.2), dtype=float)
    except Exception as error:
        unavailable = unavailable_model_native_band(
            sample_count=sample_count,
            reason_code=f"MODEL_NATIVE_INTERVAL_FAILED:{type(error).__name__}",
            calibration_method=method,
            calibration_version=version,
        )
        return tuple(unavailable for _ in range(horizon_steps))

    return tuple(
        available_model_native_band(
            lower=float(bounds[0]),
            upper=float(bounds[1]),
            sample_count=sample_count,
            calibration_method=method,
            calibration_version=version,
        )
        for bounds in confidence_intervals
    )
