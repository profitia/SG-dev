from __future__ import annotations

import unittest

from forecasting.history_fingerprint import build_history_fingerprint


def create_average_history() -> dict:
    return {
        "seriesId": "wocaes0074",
        "benchmarkName": "Brent, Spot, FOB North Sea",
        "description": "Brent, Spot, FOB North Sea",
        "frequency": "MONTHLY",
        "start": "2026-01-01T00:00:00.000Z",
        "end": "2026-02-01T00:00:00.000Z",
        "observations": 2,
        "canonicalization": {
            "method": "AVERAGE_OF_LAWFUL_DAILY_OBSERVATIONS",
            "version": "daily-market-price-monthly-average-v2",
        },
        "points": [
            {"date": "2026-01-01T00:00:00.000Z", "value": 20.0},
            {"date": "2026-02-01T00:00:00.000Z", "value": 30.0},
        ],
    }


def create_end_of_period_history() -> dict:
    history = create_average_history()
    history["canonicalization"] = {
        "method": "LAST_LAWFUL_OBSERVATION_IN_CLOSED_PERIOD",
        "version": "daily-market-price-end-of-period-v1",
    }
    history["points"] = [
        {"date": "2026-01-01T00:00:00.000Z", "value": 20.0, "sourceObservedAt": "2026-01-30T00:00:00.000Z"},
        {"date": "2026-02-01T00:00:00.000Z", "value": 30.0, "sourceObservedAt": "2026-02-27T00:00:00.000Z"},
    ]
    return history


class HistoryFingerprintTests(unittest.TestCase):
    def test_monthly_date_only_and_iso_hash_identically(self) -> None:
        iso = create_average_history()
        date_only = {
            **iso,
            "start": "2026-01-01",
            "end": "2026-02-01",
            "points": [
                {"date": "2026-01-01", "value": 20.0},
                {"date": "2026-02-01", "value": 30.0},
            ],
        }
        timezone_variant = {
            **iso,
            "start": "2026-01-01T00:00:00Z",
            "end": "2026-02-01T00:00:00Z",
            "points": [
                {"date": "2026-01-01T00:00:00Z", "value": 20.0},
                {"date": "2026-02-01T00:00:00Z", "value": 30.0},
            ],
        }

        expected = build_history_fingerprint(iso)
        self.assertEqual(build_history_fingerprint(date_only), expected)
        self.assertEqual(build_history_fingerprint(timezone_variant), expected)

    def test_monthly_fingerprint_is_order_stable(self) -> None:
        ordered = create_average_history()
        reversed_points = {**ordered, "points": list(reversed(ordered["points"]))}
        self.assertEqual(build_history_fingerprint(reversed_points), build_history_fingerprint(ordered))

    def test_invalid_mid_month_period_fails_closed(self) -> None:
        invalid = create_average_history()
        invalid["end"] = "2026-01-15"
        invalid["observations"] = 1
        invalid["points"] = [{"date": "2026-01-15", "value": 20.0}]

        with self.assertRaisesRegex(ValueError, "canonical MONTHLY period"):
            build_history_fingerprint(invalid)

    def test_eop_date_only_and_iso_provenance_hash_identically(self) -> None:
        iso = create_end_of_period_history()
        date_only = {
            **iso,
            "start": "2026-01-01",
            "end": "2026-02-01",
            "points": [
                {"date": "2026-01-01", "value": 20.0, "sourceObservedAt": "2026-01-30"},
                {"date": "2026-02-01", "value": 30.0, "sourceObservedAt": "2026-02-27"},
            ],
        }

        self.assertEqual(build_history_fingerprint(date_only), build_history_fingerprint(iso))

    def test_eop_fingerprint_remains_provenance_and_value_sensitive(self) -> None:
        baseline = create_end_of_period_history()
        provenance_shifted = {
            **baseline,
            "points": [
                {**baseline["points"][0], "sourceObservedAt": "2026-01-29T00:00:00.000Z"},
                baseline["points"][1],
            ],
        }
        value_shifted = {
            **baseline,
            "points": [
                {**baseline["points"][0], "value": 21.0},
                baseline["points"][1],
            ],
        }

        self.assertNotEqual(build_history_fingerprint(provenance_shifted), build_history_fingerprint(baseline))
        self.assertNotEqual(build_history_fingerprint(value_shifted), build_history_fingerprint(baseline))


if __name__ == "__main__":
    unittest.main()