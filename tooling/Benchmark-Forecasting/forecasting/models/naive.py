from __future__ import annotations

from collections.abc import Sequence

from forecasting.contracts import ForecastMetadata, Frequency, ModelForecast, NativeCadenceExecutionPlan, Observation
from forecasting.models.base import ForecastModel
from forecasting.models.statsmodels_utils import validate_regular_history


class NaiveLastValueModel(ForecastModel):
    model_id = "naive"

    def __init__(
        self,
        frequency: Frequency = Frequency.MONTHLY,
        cadence_plan: NativeCadenceExecutionPlan | None = None,
    ) -> None:
        self.frequency = frequency
        self.cadence_plan = cadence_plan

    def forecast_with_metadata(self, history: Sequence[Observation], horizon_steps: int) -> ModelForecast:
        validate_regular_history(history, horizon_steps, 1, "Naive", self.frequency, self.cadence_plan)
        return ModelForecast(
            forecast_value=float(history[-1].value),
            metadata=ForecastMetadata(
                model_family=self.model_id,
                selected_variant="NAIVE_LAST_VALUE",
                selected_parameters={},
                fit_status="SUCCEEDED",
            ),
        )