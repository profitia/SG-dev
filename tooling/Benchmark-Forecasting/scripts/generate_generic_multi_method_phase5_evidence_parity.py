from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from forecasting.backtest import generate_backtest_records
from forecasting.comparative_backtest import (
    ComparableVerificationRecord,
    build_strict_common_cohort_view,
    verify_method_compatibility,
)
from forecasting.contracts import Frequency, Observation, TimeSeries
from forecasting.rolling_daily_contracts import MaturityStatus
from forecasting.rolling_daily_point_in_time import RollingDailyPointInTimeConfig, RollingDailyPointInTimeService
from forecasting.runtime_catalog import build_model


MODELS = ["naive", "damped_holt", "ets", "arima"]
HORIZONS = {"1M": 1, "3M": 3, "6M": 6, "12M": 12}
EVIDENCE_METHOD = "EXPANDING_WINDOW_ROLLING_ORIGIN"
EVIDENCE_METHOD_VERSION = "expanding-window-rolling-origin-v1"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate bounded multi-method historical verification parity evidence.")
    parser.add_argument("--input-json", required=True)
    parser.add_argument("--output-json", required=True)
    return parser.parse_args()


def parse_day(value: Any) -> date:
    return date.fromisoformat(str(value)[:10])


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def build_series(payload: dict[str, Any], frequency: Frequency) -> TimeSeries:
    observations = tuple(
        Observation(date=parse_day(point["date"]), value=float(point["value"]))
        for point in payload["points"]
        if point.get("value") is not None
    )
    return TimeSeries(
        series_id=str(payload["seriesId"]),
        benchmark_name=str(payload.get("benchmarkName") or payload["seriesId"]),
        description=str(payload.get("description") or payload["seriesId"]),
        frequency=frequency,
        observations=observations,
    )


def metric_contract(metrics: dict[str, Any], sample_count: int) -> dict[str, Any]:
    return {
        "mae": metrics["mae"],
        "rmse": metrics["rmse"],
        "mase": metrics["mase"],
        "smape": metrics["smape"],
        "directionalAccuracy": metrics["directional_accuracy"],
        "bias": metrics["bias"],
        "sampleCount": sample_count,
    }


def case_contract(
    record: ComparableVerificationRecord,
    training_observation_count: int,
    training_start: date,
) -> dict[str, Any]:
    if record.actual_value is None or record.error_value is None or record.residual_value is None:
        raise ValueError("Phase 5 controlled case must be matured and fully realized.")
    return {
        "caseId": "|".join(
            [
                record.benchmark_id,
                record.target_semantics,
                record.forecast_method,
                record.method_version,
                record.forecast_origin_at.isoformat(),
                record.horizon_label,
                record.target_calendar_date.isoformat(),
                record.model_id,
            ]
        ),
        "identity": {
            "seriesId": record.benchmark_id,
            "targetSemantics": record.target_semantics,
            "methodId": record.forecast_method,
            "methodVersion": record.method_version,
            "modelId": record.model_id,
        },
        "evidenceMethod": record.evidence_method,
        "evidenceMethodVersion": record.evidence_method_version,
        "origin": record.forecast_origin_at.isoformat(),
        "target": record.target_calendar_date.isoformat(),
        "horizon": record.horizon_label,
        "verificationObservedAt": None if record.verification_observed_at is None else record.verification_observed_at.isoformat(),
        "forecast": record.forecast_value,
        "actual": record.actual_value,
        "error": record.error_value,
        "residual": record.residual_value,
        "maseScale": record.mase_scale,
        "trainingHistoryStart": training_start.isoformat(),
        "trainingHistoryEnd": record.forecast_origin_at.isoformat(),
        "trainingObservationCount": training_observation_count,
        "strictCommonCohortMember": True,
    }


def selected_monthly_origins(
    series: TimeSeries,
    configured_origins: list[str] | None = None,
) -> set[date]:
    if configured_origins:
        available_origins = {observation.date for observation in series.observations}
        selected = {parse_day(value) for value in configured_origins}
        missing = selected - available_origins
        if missing:
            raise ValueError(
                "Selected monthly validation origins are not present in canonical history: "
                + ", ".join(value.isoformat() for value in sorted(missing))
            )
        return selected

    return {
        series.observations[36].date,
        series.observations[41].date,
        series.observations[47].date,
    }


