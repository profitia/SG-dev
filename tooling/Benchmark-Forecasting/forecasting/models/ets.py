from __future__ import annotations

import math
import warnings
from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np
from statsmodels.tsa.exponential_smoothing.ets import ETSModel

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
class ETSCandidate:
    variant: str
    trend: str | None
    damped_trend: bool
    seasonal: str | None


@dataclass(frozen=True)
class ETSCandidateResult:
    candidate: ETSCandidate
    forecast_value: float
    aicc: float
    parameters: dict[str, float]
    fitted: object | None = None


@dataclass(frozen=True)
class ETSPathFit:
    selected: ETSCandidateResult
    metadata: ForecastMetadata

    def forecast_path(self, horizon_steps: int) -> tuple[float, ...]:
        if self.selected.fitted is None:
            raise ModelForecastError("FIT_STATE_MISSING: ETS path forecast requires a fitted model instance.")
        try:
            forecast = self.selected.fitted.forecast(horizon_steps)
        except Exception as error:
            raise ModelForecastError(f"FORECAST_EXCEPTION: {error}") from error

        values = tuple(float(value) for value in forecast)
        if not all(math.isfinite(value) for value in values):
            raise ModelForecastError("NON_FINITE_FORECAST: ETS candidate produced a non-finite forecast path.")
        return values


ETS_CANDIDATE_CATALOG: tuple[ETSCandidate, ...] = (
    ETSCandidate("ETS(A,N,N)", None, False, None),
    ETSCandidate("ETS(A,A,N)", "add", False, None),
    ETSCandidate("ETS(A,Ad,N)", "add", True, None),
    ETSCandidate("ETS(A,N,A)", None, False, "add"),
    ETSCandidate("ETS(A,A,A)", "add", False, "add"),
    ETSCandidate("ETS(A,Ad,A)", "add", True, "add"),
)


class ETSModelFamily(ForecastModel):
    model_id = "ets"
    min_history = 36
    seasonal_periods = 12

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
            "ETS",
            self.frequency,
            self.cadence_plan,
        )

        failures: list[str] = []
        selected: ETSCandidateResult | None = None
        for candidate in self.eligible_candidates(history):
            try:
                candidate_result = self.fit_candidate(history, candidate, horizon_steps)
            except ModelForecastError as error:
                failures.append(f"{candidate.variant}={error.reason}")
                continue

            if selected is None or candidate_result.aicc < selected.aicc - AICC_TIE_TOLERANCE:
                selected = candidate_result

        if selected is None:
            failure_summary = "; ".join(failures) if failures else "no eligible ETS candidates"
            raise ModelForecastError(f"ALL_CANDIDATES_INVALID: {failure_summary}")

        return ModelForecast(
            forecast_value=selected.forecast_value,
            metadata=ForecastMetadata(
                model_family=self.model_id,
                selected_variant=selected.candidate.variant,
                selected_parameters=selected.parameters,
                selection_score=selected.aicc,
                selection_metric="AICc",
                fit_status="SUCCEEDED",
                failure_reason=None,
            ),
        )

    def eligible_candidates(self, history: Sequence[Observation]) -> tuple[ETSCandidate, ...]:
        seasonal_allowed = self.frequency is Frequency.MONTHLY and len(history) >= self.min_history
        return tuple(
            candidate
            for candidate in ETS_CANDIDATE_CATALOG
            if seasonal_allowed or candidate.seasonal is None
        )

    def fit_candidate(
        self,
        history: Sequence[Observation],
        candidate: ETSCandidate,
        horizon_steps: int,
    ) -> ETSCandidateResult:
        endog = validate_regular_history(
            history,
            horizon_steps,
            self.min_history,
            "ETS",
            self.frequency,
            self.cadence_plan,
        )
        if candidate.seasonal is not None and self.frequency is not Frequency.MONTHLY:
            raise ModelForecastError(
                f"SEASONAL_NOT_ELIGIBLE: ETS seasonal candidates are not canonical for {self.frequency.value} cadence."
            )
        return fit_ets_candidate_endog(endog=endog, candidate=candidate, sample_size=len(history), seasonal_periods=self.seasonal_periods)


def fit_ets_candidate_endog(
    *,
    endog: np.ndarray,
    candidate: ETSCandidate,
    sample_size: int,
    seasonal_periods: int,
) -> ETSCandidateResult:
    seasonal_period_count = seasonal_periods if candidate.seasonal is not None else None
    with warnings.catch_warnings(record=True) as captured_warnings:
        warnings.simplefilter("always")
        try:
            fitted = ETSModel(
                endog,
                error="add",
                trend=candidate.trend,
                damped_trend=candidate.damped_trend,
                seasonal=candidate.seasonal,
                seasonal_periods=seasonal_period_count,
                initialization_method="estimated",
            ).fit(
                maxiter=1000,
                full_output=True,
                disp=False,
            )
        except Exception as error:
            raise ModelForecastError(f"FIT_EXCEPTION: {error}") from error

    if has_convergence_warning(captured_warnings):
        raise ModelForecastError("NON_CONVERGENCE: ETS emitted a convergence warning.")

    converged = fit_converged(fitted)
    if converged is False:
        raise ModelForecastError("NON_CONVERGENCE: ETS optimizer did not converge.")

    parameters = extract_named_parameter_map(fitted)
    if seasonal_period_count is not None:
        parameters["seasonal_periods"] = float(seasonal_period_count)

    aicc = compute_aicc(fitted, sample_size)
    if not math.isfinite(aicc):
        raise ModelForecastError("NON_FINITE_AICC: ETS candidate produced a non-finite AICc.")

    try:
        forecast = fitted.forecast(1)
        forecast_value = float(forecast[-1])
    except Exception as error:
        raise ModelForecastError(f"FORECAST_EXCEPTION: {error}") from error

    if not math.isfinite(forecast_value):
        raise ModelForecastError("NON_FINITE_FORECAST: ETS candidate produced a non-finite forecast.")

    return ETSCandidateResult(
        candidate=candidate,
        fitted=fitted,
        forecast_value=forecast_value,
        aicc=aicc,
        parameters=parameters,
    )


def fit_selected_ets_endog(
    *,
    endog: np.ndarray,
    candidates: tuple[ETSCandidate, ...],
    sample_size: int,
    seasonal_periods: int = 12,
) -> ETSPathFit:
    failures: list[str] = []
    selected: ETSCandidateResult | None = None
    for candidate in candidates:
        try:
            candidate_result = fit_ets_candidate_endog(
                endog=endog,
                candidate=candidate,
                sample_size=sample_size,
                seasonal_periods=seasonal_periods,
            )
        except ModelForecastError as error:
            failures.append(f"{candidate.variant}={error.reason}")
            continue

        if selected is None or candidate_result.aicc < selected.aicc - AICC_TIE_TOLERANCE:
            selected = candidate_result

    if selected is None:
        failure_summary = "; ".join(failures) if failures else "no eligible ETS candidates"
        raise ModelForecastError(f"ALL_CANDIDATES_INVALID: {failure_summary}")

    return ETSPathFit(
        selected=selected,
        metadata=ForecastMetadata(
            model_family=ETSModelFamily.model_id,
            selected_variant=selected.candidate.variant,
            selected_parameters=selected.parameters,
            selection_score=selected.aicc,
            selection_metric="AICc",
            fit_status="SUCCEEDED",
            failure_reason=None,
        ),
    )