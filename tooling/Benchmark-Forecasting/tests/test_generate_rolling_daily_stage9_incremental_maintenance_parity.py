from __future__ import annotations

import unittest

from scripts.generate_rolling_daily_stage9_incremental_maintenance_parity import (
    AUTOMATIC_SELECTION,
    build_model_policy,
    decide_stage9_status,
    evaluate_serving_guardrails,
)


class GenerateRollingDailyStage9IncrementalMaintenanceParityTests(unittest.TestCase):
    def test_decide_stage9_status_passes_only_when_all_checks_pass(self) -> None:
        self.assertEqual(decide_stage9_status({"a": "PASS", "b": "PASS"}), "PASS")
        self.assertEqual(decide_stage9_status({"a": "PASS", "b": "BLOCKED"}), "BLOCKED")
        self.assertEqual(decide_stage9_status({"a": "PASS", "b": "FAIL"}), "FAIL")

    def test_serving_guardrails_fail_closed_on_benchmark_finder_or_request_time_recompute(self) -> None:
        self.assertEqual(evaluate_serving_guardrails("NONE", "NO", "NO")["canonicalPreparedRead"], "PASS")
        self.assertEqual(evaluate_serving_guardrails("DETECTED", "NO", "NO")["canonicalPreparedRead"], "FAIL")
        self.assertEqual(evaluate_serving_guardrails("NONE", "YES", "NO")["canonicalPreparedRead"], "FAIL")
        self.assertEqual(evaluate_serving_guardrails("NONE", "NO", "YES")["canonicalPreparedRead"], "FAIL")

    def test_model_policy_stays_non_automatic(self) -> None:
        policy = build_model_policy()
        self.assertEqual(policy["champion"], "NOT DEFINED")
        self.assertEqual(policy["preferredModel"], "NOT DEFINED")
        self.assertEqual(policy["defaultModel"], "NOT DEFINED")
        self.assertEqual(policy["automaticSelection"], AUTOMATIC_SELECTION)