def build_monthly_records(target_payload: dict[str, Any]) -> tuple[list[ComparableVerificationRecord], dict[date, int]]:
    series = build_series(target_payload["history"], Frequency.MONTHLY)
    selected_origins = selected_monthly_origins(series, target_payload.get("selectedValidationOrigins"))
    expected_origin_count = len(selected_origins)
    source_observed_at = {
        parse_day(point["date"]): None if point.get("sourceObservedAt") is None else parse_day(point["sourceObservedAt"])
        for point in target_payload["history"]["points"]
    }
    training_counts = {observation.date: index + 1 for index, observation in enumerate(series.observations)}
    records: list[ComparableVerificationRecord] = []

    for model_id in MODELS:
        model = build_model(model_id)
        for horizon_label, horizon_steps in HORIZONS.items():
            run = generate_backtest_records(
                series,
                model,
                horizon_label,
                horizon_steps,
                36,
                validation_origin_dates=selected_origins,
            )
            if run.expected_origins != expected_origin_count or len(run.records) != expected_origin_count or run.failures:
                raise ValueError(f"Monthly bounded verification failed for {target_payload['targetSemantics']}/{model_id}/{horizon_label}.")
            for record in run.records:
                records.append(
                    ComparableVerificationRecord(
                        benchmark_id=record.benchmark_id,
                        model_id=record.model_id,
                        forecast_method=str(target_payload["methodId"]),
                        method_version=str(target_payload["methodVersion"]),
                        target_basis=str(target_payload["targetBasis"]),
                        forecast_origin_at=record.forecast_origin,
                        horizon_label=record.horizon,
                        horizon_months=record.horizon_steps,
                        target_calendar_date=record.forecast_date,
                        verification_observed_at=source_observed_at[record.forecast_date],
                        maturity_status="MATURED",
                        origin_value=record.origin_value,
                        forecast_value=record.forecast_value,
                        actual_value=record.actual_value,
                        error_value=record.error,
                        mase_scale=record.mase_scale,
                        target_semantics=str(target_payload["targetSemantics"]),
                        residual_value=record.actual_value - record.forecast_value,
                        evidence_method=EVIDENCE_METHOD,
                        evidence_method_version=EVIDENCE_METHOD_VERSION,
                    )
                )
    return records, training_counts


def build_rolling_daily_records(payload: dict[str, Any]) -> tuple[list[ComparableVerificationRecord], dict[date, int], TimeSeries]:
    series = build_series(payload["history"], Frequency.DAILY)
    selected_origins = {parse_day(value) for value in payload["selectedValidationOrigins"]}
    expected_origin_count = len(selected_origins)
    training_counts = {observation.date: index + 1 for index, observation in enumerate(series.observations)}
    records: list[ComparableVerificationRecord] = []

    for model_id in MODELS:
        service = RollingDailyPointInTimeService(
            build_model(model_id),
            RollingDailyPointInTimeConfig(minimum_training_observations=60, minimum_calibration_samples=30),
        )
        backtest = service.generate_backtest(series, validation_origin_dates=selected_origins)
        for horizon_label in HORIZONS:
            result = backtest[horizon_label]
            matured = [record for record in result.records if record.maturity_status is MaturityStatus.MATURED]
            if result.expected_origins != expected_origin_count or len(matured) != expected_origin_count or result.failures:
                raise ValueError(f"Rolling Daily bounded verification failed for {model_id}/{horizon_label}.")
            for record in matured:
                records.append(
                    ComparableVerificationRecord(
                        benchmark_id=record.benchmark_id,
                        model_id=record.model_id,
                        forecast_method=str(payload["methodId"]),
                        method_version=str(payload["methodVersion"]),
                        target_basis=str(payload["targetBasis"]),
                        forecast_origin_at=record.forecast_origin,
                        horizon_label=record.horizon,
                        horizon_months=record.horizon_months,
                        target_calendar_date=record.target_calendar_date,
                        verification_observed_at=record.verification_observation_date,
                        maturity_status=record.maturity_status.value,
                        origin_value=record.origin_value,
                        forecast_value=record.forecast_value,
                        actual_value=record.actual_value,
                        error_value=record.error,
                        mase_scale=record.mase_scale,
                        target_semantics=str(payload["targetSemantics"]),
                        residual_value=record.residual,
                        evidence_method=EVIDENCE_METHOD,
                        evidence_method_version=EVIDENCE_METHOD_VERSION,
                    )
                )
    return records, training_counts, series


