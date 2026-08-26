from __future__ import annotations

import unittest
from datetime import date

from forecasting.comparative_backtest import ComparableVerificationRecord, build_native_view, build_strict_common_cohort_view
from scripts.generate_stage5_four_model_comparative_backtest import (
    HORIZONS,
    MODELS,
    build_identity_set_equality,
    flatten_strict_common_metrics,
    metric_row,
    render_acceptance,
    strict_metric_row,
    validate_metric_completeness,
)


def record(
    model_id: str,
    *,
    origin_day: int,
    horizon_label: str = "1M",
    target_day: int = 1,
    actual_value: float = 11.0,
    forecast_value: float = 10.0,
    origin_value: float = 9.0,
    mase_scale: float = 2.0,
    maturity_status: str = "MATURED",
    verification_day: int = 1,
) -> ComparableVerificationRecord:
    error_value = None if maturity_status != "MATURED" else forecast_value - actual_value
    actual_or_none = None if maturity_status != "MATURED" else actual_value
    verification_or_none = None if maturity_status != "MATURED" else date(2024, 2, verification_day)
    return ComparableVerificationRecord(
        benchmark_id="wocaes0074",
        model_id=model_id,
        forecast_method="ROLLING_DAILY_POINT_IN_TIME",
        method_version="rolling-daily-point-in-time-v1",
        target_basis="POINT_IN_TIME",
        forecast_origin_at=date(2024, 1, origin_day),
        horizon_label=horizon_label,
        horizon_months=int(horizon_label[:-1]),
        target_calendar_date=date(2024, 2, target_day),
        verification_observed_at=verification_or_none,
        maturity_status=maturity_status,
        origin_value=origin_value,
        forecast_value=forecast_value,
        actual_value=actual_or_none,
        error_value=error_value,
        mase_scale=mase_scale,
    )


