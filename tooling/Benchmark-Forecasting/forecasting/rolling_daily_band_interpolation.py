from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from forecasting.rolling_daily_contracts import BandSource, BandStatus, CalibrationSummary


INTERPOLATION_METHOD = "CALENDAR_TIME_LINEAR_INTERPOLATION"
INTERPOLATION_DOMAIN = "CALENDAR_TIME"


@dataclass(frozen=True)
class DailyBandInterpolationResult:
    lower_p10: float | None
    upper_p90: float | None
    p10_residual_offset: float | None
    p90_residual_offset: float | None
    band_status: BandStatus
    band_source: BandSource | None
    band_anchor_horizon: str | None
    left_anchor_horizon: str | None
    right_anchor_horizon: str | None
    interpolation_fraction: float | None


def _is_available_anchor(summary: CalibrationSummary | None) -> bool:
    return (
        summary is not None
        and summary.status is BandStatus.AVAILABLE
        and summary.residual_p10 is not None
        and summary.residual_p90 is not None
    )


def _exact_anchor_result(horizon_label: str, point_forecast: float, summary: CalibrationSummary | None) -> DailyBandInterpolationResult:
    if not _is_available_anchor(summary):
        status = BandStatus.NOT_AVAILABLE if summary is None else summary.status
        return DailyBandInterpolationResult(
            lower_p10=None,
            upper_p90=None,
            p10_residual_offset=None,
            p90_residual_offset=None,
            band_status=status,
            band_source=None,
            band_anchor_horizon=horizon_label,
            left_anchor_horizon=horizon_label,
            right_anchor_horizon=horizon_label,
            interpolation_fraction=None,
        )

    p10_residual_offset = float(summary.residual_p10)
    p90_residual_offset = float(summary.residual_p90)
    return DailyBandInterpolationResult(
        lower_p10=point_forecast + p10_residual_offset,
        upper_p90=point_forecast + p90_residual_offset,
        p10_residual_offset=p10_residual_offset,
        p90_residual_offset=p90_residual_offset,
        band_status=BandStatus.AVAILABLE,
        band_source=BandSource.EMPIRICAL_ANCHOR,
        band_anchor_horizon=horizon_label,
        left_anchor_horizon=horizon_label,
        right_anchor_horizon=horizon_label,
        interpolation_fraction=None,
    )


