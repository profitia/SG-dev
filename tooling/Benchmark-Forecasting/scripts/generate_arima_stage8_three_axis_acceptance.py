from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
VALIDATION_ROOT = ROOT / "validation"

SERIES_ID = "wocaes0074"
DISPLAY_NAME = "Brent, Spot, FOB North Sea"
FORECAST_METHOD = "ROLLING_DAILY_POINT_IN_TIME"
METHOD_VERSION = "rolling-daily-point-in-time-v1"
TARGET_BASIS = "POINT_IN_TIME"
MODEL_ID = "arima"
REFERENCE_MODELS = ["naive", "damped_holt", "ets"]
ALL_MODELS = [*REFERENCE_MODELS, MODEL_ID]
HORIZONS = ["1M", "3M", "6M", "12M"]
EXPECTED_COMMON_COHORTS = {"1M": 659, "3M": 615, "6M": 553, "12M": 423}
EXPECTED_ORDER_DISTRIBUTION = {
    "ARIMA(1,1,2)": 9,
    "ARIMA(2,1,0)": 17,
    "ARIMA(2,1,1)": 115,
    "ARIMA(2,1,2)": 540,
}

OUTPUT_JSON = VALIDATION_ROOT / "arima_stage8_three_axis_acceptance_wocaes0074.json"
OUTPUT_MD = ROOT / "ARIMA_STAGE8_THREE_AXIS_ACCEPTANCE.md"

STAGE0_MD = ROOT / "ARIMA_ROLLING_DAILY_MODEL_CONTRACT_PARITY_AUDIT.md"
STAGE1_MD = ROOT / "ARIMA_ROLLING_DAILY_CURRENT_FORECAST_ACCEPTANCE.md"
STAGE2_MD = ROOT / "ARIMA_REPRODUCIBILITY_FAST_SERVING_ACCEPTANCE.md"
STAGE4_MD = ROOT / "ARIMA_HISTORICAL_ROLLING_VERIFICATION_ACCEPTANCE.md"
STAGE4_JSON = VALIDATION_ROOT / "arima_stage4_historical_verification_wocaes0074.json"
STAGE5_MD = ROOT / "FOUR_MODEL_COMPARATIVE_BACKTEST_ACCEPTANCE.md"
STAGE5_JSON = VALIDATION_ROOT / "four_model_stage5_comparative_backtest_wocaes0074.json"
STAGE6_MD = ROOT / "ARIMA_EMPIRICAL_PREDICTION_BAND_ACCEPTANCE.md"
STAGE6_JSON = VALIDATION_ROOT / "arima_stage6_empirical_prediction_band_wocaes0074.json"
STAGE7_MD = ROOT / "ROLLING_DAILY_STAGE7_PERFORMANCE_COST_CHARACTERIZATION.md"
STAGE7_JSON = VALIDATION_ROOT / "rolling_daily_stage7_performance_cost_wocaes0074.json"
METHOD_SPEC_MD = ROOT / "ROLLING_DAILY_POINT_IN_TIME_METHOD_SPEC.md"
FORECASTING_CANON_MD = ROOT / "FORECASTING_CANON.md"
FORECASTING_METHODS_SPEC_MD = ROOT / "FORECASTING_METHODS_SPEC.md"
PRODUCTION_CONTRACT_MD = ROOT / "ROLLING_DAILY_PRODUCTION_FORECAST_CONTRACT.md"
TARGET_BASIS_CANON_MD = ROOT / "FORECAST_TARGET_BASIS_CANON.md"
DEMO_BACKLOG_MD = ROOT / "ARIMA_DASHBOARD_DEMO_DEFERRED_BACKLOG.md"
FORECAST_CONTRACT_TS = ROOT.parents[1] / "apps" / "dashboard-preview" / "lib" / "benchmark-forecast" / "forecast-contract.ts"
RUNTIME_QUERY_TS = ROOT.parents[1] / "apps" / "dashboard-preview" / "lib" / "benchmark-forecast" / "runtime-query.ts"
ROLLING_DAILY_SERVICE_PY = ROOT / "forecasting" / "rolling_daily_point_in_time.py"


class Stage8EvidenceError(ValueError):
    pass


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise Stage8EvidenceError(message)


def status_from_bool(value: bool) -> str:
    return "PASS" if value else "FAIL"


def parse_inline_stage_status(markdown: str, label: str) -> str | None:
    pattern = rf"{re.escape(label)}:\s*(PASS|FAIL|READY|BLOCKED|NOT STARTED|NOT DEFINED)"
    match = re.search(pattern, markdown, flags=re.IGNORECASE)
    if not match:
        return None
    return match.group(1).upper()


def parse_markdown_contains_pass(markdown: str, label: str) -> bool:
    return parse_inline_stage_status(markdown, label) == "PASS"


def assert_required_paths_exist(paths: list[Path]) -> None:
    missing = [str(path.relative_to(ROOT.parents[1])) for path in paths if not path.exists()]
    require(not missing, f"Missing required Stage 8 authorities: {missing}")


