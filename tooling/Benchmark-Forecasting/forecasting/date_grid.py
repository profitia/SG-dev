from __future__ import annotations

from bisect import bisect_right
from calendar import monthrange
from collections.abc import Sequence
from datetime import date

from forecasting.contracts import Observation


def add_calendar_months_clamped(base_date: date, months: int) -> date:
    zero_based_month = (base_date.month - 1) + months
    year = base_date.year + zero_based_month // 12
    month = zero_based_month % 12 + 1
    day = min(base_date.day, monthrange(year, month)[1])
    return date(year, month, day)


def resolve_latest_lawful_observation_on_or_before(
    observations: Sequence[Observation],
    target_date: date,
) -> Observation | None:
    if not observations:
        return None

    ordered_dates = [observation.date for observation in observations]
    resolved_index = bisect_right(ordered_dates, target_date) - 1
    if resolved_index < 0:
        return None
    return observations[resolved_index]