def interpolate_daily_band(
    *,
    origin_date: date | None = None,
    target_date: date,
    point_forecast: float,
    anchor_dates: dict[str, date],
    calibration_summaries: dict[str, CalibrationSummary] | None,
    ordered_horizons: list[tuple[str, int]],
) -> DailyBandInterpolationResult:
    if calibration_summaries is None or not ordered_horizons:
        return DailyBandInterpolationResult(
            lower_p10=None,
            upper_p90=None,
            p10_residual_offset=None,
            p90_residual_offset=None,
            band_status=BandStatus.NOT_AVAILABLE,
            band_source=None,
            band_anchor_horizon=None,
            left_anchor_horizon=None,
            right_anchor_horizon=None,
            interpolation_fraction=None,
        )

    first_horizon, _ = ordered_horizons[0]
    first_anchor_date = anchor_dates[first_horizon]
    first_summary = calibration_summaries.get(first_horizon)

    for horizon_label, _ in ordered_horizons:
        anchor_date = anchor_dates[horizon_label]
        if target_date == anchor_date:
            return _exact_anchor_result(horizon_label, point_forecast, calibration_summaries.get(horizon_label))

    if origin_date is not None and target_date == origin_date:
        return DailyBandInterpolationResult(
            lower_p10=point_forecast,
            upper_p90=point_forecast,
            p10_residual_offset=0.0,
            p90_residual_offset=0.0,
            band_status=BandStatus.AVAILABLE,
            band_source=BandSource.INTERPOLATED_BETWEEN_EMPIRICAL_ANCHORS,
            band_anchor_horizon=None,
            left_anchor_horizon="ORIGIN",
            right_anchor_horizon=first_horizon,
            interpolation_fraction=0.0,
        )
    if target_date < first_anchor_date:
        if origin_date is not None and origin_date < target_date and _is_available_anchor(first_summary):
            total_days = (first_anchor_date - origin_date).days
            elapsed_days = (target_date - origin_date).days
            fraction = elapsed_days / total_days
            p10_residual_offset = fraction * float(first_summary.residual_p10)
            p90_residual_offset = fraction * float(first_summary.residual_p90)
            return DailyBandInterpolationResult(
                lower_p10=point_forecast + p10_residual_offset,
                upper_p90=point_forecast + p90_residual_offset,
                p10_residual_offset=p10_residual_offset,
                p90_residual_offset=p90_residual_offset,
                band_status=BandStatus.AVAILABLE,
                band_source=BandSource.INTERPOLATED_BETWEEN_EMPIRICAL_ANCHORS,
                band_anchor_horizon=None,
                left_anchor_horizon="ORIGIN",
                right_anchor_horizon=first_horizon,
                interpolation_fraction=fraction,
            )
        return DailyBandInterpolationResult(
            lower_p10=None,
            upper_p90=None,
            p10_residual_offset=None,
            p90_residual_offset=None,
            band_status=BandStatus.NOT_AVAILABLE_BEFORE_FIRST_EMPIRICAL_ANCHOR,
            band_source=None,
            band_anchor_horizon=None,
            left_anchor_horizon=None,
            right_anchor_horizon=first_horizon,
            interpolation_fraction=None,
        )

    for index in range(len(ordered_horizons) - 1):
        left_horizon, _ = ordered_horizons[index]
        right_horizon, _ = ordered_horizons[index + 1]
        left_date = anchor_dates[left_horizon]
        right_date = anchor_dates[right_horizon]
        if not (left_date < target_date < right_date):
            continue

        left_summary = calibration_summaries.get(left_horizon)
        right_summary = calibration_summaries.get(right_horizon)
        if not _is_available_anchor(left_summary) or not _is_available_anchor(right_summary):
            return DailyBandInterpolationResult(
                lower_p10=None,
                upper_p90=None,
                p10_residual_offset=None,
                p90_residual_offset=None,
                band_status=BandStatus.NOT_AVAILABLE_INSUFFICIENT_ANCHOR_CALIBRATION,
                band_source=None,
                band_anchor_horizon=None,
                left_anchor_horizon=left_horizon,
                right_anchor_horizon=right_horizon,
                interpolation_fraction=None,
            )

        total_days = (right_date - left_date).days
        elapsed_days = (target_date - left_date).days
        fraction = elapsed_days / total_days
        p10_residual_offset = float(left_summary.residual_p10) + fraction * (float(right_summary.residual_p10) - float(left_summary.residual_p10))
        p90_residual_offset = float(left_summary.residual_p90) + fraction * (float(right_summary.residual_p90) - float(left_summary.residual_p90))
        return DailyBandInterpolationResult(
            lower_p10=point_forecast + p10_residual_offset,
            upper_p90=point_forecast + p90_residual_offset,
            p10_residual_offset=p10_residual_offset,
            p90_residual_offset=p90_residual_offset,
            band_status=BandStatus.AVAILABLE,
            band_source=BandSource.INTERPOLATED_BETWEEN_EMPIRICAL_ANCHORS,
            band_anchor_horizon=None,
            left_anchor_horizon=left_horizon,
            right_anchor_horizon=right_horizon,
            interpolation_fraction=fraction,
        )

    return DailyBandInterpolationResult(
        lower_p10=None,
        upper_p90=None,
        p10_residual_offset=None,
        p90_residual_offset=None,
        band_status=BandStatus.NOT_AVAILABLE,
        band_source=None,
        band_anchor_horizon=None,
        left_anchor_horizon=None,
        right_anchor_horizon=None,
        interpolation_fraction=None,
    )