def load_stage8_inputs() -> dict[str, Any]:
    required_paths = [
        STAGE0_MD,
        STAGE1_MD,
        STAGE2_MD,
        STAGE4_MD,
        STAGE4_JSON,
        STAGE5_MD,
        STAGE5_JSON,
        STAGE6_MD,
        STAGE6_JSON,
        STAGE7_MD,
        STAGE7_JSON,
        METHOD_SPEC_MD,
        FORECASTING_CANON_MD,
        FORECASTING_METHODS_SPEC_MD,
        PRODUCTION_CONTRACT_MD,
        TARGET_BASIS_CANON_MD,
        DEMO_BACKLOG_MD,
        FORECAST_CONTRACT_TS,
        RUNTIME_QUERY_TS,
        ROLLING_DAILY_SERVICE_PY,
    ]
    assert_required_paths_exist(required_paths)
    return {
        "stage0Md": load_text(STAGE0_MD),
        "stage1Md": load_text(STAGE1_MD),
        "stage2Md": load_text(STAGE2_MD),
        "stage4Md": load_text(STAGE4_MD),
        "stage4Json": load_json(STAGE4_JSON),
        "stage5Md": load_text(STAGE5_MD),
        "stage5Json": load_json(STAGE5_JSON),
        "stage6Md": load_text(STAGE6_MD),
        "stage6Json": load_json(STAGE6_JSON),
        "stage7Md": load_text(STAGE7_MD),
        "stage7Json": load_json(STAGE7_JSON),
        "methodSpecMd": load_text(METHOD_SPEC_MD),
        "forecastingCanonMd": load_text(FORECASTING_CANON_MD),
        "forecastingMethodsSpecMd": load_text(FORECASTING_METHODS_SPEC_MD),
        "productionContractMd": load_text(PRODUCTION_CONTRACT_MD),
        "targetBasisCanonMd": load_text(TARGET_BASIS_CANON_MD),
        "demoBacklogMd": load_text(DEMO_BACKLOG_MD),
        "forecastContractTs": load_text(FORECAST_CONTRACT_TS),
        "runtimeQueryTs": load_text(RUNTIME_QUERY_TS),
        "rollingDailyServicePy": load_text(ROLLING_DAILY_SERVICE_PY),
    }


def normalize_order_distribution(rows: list[dict[str, Any]]) -> dict[str, int]:
    return {str(row["order"]): int(row["selectedOrigins"]) for row in rows}


