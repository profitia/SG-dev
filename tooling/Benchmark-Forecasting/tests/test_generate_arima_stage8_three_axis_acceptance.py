from __future__ import annotations

import unittest
from pathlib import Path

from scripts.generate_arima_stage8_three_axis_acceptance import (
    EXPECTED_COMMON_COHORTS,
    EXPECTED_ORDER_DISTRIBUTION,
    ROOT,
    Stage8EvidenceError,
    build_axis_a,
    build_axis_b,
    build_axis_c,
    build_model_policy,
    build_stage8_payload,
    decide_overall_status,
    render_acceptance_markdown,
)


def base_inputs() -> dict[str, object]:
    stage4_json = {
        "forecastMethod": "ROLLING_DAILY_POINT_IN_TIME",
        "targetBasis": "POINT_IN_TIME",
        "historicalOriginFloor": "2024-01-01",
        "lawfulHistoricalOrigins": 681,
        "successfulArimaOrigins": 681,
        "coverageReconciliation": {"missing": 0, "duplicates": 0},
        "semanticsChecks": {
            "noLeakage": "PASS",
            "calendarMonthClamp": "PASS",
            "asOfTargetDate": "PASS",
            "pre2024TrainingHistoryPreserved": True,
            "oneFitPerOrigin": "PASS",
        },
        "sourceHistory": {"startDate": "1985-10-01"},
        "selectedOrderDistribution": [
            {"order": order, "selectedOrigins": count, "share": 0.0} for order, count in EXPECTED_ORDER_DISTRIBUTION.items()
        ],
    }
    stage5_json = {
        "identitySetEquality": {
            horizon: {
                "status": "PASS",
                "equal": True,
                "commonCohortCount": count,
                "counts": {model: count for model in ["naive", "damped_holt", "ets", "arima"]},
            }
            for horizon, count in EXPECTED_COMMON_COHORTS.items()
        },
        "methodCompatibility": {
            "fourModelMethodCompatibility": "PASS",
            "targetDateParity": "PASS",
            "commonActualParity": "PASS",
            "verificationObservedAtParity": "PASS",
            "errorConventionParity": "PASS",
        },
        "metricLeaders": {
            horizon: {
                "lowestMAE": "naive",
                "highestDirectionalAccuracy": "ets",
                "lowestAbsoluteBias": "arima",
            }
            for horizon in ["1M", "3M", "6M", "12M"]
        },
        "strictCommonCohortMetrics": {
            horizon: {
                "arima": {"mae": 1.0, "bias": 0.0},
                "naive": {"mae": 1.0, "bias": 0.0},
                "damped_holt": {"mae": 1.0, "bias": 0.0},
                "ets": {"mae": 1.0, "bias": 0.0},
            }
            for horizon in ["1M", "3M", "6M", "12M"]
        },
    }
    stage6_json = {
        "modelId": "arima",
        "forecastMethod": "ROLLING_DAILY_POINT_IN_TIME",
        "targetBasis": "POINT_IN_TIME",
        "bandMethod": {
            "residualDefinition": "actual - forecast",
            "minimumCalibrationSamples": 30,
        },
        "guardrails": {
            "historicalVerificationRefitsPerformed": 0,
            "historicalForecastMutationsPerformed": 0,
            "pointForecastMutation": "NOT_PERFORMED",
            "anchorPathParity": True,
            "pre1MCurrentBandPolicy": "INTERPOLATE_FROM_ORIGIN_ZERO_TO_1M_EMPIRICAL_ANCHOR",
        },
    }
    stage7_json = {
        "historicalEvidence": {
            "stage4": {"totalRuntimeSeconds": 6810.170992082974, "origins": 681},
            "stage5Recomputation": {"totalRuntimeSeconds": 6957.410418666666, "origins": 681},
        },
        "arimaCurrentCompute": {
            "candidateAttempts": 17,
            "candidateSuccesses": 17,
            "policyIdentity": "ARIMA_NON_SEASONAL_BOUNDED_AICC_V1",
            "timings": {"medianMs": 14378.88518749969, "sampleCount": 2},
        },
        "incrementalMaintenance": {
            "status": "MEASURED_WITHOUT_PERSISTENCE",
            "timings": {"totalMs": 1753.756958001759},
            "persistence": {"status": "NOT_MEASURED_SAFE_READ_ONLY"},
        },
        "bandCalibration": {
            "historicalModelRefits": 0,
            "calibrationRecordsRead": 2724,
            "timings": {"totalMs": {"medianMs": 1303.713915986009}},
        },
        "bandPathGeneration": {
            "pathLength": 365,
            "timings": {"medianMs": 0.7248330512084067},
        },
        "preparedServing": {
            "seam": "DASHBOARD_LIBRARY_PREPARED_SNAPSHOT_DB_READ",
            "timings": {"medianMs": 27.162020499999983, "sampleCount": 20, "p95Ms": 34.064750000000004},
            "fitTriggered": False,
            "historicalCalibrationRecomputed": False,
            "forecastPersistenceMutation": False,
            "sourceHistoryFingerprint": "fp-1",
        },
        "servingTopologyAudit": {
            "topologyGate": "PASS",
            "canonicalPreparedServing": {
                "storage": "rollingDailyCurrentForecastSnapshot",
                "dashboardConsumerMethod": "getBenchmarkForecastCurrent(seriesId, model, 'POINT_IN_TIME')",
            },
            "dependencyProof": {"dashboardLibraryRequiresBenchmarkFinder": "NO"},
        },
        "servingBehaviorGate": {
            "pass": True,
            "benchmarkFinderDependency": "NO",
            "arimaFitTriggered": "NO",
            "historicalCalibrationTriggered": "NO",
            "forecastPersistenceMutation": "NO",
        },
        "outputParity": {
            "selectedOrderParity": "PASS",
            "pointForecastParity": "PASS",
        },
    }

    return {
        "stage0Md": "ARIMA Model Contract Parity: PASS\n",
        "stage1Md": "ARIMA Current Rolling Daily Forecast: PASS\n",
        "stage2Md": "ARIMA Reproducibility: PASS\nARIMA Fast Serving Feasibility: PASS\n",
        "stage4Md": "ARIMA-specific Table:\nNO\nNew Database:\nNO\n",
        "stage4Json": stage4_json,
        "stage5Md": "Four-Model Comparative Backtest: PASS\n",
        "stage5Json": stage5_json,
        "stage6Md": "ARIMA Empirical Prediction Band: PASS\n",
        "stage6Json": stage6_json,
        "stage7Md": "ROLLING_DAILY Stage 7 Performance & Cost Characterization\n",
        "stage7Json": stage7_json,
        "methodSpecMd": "arima is intentionally not enabled for this method.\n",
        "forecastingCanonMd": "canon",
        "forecastingMethodsSpecMd": "methods",
        "productionContractMd": "contract",
        "targetBasisCanonMd": "basis",
        "demoBacklogMd": "Stage 8 deferred after demo\nForecast Portfolio v3 is demo-controlled on `wocaes0074`\nAdd a focused deployed smoke check\n",
        "forecastContractTs": "export const FORECAST_PORTFOLIO_MODELS = ['naive', 'damped_holt', 'ets', 'arima'] as const\n",
        "runtimeQueryTs": "rollingDailyCurrentForecastSnapshot\nmodelId: model\n",
        "rollingDailyServicePy": "if model.model_id == \"arima\":\n    return fit_selected_arima_endog(endog=endog, sample_size=len(history))\n",
    }


