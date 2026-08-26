from __future__ import annotations

import unittest

from scripts.generate_rolling_daily_stage10_production_contract_parity import (
    MODELS,
    classify_model_catalog,
    decide_stage10_status,
    extract_const_model_list,
)


class GenerateRollingDailyStage10ProductionContractParityTests(unittest.TestCase):
    def test_extract_const_model_list_reads_typescript_string_tuple(self) -> None:
        source = "const DEFAULT_MODELS = ['naive', 'damped_holt', 'ets', 'arima'] as const\n"
        self.assertEqual(extract_const_model_list(source, "DEFAULT_MODELS"), list(MODELS))

    def test_classify_model_catalog_fails_closed_when_arima_is_missing(self) -> None:
        self.assertEqual(classify_model_catalog(["naive", "damped_holt", "ets"]), "FAIL")
        self.assertEqual(classify_model_catalog(list(MODELS)), "PASS")

    def test_decide_stage10_status_requires_every_check_to_pass(self) -> None:
        self.assertEqual(decide_stage10_status({"a": "PASS", "b": "PASS"}), "PASS")
        self.assertEqual(decide_stage10_status({"a": "PASS", "b": "FAIL"}), "FAIL")


if __name__ == "__main__":
    unittest.main()