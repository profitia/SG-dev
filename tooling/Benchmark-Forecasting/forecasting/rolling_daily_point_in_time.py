from __future__ import annotations

import math
from bisect import bisect_right
from dataclasses import dataclass, field
from datetime import date, timedelta
from time import perf_counter
from typing import Protocol

from forecasting.backtest import compute_mase_scale
from forecasting.rolling_daily_band_interpolation import interpolate_daily_band
from forecasting.rolling_daily_calibration import empirical_quantile_type7
from forecasting.contracts import ForecastMetadata, Frequency, Observation, TimeSeries
from forecasting.date_grid import add_calendar_months_clamped, resolve_latest_lawful_observation_on_or_before
from forecasting.metrics import summarize_metrics
from forecasting.models.base import ForecastModel, ModelForecastError
from forecasting.models.arima import ARIMAModelFamily, fit_selected_arima_endog
from forecasting.models.damped_holt import fit_damped_holt_endog
from forecasting.models.ets import ETS_CANDIDATE_CATALOG, fit_selected_ets_endog
from forecasting.models.statsmodels_utils import validate_history_values
from forecasting.rolling_daily_contracts import (
    BandStatus,
    CalibrationSummary,
    ForecastAnchorPoint,
    ForecastAvailabilityStatus,
    ForecastPathPoint,
    MaturityStatus,
    RollingDailyBacktestFailure,
    RollingDailyBacktestRecord,
    RollingDailyBenchmarkResult,
    RollingDailyCurrentForecast,
    RollingDailyHorizonBacktestResult,
)
from forecasting.rolling_daily_policy import (
    ROLLING_DAILY_DEFAULT_CONFIGURED_CALIBRATION_MINIMUM_SAMPLES,
    ROLLING_DAILY_DEFAULT_TECHNICAL_MINIMUM_TRAINING_OBSERVATIONS,
    ROLLING_DAILY_POINT_IN_TIME_METHOD_ID,
    ROLLING_DAILY_PROJECTION_CALENDAR_STRATEGY_V1,
)


HISTORICAL_FORECAST_ORIGIN_START_DATE = date(2024, 1, 1)
DEFAULT_ANCHOR_HORIZONS: dict[str, int] = {
    "1M": 1,
    "3M": 3,
    "6M": 6,
    "12M": 12,
}
NON_SEASONAL_ETS_CANDIDATES = tuple(candidate for candidate in ETS_CANDIDATE_CATALOG if candidate.seasonal is None)


class _PathFit(Protocol):
    metadata: ForecastMetadata

    def forecast_path(self, horizon_steps: int) -> tuple[float, ...]:
        ...


@dataclass(frozen=True)
class _NaivePathFit:
    last_value: float
    metadata: ForecastMetadata

    def forecast_path(self, horizon_steps: int) -> tuple[float, ...]:
        return tuple(self.last_value for _ in range(horizon_steps))


@dataclass(frozen=True)
class RollingDailyPointInTimeConfig:
    minimum_training_observations: int = ROLLING_DAILY_DEFAULT_TECHNICAL_MINIMUM_TRAINING_OBSERVATIONS
    minimum_calibration_samples: int = ROLLING_DAILY_DEFAULT_CONFIGURED_CALIBRATION_MINIMUM_SAMPLES
    max_horizon_months: int = 12
    historical_forecast_origin_start_date: date = HISTORICAL_FORECAST_ORIGIN_START_DATE
    anchor_horizons: dict[str, int] = field(default_factory=lambda: dict(DEFAULT_ANCHOR_HORIZONS))


def _validate_daily_history(series: TimeSeries, minimum_training_observations: int) -> str | None:
    if series.frequency is not Frequency.DAILY:
        return ForecastAvailabilityStatus.UNSUPPORTED_FREQUENCY.value
    if series.observation_count < minimum_training_observations:
        return ForecastAvailabilityStatus.INSUFFICIENT_HISTORY.value

    seen_dates: set[date] = set()
    previous_date: date | None = None
    for observation in series.observations:
        if observation.date in seen_dates:
            return "FAILED: Duplicate DAILY observation date."
        seen_dates.add(observation.date)
        if previous_date is not None and observation.date <= previous_date:
            return "FAILED: DAILY observations must be strictly increasing by date."
        previous_date = observation.date

    return None