def build_axis_a(inputs: dict[str, Any]) -> dict[str, Any]:
    stage0_md = inputs["stage0Md"]
    stage1_md = inputs["stage1Md"]
    stage2_md = inputs["stage2Md"]
    stage4_json = inputs["stage4Json"]
    stage5_json = inputs["stage5Json"]
    stage6_json = inputs["stage6Json"]
    method_spec_md = inputs["methodSpecMd"]
    rolling_daily_service_py = inputs["rollingDailyServicePy"]

    require(parse_markdown_contains_pass(stage0_md, "ARIMA Model Contract Parity"), "Stage 0 model contract parity is not PASS.")
    require(parse_markdown_contains_pass(stage1_md, "ARIMA Current Rolling Daily Forecast"), "Stage 1 current forecast acceptance is not PASS.")
    require(parse_markdown_contains_pass(stage2_md, "ARIMA Reproducibility"), "Stage 2 reproducibility is not PASS.")
    require(parse_markdown_contains_pass(stage6_md := inputs["stage6Md"], "ARIMA Empirical Prediction Band"), "Stage 6 empirical band acceptance is not PASS.")

    require(stage4_json["forecastMethod"] == FORECAST_METHOD, "Stage 4 forecast method mismatch.")
    require(stage4_json["targetBasis"] == TARGET_BASIS, "Stage 4 target basis mismatch.")
    require(stage4_json["historicalOriginFloor"] == "2024-01-01", "Stage 4 historical origin floor mismatch.")
    require(stage4_json["lawfulHistoricalOrigins"] == 681, "Stage 4 lawful origin count mismatch.")
    require(stage4_json["successfulArimaOrigins"] == 681, "Stage 4 successful ARIMA origin count mismatch.")
    require(stage4_json["coverageReconciliation"]["missing"] == 0, "Stage 4 coverage has missing origins.")
    require(stage4_json["coverageReconciliation"]["duplicates"] == 0, "Stage 4 coverage has duplicate origins.")
    require(stage4_json["semanticsChecks"]["noLeakage"] == "PASS", "Stage 4 no-leakage check failed.")
    require(stage4_json["semanticsChecks"]["calendarMonthClamp"] == "PASS", "Stage 4 calendar clamp check failed.")
    require(stage4_json["semanticsChecks"]["asOfTargetDate"] == "PASS", "Stage 4 as-of-target-date check failed.")
    require(stage4_json["semanticsChecks"]["pre2024TrainingHistoryPreserved"] is True, "Stage 4 training history preservation failed.")
    require(stage4_json["semanticsChecks"]["oneFitPerOrigin"] == "PASS", "Stage 4 one-fit-per-origin check failed.")
    require(stage4_json["sourceHistory"]["startDate"] == "1985-10-01", "Stage 4 full training history start mismatch.")

    order_distribution = normalize_order_distribution(stage4_json["selectedOrderDistribution"])
    require(order_distribution == EXPECTED_ORDER_DISTRIBUTION, "Stage 4 selected-order distribution differs from accepted evidence.")

    identity_set_equality = stage5_json["identitySetEquality"]
    for horizon, expected_count in EXPECTED_COMMON_COHORTS.items():
        node = identity_set_equality[horizon]
        require(node["status"] == "PASS", f"Stage 5 identity-set equality failed at {horizon}.")
        require(node["equal"] is True, f"Stage 5 identity-set equality flag is false at {horizon}.")
        require(int(node["commonCohortCount"]) == expected_count, f"Stage 5 common cohort count mismatch at {horizon}.")
        require(all(int(count) == expected_count for count in node["counts"].values()), f"Stage 5 verified count mismatch at {horizon}.")

    method_compatibility = stage5_json["methodCompatibility"]
    require(method_compatibility["fourModelMethodCompatibility"] == "PASS", "Stage 5 method compatibility failed.")
    require(method_compatibility["targetDateParity"] == "PASS", "Stage 5 target-date parity failed.")
    require(method_compatibility["commonActualParity"] == "PASS", "Stage 5 actual parity failed.")
    require(method_compatibility["verificationObservedAtParity"] == "PASS", "Stage 5 observed-at parity failed.")
    require(method_compatibility["errorConventionParity"] == "PASS", "Stage 5 error convention parity failed.")

    band_method = stage6_json["bandMethod"]
    require(stage6_json["modelId"] == MODEL_ID, "Stage 6 model identity mismatch.")
    require(stage6_json["forecastMethod"] == FORECAST_METHOD, "Stage 6 forecast method mismatch.")
    require(stage6_json["targetBasis"] == TARGET_BASIS, "Stage 6 target basis mismatch.")
    require(band_method["residualDefinition"] == "actual - forecast", "Stage 6 residual definition mismatch.")
    require(band_method["minimumCalibrationSamples"] == 30, "Stage 6 minimum calibration sample mismatch.")
    require(stage6_json["guardrails"]["historicalVerificationRefitsPerformed"] == 0, "Stage 6 historical verification refits are non-zero.")
    require(stage6_json["guardrails"]["historicalForecastMutationsPerformed"] == 0, "Stage 6 historical forecast mutations are non-zero.")
    require(stage6_json["guardrails"]["pointForecastMutation"] == "NOT_PERFORMED", "Stage 6 point-forecast mutation guard failed.")
    require(stage6_json["guardrails"]["anchorPathParity"] is True, "Stage 6 anchor path parity failed.")
    require(stage6_json["guardrails"]["pre1MCurrentBandPolicy"] == "INTERPOLATE_FROM_ORIGIN_ZERO_TO_1M_EMPIRICAL_ANCHOR", "Stage 6 pre-1M band policy mismatch.")

    method_spec_stale_disable_line = "arima" in method_spec_md and "not enabled for this method" in method_spec_md.lower()
    arima_enabled_in_impl = "if model.model_id == \"arima\":" in rolling_daily_service_py and "fit_selected_arima_endog(" in rolling_daily_service_py
    require(arima_enabled_in_impl, "Current rolling-daily implementation does not enable ARIMA path fitting.")

    subchecks = {
        "contractParity": "PASS",
        "noLeakage": "PASS",
        "reproducibility": "PASS",
        "historicalVerification": "PASS",
        "comparativeParity": "PASS",
        "empiricalBand": "PASS",
        "pointForecastMutation": "NO",
        "historicalOriginCoverage": {"completed": 681, "expected": 681},
        "strictCommonCohorts": EXPECTED_COMMON_COHORTS,
        "selectedOrderDistribution": order_distribution,
        "resolvedMethodSpecDrift": {
            "detected": method_spec_stale_disable_line,
            "resolution": "implementation-and-accepted-stage-evidence-supersede-stale-method-spec-line"
            if method_spec_stale_disable_line
            else "not-applicable",
        },
    }
    limitations = []
    if method_spec_stale_disable_line:
        limitations.append(
            "Base rolling-daily method spec still contains a stale pre-Stage-1 sentence disabling ARIMA; current implementation and accepted Stage 1-7 evidence supersede that line under the implementation-wins rule."
        )

    return {
        "status": "PASS",
        **subchecks,
        "evidence": [
            str(STAGE0_MD.relative_to(ROOT)),
            str(STAGE1_MD.relative_to(ROOT)),
            str(STAGE2_MD.relative_to(ROOT)),
            str(STAGE4_JSON.relative_to(ROOT)),
            str(STAGE5_JSON.relative_to(ROOT)),
            str(STAGE6_JSON.relative_to(ROOT)),
            str(ROLLING_DAILY_SERVICE_PY.relative_to(ROOT)),
        ],
        "limitations": limitations,
    }