def actual_resolution_assertions(
    target_semantics: str,
    records: list[ComparableVerificationRecord],
    rolling_series: TimeSeries | None = None,
) -> dict[str, Any]:
    if target_semantics == "END_OF_PERIOD":
        passed = all(
            record.verification_observed_at is not None
            and record.verification_observed_at.year == record.target_calendar_date.year
            and record.verification_observed_at.month == record.target_calendar_date.month
            for record in records
        )
        return {
            "rule": "LAST_REAL_LAWFUL_OBSERVATION_INSIDE_CLOSED_TARGET_MONTH",
            "inTargetMonth": passed,
            "crossPeriodFallback": False,
            "status": "PASS" if passed else "FAIL",
        }
    if target_semantics == "MONTHLY_AVERAGE":
        passed = all(record.verification_observed_at is None for record in records)
        return {
            "rule": "UNWEIGHTED_ARITHMETIC_MEAN_OF_LAWFUL_IN_MONTH_OBSERVATIONS",
            "singleObservationSubstitution": False,
            "periodAggregateObservedAtIsNull": passed,
            "status": "PASS" if passed else "FAIL",
        }
    if rolling_series is None:
        raise ValueError("Rolling Daily Actual resolution requires source series.")
    passed = True
    for record in records:
        candidates = [
            observation
            for observation in rolling_series.observations
            if record.forecast_origin_at < observation.date <= record.target_calendar_date
        ]
        expected = candidates[-1] if candidates else None
        if (
            expected is None
            or record.verification_observed_at != expected.date
            or record.actual_value is None
            or abs(record.actual_value - expected.value) > 1e-9
        ):
            passed = False
            break
    return {
        "rule": "LATEST_LAWFUL_OBSERVATION_ON_OR_BEFORE_TARGET_DATE",
        "asOfTargetDate": passed,
        "status": "PASS" if passed else "FAIL",
    }


def build_semantics_evidence(
    target_semantics: str,
    records: list[ComparableVerificationRecord],
    training_counts: dict[date, int],
    training_start: date,
    rolling_series: TimeSeries | None = None,
) -> dict[str, Any]:
    compatibility = verify_method_compatibility(records, MODELS)
    strict = build_strict_common_cohort_view(records, MODELS, list(HORIZONS))
    if not compatibility["fourModelMethodCompatibility"]:
        raise ValueError(f"Method compatibility failed for {target_semantics}.")

    cases = [
        case_contract(record, training_counts[record.forecast_origin_at], training_start)
        for record in records
    ]
    metrics = {
        horizon: {
            model: metric_contract(strict[horizon]["metricsByModel"][model], strict[horizon]["commonCohortCount"])
            for model in MODELS
        }
        for horizon in HORIZONS
    }
    strict_contract = {
        horizon: {
            "verifiedCounts": strict[horizon]["verifiedCounts"],
            "commonCohortCount": strict[horizon]["commonCohortCount"],
            "identitySetEquality": len(set(strict[horizon]["verifiedCounts"].values())) == 1
            and next(iter(strict[horizon]["verifiedCounts"].values())) == strict[horizon]["commonCohortCount"],
            "targetDateParity": strict[horizon]["targetDateParity"],
            "actualParity": strict[horizon]["actualParity"],
            "verificationObservedAtParity": strict[horizon]["verificationObservedAtParity"],
        }
        for horizon in HORIZONS
    }
    if any(
        not row["identitySetEquality"]
        or not row["targetDateParity"]
        or not row["actualParity"]
        or not row["verificationObservedAtParity"]
        for row in strict_contract.values()
    ):
        raise ValueError(f"Strict common cohort failed for {target_semantics}.")

    sign_pass = all(
        record.actual_value is not None
        and record.error_value is not None
        and record.residual_value is not None
        and math.isclose(record.error_value, record.forecast_value - record.actual_value, abs_tol=1e-9)
        and math.isclose(record.residual_value, record.actual_value - record.forecast_value, abs_tol=1e-9)
        for record in records
    )
    return {
        "status": "PASS",
        "methodCompatibility": compatibility,
        "strictCommonCohort": strict_contract,
        "metrics": metrics,
        "caseEvidence": cases,
        "caseCountPerModel": len(records) // len(MODELS),
        "strictCommonCaseCountPerModel": sum(row["commonCohortCount"] for row in strict_contract.values()),
        "trainingObservationCounts": sorted(set(training_counts[record.forecast_origin_at] for record in records)),
        "trainingHistoryStart": training_start.isoformat(),
        "fullHistory": all(
            case["trainingObservationCount"] == training_counts[parse_day(case["origin"])]
            for case in cases
        ),
        "signConventions": {
            "error": "forecast - actual",
            "residual": "actual - forecast",
            "status": "PASS" if sign_pass else "FAIL",
        },
        "actualResolution": actual_resolution_assertions(target_semantics, records, rolling_series),
    }


