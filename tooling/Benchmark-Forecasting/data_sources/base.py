from __future__ import annotations

from abc import ABC, abstractmethod

from forecasting.contracts import BenchmarkDefinition, TimeSeries


class HistoricalSeriesSource(ABC):
    @abstractmethod
    def load_series(self, benchmark: BenchmarkDefinition, run_id: str) -> TimeSeries:
        raise NotImplementedError