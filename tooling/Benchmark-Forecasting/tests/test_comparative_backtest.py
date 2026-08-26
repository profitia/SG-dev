from __future__ import annotations

import unittest
from datetime import date

from forecasting.comparative_backtest import (
    ComparativeBacktestError,
    ComparableVerificationRecord,
    build_native_view,
    build_strict_common_cohort_view,
    verify_method_compatibility,
)


MODELS = ["naive", "damped_holt", "ets", "arima"]
HORIZONS = ["1M", "3M", "6M", "12M"]


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
    method_version: str = "rolling-daily-point-in-time-v1",
    target_basis: str = "POINT_IN_TIME",
    forecast_method: str = "ROLLING_DAILY_POINT_IN_TIME",
    target_semantics: str = "ROLLING_DAILY_POINT_IN_TIME",
) -> ComparableVerificationRecord:
    error_value = None if maturity_status != "MATURED" else forecast_value - actual_value
    actual_or_none = None if maturity_status != "MATURED" else actual_value
    verification_or_none = None if maturity_status != "MATURED" else date(2024, 2, verification_day)
    return ComparableVerificationRecord(
        benchmark_id="wocaes0074",
        model_id=model_id,
        forecast_method=forecast_method,
        method_version=method_version,
        target_basis=target_basis,
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
        target_semantics=target_semantics,
        residual_value=None if actual_or_none is None else actual_or_none - forecast_value,
    )


class ComparableBacktestTests(unittest.TestCase):
    def test_common_cohort_intersection_uses_exact_shared_identities(self) -> None:
        records = [
            record(model, origin_day=2, target_day=2) for model in MODELS
        ] + [
            record(model, origin_day=3, target_day=3) for model in MODELS if model != "arima"
        ]

        cohort = build_strict_common_cohort_view(records, MODELS, ["1M"])

        self.assertEqual(cohort["1M"]["commonCohortCount"], 1)

    def test_equal_cohorts_match_full_matured_counts(self) -> None:
        records = [
            record(model, origin_day=2, target_day=2) for model in MODELS
        ] + [
            record(model, origin_day=3, target_day=3) for model in MODELS
        ]

        cohort = build_strict_common_cohort_view(records, MODELS, ["1M"])

        self.assertEqual(cohort["1M"]["commonCohortCount"], 2)
        self.assertEqual(cohort["1M"]["verifiedCounts"]["naive"], 2)

    def test_missing_model_record_is_excluded_from_strict_common_comparison(self) -> None:
        records = [record(model, origin_day=2, target_day=2) for model in MODELS]
        records.append(record("naive", origin_day=3, target_day=3))

        cohort = build_strict_common_cohort_view(records, MODELS, ["1M"])

        self.assertEqual(cohort["1M"]["commonCohortCount"], 1)

    def test_target_date_parity_mismatch_is_detected(self) -> None:
        records = [record(model, origin_day=2, target_day=2) for model in MODELS]
        records[-1] = record("arima", origin_day=2, target_day=3)

        cohort = build_strict_common_cohort_view(records, MODELS, ["1M"])

        self.assertFalse(cohort["1M"]["targetDateParity"])

    def test_common_actual_parity_mismatch_is_detected(self) -> None:
        records = [record(model, origin_day=2, target_day=2) for model in MODELS]
        records[-1] = record("arima", origin_day=2, target_day=2, actual_value=99.0)

        cohort = build_strict_common_cohort_view(records, MODELS, ["1M"])

        self.assertFalse(cohort["1M"]["actualParity"])

    def test_duplicate_model_record_raises(self) -> None:
        records = [record(model, origin_day=2, target_day=2) for model in MODELS]
        records.append(record("naive", origin_day=2, target_day=2))

        with self.assertRaises(ComparativeBacktestError):
            build_strict_common_cohort_view(records, MODELS, ["1M"])

    def test_metrics_on_common_cohort_use_filtered_records(self) -> None:
        records = [
            record(model, origin_day=2, target_day=2, actual_value=10.0, forecast_value=8.0) for model in MODELS
        ] + [
            record(model, origin_day=3, target_day=3, actual_value=15.0, forecast_value=14.0) for model in MODELS if model != "arima"
        ]

        cohort = build_strict_common_cohort_view(records, MODELS, ["1M"])

        self.assertAlmostEqual(cohort["1M"]["metricsByModel"]["naive"]["mae"], 2.0)

    def test_native_metrics_remain_independent_of_common_cohort_filter(self) -> None:
        records = [
            record(model, origin_day=2, target_day=2, actual_value=10.0, forecast_value=8.0) for model in MODELS
        ] + [
            record(model, origin_day=3, target_day=3, actual_value=15.0, forecast_value=14.0) for model in MODELS if model != "arima"
        ]

        native = build_native_view(records, MODELS, ["1M"])

        self.assertEqual(native["1M"]["naive"]["verified"], 2)
        self.assertEqual(native["1M"]["arima"]["verified"], 1)

    def test_model_order_does_not_affect_deterministic_result(self) -> None:
        records = [record(model, origin_day=2, target_day=2) for model in MODELS]

        forward = build_strict_common_cohort_view(records, MODELS, ["1M"])
        reversed_result = build_strict_common_cohort_view(list(reversed(records)), list(reversed(MODELS)), ["1M"])

        self.assertEqual(forward["1M"]["commonCohortCount"], reversed_result["1M"]["commonCohortCount"])
        self.assertEqual(forward["1M"]["targetDateParity"], reversed_result["1M"]["targetDateParity"])
        self.assertEqual(forward["1M"]["actualParity"], reversed_result["1M"]["actualParity"])

    def test_method_compatibility_detects_incompatible_method_version(self) -> None:
        records = [record(model, origin_day=2, target_day=2) for model in MODELS]
        records[-1] = record("arima", origin_day=2, target_day=2, method_version="rolling-daily-point-in-time-v2")

        compatibility = verify_method_compatibility(records, MODELS)

        self.assertFalse(compatibility["fourModelMethodCompatibility"])

    def test_strict_common_cohort_rejects_cross_semantics_comparison(self) -> None:
        records = [record(model, origin_day=2, target_day=2) for model in MODELS]
        records.extend(
            record(
                model,
                origin_day=3,
                target_day=3,
                target_semantics="END_OF_PERIOD",
                target_basis="END_OF_PERIOD",
                forecast_method="END_OF_PERIOD",
                method_version="benchmark-forecasting-mvp-phase2-v1",
            )
            for model in MODELS
        )

        with self.assertRaisesRegex(ComparativeBacktestError, "one benchmark, target semantics"):
            build_strict_common_cohort_view(records, MODELS, ["1M"])

    def test_error_and_residual_sign_conventions_are_audited(self) -> None:
        records = [record(model, origin_day=2, target_day=2) for model in MODELS]

        compatibility = verify_method_compatibility(records, MODELS)

        self.assertTrue(compatibility["errorConventionParity"])
        self.assertTrue(compatibility["residualConventionParity"])


if __name__ == "__main__":
    unittest.main()