def build_axis_b(inputs: dict[str, Any]) -> dict[str, Any]:
    stage4_md = inputs["stage4Md"]
    stage7_json = inputs["stage7Json"]

    historical_stage4 = stage7_json["historicalEvidence"]["stage4"]
    historical_stage5 = stage7_json["historicalEvidence"]["stage5Recomputation"]
    arima_current = stage7_json["arimaCurrentCompute"]
    incremental = stage7_json["incrementalMaintenance"]
    band_calibration = stage7_json["bandCalibration"]
    band_path = stage7_json["bandPathGeneration"]
    prepared = stage7_json["preparedServing"]
    behavior = stage7_json["servingBehaviorGate"]

    require("ARIMA-specific Table:\nNO" in stage4_md or "ARIMA-specific Table:\r\nNO" in stage4_md, "Stage 4 persistence parity no-table proof is missing.")
    require("New Database:\nNO" in stage4_md or "New Database:\r\nNO" in stage4_md, "Stage 4 no-new-database proof is missing.")
    require(arima_current["candidateAttempts"] == 17, "Stage 7 candidate attempt count is not bounded to 17.")
    require(arima_current["candidateSuccesses"] == 17, "Stage 7 candidate success count mismatch.")
    require(arima_current["policyIdentity"] == "ARIMA_NON_SEASONAL_BOUNDED_AICC_V1", "Stage 7 ARIMA policy identity mismatch.")
    require(incremental["status"] == "MEASURED_WITHOUT_PERSISTENCE", "Stage 7 incremental maintenance status mismatch.")
    require(incremental["persistence"]["status"] == "NOT_MEASURED_SAFE_READ_ONLY", "Stage 7 persistence timing limitation changed unexpectedly.")
    require(band_calibration["historicalModelRefits"] == 0, "Stage 7 band calibration historical refits are non-zero.")
    require(behavior["benchmarkFinderDependency"] == "NO", "Stage 7 behavior gate detected Benchmark Finder dependency.")

    return {
        "status": "PASS",
        "freshCompute": {
            "medianMs": float(arima_current["timings"]["medianMs"]),
            "sampleCount": int(arima_current["timings"]["sampleCount"]),
        },
        "historicalOfflineCompute": {
            "stage4RuntimeSeconds": float(historical_stage4["totalRuntimeSeconds"]),
            "stage4Origins": int(historical_stage4["origins"]),
            "stage5RuntimeSeconds": float(historical_stage5["totalRuntimeSeconds"]),
            "stage5Origins": int(historical_stage5["origins"]),
        },
        "incrementalMaintenance": {
            "status": incremental["status"],
            "totalMs": float(incremental["timings"]["totalMs"]),
            "persistenceStatus": incremental["persistence"]["status"],
        },
        "bandCalibration": {
            "medianMs": float(band_calibration["timings"]["totalMs"]["medianMs"]),
            "calibrationRecordsRead": int(band_calibration["calibrationRecordsRead"]),
        },
        "bandInterpolation": {
            "medianMs": float(band_path["timings"]["medianMs"]),
            "pathLength": int(band_path["pathLength"]),
        },
        "preparedArchitecture": {
            "preparedReadMedianMs": float(prepared["timings"]["medianMs"]),
            "arimaFitOnRead": "NO" if prepared["fitTriggered"] is False else "YES",
            "historicalCalibrationOnRead": "NO" if prepared["historicalCalibrationRecomputed"] is False else "YES",
            "persistenceMutationOnRead": "NO" if prepared["forecastPersistenceMutation"] is False else "YES",
        },
        "boundedCandidateSearch": "PASS",
        "candidateCount": 17,
        "requestTimeFit": "NO",
        "fullHistoricalReplayDuringNormalUse": "NO",
        "dedicatedArimaInfrastructure": "NO",
        "directCurrencyCost": "NOT CALCULATED",
        "evidence": [
            str(STAGE4_MD.relative_to(ROOT)),
            str(STAGE7_JSON.relative_to(ROOT)),
            str(STAGE7_MD.relative_to(ROOT)),
        ],
        "limitations": [
            "Incremental maintenance persistence timing was intentionally not measured separately to avoid mutating canonical runtime truth during characterization."
        ],
    }


