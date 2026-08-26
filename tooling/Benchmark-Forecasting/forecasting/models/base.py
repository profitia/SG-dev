from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Sequence

from forecasting.contracts import ModelForecast, Observation


AICC_TIE_TOLERANCE = 1e-9


class ModelForecastError(RuntimeError):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class ForecastModel(ABC):
    model_id: str

    def forecast(self, history: Sequence[Observation], horizon_steps: int) -> float:
        return self.forecast_with_metadata(history, horizon_steps).forecast_value

    @abstractmethod
    def forecast_with_metadata(self, history: Sequence[Observation], horizon_steps: int) -> ModelForecast:
        raise NotImplementedError