class GenerateStage5ComparativeBacktestTests(unittest.TestCase):
    def test_valid_numeric_metric_values_survive_aggregation(self) -> None:
        records = [record(model, origin_day=2, actual_value=10.0, forecast_value=8.0) for model in MODELS]
        native = build_native_view(records, MODELS, ["1M"])

        row = metric_row(native["1M"]["naive"])

        self.assertEqual(row["mae"], 2.0)
        self.assertEqual(row["directionalAccuracy"], 0.0)

    def test_strict_metrics_serialization_preserves_all_six_metrics(self) -> None:
        records = [record(model, origin_day=2, actual_value=10.0, forecast_value=8.0) for model in MODELS]
        strict = build_strict_common_cohort_view(records, MODELS, ["1M"])

        row = strict_metric_row(strict["1M"], "naive")

        self.assertEqual(set(row.keys()), {"verified", "mae", "rmse", "mase", "smape", "directionalAccuracy", "bias"})

    def test_markdown_rendering_preserves_numeric_zero(self) -> None:
        payload = {
            "methodCompatibility": {
                "fourModelMethodCompatibility": "PASS",
                "targetDateParity": "PASS",
                "commonActualParity": "PASS",
                "verificationObservedAtParity": "PASS",
                "errorConventionParity": "PASS",
            },
            "coverageSummary": {model: {"expectedOrigins": 1, "completed": 1, "available": 1, "unavailable": 0, "missing": 0} for model in MODELS},
            "strictCommonCohort": {h: {"verifiedCounts": {m: 1 for m in MODELS}, "commonCohortCount": 1, "targetDateParity": True, "actualParity": True, "verificationObservedAtParity": True, "metricsByModel": {m: {"mae": 2.0, "rmse": 2.0, "mase": 1.0, "smape": 1.0, "directional_accuracy": 0.0 if m == 'naive' else 0.5, "bias": -1.0} for m in MODELS}} for h in HORIZONS},
            "nativeMetrics": {h: {m: {"generated": 1, "mature": 1, "verified": 1, "unavailable": 0, "mae": 2.0, "rmse": 2.0, "mase": 1.0, "smape": 1.0, "directionalAccuracy": 0.0 if m == 'naive' else 0.5, "bias": -1.0} for m in MODELS} for h in HORIZONS},
            "strictCommonCohortMetrics": {h: {m: {"verified": 1, "mae": 2.0, "rmse": 2.0, "mase": 1.0, "smape": 1.0, "directionalAccuracy": 0.0 if m == 'naive' else 0.5, "bias": -1.0} for m in MODELS} for h in HORIZONS},
            "metricCompleteness": {"nativeRequiredMetricCells": 96, "nativeNumericMetricCells": 96, "nativeMissingMetricCells": 0, "strictRequiredMetricCells": 96, "strictNumericMetricCells": 96, "strictMissingMetricCells": 0},
            "identitySetEquality": {h: {"status": "PASS"} for h in HORIZONS},
            "nativeMetricParity": {"status": "PASS"},
            "metricLeaders": {h: {"lowestMAE": "naive", "lowestRMSE": "naive", "lowestMASE": "naive", "lowestSMAPE": "naive", "highestDirectionalAccuracy": "ets", "lowestAbsoluteBias": "naive"} for h in HORIZONS},
            "stage3PathStructureContext": [{"model": "naive", "forecastRange": 0.0, "directionChanges": 0, "pathVolatility": 0.0}, {"model": "damped_holt", "forecastRange": 1.0, "directionChanges": 0, "pathVolatility": 0.1}, {"model": "ets", "forecastRange": 0.0, "directionChanges": 0, "pathVolatility": 0.0}, {"model": "arima", "forecastRange": 2.0, "directionChanges": 1, "pathVolatility": 0.2}],
            "arimaFitProvenance": [{"order": "ARIMA(1,1,2)", "selectedOrigins": 9, "share": 0.01}],
            "horizonFindings": {h: ["sample finding"] for h in HORIZONS},
            "crossHorizonPatternSummary": ["sample summary"],
        }

        rendered = render_acceptance(payload)

        self.assertIn("| Naive | 1 | 2.0 | 2.0 | 1.0 | 1.0 | 0.0 | -1.0 |", rendered)
        self.assertNotIn("None", rendered)

    def test_metric_completeness_fails_closed_on_missing_metric(self) -> None:
        native = {h: {m: {"mae": 1.0, "rmse": 1.0, "mase": 1.0, "smape": 1.0, "directionalAccuracy": 0.0, "bias": 0.0} for m in MODELS} for h in HORIZONS}
        strict = {h: {m: {"mae": 1.0, "rmse": 1.0, "mase": 1.0, "smape": 1.0, "directionalAccuracy": 0.0, "bias": 0.0} for m in MODELS} for h in HORIZONS}
        native["1M"]["naive"].pop("mae")

        with self.assertRaises(ValueError):
            validate_metric_completeness(native, strict)

    def test_identity_set_equality_is_checked_not_inferred_from_counts(self) -> None:
        records = [record(model, origin_day=2) for model in MODELS]
        records.append(record("naive", origin_day=3))
        records.append(record("damped_holt", origin_day=4))
        records.append(record("ets", origin_day=5))
        records.append(record("arima", origin_day=6))

        equality = build_identity_set_equality(records)

        self.assertFalse(equality["1M"]["equal"])
        self.assertEqual(equality["1M"]["counts"]["naive"], equality["1M"]["counts"]["arima"])

    def test_strict_common_metrics_equal_native_when_identity_sets_equal(self) -> None:
        records = [record(model, origin_day=2, actual_value=10.0, forecast_value=8.0) for model in MODELS]
        native = build_native_view(records, MODELS, ["1M"])
        strict = build_strict_common_cohort_view(records, MODELS, ["1M"])
        native_row = metric_row(native["1M"]["naive"])
        strict_row = strict_metric_row(strict["1M"], "naive")

        self.assertEqual(native_row["mae"], strict_row["mae"])
        self.assertEqual(native_row["directionalAccuracy"], strict_row["directionalAccuracy"])

    def test_flatten_strict_common_metrics_contains_all_horizons_models_and_metrics(self) -> None:
        records = [record(model, origin_day=2, horizon_label=horizon) for model in MODELS for horizon in HORIZONS]
        strict = build_strict_common_cohort_view(records, MODELS, HORIZONS)
        flattened = flatten_strict_common_metrics(strict)

        self.assertEqual(set(flattened.keys()), set(HORIZONS))
        self.assertEqual(set(flattened["1M"].keys()), set(MODELS))
        self.assertIn("directionalAccuracy", flattened["1M"]["naive"])

    def test_ranking_is_not_introduced_in_rendered_acceptance(self) -> None:
        payload = {
            "methodCompatibility": {"fourModelMethodCompatibility": "PASS", "targetDateParity": "PASS", "commonActualParity": "PASS", "verificationObservedAtParity": "PASS", "errorConventionParity": "PASS"},
            "coverageSummary": {model: {"expectedOrigins": 1, "completed": 1, "available": 1, "unavailable": 0, "missing": 0} for model in MODELS},
            "strictCommonCohort": {h: {"verifiedCounts": {m: 1 for m in MODELS}, "commonCohortCount": 1, "targetDateParity": True, "actualParity": True, "verificationObservedAtParity": True, "metricsByModel": {m: {"mae": 1.0, "rmse": 1.0, "mase": 1.0, "smape": 1.0, "directional_accuracy": 0.0, "bias": 0.0} for m in MODELS}} for h in HORIZONS},
            "nativeMetrics": {h: {m: {"generated": 1, "mature": 1, "verified": 1, "unavailable": 0, "mae": 1.0, "rmse": 1.0, "mase": 1.0, "smape": 1.0, "directionalAccuracy": 0.0, "bias": 0.0} for m in MODELS} for h in HORIZONS},
            "strictCommonCohortMetrics": {h: {m: {"verified": 1, "mae": 1.0, "rmse": 1.0, "mase": 1.0, "smape": 1.0, "directionalAccuracy": 0.0, "bias": 0.0} for m in MODELS} for h in HORIZONS},
            "metricCompleteness": {"nativeRequiredMetricCells": 96, "nativeNumericMetricCells": 96, "nativeMissingMetricCells": 0, "strictRequiredMetricCells": 96, "strictNumericMetricCells": 96, "strictMissingMetricCells": 0},
            "identitySetEquality": {h: {"status": "PASS"} for h in HORIZONS},
            "nativeMetricParity": {"status": "PASS"},
            "metricLeaders": {h: {"lowestMAE": "naive", "lowestRMSE": "naive", "lowestMASE": "naive", "lowestSMAPE": "naive", "highestDirectionalAccuracy": "naive", "lowestAbsoluteBias": "naive"} for h in HORIZONS},
            "stage3PathStructureContext": [{"model": "naive", "forecastRange": 0.0, "directionChanges": 0, "pathVolatility": 0.0}, {"model": "damped_holt", "forecastRange": 1.0, "directionChanges": 0, "pathVolatility": 0.1}, {"model": "ets", "forecastRange": 0.0, "directionChanges": 0, "pathVolatility": 0.0}, {"model": "arima", "forecastRange": 2.0, "directionChanges": 1, "pathVolatility": 0.2}],
            "arimaFitProvenance": [{"order": "ARIMA(1,1,2)", "selectedOrigins": 9, "share": 0.01}],
            "horizonFindings": {h: ["sample finding"] for h in HORIZONS},
            "crossHorizonPatternSummary": ["sample summary"],
        }

        rendered = render_acceptance(payload)

        self.assertIn("Model Ranking:\nNOT PERFORMED", rendered)
        self.assertNotIn("Overall Score", rendered)


if __name__ == "__main__":
    unittest.main()