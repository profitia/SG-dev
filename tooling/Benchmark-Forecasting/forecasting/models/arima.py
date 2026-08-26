from __future__ import annotations

import math
import warnings
from dataclasses import dataclass
from collections.abc import Sequence

import numpy as np
from statsmodels.tsa.arima.model import ARIMA

from forecasting.contracts import ForecastMetadata, Frequency, ModelForecast, NativeCadenceExecutionPlan, Observation
from forecasting.models.base import AICC_TIE_TOLERANCE, ForecastModel, ModelForecastError
from forecasting.models.statsmodels_utils import (
    compute_aicc,
    extract_named_parameter_map,
    fit_converged,
    has_convergence_warning,
    validate_regular_history,
)


@dataclass(frozen=True)
class ARIMACandidate:
    order: tuple[int, int, int]
    trend: str
    seasonal_order: tuple[int, int, int, int] = (0, 0, 0, 0)

    @property
    def label(self) -> str:
        p, d, q = self.order
        return f"ARIMA({p},{d},{q})"


@dataclass(frozen=True)
class ARIMACandidateResult:
    candidate: ARIMACandidate
    forecast_value: float
    aicc: float
    parameters: dict[str, float]
    fitted: object | None = None


@dataclass(frozen=True)
class ARIMAPathFit:
    selected: ARIMACandidateResult
    metadata: ForecastMetadata

    def forecast_path(self, horizon_steps: int) -> tuple[float, ...]:
        if self.selected.fitted is None:
            raise ModelForecastError("FIT_STATE_MISSING: ARIMA path forecast requires a fitted model instance.")

        try:
            forecast = self.selected.fitted.forecast(horizon_steps)
        except Exception as error:
            raise ModelForecastError(f"FORECAST_EXCEPTION: {error}") from error

        values = tuple(float(value) for value in forecast)
        if not all(math.isfinite(value) for value in values):
            raise ModelForecastError("NON_FINITE_FORECAST: ARIMA candidate produced a non-finite forecast path.")
        return values


def _arima_tie_break_key(candidate: ARIMACandidate) -> tuple[int, int, int, int]:
    p, d, q = candidate.order
    return (d, p + q, p, q)


ARIMA_CANDIDATE_GRID: tuple[ARIMACandidate, ...] = tuple(
    sorted(
        (
            ARIMACandidate(order=(p, d, q), trend=("c" if d == 0 else "t"))
            for p in (0, 1, 2)
            for d in (0, 1)
            for q in (0, 1, 2)
            if (p, d, q) != (0, 0, 0)
        ),
        key=_arima_tie_break_key,
    )
)

ARIMA_POLICY_ID = "ARIMA_NON_SEASONAL_BOUNDED_AICC_V1"
ARIMA_TIE_BREAK_POLICY_ID = "LOWER_D_THEN_LOWER_P_PLUS_Q_THEN_P_THEN_Q"
ARIMA_FIT_IMPLEMENTATION = "STATSMODELS_ARIMA_STATESPACE"


class ARIMAModelFamily(ForecastModel):
    model_id = "arima"
    min_history = 36

    def __init__(
        self,
        frequency: Frequency = Frequency.MONTHLY,
        cadence_plan: NativeCadenceExecutionPlan | None = None,
    ) -> None:
        self.frequency = frequency
        self.cadence_plan = cadence_plan

    def forecast_with_metadata(self, history: Sequence[Observation], horizon_steps: int) -> ModelForecast:
        validate_regular_history(
            history,
            horizon_steps,
            self.min_history,
            "ARIMA",
            self.frequency,
            self.cadence_plan,
        )

        failures: list[str] = []
        selected: ARIMACandidateResult | None = None
        for candidate in ARIMA_CANDIDATE_GRID:
            try:
                candidate_result = self.fit_candidate(history, candidate, horizon_steps)
            except ModelForecastError as error:
                failures.append(f"{candidate.label}={error.reason}")
                continue

            if selected is None or candidate_result.aicc < selected.aicc - AICC_TIE_TOLERANCE:
                selected = candidate_result

        if selected is None:
            failure_summary = "; ".join(failures) if failures else "no eligible ARIMA candidates"
            raise ModelForecastError(f"ALL_CANDIDATES_INVALID: {failure_summary}")

        selected_parameters: dict[str, object] = {
            "order": list(selected.candidate.order),
            "trend": selected.candidate.trend,
            "seasonal_order": list(selected.candidate.seasonal_order),
            "policyIdentity": ARIMA_POLICY_ID,
            "candidateCount": len(ARIMA_CANDIDATE_GRID),
            "tieBreakPolicy": ARIMA_TIE_BREAK_POLICY_ID,
            "fitImplementation": ARIMA_FIT_IMPLEMENTATION,
        }
        selected_parameters.update(selected.parameters)

        return ModelForecast(
            forecast_value=selected.forecast_value,
            metadata=ForecastMetadata(
                model_family=self.model_id,
                selected_variant=selected.candidate.label,
                selected_parameters=selected_parameters,
                selection_score=selected.aicc,
                selection_metric="AICc",
                fit_status="SUCCEEDED",
                failure_reason=None,
            ),
        )

    def fit_candidate(
        self,
        history: Sequence[Observation],
        candidate: ARIMACandidate,
        horizon_steps: int,
    ) -> ARIMACandidateResult:
        endog = validate_regular_history(
            history,
            horizon_steps,
            self.min_history,
            "ARIMA",
            self.frequency,
            self.cadence_plan,
        )

        return fit_arima_candidate_endog(
            endog=endog,
            candidate=candidate,
            sample_size=len(history),
            horizon_steps=horizon_steps,
        )