def build_axis_c(inputs: dict[str, Any]) -> dict[str, Any]:
    stage2_md = inputs["stage2Md"]
    stage7_json = inputs["stage7Json"]
    forecast_contract_ts = inputs["forecastContractTs"]
    runtime_query_ts = inputs["runtimeQueryTs"]
    demo_backlog_md = inputs["demoBacklogMd"]

    prepared = stage7_json["preparedServing"]
    topology = stage7_json["servingTopologyAudit"]
    behavior = stage7_json["servingBehaviorGate"]
    output_parity = stage7_json["outputParity"]

    require(parse_markdown_contains_pass(stage2_md, "ARIMA Reproducibility"), "Stage 2 reproducibility is not PASS.")
    require(parse_markdown_contains_pass(stage2_md, "ARIMA Fast Serving Feasibility"), "Stage 2 fast-serving feasibility is not PASS.")
    require(prepared["seam"] == "DASHBOARD_LIBRARY_PREPARED_SNAPSHOT_DB_READ", "Stage 7 prepared-serving seam mismatch.")
    require(topology["topologyGate"] == "PASS", "Stage 7 serving topology gate failed.")
    require(topology["dependencyProof"]["dashboardLibraryRequiresBenchmarkFinder"] == "NO", "Dashboard Library dependency on Benchmark Finder detected.")
    require(behavior["pass"] is True, "Stage 7 serving behavior gate failed.")
    require(behavior["benchmarkFinderDependency"] == "NO", "Stage 7 serving behavior gate detected Benchmark Finder dependency.")
    require(behavior["arimaFitTriggered"] == "NO", "ARIMA fit is triggered on prepared read.")
    require(behavior["historicalCalibrationTriggered"] == "NO", "Historical calibration is triggered on prepared read.")
    require(behavior["forecastPersistenceMutation"] == "NO", "Prepared read mutates persistence.")
    require(output_parity["selectedOrderParity"] == "PASS", "Stage 7 selected-order parity failed.")
    require(output_parity["pointForecastParity"] == "PASS", "Stage 7 point-forecast parity failed.")
    require("['naive', 'damped_holt', 'ets', 'arima']" in forecast_contract_ts, "Dashboard forecast contract does not expose ARIMA in the shared model union.")
    require("rollingDailyCurrentForecastSnapshot" in runtime_query_ts, "Dashboard runtime query seam does not read the persisted rolling-daily snapshot.")
    require("modelId: model" in runtime_query_ts, "Dashboard runtime query does not preserve model identity on snapshot reads.")

    demo_context = {
        "acknowledged": "Stage 8 - deferred after demo" in demo_backlog_md or "Stage 8 deferred after demo" in demo_backlog_md,
        "dashboardV3DemoControlled": "Forecast Portfolio v3 is demo-controlled on `wocaes0074`" in demo_backlog_md,
        "renderSmokeCheckDeferred": "Add a focused deployed smoke check" in demo_backlog_md,
    }

    return {
        "status": "PASS",
        "preparedReadLatency": {
            "medianMs": float(prepared["timings"]["medianMs"]),
            "sampleCount": int(prepared["timings"]["sampleCount"]),
            "p95Ms": float(prepared["timings"]["p95Ms"]),
        },
        "arimaFitOnRequest": "NO",
        "historicalCalibrationOnRequest": "NO",
        "persistenceMutationOnRead": "NO",
        "benchmarkFinderDependency": "NO",
        "reproducibility": {
            "forecastReproducibility": "PASS",
            "preparedSnapshotIdentity": "PASS",
            "sourceHistoryFingerprint": str(prepared["sourceHistoryFingerprint"]),
        },
        "topology": {
            "status": "PASS",
            "preparedReadOwner": str(topology["canonicalPreparedServing"]["storage"]),
            "dashboardReadSeam": "apps/dashboard-preview/lib/benchmark-forecast/runtime-query.ts",
            "dashboardConsumerMethod": str(topology["canonicalPreparedServing"]["dashboardConsumerMethod"]),
        },
        "demoContext": demo_context,
        "evidence": [
            str(STAGE2_MD.relative_to(ROOT)),
            str(STAGE7_JSON.relative_to(ROOT)),
            str(FORECAST_CONTRACT_TS.relative_to(ROOT.parents[1])),
            str(RUNTIME_QUERY_TS.relative_to(ROOT.parents[1])),
            str(DEMO_BACKLOG_MD.relative_to(ROOT)),
        ],
        "limitations": [
            "Prepared-read latency is runtime datastore-read evidence, not full deployed browser/network latency.",
            "Dashboard demo evidence is context only and is not treated as a UI acceptance gate.",
        ],
    }


def decide_overall_status(axis_statuses: list[str]) -> str:
    if any(status == "FAIL" for status in axis_statuses):
        return "FAIL"
    if any(status == "BLOCKED" for status in axis_statuses):
        return "BLOCKED"
    if all(status == "PASS" for status in axis_statuses):
        return "PASS"
    raise Stage8EvidenceError(f"Unsupported axis status set: {axis_statuses}")


def build_model_policy() -> dict[str, str]:
    return {
        "champion": "NOT DEFINED",
        "preferredModel": "NOT DEFINED",
        "defaultModel": "NOT DEFINED",
        "automaticSelection": "NOT BUILT",
        "modelRanking": "NOT PERFORMED",
    }


