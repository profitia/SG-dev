from __future__ import annotations

import unittest

from scripts.validate_arima_historical_rolling_verification import (
    assert_checkpoint_matches_corpus_identity,
    build_completed_origins,
    build_history_prefix,
    build_lawful_observation_dates,
    build_requested_corpus_identity,
    build_expected_origins,
    filter_records_through_origin,
    find_missing_expected_origins,
    merge_records,
    resolve_corpus_boundary,
)


class ArimaHistoricalVerificationResumeTests(unittest.TestCase):
    def test_explicit_through_date_filters_source_history_before_origin_construction(self) -> None:
        history_payload = {
            "points": [
                {"date": "2024-01-02", "value": 10.0},
                {"date": "2024-01-03", "value": 11.0},
                {"date": "2024-01-04", "value": 12.0},
            ]
        }

        resolved = resolve_corpus_boundary(history_payload, "2024-01-03")

        self.assertEqual(resolved["effectiveSourceHistoryEndDate"], "2024-01-03")
        self.assertEqual(resolved["corpusBoundaryMode"], "EXPLICIT_UPPER_BOUND")
        self.assertEqual(build_lawful_observation_dates(resolved["history"]), ["2024-01-02", "2024-01-03"])

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

    def test_expected_origins_stop_at_upper_bound(self) -> None:
        history_payload = {
            "points": [
                {"date": "2024-01-01", "value": 1.0},
                {"date": "2024-01-02", "value": 2.0},
                {"date": "2024-01-03", "value": 3.0},
                {"date": "2024-01-04", "value": 4.0},
                {"date": "2024-01-05", "value": 5.0},
            ]
        }

        resolved = resolve_corpus_boundary(history_payload, "2024-01-04")
        expected = build_expected_origins(resolved["lawfulDates"], 3, "2024-01-01")

        self.assertEqual(expected, ["2024-01-03", "2024-01-04"])

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

    def test_live_current_behavior_remains_when_no_upper_bound_is_supplied(self) -> None:
        history_payload = {
            "points": [
                {"date": "2024-01-02", "value": 1.0},
                {"date": "2024-01-03", "value": 2.0},
            ]
        }

        resolved = resolve_corpus_boundary(history_payload, None)

        self.assertEqual(resolved["corpusBoundaryMode"], "LIVE_CURRENT")
        self.assertEqual(build_lawful_observation_dates(resolved["history"]), ["2024-01-02", "2024-01-03"])

    def test_checkpoint_from_different_corpus_is_rejected(self) -> None:
        checkpoint = {
            "seriesId": "wocaes0074",
            "historicalOriginFloor": "2024-01-01",
            "requestedThroughDate": None,
            "effectiveSourceHistoryEndDate": "2026-08-20",
            "lawfulHistoricalOriginCount": 683,
        }
        expected_identity = build_requested_corpus_identity(
            series_id="wocaes0074",
            requested_through_date="2026-08-18",
            effective_source_history_end_date="2026-08-18",
            lawful_historical_origin_count=681,
        )

        with self.assertRaises(RuntimeError):
            assert_checkpoint_matches_corpus_identity(checkpoint, expected_identity)

    def test_checkpoint_same_corpus_is_reusable(self) -> None:
        checkpoint = {
            "seriesId": "wocaes0074",
            "historicalOriginFloor": "2024-01-01",
            "requestedThroughDate": "2026-08-18",
            "effectiveSourceHistoryEndDate": "2026-08-18",
            "lawfulHistoricalOriginCount": 681,
        }
        expected_identity = build_requested_corpus_identity(
            series_id="wocaes0074",
            requested_through_date="2026-08-18",
            effective_source_history_end_date="2026-08-18",
            lawful_historical_origin_count=681,
        )

        assert_checkpoint_matches_corpus_identity(checkpoint, expected_identity)


if __name__ == "__main__":
    unittest.main()