from __future__ import annotations

import unittest

from scripts.validate_arima_historical_rolling_verification import (
    build_completed_origins,
    build_expected_origins,
    filter_records_through_origin,
    find_missing_expected_origins,
    merge_records,
)


class ArimaHistoricalVerificationResumeTests(unittest.TestCase):
    def test_expected_origin_universe_uses_only_lawful_dates_after_floor(self) -> None:
        lawful_dates = [
            "2023-12-29",
            "2024-01-01",
            "2024-01-02",
            "2024-01-03",
            "2024-01-04",
            "2024-01-05",
        ]

        expected = build_expected_origins(lawful_dates, 3, "2024-01-01")

        self.assertEqual(expected, ["2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"])

    def test_completed_origin_recognition_is_set_based(self) -> None:
        records = [
            {"forecastOriginAt": "2024-01-02", "horizonLabel": "1M"},
            {"forecastOriginAt": "2024-01-02", "horizonLabel": "3M"},
            {"forecastOriginAt": "2024-01-03", "horizonLabel": "1M"},
        ]

        completed = build_completed_origins(records)

        self.assertEqual(completed, ["2024-01-02", "2024-01-03"])

    def test_gap_detection_finds_missing_origin_inside_completed_range(self) -> None:
        expected = ["2024-01-02", "2024-01-03", "2024-01-04"]
        completed = ["2024-01-02", "2024-01-04"]

        missing = find_missing_expected_origins(expected, completed)

        self.assertEqual(missing, ["2024-01-03"])

    def test_merge_records_prefers_matured_record_for_same_origin_and_horizon(self) -> None:
        existing = [
            {
                "forecastOriginAt": "2024-01-02",
                "horizonLabel": "1M",
                "maturityStatus": "NOT_YET_MATURED",
                "verificationObservedAt": None,
            }
        ]
        updates = [
            {
                "forecastOriginAt": "2024-01-02",
                "horizonLabel": "1M",
                "maturityStatus": "MATURED",
                "verificationObservedAt": "2024-02-02",
            }
        ]

        merged = merge_records(existing, updates)

        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["maturityStatus"], "MATURED")
        self.assertEqual(merged[0]["verificationObservedAt"], "2024-02-02")

    def test_filter_records_through_origin_excludes_later_completed_work(self) -> None:
        records = [
            {"forecastOriginAt": "2024-01-02", "horizonLabel": "1M"},
            {"forecastOriginAt": "2024-01-03", "horizonLabel": "1M"},
            {"forecastOriginAt": "2024-01-04", "horizonLabel": "1M"},
        ]

        filtered = filter_records_through_origin(records, "2024-01-03")

        self.assertEqual([record["forecastOriginAt"] for record in filtered], ["2024-01-02", "2024-01-03"])


if __name__ == "__main__":
    unittest.main()