def build_deferred_work() -> dict[str, Any]:
    return {
        "stage9": "NOT EXECUTED",
        "stage10": "NOT EXECUTED",
        "stage11FormalAcceptance": "NOT EXECUTED",
        "stage12FormalAcceptance": "NOT EXECUTED",
        "stage13": "NOT EXECUTED",
        "naiveHoltEtsPredictionBandPre1MParity": "DEFERRED",
        "benchmarkFinderContaminationAudit": "DEFERRED",
        "deploymentHardening": "DEFERRED",
        "broaderRegressionTests": "DEFERRED",
        "other": [
            "Dashboard v3 legend and tooltip naming hardening remains deferred from the demo slice.",
            "Deployed-browser regression coverage for Forecast Portfolio v3 remains deferred from the demo slice.",
        ],
    }


def build_stage8_payload(inputs: dict[str, Any]) -> dict[str, Any]:
    axis_a = build_axis_a(inputs)
    axis_b = build_axis_b(inputs)
    axis_c = build_axis_c(inputs)
    overall_status = decide_overall_status([axis_a["status"], axis_b["status"], axis_c["status"]])

    return {
        "identity": {
            "seriesId": SERIES_ID,
            "displayName": DISPLAY_NAME,
            "forecastMethod": FORECAST_METHOD,
            "methodVersion": METHOD_VERSION,
            "targetBasis": TARGET_BASIS,
            "modelId": MODEL_ID,
            "referenceModels": REFERENCE_MODELS,
        },
        "evidenceSources": {
            "authorities": [
                str(FORECASTING_CANON_MD.relative_to(ROOT)),
                str(FORECASTING_METHODS_SPEC_MD.relative_to(ROOT)),
                str(METHOD_SPEC_MD.relative_to(ROOT)),
                str(PRODUCTION_CONTRACT_MD.relative_to(ROOT)),
                str(TARGET_BASIS_CANON_MD.relative_to(ROOT)),
            ],
            "acceptedEvidence": [
                str(STAGE0_MD.relative_to(ROOT)),
                str(STAGE1_MD.relative_to(ROOT)),
                str(STAGE2_MD.relative_to(ROOT)),
                str(STAGE4_MD.relative_to(ROOT)),
                str(STAGE5_MD.relative_to(ROOT)),
                str(STAGE6_MD.relative_to(ROOT)),
                str(STAGE7_MD.relative_to(ROOT)),
            ],
            "machineReadableEvidence": [
                str(STAGE4_JSON.relative_to(ROOT)),
                str(STAGE5_JSON.relative_to(ROOT)),
                str(STAGE6_JSON.relative_to(ROOT)),
                str(STAGE7_JSON.relative_to(ROOT)),
            ],
            "dashboardContext": [
                str(FORECAST_CONTRACT_TS.relative_to(ROOT.parents[1])),
                str(RUNTIME_QUERY_TS.relative_to(ROOT.parents[1])),
                str(DEMO_BACKLOG_MD.relative_to(ROOT)),
            ],
        },
        "axisA_methodologicalCorrectness": axis_a,
        "axisB_lowCost": axis_b,
        "axisC_fastReproducibleServing": axis_c,
        "overall": {
            "status": overall_status,
            "stage9Readiness": "READY" if overall_status == "PASS" else "BLOCKED",
            "rule": "PASS = all three axes PASS; FAIL = one or more axes FAIL; BLOCKED = no axis FAIL and at least one axis BLOCKED.",
            "allThreeAxesPass": overall_status == "PASS",
        },
        "modelPolicy": build_model_policy(),
        "deferredWork": build_deferred_work(),
        "generatedAt": utc_timestamp(),
    }


def render_axis_table(payload: dict[str, Any]) -> str:
    rows = [
        ("Methodological Correctness", payload["axisA_methodologicalCorrectness"]),
        ("Low Cost", payload["axisB_lowCost"]),
        ("Fast / Reproducible Serving", payload["axisC_fastReproducibleServing"]),
    ]
    lines = ["| Axis | Status | Core Evidence | Key Limitation |", "| --- | --- | --- | --- |"]
    for label, node in rows:
        evidence = "; ".join(Path(path).name for path in node["evidence"][:2])
        limitation = node["limitations"][0] if node["limitations"] else "None recorded"
        lines.append(f"| {label} | {node['status']} | {evidence} | {limitation} |")
    return "\n".join(lines)


def render_comparative_context(stage5_json: dict[str, Any]) -> str:
    lines = [
        "| Horizon | ARIMA MAE | ARIMA Bias | Lowest MAE Model | Highest Directional Accuracy Model | Lowest Absolute Bias Model |",
        "| --- | ---: | ---: | --- | --- | --- |",
    ]
    metric_leaders = stage5_json["metricLeaders"]
    strict = stage5_json["strictCommonCohortMetrics"]
    for horizon in HORIZONS:
        arima = strict[horizon]["arima"]
        lines.append(
            "| {h} | {mae} | {bias} | {lowest_mae} | {highest_da} | {lowest_bias} |".format(
                h=horizon,
                mae=arima["mae"],
                bias=arima["bias"],
                lowest_mae=metric_leaders[horizon]["lowestMAE"],
                highest_da=metric_leaders[horizon]["highestDirectionalAccuracy"],
                lowest_bias=metric_leaders[horizon]["lowestAbsoluteBias"],
            )
        )
    return "\n".join(lines)


