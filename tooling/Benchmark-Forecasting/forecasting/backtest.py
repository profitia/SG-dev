from __future__ import annotations

from collections.abc import Sequence
from datetime import date

from forecasting.contracts import (
    BacktestFailure,
    BacktestRecord,
    BacktestRun,
    CurrentForecast,
    Frequency,
    NativeStepForecast,
    Observation,
    TimeSeries,
)
from forecasting.models.base import ForecastModel, ModelForecastError


def add_months(base_date: date, months: int) -> date:
    zero_based_month = base_date.month - 1 + months
    year = base_date.year + zero_based_month // 12
    month = zero_based_month % 12 + 1
    return date(year, month, 1)


def compute_mase_scale(history: list[Observation]) -> float:
    if len(history) < 2:
        raise ValueError("MASE requires at least two training observations.")
    diffs = [abs(current.value - previous.value) for previous, current in zip(history, history[1:])]
    return sum(diffs) / len(diffs)


def expected_origin_count(total_observations: int, horizon_steps: int, min_training_window: int) -> int:
    if total_observations < min_training_window + horizon_steps:
        return 0
    return total_observations - min_training_window - horizon_steps + 1


def generate_backtest_records(
    series: TimeSeries,
    model: ForecastModel,
    horizon_label: str,
    horizon_steps: int,
    min_training_window: int,
    validation_origin_dates: set[date] | None = None,
) -> BacktestRun:
    observations = list(series.observations)
    last_origin_index = len(observations) - horizon_steps
    origin_ends = [
        origin_end
        for origin_end in range(min_training_window, last_origin_index + 1)
        if validation_origin_dates is None or observations[origin_end - 1].date in validation_origin_dates
    ]
    expected_origins = len(origin_ends)
    if expected_origins == 0:
        return BacktestRun(expected_origins=0, records=(), failures=())

    records: list[BacktestRecord] = []
    failures: list[BacktestFailure] = []
    for origin_end in origin_ends:
        history = observations[:origin_end]
        forecast_observation = observations[origin_end + horizon_steps - 1]
        origin_value = history[-1].value
        try:
            model_forecast = model.forecast_with_metadata(history, horizon_steps)
        except ModelForecastError as error:
            failures.append(
                BacktestFailure(
                    benchmark_id=series.series_id,
                    model_id=model.model_id,
                    forecast_origin=history[-1].date,
                    horizon=horizon_label,
                    horizon_steps=horizon_steps,
                    forecast_date=forecast_observation.date,
                    failure_reason=error.reason,
                )
            )
            continue
        except Exception as error:
            failures.append(
                BacktestFailure(
                    benchmark_id=series.series_id,
                    model_id=model.model_id,
                    forecast_origin=history[-1].date,
                    horizon=horizon_label,
                    horizon_steps=horizon_steps,
                    forecast_date=forecast_observation.date,
                    failure_reason=f"UNEXPECTED_EXCEPTION: {error}",
                )
            )
            continue

        forecast_value = model_forecast.forecast_value
        error = forecast_value - forecast_observation.value
        delta = error
        delta_pct = None if forecast_observation.value == 0 else delta / forecast_observation.value
        records.append(
            BacktestRecord(
                benchmark_id=series.series_id,
                model_id=model.model_id,
                forecast_origin=history[-1].date,
                horizon=horizon_label,
                horizon_steps=horizon_steps,
                forecast_date=forecast_observation.date,
                origin_value=origin_value,
                forecast_value=forecast_value,
                actual_value=forecast_observation.value,
                error=error,
                absolute_error=abs(error),
                delta=delta,
                delta_pct=delta_pct,
                mase_scale=compute_mase_scale(history),
                metadata=model_forecast.metadata,
            )
        )
    return BacktestRun(
        expected_origins=expected_origins,
        records=tuple(records),
        failures=tuple(failures),
    )


def generate_current_forecast(
    series: TimeSeries,
    model: ForecastModel,
    horizon_label: str,
    horizon_steps: int,
    forecast_date: date | None = None,
) -> CurrentForecast:
    history = list(series.observations)
    if forecast_date is None:
        if series.frequency is not Frequency.MONTHLY:
            raise ValueError(
                f"B1 cadence target date is required for {series.frequency.value} current Forecast execution."
            )
        forecast_date = add_months(history[-1].date, horizon_steps)
    try:
        model_forecast = model.forecast_with_metadata(history, horizon_steps)
    except ModelForecastError as error:
        return CurrentForecast(
            horizon=horizon_label,
            horizon_steps=horizon_steps,
            forecast_date=forecast_date,
            forecast_value=None,
            metadata=None,
            failure_reason=error.reason,
        )
    except Exception as error:
        return CurrentForecast(
            horizon=horizon_label,
            horizon_steps=horizon_steps,
            forecast_date=forecast_date,
            forecast_value=None,
            metadata=None,
            failure_reason=f"UNEXPECTED_EXCEPTION: {error}",
        )

    return CurrentForecast(
        horizon=horizon_label,
        horizon_steps=horizon_steps,
        forecast_date=forecast_date,
        forecast_value=model_forecast.forecast_value,
        metadata=model_forecast.metadata,
        failure_reason=None,
    )


def generate_native_forecast_path(
    series: TimeSeries,
    model: ForecastModel,
    target_dates: Sequence[date],
) -> tuple[NativeStepForecast, ...]:
    if not target_dates:
        raise ValueError("Native Forecast path requires at least one B1 target date.")
    if any(current <= previous for previous, current in zip((series.end, *target_dates), target_dates)):
        raise ValueError("Native Forecast target dates must be strictly ordered after the Forecast origin.")

    path: list[NativeStepForecast] = []
    for step, target_date in enumerate(target_dates, start=1):
        point = generate_current_forecast(
            series=series,
            model=model,
            horizon_label=f"NATIVE_STEP_{step}",
            horizon_steps=step,
            forecast_date=target_date,
        )
        path.append(
            NativeStepForecast(
                horizon_steps=step,
                forecast_date=point.forecast_date,
                forecast_value=point.forecast_value,
                metadata=point.metadata,
                failure_reason=point.failure_reason,
            )
        )
    return tuple(path)