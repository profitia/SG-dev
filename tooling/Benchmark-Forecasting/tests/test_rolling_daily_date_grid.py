from __future__ import annotations

import unittest
from datetime import date

from forecasting.contracts import Observation
from forecasting.date_grid import add_calendar_months_clamped, resolve_latest_lawful_observation_on_or_before


def observation(day: str, value: float = 1.0) -> Observation:
    return Observation(date=date.fromisoformat(day), value=value)


class CalendarMonthClampTests(unittest.TestCase):
    def test_preserves_existing_day_of_month(self) -> None:
        self.assertEqual(add_calendar_months_clamped(date(2026, 1, 15), 1), date(2026, 2, 15))
        self.assertEqual(add_calendar_months_clamped(date(2026, 2, 15), 1), date(2026, 3, 15))

    def test_clamps_to_month_end_when_day_missing(self) -> None:
        self.assertEqual(add_calendar_months_clamped(date(2026, 1, 30), 1), date(2026, 2, 28))
        self.assertEqual(add_calendar_months_clamped(date(2026, 1, 31), 1), date(2026, 2, 28))
        self.assertEqual(add_calendar_months_clamped(date(2024, 1, 31), 1), date(2024, 2, 29))

    def test_handles_multi_month_rolls(self) -> None:
        self.assertEqual(add_calendar_months_clamped(date(2026, 1, 31), 2), date(2026, 3, 31))
        self.assertEqual(add_calendar_months_clamped(date(2026, 3, 31), 1), date(2026, 4, 30))
        self.assertEqual(add_calendar_months_clamped(date(2026, 8, 31), 6), date(2027, 2, 28))

    def test_handles_year_boundary_and_twelve_month_horizon(self) -> None:
        self.assertEqual(add_calendar_months_clamped(date(2026, 12, 15), 1), date(2027, 1, 15))
        self.assertEqual(add_calendar_months_clamped(date(2025, 2, 28), 12), date(2026, 2, 28))


class ObservationResolutionTests(unittest.TestCase):
    def test_returns_exact_target_observation_when_present(self) -> None:
        observations = [
            observation("2026-02-13", 10.0),
            observation("2026-02-14", 11.0),
            observation("2026-02-15", 12.0),
        ]
        resolved = resolve_latest_lawful_observation_on_or_before(observations, date(2026, 2, 15))
        self.assertEqual(resolved, observations[2])

    def test_returns_latest_observation_before_target_when_missing(self) -> None:
        observations = [
            observation("2026-02-13", 10.0),
            observation("2026-02-14", 11.0),
            observation("2026-02-18", 12.0),
        ]
        resolved = resolve_latest_lawful_observation_on_or_before(observations, date(2026, 2, 15))
        self.assertEqual(resolved, observations[1])

    def test_never_selects_observation_after_target(self) -> None:
        observations = [
            observation("2026-02-13", 10.0),
            observation("2026-02-18", 12.0),
        ]
        resolved = resolve_latest_lawful_observation_on_or_before(observations, date(2026, 2, 15))
        self.assertEqual(resolved, observations[0])

    def test_returns_none_when_no_prior_lawful_observation_exists(self) -> None:
        observations = [
            observation("2026-02-18", 12.0),
            observation("2026-02-20", 13.0),
        ]
        self.assertIsNone(resolve_latest_lawful_observation_on_or_before(observations, date(2026, 2, 15)))

    def test_handles_weekend_like_gaps(self) -> None:
        observations = [
            observation("2026-02-13", 10.0),
            observation("2026-02-16", 11.0),
            observation("2026-02-17", 12.0),
        ]
        resolved = resolve_latest_lawful_observation_on_or_before(observations, date(2026, 2, 15))
        self.assertEqual(resolved, observations[0])

    def test_returns_friday_for_saturday_target(self) -> None:
        observations = [
            observation("2026-03-13", 10.0),
            observation("2026-03-16", 11.0),
        ]
        resolved = resolve_latest_lawful_observation_on_or_before(observations, date(2026, 3, 14))
        self.assertEqual(resolved, observations[0])

    def test_returns_friday_for_sunday_target(self) -> None:
        observations = [
            observation("2026-03-13", 10.0),
            observation("2026-03-16", 11.0),
        ]
        resolved = resolve_latest_lawful_observation_on_or_before(observations, date(2026, 3, 15))
        self.assertEqual(resolved, observations[0])

    def test_handles_larger_source_gaps(self) -> None:
        observations = [
            observation("2026-02-01", 10.0),
            observation("2026-02-10", 11.0),
            observation("2026-03-05", 12.0),
        ]
        resolved = resolve_latest_lawful_observation_on_or_before(observations, date(2026, 2, 28))
        self.assertEqual(resolved, observations[1])


if __name__ == "__main__":
    unittest.main()