def infer_supported_weekdays(observations: tuple[Observation, ...]) -> tuple[int, ...]:
    supported = sorted({observation.date.weekday() for observation in observations})
    if not supported:
        raise ValueError("Cannot infer lawful DAILY projection weekdays from an empty history.")
    return tuple(supported)


def _build_projected_step_counts(
    origin_date: date,
    max_target_date: date,
    supported_weekdays: tuple[int, ...],
) -> tuple[list[date], dict[date, int]]:
    calendar_dates: list[date] = []
    step_counts: dict[date, int] = {}
    current = origin_date + timedelta(days=1)
    step_count = 0
    while current <= max_target_date:
        if current.weekday() in supported_weekdays:
            step_count += 1
        calendar_dates.append(current)
        step_counts[current] = step_count
        current += timedelta(days=1)
    return calendar_dates, step_counts


def _count_actual_steps_to_target(observations: tuple[Observation, ...], origin_index: int, target_date: date) -> int:
    future_dates = [observation.date for observation in observations[origin_index + 1:]]
    return bisect_right(future_dates, target_date)


def _band_status_from_summary(summary: CalibrationSummary | None) -> BandStatus:
    if summary is None:
        return BandStatus.NOT_AVAILABLE
    return summary.status


def empirical_quantile(values: list[float], probability: float) -> float:
    return empirical_quantile_type7(values, probability)


def build_calibration_summaries(
    backtest_results: dict[str, RollingDailyHorizonBacktestResult],
    calibration_cutoff: date,
    minimum_calibration_samples: int,
) -> dict[str, CalibrationSummary]:
    summaries: dict[str, CalibrationSummary] = {}
    for horizon, result in backtest_results.items():
        residuals: list[float] = []
        for record in result.records:
            maturity_status = getattr(record, "maturity_status", MaturityStatus.MATURED)
            if maturity_status is not MaturityStatus.MATURED:
                continue
            if record.verification_observation_date is None or record.verification_observation_date > calibration_cutoff:
                continue
            if record.actual_value is None:
                continue
            residual = record.actual_value - record.forecast_value
            if not math.isfinite(residual):
                continue
            residuals.append(residual)

        if len(residuals) < minimum_calibration_samples:
            summaries[horizon] = CalibrationSummary(
                horizon=horizon,
                sample_count=len(residuals),
                residual_p10=None,
                residual_p90=None,
                status=BandStatus.INSUFFICIENT_CALIBRATION_HISTORY,
            )
            continue

        summaries[horizon] = CalibrationSummary(
            horizon=horizon,
            sample_count=len(residuals),
            residual_p10=empirical_quantile_type7(residuals, 0.10),
            residual_p90=empirical_quantile_type7(residuals, 0.90),
            status=BandStatus.AVAILABLE,
        )
    return summaries


def _resolve_band(
    point_forecast: float,
    horizon_label: str,
    calibration_summaries: dict[str, CalibrationSummary] | None,
) -> tuple[float | None, float | None, BandStatus]:
    if calibration_summaries is None:
        return None, None, BandStatus.NOT_AVAILABLE
    summary = calibration_summaries.get(horizon_label)
    if summary is None or summary.status is not BandStatus.AVAILABLE:
        return None, None, _band_status_from_summary(summary)
    return (
        point_forecast + float(summary.residual_p10),
        point_forecast + float(summary.residual_p90),
        BandStatus.AVAILABLE,
    )


def _fit_naive_path(history: tuple[Observation, ...]) -> _NaivePathFit:
    return _NaivePathFit(
        last_value=float(history[-1].value),
        metadata=ForecastMetadata(
            model_family="naive",
            selected_variant="NAIVE_LAST_VALUE",
            selected_parameters={},
            fit_status="SUCCEEDED",
        ),
    )


def fit_path_model(model: ForecastModel, history: tuple[Observation, ...]) -> _PathFit:
    if model.model_id == "naive":
        return _fit_naive_path(history)

    if model.model_id == "damped_holt":
        endog = validate_history_values(history, 1, 2, "Damped Holt")
        return fit_damped_holt_endog(endog)

    if model.model_id == "ets":
        endog = validate_history_values(history, 1, 2, "ETS")
        return fit_selected_ets_endog(
            endog=endog,
            candidates=NON_SEASONAL_ETS_CANDIDATES,
            sample_size=len(history),
            seasonal_periods=0,
        )

    if model.model_id == "arima":
        endog = validate_history_values(history, 1, ARIMAModelFamily.min_history, "ARIMA")
        return fit_selected_arima_endog(
            endog=endog,
            sample_size=len(history),
        )

    raise ModelForecastError(f"MODEL_NOT_AVAILABLE: {model.model_id} is not enabled for {ROLLING_DAILY_POINT_IN_TIME_METHOD_ID}.")


