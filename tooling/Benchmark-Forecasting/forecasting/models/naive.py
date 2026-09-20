from __future__ import annotations

from collections.abc import Sequence

from forecasting.contracts import ForecastMetadata, Frequency, ModelForecast, NativeCadenceExecutionPlan, Observation
from forecasting.models.base import ForecastModel
from forecasting.models.statsmodels_utils import validate_regular_history
from forecasting.training_policy import resolve_period_model_minimum_training_observations
from forecasting.uncertainty_bands import build_naive_model_native_band


class NaiveLastValueModel(ForecastModel):
    model_id = "naive"
    min_history = resolve_period_model_minimum_training_observations(model_id)

    def __init__(
        self,
        frequency: Frequency = Frequency.MONTHLY,
        cadence_plan: NativeCadenceExecutionPlan | None = None,
    ) -> None:
        self.frequency = frequency
        self.cadence_plan = cadence_plan

    def forecast_with_metadata(self, history: Sequence[Observation], horizon_steps: int) -> ModelForecast:
        validate_regular_history(history, horizon_steps, self.min_history, "Naive", self.frequency, self.cadence_plan)
        return ModelForecast(
            forecast_value=float(history[-1].value),
            metadata=ForecastMetadata(
                model_family=self.model_id,
                selected_variant="NAIVE_LAST_VALUE",
                selected_parameters={},
                fit_status="SUCCEEDED",
            ),
        )

    def forecast_with_uncertainty(self, history: Sequence[Observation], horizon_steps: int) -> ModelForecast:
        forecast = self.forecast_with_metadata(history, horizon_steps)
        return ModelForecast(
            forecast_value=forecast.forecast_value,
            metadata=ForecastMetadata(
                model_family=forecast.metadata.model_family,
                selected_variant=forecast.metadata.selected_variant,
                selected_parameters=forecast.metadata.selected_parameters,
                selection_score=forecast.metadata.selection_score,
                selection_metric=forecast.metadata.selection_metric,
                fit_status=forecast.metadata.fit_status,
                failure_reason=forecast.metadata.failure_reason,
                uncertainty_band=build_naive_model_native_band(
                    history_values=(observation.value for observation in history),
                    point_forecast=forecast.forecast_value,
                    horizon_steps=horizon_steps,
                ),
            ),
        )
