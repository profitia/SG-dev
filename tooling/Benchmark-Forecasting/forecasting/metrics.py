from __future__ import annotations

import math
from collections.abc import Sequence

import numpy as np

from forecasting.contracts import BacktestRecord, MetricsSummary


def _direction(value: float) -> int:
    if value > 0:
        return 1
    if value < 0:
        return -1
    return 0


def mae(records: Sequence[BacktestRecord]) -> float:
    return float(np.mean([record.absolute_error for record in records]))


def rmse(records: Sequence[BacktestRecord]) -> float:
    return float(math.sqrt(np.mean([record.error ** 2 for record in records])))


def mase(records: Sequence[BacktestRecord]) -> float:
    scaled_errors: list[float] = []
    for record in records:
        if record.mase_scale == 0:
            scaled_errors.append(0.0 if record.absolute_error == 0 else math.inf)
            continue
        scaled_errors.append(record.absolute_error / record.mase_scale)
    return float(np.mean(scaled_errors))


def smape(records: Sequence[BacktestRecord]) -> float:
    values: list[float] = []
    for record in records:
        denominator = abs(record.actual_value) + abs(record.forecast_value)
        if denominator == 0:
            values.append(0.0)
            continue
        values.append((2.0 * abs(record.forecast_value - record.actual_value) / denominator) * 100.0)
    return float(np.mean(values))


def directional_accuracy(records: Sequence[BacktestRecord]) -> float:
    correct = 0
    for record in records:
        predicted_direction = _direction(record.forecast_value - record.origin_value)
        actual_direction = _direction(record.actual_value - record.origin_value)
        if predicted_direction == actual_direction:
            correct += 1
    return float(correct / len(records)) if records else 0.0


def bias(records: Sequence[BacktestRecord]) -> float:
    return float(np.mean([record.error for record in records]))


def summarize_metrics(records: Sequence[BacktestRecord]) -> MetricsSummary:
    if not records:
        raise ValueError("Cannot summarize metrics for an empty backtest record set.")
    return MetricsSummary(
        mae=mae(records),
        rmse=rmse(records),
        mase=mase(records),
        smape=smape(records),
        directional_accuracy=directional_accuracy(records),
        bias=bias(records),
    )