class RollingDailyPointInTimeService:
    def __init__(self, model: ForecastModel, config: RollingDailyPointInTimeConfig | None = None) -> None:
        self._model = model
        self._config = config or RollingDailyPointInTimeConfig()

    def generate_backtest(
        self,
        series: TimeSeries,
        validation_origin_start_date: date | None = None,
        validation_origin_dates: set[date] | None = None,
    ) -> dict[str, RollingDailyHorizonBacktestResult]:
        validation_error = _validate_daily_history(series, self._config.minimum_training_observations)
        if validation_error is not None:
            return {
                horizon: RollingDailyHorizonBacktestResult(
                    origins=0,
                    expected_origins=0,
                    failed_origins=0,
                    coverage=0.0,
                    records=(),
                    failures=(),
                    metrics=None,
                )
                for horizon in self._config.anchor_horizons
            }

        observations = series.observations
        source_last_observation_date = observations[-1].date
        expected_counts = {horizon: 0 for horizon in self._config.anchor_horizons}
        records: dict[str, list[RollingDailyBacktestRecord]] = {horizon: [] for horizon in self._config.anchor_horizons}
        failures: dict[str, list[RollingDailyBacktestFailure]] = {horizon: [] for horizon in self._config.anchor_horizons}

        for origin_index in range(self._config.minimum_training_observations - 1, len(observations)):
            history = observations[:origin_index + 1]
            origin_date = history[-1].date
            origin_value = history[-1].value

            if origin_date < self._config.historical_forecast_origin_start_date:
                continue
            if validation_origin_start_date is not None and origin_date < validation_origin_start_date:
                continue
            if validation_origin_dates is not None and origin_date not in validation_origin_dates:
                continue

            supported_weekdays = infer_supported_weekdays(history)
            max_target_date = add_calendar_months_clamped(origin_date, self._config.max_horizon_months)
            _, step_counts = _build_projected_step_counts(origin_date, max_target_date, supported_weekdays)

            plans: list[tuple[str, int, date, int, MaturityStatus, Observation | None]] = []
            for horizon_label, horizon_months in self._config.anchor_horizons.items():
                target_calendar_date = add_calendar_months_clamped(origin_date, horizon_months)
                projected_steps = step_counts[target_calendar_date]
                if projected_steps < 1:
                    continue
                expected_counts[horizon_label] += 1
                maturity_status = (
                    MaturityStatus.MATURED
                    if target_calendar_date <= source_last_observation_date
                    else MaturityStatus.NOT_YET_MATURED
                )
                verification_observation = None
                if maturity_status is MaturityStatus.MATURED:
                    verification_observation = resolve_latest_lawful_observation_on_or_before(
                        observations[origin_index + 1:],
                        target_calendar_date,
                    )
                    if verification_observation is None:
                        failures[horizon_label].append(
                            RollingDailyBacktestFailure(
                                benchmark_id=series.series_id,
                                model_id=self._model.model_id,
                                method_id=ROLLING_DAILY_POINT_IN_TIME_METHOD_ID,
                                forecast_origin=origin_date,
                                horizon=horizon_label,
                                horizon_months=horizon_months,
                                target_calendar_date=target_calendar_date,
                                verification_observation_date=None,
                                failure_reason="FAILED: No lawful verification observation on or before matured target date.",
                            )
                        )
                        continue
                plans.append((horizon_label, horizon_months, target_calendar_date, projected_steps, maturity_status, verification_observation))

            if not plans:
                continue

            try:
                fit = fit_path_model(self._model, history)
                max_steps = max(plan[3] for plan in plans)
                forecast_values = fit.forecast_path(max_steps)
            except ModelForecastError as error:
                for horizon_label, horizon_months, target_calendar_date, _, _, verification_observation in plans:
                    failures[horizon_label].append(
                        RollingDailyBacktestFailure(
                            benchmark_id=series.series_id,
                            model_id=self._model.model_id,
                            method_id=ROLLING_DAILY_POINT_IN_TIME_METHOD_ID,
                            forecast_origin=origin_date,
                            horizon=horizon_label,
                            horizon_months=horizon_months,
                            target_calendar_date=target_calendar_date,
                            verification_observation_date=verification_observation.date,
                            failure_reason=error.reason,
                        )
                    )
                continue

            mase_scale = compute_mase_scale(list(history))
            for horizon_label, horizon_months, target_calendar_date, projected_steps, maturity_status, verification_observation in plans:
                forecast_value = forecast_values[projected_steps - 1]
                actual_value = None if verification_observation is None else verification_observation.value
                error = None if actual_value is None else forecast_value - actual_value
                residual = None if actual_value is None else actual_value - forecast_value
                absolute_error = None if error is None else abs(error)
                delta_pct = None if actual_value in (None, 0) or error is None else error / actual_value
                records[horizon_label].append(
                    RollingDailyBacktestRecord(
                        benchmark_id=series.series_id,
                        model_id=self._model.model_id,
                        method_id=ROLLING_DAILY_POINT_IN_TIME_METHOD_ID,
                        forecast_origin=origin_date,
                        horizon=horizon_label,
                        horizon_months=horizon_months,
                        horizon_steps=projected_steps,
                        target_calendar_date=target_calendar_date,
                        verification_observation_date=None if verification_observation is None else verification_observation.date,
                        forecast_date=target_calendar_date,
                        origin_value=origin_value,
                        forecast_value=forecast_value,
                        actual_value=actual_value,
                        error=error,
                        residual=residual,
                        absolute_error=absolute_error,
                        delta=error,
                        delta_pct=delta_pct,
                        mase_scale=mase_scale,
                        metadata=fit.metadata,
                        maturity_status=maturity_status,
                    )
                )

        results: dict[str, RollingDailyHorizonBacktestResult] = {}
        for horizon in self._config.anchor_horizons:
            horizon_records = tuple(records[horizon])
            horizon_failures = tuple(failures[horizon])
            expected_origins = expected_counts[horizon]
            matured_records = tuple(record for record in horizon_records if record.maturity_status is MaturityStatus.MATURED)
            successful_origins = len(horizon_records)
            results[horizon] = RollingDailyHorizonBacktestResult(
                origins=successful_origins,
                expected_origins=expected_origins,
                failed_origins=len(horizon_failures),
                coverage=0.0 if expected_origins == 0 else successful_origins / expected_origins,
                records=horizon_records,
                failures=horizon_failures,
                metrics=summarize_metrics(matured_records) if matured_records else None,
            )
        return results

    def generate_current_forecast(
        self,
        series: TimeSeries,
        calibration_summaries: dict[str, CalibrationSummary] | None = None,
    ) -> RollingDailyCurrentForecast:
        validation_error = _validate_daily_history(series, self._config.minimum_training_observations)
        origin_date = series.end
        if validation_error is not None:
            status_text = validation_error.split(":", 1)[0]
            return RollingDailyCurrentForecast(
                method=ROLLING_DAILY_POINT_IN_TIME_METHOD_ID,
                model=self._model.model_id,
                origin_date=origin_date,
                max_horizon_months=self._config.max_horizon_months,
                frequency=series.frequency,
                status=ForecastAvailabilityStatus(status_text),
                forecast_path=(),
                anchors={},
                metadata=None,
                calendar_projection_mode=ROLLING_DAILY_PROJECTION_CALENDAR_STRATEGY_V1,
                failure_reason=validation_error,
            )

        supported_weekdays = infer_supported_weekdays(series.observations)
        max_target_date = add_calendar_months_clamped(origin_date, self._config.max_horizon_months)
        calendar_dates, step_counts = _build_projected_step_counts(origin_date, max_target_date, supported_weekdays)

        try:
            fit = fit_path_model(self._model, series.observations)
            max_steps = max(step_counts.values(), default=0)
            forecast_values = fit.forecast_path(max_steps) if max_steps > 0 else ()
        except ModelForecastError as error:
            failure_status = ForecastAvailabilityStatus.MODEL_NOT_AVAILABLE if error.reason.startswith("MODEL_NOT_AVAILABLE") else ForecastAvailabilityStatus.FAILED
            return RollingDailyCurrentForecast(
                method=ROLLING_DAILY_POINT_IN_TIME_METHOD_ID,
                model=self._model.model_id,
                origin_date=origin_date,
                max_horizon_months=self._config.max_horizon_months,
                frequency=series.frequency,
                status=failure_status,
                forecast_path=(),
                anchors={},
                metadata=None,
                calendar_projection_mode=ROLLING_DAILY_PROJECTION_CALENDAR_STRATEGY_V1,
                failure_reason=error.reason,
            )

        anchor_thresholds = {
            horizon: add_calendar_months_clamped(origin_date, horizon_months)
            for horizon, horizon_months in self._config.anchor_horizons.items()
        }
        ordered_horizons = sorted(self._config.anchor_horizons.items(), key=lambda item: item[1])

        forecast_path: list[ForecastPathPoint] = []
        origin_value = float(series.observations[-1].value)
        for target_date in calendar_dates:
            projected_steps = step_counts[target_date]
            point_forecast = origin_value if projected_steps == 0 else forecast_values[projected_steps - 1]
            band = interpolate_daily_band(
                origin_date=origin_date,
                target_date=target_date,
                point_forecast=point_forecast,
                anchor_dates=anchor_thresholds,
                calibration_summaries=calibration_summaries,
                ordered_horizons=ordered_horizons,
            )
            forecast_path.append(
                ForecastPathPoint(
                    date=target_date,
                    point_forecast=point_forecast,
                    lower_p10=band.lower_p10,
                    upper_p90=band.upper_p90,
                    band_status=band.band_status,
                    band_anchor_horizon=band.band_anchor_horizon,
                    p10_residual_offset=band.p10_residual_offset,
                    p90_residual_offset=band.p90_residual_offset,
                    band_source=band.band_source,
                    left_anchor_horizon=band.left_anchor_horizon,
                    right_anchor_horizon=band.right_anchor_horizon,
                    interpolation_fraction=band.interpolation_fraction,
                )
            )

        anchors: dict[str, ForecastAnchorPoint] = {}
        for horizon_label, horizon_months in ordered_horizons:
            target_date = anchor_thresholds[horizon_label]
            projected_steps = step_counts[target_date]
            forecast_value = origin_value if projected_steps == 0 else forecast_values[projected_steps - 1]
            band = interpolate_daily_band(
                origin_date=origin_date,
                target_date=target_date,
                point_forecast=forecast_value,
                anchor_dates=anchor_thresholds,
                calibration_summaries=calibration_summaries,
                ordered_horizons=ordered_horizons,
            )
            anchors[horizon_label] = ForecastAnchorPoint(
                horizon=horizon_label,
                horizon_months=horizon_months,
                target_calendar_date=target_date,
                projected_step_count=projected_steps,
                forecast_value=forecast_value,
                lower_p10=band.lower_p10,
                upper_p90=band.upper_p90,
                band_status=band.band_status,
                p10_residual_offset=band.p10_residual_offset,
                p90_residual_offset=band.p90_residual_offset,
                band_source=band.band_source,
            )

        return RollingDailyCurrentForecast(
            method=ROLLING_DAILY_POINT_IN_TIME_METHOD_ID,
            model=self._model.model_id,
            origin_date=origin_date,
            max_horizon_months=self._config.max_horizon_months,
            frequency=series.frequency,
            status=ForecastAvailabilityStatus.AVAILABLE,
            forecast_path=tuple(forecast_path),
            anchors=anchors,
            metadata=fit.metadata,
            calendar_projection_mode=ROLLING_DAILY_PROJECTION_CALENDAR_STRATEGY_V1,
        )

    def run_series(self, series: TimeSeries) -> RollingDailyBenchmarkResult:
        started_at = perf_counter()
        backtest = self.generate_backtest(series)
        current = self.generate_current_forecast(
            series,
            calibration_summaries=build_calibration_summaries(
                backtest_results=backtest,
                calibration_cutoff=series.end,
                minimum_calibration_samples=self._config.minimum_calibration_samples,
            ),
        )
        return RollingDailyBenchmarkResult(
            benchmark_id=series.series_id,
            component=series.benchmark_name,
            description=series.description,
            frequency=series.frequency,
            model_id=self._model.model_id,
            method_id=ROLLING_DAILY_POINT_IN_TIME_METHOD_ID,
            history=series,
            backtest=backtest,
            current_forecast=current,
            runtime_seconds=perf_counter() - started_at,
        )