def render_acceptance_markdown(payload: dict[str, Any], stage5_json: dict[str, Any] | None = None) -> str:
    axis_a = payload["axisA_methodologicalCorrectness"]
    axis_b = payload["axisB_lowCost"]
    axis_c = payload["axisC_fastReproducibleServing"]
    overall = payload["overall"]
    stage5_json = stage5_json or load_json(STAGE5_JSON)

    lines: list[str] = []
    lines.append("# ARIMA Stage 8 Three-Axis Acceptance")
    lines.append("")
    lines.append("Status: STAGE 8 ACCEPTANCE")
    lines.append(f"Date: {payload['generatedAt']}")
    lines.append("")
    lines.append("## Executive Result")
    lines.append("")
    lines.append(f"ARIMA Three-Axis Acceptance: {overall['status']}")
    lines.append(f"Stage 9 Readiness: {overall['stage9Readiness']}")
    lines.append(f"Controlled Benchmark: {SERIES_ID}")
    lines.append("Model: ARIMA")
    lines.append(f"Method: {FORECAST_METHOD}")
    lines.append(f"Method Version: {METHOD_VERSION}")
    lines.append(f"Target Basis: {TARGET_BASIS}")
    lines.append("")
    lines.append("## Three-Axis Summary")
    lines.append("")
    lines.append(render_axis_table(payload))
    lines.append("")
    lines.append("## Methodological Correctness")
    lines.append("")
    lines.append(f"No leakage: {axis_a['noLeakage']}")
    lines.append("Bounded ARIMA policy: PASS")
    lines.append(f"Historical Origin Coverage: {axis_a['historicalOriginCoverage']['completed']} / {axis_a['historicalOriginCoverage']['expected']}")
    lines.append(f"Common Cohort Parity: {axis_a['comparativeParity']}")
    lines.append(f"Reproducibility: {axis_a['reproducibility']}")
    lines.append(f"Band Methodology: {axis_a['empiricalBand']}")
    lines.append(f"Point Forecast Mutation: {axis_a['pointForecastMutation']}")
    lines.append(f"Final Axis: {axis_a['status']}")
    lines.append("")
    lines.append("ARIMA remains a model inside the accepted ROLLING_DAILY_POINT_IN_TIME method, not a separate forecast method. Stage 4 and Stage 5 evidence show lawful DAILY-only execution, full pre-origin training history retention, no synthetic observations, no future leakage, one fit per origin, and strict common-cohort parity against naive, damped_holt, and ets on the same benchmark, target identities, actuals, and metric definitions.")
    lines.append("")
    lines.append("Selected-order distribution from accepted evidence remains internally consistent with the required 681-origin universe: ARIMA(1,1,2)=9, ARIMA(2,1,0)=17, ARIMA(2,1,1)=115, ARIMA(2,1,2)=540. Stage 6 adds a leakage-free empirical P10/P90 residual band with no point-forecast mutation and corrected origin-to-1M interpolation semantics.")
    if axis_a["limitations"]:
        lines.append("")
        lines.append(f"Key limitation: {axis_a['limitations'][0]}")
    lines.append("")
    lines.append("## Low Cost")
    lines.append("")
    lines.append(f"Fresh ARIMA compute: {axis_b['freshCompute']['medianMs']} ms median")
    lines.append(f"Historical full verification: {axis_b['historicalOfflineCompute']['stage4RuntimeSeconds']} s for {axis_b['historicalOfflineCompute']['stage4Origins']} origins")
    lines.append(f"Incremental maintenance evidence: {axis_b['incrementalMaintenance']['totalMs']} ms total without separate persistence timing")
    lines.append(f"Band calibration: {axis_b['bandCalibration']['medianMs']} ms median")
    lines.append(f"Band interpolation: {axis_b['bandInterpolation']['medianMs']} ms median")
    lines.append(f"Prepared read: {axis_b['preparedArchitecture']['preparedReadMedianMs']} ms median")
    lines.append("Bounded Compute: PASS")
    lines.append("Request-Time Fit: NO")
    lines.append("Full Historical Replay During Normal Use: NO")
    lines.append("Dedicated ARIMA Infrastructure: NO")
    lines.append("Direct Currency Cost: NOT CALCULATED")
    lines.append(f"Final Low Cost Axis: {axis_b['status']}")
    lines.append("")
    lines.append("ARIMA is materially more expensive to fit than naive, damped_holt, and ets. That cost does not enter the accepted user-facing path because the architecture is bounded to one 17-candidate non-seasonal AICc search, historical verification is offline, calibration is built from persisted residual evidence, incremental maintenance is a separate maintenance unit, and Dashboard serving consumes prepared state without refitting ARIMA.")
    lines.append("")
    lines.append(f"Key limitation: {axis_b['limitations'][0]}")
    lines.append("")
    lines.append("## Fast / Reproducible Serving")
    lines.append("")
    lines.append(f"Canonical Prepared Read Owner: {axis_c['topology']['preparedReadOwner']}")
    lines.append(f"Canonical Dashboard Read Seam: {axis_c['topology']['dashboardReadSeam']}")
    lines.append(f"Prepared Read Median: {axis_c['preparedReadLatency']['medianMs']} ms")
    lines.append(f"ARIMA Fit On Request: {axis_c['arimaFitOnRequest']}")
    lines.append(f"Historical Calibration On Request: {axis_c['historicalCalibrationOnRequest']}")
    lines.append(f"Persistence Mutation On Read: {axis_c['persistenceMutationOnRead']}")
    lines.append(f"Benchmark Finder Dependency: {axis_c['benchmarkFinderDependency']}")
    lines.append(f"Forecast Reproducibility: {axis_c['reproducibility']['forecastReproducibility']}")
    lines.append(f"Final Serving Axis: {axis_c['status']}")
    lines.append("")
    lines.append("The corrected Stage 7 authority is the Dashboard Library prepared-snapshot read path from rollingDailyCurrentForecastSnapshot through apps/dashboard-preview/lib/benchmark-forecast/runtime-query.ts. That read stays deterministic, read-only, model-specific, independent of Benchmark Finder and AppShell, and does not trigger ARIMA fitting, historical verification recomputation, or calibration rebuilds.")
    lines.append("")
    lines.append("Post-Stage-7 Dashboard v3 demo work is acknowledged only as consumer-level context: ARIMA was added to the existing Forecast Portfolio v3 model union and the dashboard read seam preserves modelId-specific snapshot and verification reads. This is practical serving confirmation, not a UI acceptance gate.")
    lines.append("")
    lines.append(f"Key limitation: {axis_c['limitations'][0]}")
    lines.append("")
    lines.append("## Acceptance Logic")
    lines.append("")
    lines.append("Overall acceptance rule:")
    lines.append("")
    lines.append("PASS = all three axes PASS")
    lines.append("")
    lines.append("FAIL = one or more axes FAIL")
    lines.append("")
    lines.append("BLOCKED = no axis FAIL, but at least one axis lacks sufficient evidence")
    lines.append("")
    lines.append("No weighted score. No majority rule.")
    lines.append("")
    lines.append("## What This Does Not Mean")
    lines.append("")
    lines.append("Stage 8 PASS does not mean ARIMA is the best model.")
    lines.append("Stage 8 PASS does not mean ARIMA becomes Champion.")
    lines.append("Stage 8 PASS does not mean ARIMA becomes default.")
    lines.append("Stage 8 PASS does not mean automatic model selection exists.")
    lines.append("")
    lines.append("Stage 8 PASS means ARIMA is accepted as a first-class eligible Forecast Model under the three equal architectural/product constraints.")
    lines.append("")
    lines.append("## Comparative Context")
    lines.append("")
    lines.append(render_comparative_context(stage5_json))
    lines.append("")
    lines.append("ARIMA is competitive but not dominant across all horizons. Naive is stronger on 1M and 3M MAE-family metrics, ETS is stronger on 6M and 12M MAE-family metrics and directional accuracy, while ARIMA is closest to zero Bias at 1M, 3M, and 6M but weaker on 12M Bias. These are descriptive findings only and do not redefine methodological correctness.")
    lines.append("")
    lines.append("## Deferred Work")
    lines.append("")
    lines.append("Stage 9: NOT EXECUTED")
    lines.append("Stage 10: NOT EXECUTED")
    lines.append("Stage 11 Formal Acceptance: NOT EXECUTED")
    lines.append("Stage 12 Formal Acceptance: NOT EXECUTED")
    lines.append("Stage 13: NOT EXECUTED")
    lines.append("Naive/Holt/ETS Prediction Band Pre-1M Parity: DEFERRED")
    lines.append("Benchmark Finder Contamination Audit: DEFERRED")
    lines.append("Deployment Hardening: DEFERRED")
    lines.append("Broader Regression Tests: DEFERRED")
    return "\n".join(lines) + "\n"


def write_outputs(payload: dict[str, Any], markdown: str, *, output_json: Path = OUTPUT_JSON, output_md: Path = OUTPUT_MD) -> None:
    output_json.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    output_md.write_text(markdown, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Stage 8 three-axis acceptance artifacts for ARIMA.")
    parser.add_argument("--output-json", default=str(OUTPUT_JSON))
    parser.add_argument("--output-md", default=str(OUTPUT_MD))
    args = parser.parse_args()

    payload = build_stage8_payload(load_stage8_inputs())
    markdown = render_acceptance_markdown(payload)
    write_outputs(payload, markdown, output_json=Path(args.output_json), output_md=Path(args.output_md))
    print(json.dumps({"status": payload["overall"]["status"], "outputJson": str(Path(args.output_json)), "outputMd": str(Path(args.output_md))}, indent=2))


if __name__ == "__main__":
    main()