class GenerateArimaStage8ThreeAxisAcceptanceTests(unittest.TestCase):
    def test_all_three_axes_required_for_pass(self) -> None:
        self.assertEqual(decide_overall_status(["PASS", "PASS", "PASS"]), "PASS")

    def test_one_fail_causes_overall_fail(self) -> None:
        self.assertEqual(decide_overall_status(["PASS", "FAIL", "PASS"]), "FAIL")

    def test_one_blocked_without_fail_causes_overall_blocked(self) -> None:
        self.assertEqual(decide_overall_status(["PASS", "BLOCKED", "PASS"]), "BLOCKED")

    def test_no_weighted_score_exists(self) -> None:
        payload = build_stage8_payload(base_inputs())
        self.assertNotIn("score", payload["overall"])

    def test_no_champion_or_preferred_or_default_model_is_selected(self) -> None:
        policy = build_model_policy()
        self.assertEqual(policy["champion"], "NOT DEFINED")
        self.assertEqual(policy["preferredModel"], "NOT DEFINED")
        self.assertEqual(policy["defaultModel"], "NOT DEFINED")
        self.assertEqual(policy["automaticSelection"], "NOT BUILT")

    def test_axis_a_fails_closed_on_missing_required_evidence(self) -> None:
        inputs = base_inputs()
        inputs["stage4Json"]["selectedOrderDistribution"] = []
        with self.assertRaises(Stage8EvidenceError):
            build_axis_a(inputs)

    def test_axis_b_preserves_numeric_timings(self) -> None:
        axis_b = build_axis_b(base_inputs())
        self.assertEqual(axis_b["freshCompute"]["medianMs"], 14378.88518749969)
        self.assertEqual(axis_b["bandInterpolation"]["medianMs"], 0.7248330512084067)

    def test_axis_c_fails_if_benchmark_finder_is_introduced(self) -> None:
        inputs = base_inputs()
        inputs["stage7Json"]["servingBehaviorGate"]["benchmarkFinderDependency"] = "YES"
        with self.assertRaises(Stage8EvidenceError):
            build_axis_c(inputs)

    def test_stage8_payload_does_not_trigger_stage9(self) -> None:
        payload = build_stage8_payload(base_inputs())
        self.assertEqual(payload["deferredWork"]["stage9"], "NOT EXECUTED")
        self.assertEqual(payload["overall"]["stage9Readiness"], "READY")

    def test_markdown_keeps_stage5_zero_metric_values_numeric(self) -> None:
        inputs = base_inputs()
        inputs["stage5Json"]["strictCommonCohortMetrics"]["1M"]["arima"]["bias"] = 0.0
        rendered = render_acceptance_markdown(build_stage8_payload(inputs), stage5_json=inputs["stage5Json"])
        self.assertIn("| 1M | 1.0 | 0.0 | naive | ets | arima |", rendered)
        self.assertNotIn("None", rendered)

    def test_evaluator_reads_accepted_evidence_rather_than_refitting_models(self) -> None:
        source = (ROOT / "scripts" / "generate_arima_stage8_three_axis_acceptance.py").read_text(encoding="utf-8")
        self.assertNotIn("subprocess", source)
        self.assertNotIn("statsmodels", source)
        self.assertNotIn("fit_candidate(", source)

    def test_axis_a_records_resolved_method_spec_drift(self) -> None:
        axis_a = build_axis_a(base_inputs())
        self.assertTrue(axis_a["resolvedMethodSpecDrift"]["detected"])
        self.assertTrue(axis_a["limitations"])


if __name__ == "__main__":
    unittest.main()