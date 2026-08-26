from __future__ import annotations

import unittest

from scripts.benchmark_rolling_daily_stage7_performance import (
    build_scope_guardrails,
    build_serving_behavior_gate,
    build_serving_topology_audit,
    compare_numbers,
    derive_legacy_invalidated_prepared_serving,
    derive_output_parity,
    import_stage4_historical_evidence,
    import_stage5_recomputation_evidence,
    parse_stage2_snapshot_persistence_ms,
    summarize_latency_samples_ms,
    validate_current_compute_context,
)


class DummyMetadata:
    def __init__(self, selected_variant: str) -> None:
        self.selected_variant = selected_variant


class DummyPoint:
    def __init__(self, *, day: str, point: float, lower: float, upper: float, low_offset: float, high_offset: float) -> None:
        from datetime import date

        from forecasting.rolling_daily_contracts import BandStatus

        self.date = date.fromisoformat(day)
        self.point_forecast = point
        self.lower_p10 = lower
        self.upper_p90 = upper
        self.p10_residual_offset = low_offset
        self.p90_residual_offset = high_offset
        self.band_status = BandStatus.AVAILABLE
        self.left_anchor_horizon = "ORIGIN"
        self.right_anchor_horizon = "1M"


class DummyCurrent:
    def __init__(self, path, selected_variant: str) -> None:
        self.forecast_path = tuple(path)
        self.metadata = DummyMetadata(selected_variant)