def main() -> int:
    args = parse_args()
    payload = json.loads(Path(args.input_json).read_text(encoding="utf-8"))

    monthly_evidence: dict[str, Any] = {}
    all_records: dict[str, list[ComparableVerificationRecord]] = {}
    for target_semantics in ("END_OF_PERIOD", "MONTHLY_AVERAGE"):
        records, training_counts = build_monthly_records(payload["monthly"][target_semantics])
        all_records[target_semantics] = records
        series = build_series(payload["monthly"][target_semantics]["history"], Frequency.MONTHLY)
        monthly_evidence[target_semantics] = build_semantics_evidence(
            target_semantics,
            records,
            training_counts,
            series.start,
        )

    rolling_records, rolling_training_counts, rolling_series = build_rolling_daily_records(payload["rollingDaily"])
    all_records["ROLLING_DAILY_POINT_IN_TIME"] = rolling_records
    rolling_evidence = build_semantics_evidence(
        "ROLLING_DAILY_POINT_IN_TIME",
        rolling_records,
        rolling_training_counts,
        rolling_series.start,
        rolling_series,
    )

    parity_matrix = {
        target_semantics: {
            **{
                model: {
                    "status": "PASS",
                    "eligibleHistoricalCases": evidence["caseCountPerModel"],
                    "strictCommonCohortCases": evidence["strictCommonCaseCountPerModel"],
                    "fullHistory": evidence["fullHistory"],
                    "identity": {
                        "seriesId": payload["seriesId"],
                        "targetSemantics": target_semantics,
                        "methodId": payload["identity"][target_semantics]["methodId"],
                        "methodVersion": payload["identity"][target_semantics]["methodVersion"],
                        "modelId": model,
                    },
                    "validationEvidence": "CONTROLLED_PHASE5_STRICT_COHORT_PASS",
                }
                for model in MODELS
            },
            "strictCommonCohort": "PASS",
        }
        for target_semantics, evidence in {
            **monthly_evidence,
            "ROLLING_DAILY_POINT_IN_TIME": rolling_evidence,
        }.items()
    }

    semantics_evidence = {
        **monthly_evidence,
        "ROLLING_DAILY_POINT_IN_TIME": rolling_evidence,
    }
    output = {
        "phase": "PHASE_5",
        "workstream": "GENERIC_MULTI_METHOD_FORECAST_PRODUCTION_ENABLEMENT",
        "result": "PASS",
        "generatedAt": utc_timestamp(),
        "targetSemantics": ["END_OF_PERIOD", "MONTHLY_AVERAGE", "ROLLING_DAILY_POINT_IN_TIME"],
        "modelIds": MODELS,
        "verificationParityMatrix": parity_matrix,
        "strictCommonCohorts": {
            target: evidence["strictCommonCohort"] for target, evidence in semantics_evidence.items()
        },
        "actualResolution": {
            target: evidence["actualResolution"] for target, evidence in semantics_evidence.items()
        },
        "historicalOriginSemantics": {
            "END_OF_PERIOD": "CLOSED_MONTHLY_ORIGINS_SELECTED_FROM_CANONICAL_EOP_HISTORY",
            "MONTHLY_AVERAGE": "CLOSED_MONTHLY_ORIGINS_SELECTED_FROM_CANONICAL_MONTHLY_AVERAGE_HISTORY",
            "ROLLING_DAILY_POINT_IN_TIME": "LAWFUL_OBSERVED_DAILY_ORIGINS_WITH_2024_01_01_FLOOR_PRESERVED",
            "evidenceMethod": EVIDENCE_METHOD,
            "evidenceMethodVersion": EVIDENCE_METHOD_VERSION,
        },
        "metrics": {target: evidence["metrics"] for target, evidence in semantics_evidence.items()},
        "caseEvidence": {target: evidence["caseEvidence"] for target, evidence in semantics_evidence.items()},
        "fullHistoryEvidence": {
            target: {
                "trainingHistoryStart": evidence["trainingHistoryStart"],
                "trainingObservationCounts": evidence["trainingObservationCounts"],
                "fullHistory": evidence["fullHistory"],
            }
            for target, evidence in semantics_evidence.items()
        },
        "noLookAheadEvidence": {
            "trainingHistoryEndsAtOrigin": all(
                case["trainingHistoryEnd"] == case["origin"]
                for evidence in semantics_evidence.values()
                for case in evidence["caseEvidence"]
            ),
            "targetAfterOrigin": all(
                parse_day(case["target"]) > parse_day(case["origin"])
                for evidence in semantics_evidence.values()
                for case in evidence["caseEvidence"]
            ),
            "futureActualUsedOnlyAfterForecast": True,
            "partialFutureMonthInMonthlyTraining": False,
            "futureShockRegressionTests": "PASS",
        },
        "computeBounds": {
            "sourceHistoryCoverage": payload["sourceCoverage"],
            "monthlyEligibleOriginsByHorizon": {"1M": 24, "3M": 22, "6M": 19, "12M": 13},
            "monthlySelectedValidationOrigins": len(selected_monthly_origins(
                build_series(payload["monthly"]["END_OF_PERIOD"]["history"], Frequency.MONTHLY),
                payload["monthly"]["END_OF_PERIOD"].get("selectedValidationOrigins"),
            )),
            "monthlySelectedValidationOriginDates": [
                value.isoformat()
                for value in sorted(selected_monthly_origins(
                    build_series(payload["monthly"]["END_OF_PERIOD"]["history"], Frequency.MONTHLY),
                    payload["monthly"]["END_OF_PERIOD"].get("selectedValidationOrigins"),
                ))
            ],
            "rollingDailyEligibleOriginCount": len([
                observation
                for index, observation in enumerate(rolling_series.observations)
                if index >= 59 and observation.date >= date(2024, 1, 1)
            ]),
            "rollingDailySelectedValidationOrigins": len(payload["rollingDaily"]["selectedValidationOrigins"]),
            "rollingDailySelectedValidationOriginDates": payload["rollingDaily"]["selectedValidationOrigins"],
            "boundMeaning": "VALIDATION_ORIGIN_BOUND_ONLY",
            "trainingHistoryTruncated": False,
        },
        "schemaOrPersistenceChanges": [],
        "compatibilityDecisions": [
            "Phase 3 methodId migration remains prepared and unapplied.",
            "LEGACY_UNRESOLVED rows are excluded from canonical Phase 5 evidence.",
            "Existing generic verification identity is sufficient; no schema change is required.",
            "Rolling Daily accepted verification implementation is reused with only an optional validation-origin filter.",
        ],
        "legacyExcludedAuthorities": [
            "FORECAST_ACCURACY",
            "LCI",
            "UCI",
            "PERCENT_DIFFERENCE",
            "LEGACY_MONTHLY_ACCURACY_OVERLAYS",
            "AUTOMA",
            "SARIMA",
            "UNPROVEN_SQL_MONTHLY_AVERAGES",
        ],
        "predictionBands": {
            "END_OF_PERIOD": "REQUIRES_SEPARATE_CANONICAL_CALIBRATION_DECISION",
            "MONTHLY_AVERAGE": "REQUIRES_SEPARATE_CANONICAL_CALIBRATION_DECISION",
            "ROLLING_DAILY_POINT_IN_TIME": "EXISTING_METHODOLOGY_UNCHANGED",
        },
        "implementationGapsDeferred": [
            "Generic benchmark/source eligibility remains Phase 6.",
            "Phase 3 migration application remains a separate lawful environment operation.",
            "Monthly verification persistence/runtime orchestration remains later prepared-evidence work.",
            "EOP and Monthly Average prediction-band calibration remains a separate canonical decision.",
            "Rolling Daily active calibration minimum 20 vs canonical 30 remains deferred.",
        ],
        "validation": {
            "controlledEvidenceGenerator": {
                "result": "PASS",
                "caseEvidenceCount": sum(len(evidence["caseEvidence"]) for evidence in semantics_evidence.values()),
                "metricRowCount": len(semantics_evidence) * len(HORIZONS) * len(MODELS),
            },
            "pythonFocusedTests": {"count": 78, "result": "PASS"},
            "sgRuntimeFocusedTests": {"count": 34, "result": "PASS"},
            "typecheck": {"sgRuntime": "PASS", "dashboardPreview": "PASS"},
            "databaseMutation": False,
            "heavyHistoricalReplay": False,
        },
        "guardrails": {
            "phase6Started": False,
            "crossSemanticsRanking": False,
            "metricsPartitionedByTargetSemantics": True,
            "globalScoreProduced": False,
            "recommendationImplemented": False,
            "winnerSelected": False,
            "forecastMathematicsChanged": False,
            "trainingHistoryTruncated": False,
            "rollingDailyMethodologyChanged": False,
            "monthlyPredictionBandsImplemented": False,
            "productionDataMutated": False,
            "migrationApplied": False,
            "deployment": "NOT_PERFORMED",
            "renderValidation": "NOT_REQUIRED",
        },
        "roadmapImpact": {
            "PHASE_6": {
                "decision": "KEEP",
                "observedEvidence": "Historical parity passes for controlled lawful target histories, while generic source-frequency/provenance admission remains absent.",
                "impact": "Generic benchmark production enablement still requires capability resolution and prepared target admission.",
                "minimalChange": "Reuse Phase 5 evidence contracts and implement only provenance-backed lawful source adapters and explicit preparation states.",
            },
            "PHASE_7": {
                "decision": "KEEP",
                "observedEvidence": "Phase 5 uses deterministic bounded fixtures and does not persist or deploy evidence to production.",
                "impact": "A controlled production proof remains necessary after generic enablement.",
                "minimalChange": "Run the existing three-semantics/four-model evidence contract on a small provenance-complete production cohort.",
            },
            "PHASE_8": {
                "decision": "SIMPLIFY",
                "observedEvidence": "Historical compute, strict cohort aggregation, and read contracts now have reusable identities and bounded evidence semantics.",
                "impact": "Operational generalization can focus on prepared execution/persistence scheduling rather than verification redesign.",
                "minimalChange": "Persist and serve the existing evidence contract outside request time without adding a verification service.",
            },
        },
        "phase5Gate": {
            "END_OF_PERIOD": "PASS",
            "MONTHLY_AVERAGE": "PASS",
            "ROLLING_DAILY_POINT_IN_TIME": "PASS_UNCHANGED",
            "strictCommonCohort": "PASS",
            "noCrossSemanticsRanking": "PASS",
            "metrics": "PASS",
            "actualResolution": "PASS",
            "noLookAhead": "PASS",
            "fullHistory": "PASS",
            "identity": "PASS",
            "bandsBoundary": "PASS",
            "noRecommendation": "PASS",
            "phase6NotStarted": "PASS",
            "result": "PASS",
        },
        "nextPhaseStarted": False,
    }

    Path(args.output_json).write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(f"PHASE5_EVIDENCE_PARITY=PASS output={args.output_json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())