from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date
from statistics import median, pstdev
from typing import Protocol, Sequence


DEFAULT_PATH_CHARACTERIZATION_TOLERANCE = 1e-9


class ForecastPathPointLike(Protocol):
    date: date
    point_forecast: float


@dataclass(frozen=True)
class PathCharacteristics:
    path_length: int
    unique_forecast_values: int
    min_forecast: float
    max_forecast: float
    forecast_range: float
    direction_changes: int
    median_absolute_daily_change: float
    maximum_absolute_daily_change: float
    path_volatility: float
    number_of_up_days: int
    number_of_down_days: int
    number_of_flat_days: int
    start_forecast: float
    end_forecast: float
    start_to_end_change: float
    start_to_end_pct_change: float | None
    direction_change_indexes: tuple[int, ...]


def _normalize_delta(value: float, tolerance: float) -> float:
    return 0.0 if abs(value) <= tolerance else value


def _within_tolerance(left: float, right: float, tolerance: float) -> bool:
    slack = max(1e-15, tolerance * 1e-6)
    return abs(left - right) <= tolerance + slack


def _count_unique_values(values: Sequence[float], tolerance: float) -> int:
    if not values:
        return 0

    ordered = sorted(values)
    unique = 1
    previous = ordered[0]
    for current in ordered[1:]:
        if not _within_tolerance(current, previous, tolerance):
            unique += 1
            previous = current
    return unique


def characterize_forecast_path(
    path: Sequence[ForecastPathPointLike],
    *,
    tolerance: float = DEFAULT_PATH_CHARACTERIZATION_TOLERANCE,
) -> PathCharacteristics:
    if tolerance < 0:
        raise ValueError("Path characterization tolerance must be non-negative.")
    if not path:
        raise ValueError("Forecast path characterization requires at least one path point.")

    previous_date: date | None = None
    values: list[float] = []
    for point in path:
        if previous_date is not None and point.date <= previous_date:
            raise ValueError("Forecast path dates must be strictly increasing.")
        previous_date = point.date

        value = float(point.point_forecast)
        if not math.isfinite(value):
            raise ValueError("Forecast path pointForecast values must be finite.")
        values.append(value)

    deltas = [
        _normalize_delta(current - previous, tolerance)
        for previous, current in zip(values, values[1:])
    ]
    absolute_deltas = [abs(delta) for delta in deltas]

    direction_changes = 0
    direction_change_indexes: list[int] = []
    last_non_zero_sign = 0
    for index, delta in enumerate(deltas, start=1):
        if delta == 0.0:
            continue
        current_sign = 1 if delta > 0 else -1
        if last_non_zero_sign != 0 and current_sign != last_non_zero_sign:
            direction_changes += 1
            direction_change_indexes.append(index)
        last_non_zero_sign = current_sign

    start_forecast = values[0]
    end_forecast = values[-1]
    start_to_end_change = end_forecast - start_forecast
    start_to_end_pct_change = None if abs(start_forecast) <= tolerance else start_to_end_change / start_forecast

    return PathCharacteristics(
        path_length=len(path),
        unique_forecast_values=_count_unique_values(values, tolerance),
        min_forecast=min(values),
        max_forecast=max(values),
        forecast_range=max(values) - min(values),
        direction_changes=direction_changes,
        median_absolute_daily_change=median(absolute_deltas) if absolute_deltas else 0.0,
        maximum_absolute_daily_change=max(absolute_deltas) if absolute_deltas else 0.0,
        path_volatility=pstdev(deltas) if deltas else 0.0,
        number_of_up_days=sum(delta > 0 for delta in deltas),
        number_of_down_days=sum(delta < 0 for delta in deltas),
        number_of_flat_days=sum(delta == 0 for delta in deltas),
        start_forecast=start_forecast,
        end_forecast=end_forecast,
        start_to_end_change=start_to_end_change,
        start_to_end_pct_change=start_to_end_pct_change,
        direction_change_indexes=tuple(direction_change_indexes),
    )