def fit_arima_candidate_endog(
    *,
    endog: np.ndarray,
    candidate: ARIMACandidate,
    sample_size: int,
    horizon_steps: int,
) -> ARIMACandidateResult:

        with warnings.catch_warnings(record=True) as captured_warnings:
            warnings.simplefilter("always")
            try:
                fitted = ARIMA(
                    endog,
                    order=candidate.order,
                    seasonal_order=candidate.seasonal_order,
                    trend=candidate.trend,
                    enforce_stationarity=True,
                    enforce_invertibility=True,
                    concentrate_scale=False,
                    validate_specification=True,
                ).fit(
                    method="statespace",
                    low_memory=False,
                )
            except Exception as error:
                raise ModelForecastError(f"FIT_EXCEPTION: {error}") from error

        if has_convergence_warning(captured_warnings):
            raise ModelForecastError("NON_CONVERGENCE: ARIMA emitted a convergence warning.")

        converged = fit_converged(fitted)
        if converged is False:
            raise ModelForecastError("NON_CONVERGENCE: ARIMA optimizer did not converge.")

        parameters = extract_named_parameter_map(fitted)
        aicc = compute_aicc(fitted, sample_size)
        if not math.isfinite(aicc):
            raise ModelForecastError("NON_FINITE_AICC: ARIMA candidate produced a non-finite AICc.")

        try:
            forecast = fitted.forecast(horizon_steps)
            forecast_value = float(forecast[-1])
        except Exception as error:
            raise ModelForecastError(f"FORECAST_EXCEPTION: {error}") from error

        if not math.isfinite(forecast_value):
            raise ModelForecastError("NON_FINITE_FORECAST: ARIMA candidate produced a non-finite forecast.")

        return ARIMACandidateResult(
            candidate=candidate,
            forecast_value=forecast_value,
            aicc=aicc,
            parameters=parameters,
            fitted=fitted,
        )


def fit_selected_arima_endog(
    *,
    endog: np.ndarray,
    candidates: tuple[ARIMACandidate, ...] = ARIMA_CANDIDATE_GRID,
    sample_size: int,
) -> ARIMAPathFit:
    failures: list[str] = []
    selected: ARIMACandidateResult | None = None
    for candidate in candidates:
        try:
            candidate_result = fit_arima_candidate_endog(
                endog=endog,
                candidate=candidate,
                sample_size=sample_size,
                horizon_steps=1,
            )
        except ModelForecastError as error:
            failures.append(f"{candidate.label}={error.reason}")
            continue

        if selected is None or candidate_result.aicc < selected.aicc - AICC_TIE_TOLERANCE:
            selected = candidate_result

    if selected is None:
        failure_summary = "; ".join(failures) if failures else "no eligible ARIMA candidates"
        raise ModelForecastError(f"ALL_CANDIDATES_INVALID: {failure_summary}")

    selected_parameters: dict[str, object] = {
        "order": list(selected.candidate.order),
        "trend": selected.candidate.trend,
        "seasonal_order": list(selected.candidate.seasonal_order),
        "policyIdentity": ARIMA_POLICY_ID,
        "candidateCount": len(candidates),
        "tieBreakPolicy": ARIMA_TIE_BREAK_POLICY_ID,
        "fitImplementation": ARIMA_FIT_IMPLEMENTATION,
    }
    selected_parameters.update(selected.parameters)

    return ARIMAPathFit(
        selected=selected,
        metadata=ForecastMetadata(
            model_family=ARIMAModelFamily.model_id,
            selected_variant=selected.candidate.label,
            selected_parameters=selected_parameters,
            selection_score=selected.aicc,
            selection_metric="AICc",
            fit_status="SUCCEEDED",
            failure_reason=None,
        ),
    )