class Stage7BenchmarkHelpersTests(unittest.TestCase):
    def test_p95_is_not_meaningful_for_small_samples(self) -> None:
        summary = summarize_latency_samples_ms([1.0, 2.0, 3.0])
        self.assertEqual(summary["p95Status"], "NOT_MEANINGFUL")
        self.assertIsNone(summary["p95Ms"])

    def test_zero_duration_samples_are_preserved(self) -> None:
        summary = summarize_latency_samples_ms([0.0, 0.001, 0.0], p95_min_samples=99)
        self.assertEqual(summary["minMs"], 0.0)
        self.assertEqual(summary["medianMs"], 0.0)

    def test_import_stage4_historical_evidence_uses_payload_runtime(self) -> None:
        evidence = import_stage4_historical_evidence(
            {
                "coverageReconciliation": {"completed": 2},
                "execution": {
                    "batchCount": 2,
                    "fetchSeconds": 1.5,
                    "totalVerificationRecords": 8,
                    "batches": [{"elapsedSeconds": 4.0}, {"elapsedSeconds": 6.0}],
                },
            }
        )
        self.assertEqual(evidence["totalRuntimeSeconds"], 10.0)
        self.assertEqual(evidence["runtimePerOriginSeconds"], 5.0)
        self.assertFalse(evidence["fullHistoricalRerunPerformed"])

    def test_import_stage5_recomputation_extracts_one_origin_representative(self) -> None:
        evidence = import_stage5_recomputation_evidence(
            {
                "coverageReconciliation": {"completedAfter": 3},
                "execution": {
                    "batchCount": 2,
                    "batches": [
                        {
                            "elapsedSeconds": 1.0,
                            "newOriginCount": 1,
                            "maturedRecordCount": 0,
                            "persisted": {"newRecordCount": 4, "calibrationGroupCount": 4, "status": "SUCCEEDED"},
                        },
                        {
                            "elapsedSeconds": 2.0,
                            "newOriginCount": 2,
                            "maturedRecordCount": 1,
                            "persisted": {"newRecordCount": 8, "calibrationGroupCount": 4, "status": "SUCCEEDED"},
                        },
                    ],
                },
            }
        )
        self.assertEqual(evidence["totalRuntimeSeconds"], 3.0)
        self.assertEqual(evidence["oneOriginRepresentative"]["newRecordCount"], 4)

    def test_validate_current_compute_context_requires_shared_origin_and_history(self) -> None:
        self.assertEqual(
            validate_current_compute_context(
                {
                    "naive": {"originDate": "2026-08-18", "historyCount": 10, "pathLength": 5},
                    "ets": {"originDate": "2026-08-18", "historyCount": 10, "pathLength": 5},
                }
            )["status"],
            "PASS",
        )
        self.assertEqual(
            validate_current_compute_context(
                {
                    "naive": {"originDate": "2026-08-18", "historyCount": 10, "pathLength": 5},
                    "ets": {"originDate": "2026-08-19", "historyCount": 10, "pathLength": 5},
                }
            )["status"],
            "FAIL",
        )

    def test_parse_stage2_snapshot_persistence_ms_extracts_canonical_value(self) -> None:
        self.assertEqual(
            parse_stage2_snapshot_persistence_ms("persistence of one prepared snapshot: `502.11279099999956 ms`"),
            502.11279099999956,
        )

    def test_scope_guardrails_keep_ranking_absent(self) -> None:
        guardrails = build_scope_guardrails()
        self.assertEqual(guardrails["modelRanking"], "NOT_PERFORMED")
        self.assertEqual(guardrails["champion"], "NOT_DEFINED")

    def test_serving_topology_audit_marks_benchmark_finder_non_canonical(self) -> None:
        audit = build_serving_topology_audit()
        self.assertEqual(audit["classification"], "BENCHMARK_CONFIGURATION_DEFECT")
        self.assertEqual(audit["canonicalPreparedServing"]["seam"], "DASHBOARD_LIBRARY_PREPARED_SNAPSHOT_DB_READ")
        self.assertEqual(audit["dependencyProof"]["dashboardLibraryRequiresBenchmarkFinder"], "NO")

    def test_serving_behavior_gate_stays_read_only(self) -> None:
        gate = build_serving_behavior_gate()
        self.assertTrue(gate["pass"])
        self.assertEqual(gate["arimaFitTriggered"], "NO")
        self.assertEqual(gate["forecastPersistenceMutation"], "NO")

    def test_legacy_invalidated_prepared_serving_reuses_existing_payload(self) -> None:
        legacy = derive_legacy_invalidated_prepared_serving(
            {
                "preparedServing": {
                    "sampleCount": 20,
                    "timings": {"medianMs": 30.86, "minMs": 28.0, "maxMs": 35.0},
                }
            }
        )
        self.assertEqual(legacy["classification"], "INVALID_FOR_CANONICAL_FORECAST_SERVING")
        self.assertEqual(legacy["timings"]["medianMs"], 30.86)

    def test_derive_output_parity_keeps_stage6_pre1m_semantics_pass(self) -> None:
        stage6_payload = {
            "currentDailyBandPath": [
                {
                    "date": "2026-08-19",
                    "pointForecast": 90.0,
                    "lower": 89.5,
                    "upper": 90.5,
                    "lowerResidualOffset": -0.5,
                    "upperResidualOffset": 0.5,
                }
            ],
            "currentAnchorBands": [{"horizon": "1M", "lowerResidualOffset": -7.0, "upperResidualOffset": 7.0}],
            "perHorizonCalibration": [{"horizon": "1M", "residualP10": -7.0, "residualP90": 7.0, "sampleCount": 10}],
            "pre1MCurrentBand": {"target1MDate": "2026-09-18", "pass": True, "currentBandWithheld": False},
        }
        current = DummyCurrent([DummyPoint(day="2026-08-19", point=90.0, lower=89.5, upper=90.5, low_offset=-0.5, high_offset=0.5)], "ARIMA(2,1,2)")
        parity = derive_output_parity(
            stage1_selected_order="ARIMA(2,1,2)",
            stage6_payload=stage6_payload,
            current_point_only=current,
            current_with_band=current,
            measured_band_calibration={
                "sampleCountsByHorizon": {"1M": 10},
                "quantilesByHorizon": {"1M": {"p10": -7.0, "p50": 0.0, "p90": 7.0}},
            },
        )
        self.assertEqual(parity["pointForecastParity"], "PASS")
        self.assertEqual(parity["selectedOrderParity"], "PASS")
        self.assertEqual(parity["bandQuantileParity"], "PASS")
        self.assertEqual(parity["bandPathParity"], "PASS")
        self.assertEqual(parity["stage6Pre1MSemantics"], "PASS")

    def test_compare_numbers_uses_tolerance(self) -> None:
        self.assertTrue(compare_numbers(1.0, 1.0 + 1e-10))
        self.assertFalse(compare_numbers(1.0, 1.1))


if __name__ == "__main__":
    unittest.main()
