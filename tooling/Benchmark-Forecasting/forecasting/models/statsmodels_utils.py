from __future__ import annotations

import math
from collections.abc import Sequence
from datetime import date
from warnings import WarningMessage

import numpy as np
from statsmodels.tools.sm_exceptions import ConvergenceWarning

from forecasting.contracts import Frequency, NativeCadenceExecutionPlan, Observation
from forecasting.models.base import ModelForecastError


def add_one_month(value: date) -> date:
    zero_based_month = value.month
    year = value.year + zero_based_month // 12
    month = zero_based_month % 12 + 1
    return date(year, month, 1)


def validate_history_values(
    history: Sequence[Observation],
    horizon_steps: int,
    min_history: int,
    model_name: str,
) -> np.ndarray:
    if len(history) < min_history:
        raise ModelForecastError(
            f"INSUFFICIENT_HISTORY: {model_name} requires at least {min_history} observations."
        )
    if horizon_steps < 1:
        raise ModelForecastError("INVALID_HORIZON: Forecast horizon must be at least 1 step ahead.")
    values = np.asarray([observation.value for observation in history], dtype=float)
    if not np.isfinite(values).all():
        raise ModelForecastError(f"NON_FINITE_HISTORY: {model_name} requires finite historical values.")
    return values


def validate_regular_history(
    history: Sequence[Observation],
    horizon_steps: int,
    min_history: int,
    model_name: str,
    frequency: Frequency,
    cadence_plan: NativeCadenceExecutionPlan | None = None,
) -> np.ndarray:
    values = validate_history_values(history, horizon_steps, min_history, model_name)
    if cadence_plan is None:
        if frequency is not Frequency.MONTHLY:
            raise ModelForecastError(
                f"CADENCE_PLAN_REQUIRED: {model_name} requires a B1 cadence execution plan for {frequency.value}."
            )
        for previous, current in zip(history, history[1:]):
            if add_one_month(previous.date) != current.date:
                raise ModelForecastError(
                    f"BROKEN_CADENCE: {model_name} requires regular MONTHLY cadence without gaps."
                )
        return values

    if cadence_plan.frequency is not frequency:
        raise ModelForecastError(
            f"CADENCE_PLAN_MISMATCH: {model_name} received {cadence_plan.frequency.value} periods for {frequency.value}."
        )
    actual_period_starts = tuple(observation.date for observation in history)
    expected_period_starts = cadence_plan.historical_period_starts[:len(history)]
    if len(expected_period_starts) != len(actual_period_starts) or actual_period_starts != expected_period_starts:
        raise ModelForecastError(
            f"BROKEN_CADENCE: {model_name} history does not match the B1 {frequency.value} cadence execution plan."
        )
    return values


def validate_monthly_history(
    history: Sequence[Observation],
    horizon_steps: int,
    min_history: int,
    model_name: str,
) -> np.ndarray:
    return validate_regular_history(history, horizon_steps, min_history, model_name, Frequency.MONTHLY)


def has_convergence_warning(captured_warnings: Sequence[WarningMessage]) -> bool:
    return any(issubclass(warning.category, ConvergenceWarning) for warning in captured_warnings)


def fit_converged(result: object) -> bool | None:
    mle_retvals = getattr(result, "mle_retvals", None)
    if isinstance(mle_retvals, dict):
        if "converged" in mle_retvals:
            return bool(mle_retvals["converged"])
        if "success" in mle_retvals:
            return bool(mle_retvals["success"])
    if mle_retvals is not None:
        if hasattr(mle_retvals, "converged"):
            return bool(getattr(mle_retvals, "converged"))
        if hasattr(mle_retvals, "success"):
            return bool(getattr(mle_retvals, "success"))
    return None


def compute_aicc(result: object, sample_size: int) -> float:
    direct_aicc = getattr(result, "aicc", None)
    if direct_aicc is not None:
        direct_aicc_value = float(direct_aicc)
        if math.isfinite(direct_aicc_value):
            return direct_aicc_value

    aic = getattr(result, "aic", None)
    if aic is None:
        return math.inf

    aic_value = float(aic)
    if not math.isfinite(aic_value):
        return math.inf

    parameter_count = getattr(result, "k_params", None)
    if parameter_count is None:
        params = getattr(result, "params", None)
        if params is None:
            return math.inf
        parameter_count = len(params)

    denominator = sample_size - int(parameter_count) - 1
    if denominator <= 0:
        return math.inf
    return float(aic_value + (2 * parameter_count * (parameter_count + 1)) / denominator)


def extract_named_parameter_map(result: object) -> dict[str, float]:
    raw_params = getattr(result, "params", None)
    if raw_params is None:
        raise ModelForecastError("NON_FINITE_PARAMETERS: Fitted result did not expose parameters.")

    if isinstance(raw_params, dict):
        normalized: dict[str, float] = {}
        for key, value in raw_params.items():
            if value is None or isinstance(value, bool):
                continue
            if isinstance(value, np.ndarray):
                continue
            numeric_value = float(value)
            if not math.isfinite(numeric_value):
                raise ModelForecastError(
                    f"NON_FINITE_PARAMETERS: Fitted parameter '{key}' is non-finite."
                )
            normalized[str(key)] = numeric_value
        return normalized

    param_names = list(getattr(result, "param_names", []))
    param_values = np.asarray(raw_params, dtype=float)
    if param_names and len(param_names) != len(param_values):
        raise ModelForecastError("NON_FINITE_PARAMETERS: Parameter names do not align with fitted values.")

    if not np.isfinite(param_values).all():
        raise ModelForecastError("NON_FINITE_PARAMETERS: Fitted parameter vector contains non-finite values.")

    if param_names:
        return {
            str(name): float(value)
            for name, value in zip(param_names, param_values)
        }

    return {
        f"param_{index}": float(value)
        for index, value in enumerate(param_values)
    }