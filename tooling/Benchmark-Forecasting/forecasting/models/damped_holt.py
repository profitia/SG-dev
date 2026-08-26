from __future__ import annotations

import math
import warnings
from dataclasses import dataclass
from collections.abc import Sequence

import numpy as np
from statsmodels.tools.sm_exceptions import ConvergenceWarning
from statsmodels.tsa.holtwinters import ExponentialSmoothing

from forecasting.contracts import ForecastMetadata, Frequency, ModelForecast, NativeCadenceExecutionPlan, Observation
from forecasting.models.base import ForecastModel, ModelForecastError
from forecasting.models.statsmodels_utils import fit_converged, validate_regular_history


@dataclass(frozen=True)
class DampedHoltPathFit:
    fitted: object
    metadata: ForecastMetadata

    def forecast_path(self, horizon_steps: int) -> tuple[float, ...]:
        try:
            forecast = self.fitted.forecast(horizon_steps)
        except Exception as error:
            raise ModelForecastError(f"FORECAST_EXCEPTION: {error}") from error

        values = tuple(float(value) for value in forecast)
        if not all(math.isfinite(value) for value in values):
            raise ModelForecastError("NON_FINITE_FORECAST: Damped Holt produced a non-finite forecast path.")
        return values


def fit_damped_holt_endog(endog: np.ndarray) -> DampedHoltPathFit:
    with warnings.catch_warnings(record=True) as captured_warnings:
        warnings.simplefilter("always")
        try:
            fitted = ExponentialSmoothing(
                endog,
                trend="add",
                damped_trend=True,
                seasonal=None,
                initialization_method="estimated",
                use_boxcox=False,
            ).fit(
                optimized=True,
                remove_bias=False,
                method="L-BFGS-B",
                use_brute=False,
            )
        except Exception as error:
            raise ModelForecastError(f"FIT_EXCEPTION: {error}") from error

    if any(issubclass(warning.category, ConvergenceWarning) for warning in captured_warnings):
        raise ModelForecastError("NON_CONVERGENCE: Damped Holt emitted a convergence warning.")

    converged = fit_converged(fitted)
    if converged is False:
        raise ModelForecastError("NON_CONVERGENCE: Damped Holt optimizer did not converge.")

    params = DampedHoltModel._extract_parameters(fitted)
    return DampedHoltPathFit(
        fitted=fitted,
        metadata=ForecastMetadata(
            model_family=DampedHoltModel.model_id,
            selected_variant="DAMPED_HOLT_ADDITIVE",
            selected_parameters=params,
            selection_score=None,
            selection_metric=None,
            fit_status="SUCCEEDED",
            failure_reason=None,
        ),
    )


class DampedHoltModel(ForecastModel):
    model_id = "damped_holt"
    min_history = 36

    def __init__(
        self,
        frequency: Frequency = Frequency.MONTHLY,
        cadence_plan: NativeCadenceExecutionPlan | None = None,
    ) -> None:
        self.frequency = frequency
        self.cadence_plan = cadence_plan

    def forecast_with_metadata(self, history: Sequence[Observation], horizon_steps: int) -> ModelForecast:
        endog = validate_regular_history(
            history,
            horizon_steps,
            self.min_history,
            "Damped Holt",
            self.frequency,
            self.cadence_plan,
        )
        fit = fit_damped_holt_endog(endog)
        forecast_value = fit.forecast_path(horizon_steps)[-1]

        return ModelForecast(
            forecast_value=forecast_value,
            metadata=fit.metadata,
        )

    @staticmethod
    def _extract_parameters(fitted: object) -> dict[str, float]:
        raw_params = getattr(fitted, "params", None)
        if not isinstance(raw_params, dict):
            raise ModelForecastError("NON_FINITE_PARAMETERS: Damped Holt fit did not expose parameter mapping.")

        selected = {
            "alpha": raw_params.get("smoothing_level"),
            "beta": raw_params.get("smoothing_trend"),
            "phi": raw_params.get("damping_trend"),
            "initial_level": raw_params.get("initial_level"),
            "initial_trend": raw_params.get("initial_trend"),
        }
        normalized: dict[str, float] = {}
        for key, value in selected.items():
            if value is None:
                raise ModelForecastError(f"NON_FINITE_PARAMETERS: Missing Damped Holt parameter '{key}'.")
            numeric_value = float(value)
            if not math.isfinite(numeric_value):
                raise ModelForecastError(
                    f"NON_FINITE_PARAMETERS: Damped Holt parameter '{key}' is non-finite."
                )
            normalized[key] = numeric_value
        return normalized