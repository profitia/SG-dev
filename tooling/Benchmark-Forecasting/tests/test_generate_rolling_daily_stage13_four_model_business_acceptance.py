from __future__ import annotations

import unittest

from scripts.generate_rolling_daily_stage13_four_model_business_acceptance import (
    HORIZONS,
    MODELS,
    build_stage13_payload,
    compute_metric_leaders,
    render_acceptance,
)


class GenerateRollingDailyStage13FourModelBusinessAcceptanceTests(unittest.TestCase):
    def test_metric_leaders_use_absolute_bias_and_preserve_signed_bias(self) -> None:
        leaders = compute_metric_leaders(
            {
                "1M": {
                    "naive": {"verified": 1, "mae": 1.0, "rmse": 1.0, "mase": 1.0, "smape": 1.0, "directionalAccuracy": 0.0, "bias": -0.1},
                    "damped_holt": {"verified": 1, "mae": 2.0, "rmse": 2.0, "mase": 2.0, "smape": 2.0, "directionalAccuracy": 0.1, "bias": 0.2},
                    "ets": {"verified": 1, "mae": 3.0, "rmse": 3.0, "mase": 3.0, "smape": 3.0, "directionalAccuracy": 0.2, "bias": -0.3},
                    "arima": {"verified": 1, "mae": 4.0, "rmse": 4.0, "mase": 4.0, "smape": 4.0, "directionalAccuracy": 0.3, "bias": 0.4},
                }
            }
        )

        self.assertEqual(leaders["1M"]["lowestAbsoluteBias"]["modelId"], "naive")
        self.assertEqual(leaders["1M"]["lowestAbsoluteBias"]["value"], 0.1)
        self.assertEqual(leaders["1M"]["lowestAbsoluteBias"]["signedBias"], -0.1)

    def test_payload_includes_all_models_and_horizons_from_strict_common_evidence(self) -> None:
        payload = build_stage13_payload()

        self.assertEqual(payload["identity"]["models"], MODELS)
        self.assertEqual(set(payload["metricsByHorizon"].keys()), set(HORIZONS))
        self.assertEqual(set(payload["modelProfiles"].keys()), set(MODELS))
        self.assertEqual(payload["commonCohorts"], {"1M": 659, "3M": 615, "6M": 553, "12M": 423})

    def test_payload_preserves_legitimate_zero_metric_values(self) -> None:
        payload = build_stage13_payload()

        self.assertEqual(payload["metricsByHorizon"]["3M"]["naive"]["directionalAccuracy"], 0.0)
        self.assertIsInstance(payload["metricsByHorizon"]["3M"]["naive"]["directionalAccuracy"], float)
        self.assertEqual(payload["metricsByHorizon"]["12M"]["naive"]["directionalAccuracy"], 0.0)

    def test_payload_does_not_introduce_weighted_score_ranking_or_policy_winner(self) -> None:
        payload = build_stage13_payload()

        self.assertEqual(payload["modelPolicy"]["champion"], "NOT DEFINED")
        self.assertEqual(payload["modelPolicy"]["preferredModel"], "NOT DEFINED")
        self.assertEqual(payload["modelPolicy"]["globalDefault"], "NOT DEFINED")
        self.assertEqual(payload["modelPolicy"]["automaticSelection"], "NOT BUILT")
        self.assertEqual(payload["modelPolicy"]["autoAutoma"], "NOT BUILT")
        self.assertEqual(payload["modelPolicy"]["modelRanking"], "NOT PERFORMED")
        self.assertNotIn("score", {key.lower() for key in payload.keys()})

    def test_portfolio_decisions_carry_explicit_evidence_basis(self) -> None:
        payload = build_stage13_payload()

        for model_id in MODELS:
            node = payload["portfolioDecisions"][model_id]
            self.assertEqual(node["decision"], "KEEP")
            self.assertTrue(node["evidenceBasis"])
        self.assertTrue(payload["portfolioDecisions"]["fourModelPortfolio"]["evidenceBasis"])

    def test_scope_guardrails_show_no_fit_mutation_deploy_or_unrelated_surfaces(self) -> None:
        payload = build_stage13_payload()

        self.assertEqual(payload["scope"]["newModelFits"], 0)
        self.assertEqual(payload["scope"]["forecastPersistence"], "NOT MODIFIED")
        self.assertEqual(payload["scope"]["deployment"], "NOT PERFORMED")
        self.assertEqual(payload["scope"]["benchmarkFinder"], "NOT TOUCHED")
        self.assertEqual(payload["scope"]["appShell"], "NOT TOUCHED")

    def test_rendered_markdown_keeps_ranking_not_performed_and_no_overall_score(self) -> None:
        rendered = render_acceptance(build_stage13_payload())

        self.assertIn("Model Ranking:\nNOT PERFORMED", rendered)
        self.assertNotIn("Overall Score", rendered)
        self.assertIn("Champion: NOT DEFINED", rendered)


if __name__ == "__main__":
    unittest.main()