from __future__ import annotations

import argparse
import json
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
MODELS = ["naive", "damped_holt", "ets", "arima"]
HORIZONS = ["1M", "3M", "6M", "12M"]
EXPECTED_COMMON_COHORTS = {"1M": 659, "3M": 615, "6M": 553, "12M": 423}
MODEL_LABELS = {
    "naive": "Naive",
    "damped_holt": "Damped Holt",
    "ets": "ETS",
    "arima": "ARIMA",
}
METRIC_LABELS = {
    "mae": "MAE",
    "rmse": "RMSE",
    "mase": "MASE",
    "smape": "sMAPE",
    "directionalAccuracy": "Directional Accuracy",
    "bias": "Bias",
}

OUTPUT_JSON = VALIDATION_ROOT / "rolling_daily_stage13_four_model_business_acceptance_wocaes0074.json"
OUTPUT_MD = ROOT / "ROLLING_DAILY_STAGE13_FOUR_MODEL_BUSINESS_ACCEPTANCE.md"

FORECASTING_CANON_MD = ROOT / "FORECASTING_CANON.md"
METHOD_SPEC_MD = ROOT / "ROLLING_DAILY_POINT_IN_TIME_METHOD_SPEC.md"
STAGE5_MD = ROOT / "FOUR_MODEL_COMPARATIVE_BACKTEST_ACCEPTANCE.md"
STAGE3_MD = ROOT / "ARIMA_PATH_SHAPE_CHARACTERIZATION.md"
STAGE8_MD = ROOT / "ARIMA_STAGE8_THREE_AXIS_ACCEPTANCE.md"
STAGE9_MD = ROOT / "ROLLING_DAILY_STAGE9_INCREMENTAL_MAINTENANCE_PARITY.md"
STAGE10_MD = ROOT / "ROLLING_DAILY_STAGE10_PRODUCTION_CONTRACT_PARITY.md"
STAGE11_MD = ROOT / "ROLLING_DAILY_STAGE11_CURRENT_SNAPSHOT_FAST_PRESENTATION.md"
STAGE12_MD = ROOT / "ROLLING_DAILY_STAGE12_FORECAST_PORTFOLIO_V3_FORMAL_ACCEPTANCE.md"
STAGE12_1_MD = ROOT / "ROLLING_DAILY_STAGE12_1_CONSUMER_FRESHNESS_CONTRACT_CLOSURE.md"

STAGE5_JSON = VALIDATION_ROOT / "four_model_stage5_comparative_backtest_wocaes0074.json"
STAGE7_JSON = VALIDATION_ROOT / "rolling_daily_stage7_performance_cost_wocaes0074.json"
STAGE8_JSON = VALIDATION_ROOT / "arima_stage8_three_axis_acceptance_wocaes0074.json"
STAGE10_JSON = VALIDATION_ROOT / "rolling_daily_stage10_production_contract_parity_wocaes0074.json"
STAGE11_JSON = VALIDATION_ROOT / "rolling_daily_stage11_current_snapshot_fast_presentation_wocaes0074.json"
STAGE12_JSON = VALIDATION_ROOT / "rolling_daily_stage12_forecast_portfolio_v3_formal_acceptance_wocaes0074.json"
STAGE12_1_JSON = VALIDATION_ROOT / "rolling_daily_stage12_1_consumer_freshness_contract_closure_wocaes0074.json"


class Stage13EvidenceError(ValueError):
    pass


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def require(condition: bool, message: str) -> None:
    if not condition:
        raise Stage13EvidenceError(message)


def assert_required_paths_exist(paths: list[Path]) -> None:
    missing = [str(path.relative_to(ROOT)) for path in paths if not path.exists()]
    require(not missing, f"Missing required Stage 13 authorities: {missing}")


def load_stage13_inputs() -> dict[str, Any]:
    required_paths = [
        FORECASTING_CANON_MD,
        METHOD_SPEC_MD,
        STAGE5_MD,
        STAGE3_MD,
        STAGE8_MD,
        STAGE9_MD,
        STAGE10_MD,
        STAGE11_MD,
        STAGE12_MD,
        STAGE12_1_MD,
        STAGE5_JSON,
        STAGE7_JSON,
        STAGE8_JSON,
        STAGE10_JSON,
        STAGE11_JSON,
        STAGE12_JSON,
        STAGE12_1_JSON,
    ]
    assert_required_paths_exist(required_paths)
    return {
        "stage5": load_json(STAGE5_JSON),
        "stage7": load_json(STAGE7_JSON),
        "stage8": load_json(STAGE8_JSON),
        "stage10": load_json(STAGE10_JSON),
        "stage11": load_json(STAGE11_JSON),
        "stage12": load_json(STAGE12_JSON),
        "stage12_1": load_json(STAGE12_1_JSON),
    }


def format_number(value: float) -> str:
    text = f"{value:.6f}"
    text = text.rstrip("0").rstrip(".")
    if text == "-0":
        return "0"
    if "." not in text:
        return f"{text}.0" if value == 0 else text
    return text


def format_model_value(model_id: str, value: float) -> str:
    return f"{MODEL_LABELS[model_id]} ({format_number(value)})"


def model_label_list(model_ids: list[str]) -> str:
    return " / ".join(MODEL_LABELS[model_id] for model_id in model_ids)


def read_prepared_read_medians(stage11: dict[str, Any]) -> dict[str, float]:
    result: dict[str, float] = {}
    for item in stage11["preparedReadAcceptance"]["results"]:
        result[str(item["modelId"])] = float(item["medianMs"])
    return result


def validate_prerequisites(inputs: dict[str, Any]) -> None:
    stage5 = inputs["stage5"]
    stage8 = inputs["stage8"]
    stage10 = inputs["stage10"]
    stage11 = inputs["stage11"]
    stage12 = inputs["stage12"]
    stage12_1 = inputs["stage12_1"]

    require(stage5["fourModelComparativeBacktest"] == "PASS", "Stage 5 comparative backtest is not PASS.")
    require(stage8["overall"]["status"] == "PASS", "Stage 8 ARIMA acceptance is not PASS.")
    require(stage10["status"] == "PASS", "Stage 10 production contract parity is not PASS.")
    require(stage11["status"] == "PASS", "Stage 11 current snapshot fast presentation is not PASS.")
    require(stage12["result"] == "PASS", "Stage 12 portfolio formal acceptance is not PASS.")
    require(stage12_1["stage12_1Decision"]["stage12_1"] == "PASS", "Stage 12.1 freshness contract closure is not PASS.")
    require(stage12_1["stage12_1Decision"]["stage13Readiness"] == "READY", "Stage 13 readiness is not READY.")

    identity = stage5["comparisonIdentity"]
    require(identity["seriesId"] == SERIES_ID, "Stage 5 seriesId mismatch.")
    require(identity["forecastMethod"] == FORECAST_METHOD, "Stage 5 forecast method mismatch.")
    require(identity["methodVersion"] == METHOD_VERSION, "Stage 5 method version mismatch.")
    require(identity["targetBasis"] == TARGET_BASIS, "Stage 5 target basis mismatch.")
    require(identity["models"] == MODELS, "Stage 5 model set mismatch.")

    for horizon, expected in EXPECTED_COMMON_COHORTS.items():
        node = stage5["identitySetEquality"][horizon]
        require(node["status"] == "PASS", f"Identity-set equality failed at {horizon}.")
        require(node["equal"] is True, f"Identity-set equality flag is false at {horizon}.")
        require(int(node["commonCohortCount"]) == expected, f"Common cohort count mismatch at {horizon}.")
        require(all(int(count) == expected for count in node["counts"].values()), f"Per-model cohort count mismatch at {horizon}.")

    require(stage5["metricCompleteness"]["strictMissingMetricCells"] == 0, "Stage 5 strict metric completeness failed.")
    require(stage5["metricCompleteness"]["strictNumericMetricCells"] == 96, "Stage 5 strict numeric metric count mismatch.")
    require(stage11["preparedReadAcceptance"]["status"] == "PASS", "Stage 11 prepared read acceptance is not PASS.")
    require(stage11["preparedReadAcceptance"]["fetchCalls"] == 0, "Stage 11 prepared reads used fetch fallback.")
    require(stage12["preSteps"]["presentationFreshnessContract"]["status"] == "PASS", "Stage 12 freshness pre-step is not PASS.")
    require(stage12["preSteps"]["crossModelPredictionBandParity"]["status"] == "PASS", "Stage 12 band parity pre-step is not PASS.")


def compute_metric_leaders(metrics_by_horizon: dict[str, dict[str, dict[str, float]]]) -> dict[str, dict[str, dict[str, Any]]]:
    leaders: dict[str, dict[str, dict[str, Any]]] = {}
    comparisons = {
        "lowestMAE": ("mae", min),
        "lowestRMSE": ("rmse", min),
        "lowestMASE": ("mase", min),
        "lowestSMAPE": ("smape", min),
        "highestDirectionalAccuracy": ("directionalAccuracy", max),
        "lowestAbsoluteBias": ("bias", None),
    }

    for horizon, per_model in metrics_by_horizon.items():
        horizon_leaders: dict[str, dict[str, Any]] = {}
        for leader_key, (metric_key, reducer) in comparisons.items():
            if leader_key == "lowestAbsoluteBias":
                model_id = min(per_model, key=lambda candidate: abs(float(per_model[candidate][metric_key])))
                value = abs(float(per_model[model_id][metric_key]))
                signed_bias = float(per_model[model_id][metric_key])
                horizon_leaders[leader_key] = {
                    "modelId": model_id,
                    "value": value,
                    "signedBias": signed_bias,
                }
            else:
                model_id = reducer(per_model, key=lambda candidate: float(per_model[candidate][metric_key]))
                horizon_leaders[leader_key] = {
                    "modelId": model_id,
                    "value": float(per_model[model_id][metric_key]),
                }
        leaders[horizon] = horizon_leaders
    return leaders


def assert_metric_leaders_match_accepted(stage5: dict[str, Any], computed: dict[str, dict[str, dict[str, Any]]]) -> None:
    accepted = stage5["metricLeaders"]
    mapping = {
        "lowestMAE": "lowestMAE",
        "lowestRMSE": "lowestRMSE",
        "lowestMASE": "lowestMASE",
        "lowestSMAPE": "lowestSMAPE",
        "highestDirectionalAccuracy": "highestDirectionalAccuracy",
        "lowestAbsoluteBias": "lowestAbsoluteBias",
    }
    for horizon, horizon_leaders in computed.items():
        for key, accepted_key in mapping.items():
            require(
                horizon_leaders[key]["modelId"] == accepted[horizon][accepted_key],
                f"Computed leader mismatch at {horizon} for {key}: {horizon_leaders[key]['modelId']} != {accepted[horizon][accepted_key]}",
            )


def horizons_led_by(metric_leaders: dict[str, dict[str, dict[str, Any]]], leader_key: str, model_id: str) -> list[str]:
    return [horizon for horizon in HORIZONS if metric_leaders[horizon][leader_key]["modelId"] == model_id]


def path_character_label(path_context: dict[str, Any]) -> str:
    forecast_range = float(path_context["forecastRange"])
    direction_changes = int(path_context["directionChanges"])
    volatility = float(path_context["pathVolatility"])
    if forecast_range == 0 and direction_changes == 0:
        return "Flat constant path on the current slice"
    if direction_changes == 0 and volatility > 0:
        return "Smooth one-direction path with damped movement"
    if direction_changes > 0:
        return "Most dynamic path with repeated reversals"
    return "Low-variation path"


def make_metric_table(stage5: dict[str, Any]) -> dict[str, dict[str, dict[str, float]]]:
    metrics = stage5["strictCommonCohortMetrics"]
    result: dict[str, dict[str, dict[str, float]]] = {}
    for horizon in HORIZONS:
        result[horizon] = {}
        for model_id in MODELS:
            row = metrics[horizon][model_id]
            result[horizon][model_id] = {
                "verified": int(row["verified"]),
                "mae": float(row["mae"]),
                "rmse": float(row["rmse"]),
                "mase": float(row["mase"]),
                "smape": float(row["smape"]),
                "directionalAccuracy": float(row["directionalAccuracy"]),
                "bias": float(row["bias"]),
            }
    return result


def build_model_profiles(
    metrics_by_horizon: dict[str, dict[str, dict[str, float]]],
    metric_leaders: dict[str, dict[str, dict[str, Any]]],
    path_context_by_model: dict[str, dict[str, Any]],
    fit_medians: dict[str, float],
    prepared_read_medians: dict[str, float],
) -> dict[str, dict[str, Any]]:
    profiles: dict[str, dict[str, Any]] = {}

    for model_id in MODELS:
        mae_horizons = horizons_led_by(metric_leaders, "lowestMAE", model_id)
        da_horizons = horizons_led_by(metric_leaders, "highestDirectionalAccuracy", model_id)
        bias_horizons = horizons_led_by(metric_leaders, "lowestAbsoluteBias", model_id)
        path_context = path_context_by_model[model_id]

        if model_id == "naive":
            role = "Transparent no-change baseline"
            description = (
                "Naive uses the last lawful observed value as the future expectation. "
                "It is the most transparent reference point and a necessary baseline against which more complex models must prove incremental value."
            )
            strength = "Lowest MAE-family metrics at 1M and 3M on the strict common cohort, with maximal interpretability."
            limitation = "Cannot express changing trend or dynamics; directional accuracy remains near zero on this benchmark."
            direction_profile = "Near-zero directional accuracy on all four horizons, so it is useful for level benchmarking rather than directional reading."
            business_role = "Visible baseline for level expectation and a reference against which all challengers can be judged."
            interpretability = "Very high"
        elif model_id == "damped_holt":
            role = "Interpretable trend-with-decay view"
            description = (
                "Damped Holt models current level and recent trend, then progressively damps that trend into the future. "
                "It offers a trend-aware forecast that stays easier to explain than ARIMA."
            )
            strength = "Adds a differentiated monotonic trend-aware view with materially stronger directional behavior than Naive."
            limitation = "Does not lead the MAE-family metrics on this benchmark and is less directionally strong than ETS."
            direction_profile = "Directional accuracy is materially above Naive on every horizon and remains close to ETS at 3M, 6M, and 12M."
            business_role = "Interpretable trend-aware alternative when a user wants to see recent momentum carried forward but softened over time."
            interpretability = "High"
        elif model_id == "ets":
            role = "Stable exponentially smoothed statistical view"
            description = (
                "ETS applies exponential smoothing to emphasize persistent signal over short-term noise. "
                "On this benchmark it produces a stable path while still adding an empirically distinct historical perspective."
            )
            strength = "Highest directional accuracy on all four horizons and lowest MAE-family metrics at 6M and 12M."
            limitation = "Its current path is almost flat, so users may underestimate its value if they judge only line shape instead of historical evidence."
            direction_profile = "Highest directional accuracy on the strict common cohort at 1M, 3M, 6M, and 12M."
            business_role = "Smoothed statistical view that adds robustness against short-term noise without pretending flatness is failure."
            interpretability = "Moderate to high"
        else:
            role = "Dynamic autoregressive challenger"
            description = (
                "ARIMA models temporal dependence in changes and errors using the accepted bounded 17-candidate non-seasonal AICc policy. "
                "It provides a more flexible dynamics-aware view without implying higher accuracy."
            )
            strength = "Closest to zero bias at 1M, 3M, and 6M, with the only materially dynamic current path and Stage 8 serving acceptance."
            limitation = "Fit cost is materially higher and historical accuracy is not dominant, especially at 12M."
            direction_profile = "Moderate directional accuracy at 1M and 3M, then weaker than ETS and Damped Holt at 6M and 12M."
            business_role = "Dynamic challenger that can surface a different structural view when simpler models look flat or monotonic."
            interpretability = "Lower intuitive interpretability"

        profiles[model_id] = {
            "modelId": model_id,
            "name": MODEL_LABELS[model_id],
            "whatItRepresents": role,
            "marketBehavior": business_role,
            "currentPath": {
                "character": path_character_label(path_context),
                "forecastRange": float(path_context["forecastRange"]),
                "directionChanges": int(path_context["directionChanges"]),
                "pathVolatility": float(path_context["pathVolatility"]),
            },
            "historicalPerformance": {
                "lowestMAEHorizons": mae_horizons,
                "highestDirectionalAccuracyHorizons": da_horizons,
                "lowestAbsoluteBiasHorizons": bias_horizons,
            },
            "directionProfile": direction_profile,
            "biasProfile": {
                "closestToZeroHorizons": bias_horizons,
                "signedBiasByHorizon": {horizon: float(metrics_by_horizon[horizon][model_id]["bias"]) for horizon in HORIZONS},
            },
            "computeContext": {
                "fitMedianMs": fit_medians[model_id],
                "preparedReadMedianMs": prepared_read_medians[model_id],
            },
            "interpretability": interpretability,
            "businessStrength": strength,
            "businessLimitation": limitation,
            "businessRole": business_role,
            "portfolioDecision": "KEEP",
            "evidenceBasis": [
                "validation/four_model_stage5_comparative_backtest_wocaes0074.json",
                "ARIMA_PATH_SHAPE_CHARACTERIZATION.md",
                "validation/rolling_daily_stage7_performance_cost_wocaes0074.json",
                "validation/rolling_daily_stage11_current_snapshot_fast_presentation_wocaes0074.json",
            ],
            "description": description,
        }
    return profiles


def build_business_dimensions() -> dict[str, dict[str, str]]:
    return {
        "truthfulness": {
            "status": "PASS",
            "evidence": "Stages 10, 11, 12, and 12.1 all PASS with prepared truth, empirical bands, historical verification, and freshness exposed without recomputation.",
            "businessInterpretation": "The portfolio does not pretend certainty beyond the accepted evidence and does not collapse freshness into accuracy.",
        },
        "interpretability": {
            "status": "PASS",
            "evidence": "Stage 3 path characterization plus Stage 5 metric separation supports simple factual explanations for all four models.",
            "businessInterpretation": "A user can understand baseline, trend-aware, smoothed, and dynamic views without needing model mathematics.",
        },
        "decisionUsefulness": {
            "status": "PASS",
            "evidence": "Stage 5 gives horizon-specific level, direction, and bias evidence while Stage 12 provides live point forecasts and bands.",
            "businessInterpretation": "The portfolio helps a user compare expected level, directional tendency, and uncertainty without making the procurement decision for them.",
        },
        "transparency": {
            "status": "PASS",
            "evidence": "Prepared-read origin, model identity, empirical band semantics, historical verification, and freshness states are all visible on accepted surfaces.",
            "businessInterpretation": "The user can inspect what was forecast, how it performed historically, and whether the current snapshot is fresh.",
        },
        "comparativeValue": {
            "status": "PASS",
            "evidence": "Naive and ETS provide different benchmark roles, Damped Holt adds a trend-decay view, and ARIMA adds the only materially dynamic path.",
            "businessInterpretation": "Multiple lawful views provide more context than one opaque line, and disagreement itself can carry information.",
        },
        "uncertaintyCommunication": {
            "status": "PASS",
            "evidence": "Stage 12 accepted model-specific empirical P10/P90 residual bands with no confidence-interval relabeling.",
            "businessInterpretation": "Showing bands reduces false precision by making historical uncertainty explicit around the point forecast.",
        },
        "historicalAccountability": {
            "status": "PASS",
            "evidence": "Stage 5 strict common-cohort backtest evidence and Stage 11 accepted historical verification presentation remain available.",
            "businessInterpretation": "The user can judge how each model has performed historically instead of seeing an unexplained future line.",
        },
        "userComplexity": {
            "status": "PASS",
            "evidence": "The four models are differentiated but still explainable with concise neutral descriptions and no ranking claim.",
            "businessInterpretation": "The portfolio adds cognitive load, but not beyond a manageable business comparison when explanations stay factual.",
        },
    }


def build_metric_leader_markdown_rows(metric_leaders: dict[str, dict[str, dict[str, Any]]]) -> list[str]:
    rows = []
    for horizon in HORIZONS:
        leaders = metric_leaders[horizon]
        rows.append(
            "| "
            + " | ".join(
                [
                    horizon,
                    format_model_value(leaders["lowestMAE"]["modelId"], float(leaders["lowestMAE"]["value"])),
                    format_model_value(leaders["lowestRMSE"]["modelId"], float(leaders["lowestRMSE"]["value"])),
                    format_model_value(leaders["lowestMASE"]["modelId"], float(leaders["lowestMASE"]["value"])),
                    format_model_value(leaders["lowestSMAPE"]["modelId"], float(leaders["lowestSMAPE"]["value"])),
                    format_model_value(leaders["highestDirectionalAccuracy"]["modelId"], float(leaders["highestDirectionalAccuracy"]["value"])),
                    f"{MODEL_LABELS[leaders['lowestAbsoluteBias']['modelId']]} (|bias|={format_number(float(leaders['lowestAbsoluteBias']['value']))}; signed={format_number(float(leaders['lowestAbsoluteBias']['signedBias']))})",
                ]
            )
            + " |"
        )
    return rows


def build_full_metric_markdown_rows(metrics_by_horizon: dict[str, dict[str, dict[str, float]]]) -> list[str]:
    rows = []
    for horizon in HORIZONS:
        for model_id in MODELS:
            metrics = metrics_by_horizon[horizon][model_id]
            rows.append(
                "| "
                + " | ".join(
                    [
                        horizon,
                        MODEL_LABELS[model_id],
                        str(int(metrics["verified"])),
                        format_number(float(metrics["mae"])),
                        format_number(float(metrics["rmse"])),
                        format_number(float(metrics["mase"])),
                        format_number(float(metrics["smape"])),
                        format_number(float(metrics["directionalAccuracy"])),
                        format_number(float(metrics["bias"])),
                    ]
                )
                + " |"
            )
    return rows


def build_model_profile_markdown_rows(profiles: dict[str, dict[str, Any]]) -> list[str]:
    rows = []
    for model_id in MODELS:
        profile = profiles[model_id]
        current_path = profile["currentPath"]
        current_text = (
            f"{profile['currentPath']['character']}; range={format_number(float(current_path['forecastRange']))}; "
            f"directionChanges={int(current_path['directionChanges'])}"
        )
        rows.append(
            "| "
            + " | ".join(
                [
                    MODEL_LABELS[model_id],
                    profile["businessRole"],
                    profile["businessStrength"],
                    current_text,
                    profile["businessStrength"],
                    profile["businessLimitation"],
                    profile["portfolioDecision"],
                ]
            )
            + " |"
        )
    return rows


def build_business_table_rows(dimensions: dict[str, dict[str, str]]) -> list[str]:
    labels = {
        "truthfulness": "Truthfulness",
        "interpretability": "Interpretability",
        "decisionUsefulness": "Decision Usefulness",
        "transparency": "Transparency",
        "comparativeValue": "Comparative Value",
        "uncertaintyCommunication": "Uncertainty Communication",
        "historicalAccountability": "Historical Accountability",
        "userComplexity": "User Complexity",
    }
    return [
        f"| {labels[key]} | {value['status']} | {value['evidence']} | {value['businessInterpretation']} |"
        for key, value in dimensions.items()
    ]


def build_stage13_payload() -> dict[str, Any]:
    inputs = load_stage13_inputs()
    validate_prerequisites(inputs)

    stage5 = inputs["stage5"]
    stage7 = inputs["stage7"]
    stage8 = inputs["stage8"]
    stage10 = inputs["stage10"]
    stage11 = inputs["stage11"]
    stage12 = inputs["stage12"]
    stage12_1 = inputs["stage12_1"]

    metrics_by_horizon = make_metric_table(stage5)
    metric_leaders = compute_metric_leaders(metrics_by_horizon)
    assert_metric_leaders_match_accepted(stage5, metric_leaders)

    path_context_by_model = {item["model"]: item for item in stage5["stage3PathStructureContext"]}
    fit_medians = {model_id: float(stage7["currentComputeByModel"][model_id]["timings"]["medianMs"]) for model_id in MODELS}
    prepared_read_medians = read_prepared_read_medians(stage11)
    model_profiles = build_model_profiles(metrics_by_horizon, metric_leaders, path_context_by_model, fit_medians, prepared_read_medians)
    business_dimensions = build_business_dimensions()

    common_cohorts = {horizon: int(stage5["identitySetEquality"][horizon]["commonCohortCount"]) for horizon in HORIZONS}

    portfolio_decisions = {
        "naive": {
            "decision": "KEEP",
            "reason": "Naive remains valuable as a transparent baseline and still leads the MAE-family metrics at 1M and 3M.",
            "evidenceBasis": [
                "validation/four_model_stage5_comparative_backtest_wocaes0074.json",
                "ARIMA_PATH_SHAPE_CHARACTERIZATION.md",
            ],
        },
        "damped_holt": {
            "decision": "KEEP",
            "reason": "Damped Holt adds a differentiated trend-aware view with materially stronger directional behavior than Naive.",
            "evidenceBasis": [
                "validation/four_model_stage5_comparative_backtest_wocaes0074.json",
                "ARIMA_PATH_SHAPE_CHARACTERIZATION.md",
            ],
        },
        "ets": {
            "decision": "KEEP",
            "reason": "ETS contributes the strongest directional evidence and the lowest MAE-family metrics at 6M and 12M while remaining stable and interpretable.",
            "evidenceBasis": [
                "validation/four_model_stage5_comparative_backtest_wocaes0074.json",
                "ARIMA_PATH_SHAPE_CHARACTERIZATION.md",
            ],
        },
        "arima": {
            "decision": "KEEP",
            "reason": "ARIMA adds the only materially dynamic path, carries accepted Stage 8 status, and is closest to zero bias at 1M, 3M, and 6M.",
            "evidenceBasis": [
                "validation/arima_stage8_three_axis_acceptance_wocaes0074.json",
                "validation/four_model_stage5_comparative_backtest_wocaes0074.json",
                "ARIMA_PATH_SHAPE_CHARACTERIZATION.md",
            ],
        },
        "fourModelPortfolio": {
            "decision": "KEEP",
            "reason": "The four models provide differentiated lawful views without requiring a misleading single winner claim.",
            "evidenceBasis": [
                "validation/four_model_stage5_comparative_backtest_wocaes0074.json",
                "validation/rolling_daily_stage11_current_snapshot_fast_presentation_wocaes0074.json",
                "validation/rolling_daily_stage12_1_consumer_freshness_contract_closure_wocaes0074.json",
            ],
        },
        "naiveBaselineBusinessValue": "ACCEPT",
        "predictionBandBusinessValue": "ACCEPT",
        "historicalVerificationBusinessValue": "ACCEPT",
        "multiModelComparativeValue": "ACCEPT",
    }

    model_policy = {
        "champion": "NOT DEFINED",
        "preferredModel": "NOT DEFINED",
        "globalDefault": "NOT DEFINED",
        "automaticSelection": "NOT BUILT",
        "autoAutoma": "NOT BUILT",
        "modelRanking": "NOT PERFORMED",
        "reason": "Current evidence is horizon-specific, benchmark-specific, and multi-dimensional. No accepted business policy defines a champion, preferred model, default, or automatic selector.",
    }

    payload = {
        "identity": {
            "stage": "Stage 13 - Four-Model Business Acceptance",
            "seriesId": SERIES_ID,
            "displayName": DISPLAY_NAME,
            "forecastMethod": FORECAST_METHOD,
            "methodVersion": METHOD_VERSION,
            "targetBasis": TARGET_BASIS,
            "models": MODELS,
        },
        "evidenceSources": {
            "authorities": [
                "FORECASTING_CANON.md",
                "ROLLING_DAILY_POINT_IN_TIME_METHOD_SPEC.md",
                "FOUR_MODEL_COMPARATIVE_BACKTEST_ACCEPTANCE.md",
                "ARIMA_PATH_SHAPE_CHARACTERIZATION.md",
                "ARIMA_STAGE8_THREE_AXIS_ACCEPTANCE.md",
                "ROLLING_DAILY_STAGE9_INCREMENTAL_MAINTENANCE_PARITY.md",
                "ROLLING_DAILY_STAGE10_PRODUCTION_CONTRACT_PARITY.md",
                "ROLLING_DAILY_STAGE11_CURRENT_SNAPSHOT_FAST_PRESENTATION.md",
                "ROLLING_DAILY_STAGE12_FORECAST_PORTFOLIO_V3_FORMAL_ACCEPTANCE.md",
                "ROLLING_DAILY_STAGE12_1_CONSUMER_FRESHNESS_CONTRACT_CLOSURE.md",
            ],
            "machineReadable": [
                "validation/four_model_stage5_comparative_backtest_wocaes0074.json",
                "validation/rolling_daily_stage7_performance_cost_wocaes0074.json",
                "validation/arima_stage8_three_axis_acceptance_wocaes0074.json",
                "validation/rolling_daily_stage10_production_contract_parity_wocaes0074.json",
                "validation/rolling_daily_stage11_current_snapshot_fast_presentation_wocaes0074.json",
                "validation/rolling_daily_stage12_forecast_portfolio_v3_formal_acceptance_wocaes0074.json",
                "validation/rolling_daily_stage12_1_consumer_freshness_contract_closure_wocaes0074.json",
            ],
        },
        "businessQuestion": {
            "portfolioUsefulness": "Does presenting Naive, Damped Holt, ETS, and ARIMA together provide a truthful, useful, interpretable, and decision-supportive Forecast Portfolio for a business user?",
            "modelContribution": "What does each model contribute to the portfolio based on accepted evidence?",
            "policyQuestion": "Does current evidence justify selecting a global champion, preferred model, default model, or automatic model-selection policy?",
        },
        "commonCohorts": common_cohorts,
        "metricsByHorizon": metrics_by_horizon,
        "metricLeadersByHorizon": metric_leaders,
        "modelProfiles": model_profiles,
        "businessDimensions": business_dimensions,
        "portfolioDecisions": portfolio_decisions,
        "modelPolicy": model_policy,
        "modelDescriptions": {model_id: model_profiles[model_id]["description"] for model_id in MODELS},
        "whatUserShouldUnderstand": {
            "naive": "Naive answers what the benchmark would look like if the latest lawful level simply persisted unchanged.",
            "damped_holt": "Damped Holt answers how the benchmark may evolve if the recent trend continues but gradually weakens over time.",
            "ets": "ETS answers what a smoothed, stable statistical view sees once short-term noise is down-weighted.",
            "arima": "ARIMA answers whether a more dynamics-aware time-series model sees a different pattern from the flatter or monotonic views.",
            "predictionBand": "The empirical P10/P90 residual band shows historically observed uncertainty around the point forecast, which helps prevent false precision.",
            "historicalVerification": "Historical verification shows how each model predicted before the fact versus what later happened, so the user can judge trustworthiness.",
        },
        "whatUserMustNotInfer": [
            "ARIMA is best because it is most complex.",
            "The model with the most dynamic line is more accurate.",
            "A narrower band guarantees correctness.",
            "One strong horizon proves universal superiority.",
            "Historical accuracy guarantees future performance.",
            "FRESH means accurate.",
            "STALE means mathematically invalid.",
        ],
        "businessRisks": [
            "Users may incorrectly assume the most complex model is best.",
            "Users may cherry-pick the forecast they prefer.",
            "Multiple forecasts may create decision ambiguity.",
            "Directional accuracy may be confused with price-level accuracy.",
            "Prediction bands may be misread as certainty.",
            "Any future automatic selection policy could become arbitrary without explicit rules.",
        ],
        "limitations": [
            "Controlled benchmark acceptance is based on wocaes0074 and does not prove multi-benchmark generalization.",
            "Current evidence supports horizon-specific observations, not a global winner policy.",
            "Freshness is a trust signal about snapshot recency and identity parity, not a ranking metric.",
            "Typed Prisma exposure for rolling_daily_maintenance_state remains technical debt, though the business freshness contract is now closed.",
        ],
        "futureAutoRequirements": {
            "summary": "Future Auto / Automa would require an explicit decision policy validated across more than one controlled benchmark.",
            "candidateInputs": [
                "target horizon",
                "chosen business objective",
                "chosen primary accuracy metric",
                "Directional Accuracy requirement if relevant",
                "Bias guardrail",
                "minimum historical sample size",
                "model eligibility",
                "compute and operational constraints",
                "stability and model-switching rules",
            ],
            "selectionPolicy": "NOT DEFINED",
            "implementation": "NOT BUILT",
        },
        "generalization": {
            "controlledBenchmarkAcceptance": "PASS",
            "multiBenchmarkGeneralization": "NOT PROVEN",
            "broaderMultiBenchmarkValidation": "DEFERRED",
        },
        "technicalFoundation": {
            "stage8ArimaAcceptance": stage8["overall"]["status"],
            "stage9IncrementalMaintenance": "PASS",
            "stage10ProductionContract": stage10["status"],
            "stage11FastPresentation": stage11["status"],
            "stage12PortfolioPresentation": stage12["result"],
            "stage12_1ConsumerFreshness": stage12_1["stage12_1Decision"]["stage12_1"],
        },
        "businessDeploymentReadiness": "READY",
        "stage13Decision": {
            "stage13": "PASS",
            "forecastPortfolioBusinessAcceptance": "ACCEPTED",
            "businessDeploymentReadiness": "READY",
            "fourModelPortfolio": "KEEP",
        },
        "deferredWork": {
            "broaderMultiBenchmarkRegression": "DEFERRED",
            "automaticMaintenanceScheduling": "DEFERRED",
            "sgRuntimeBaselineTypecheckCleanup": "DEFERRED",
            "typedPrismaExposureForRollingDailyMaintenanceState": "TECH DEBT",
            "benchmarkFinderContaminationAudit": "DEFERRED",
            "deploymentHardening": "DEFERRED",
            "autoAutoma": "FUTURE DESIGN",
            "championDefaultPolicy": "UNDEFINED",
        },
        "scope": {
            "newModelFits": 0,
            "historical681OriginReplay": "NO",
            "stage5MetricsRecompute": "NO",
            "forecastMethodology": "NOT CHANGED",
            "fitLogic": "NOT CHANGED",
            "arimaCandidatePolicy": "NOT CHANGED",
            "forecastPersistence": "NOT MODIFIED",
            "dashboardUx": "NOT MODIFIED",
            "benchmarkFinder": "NOT TOUCHED",
            "appShell": "NOT TOUCHED",
            "newDatabase": "NO",
            "newTable": "NO",
            "schemaMigration": "NO",
            "deployment": "NOT PERFORMED",
        },
        "generatedAt": utc_timestamp(),
    }
    return payload


def render_acceptance(payload: dict[str, Any]) -> str:
    dimensions = payload["businessDimensions"]
    profiles = payload["modelProfiles"]
    metrics_by_horizon = payload["metricsByHorizon"]
    metric_leaders = payload["metricLeadersByHorizon"]
    policy = payload["modelPolicy"]
    portfolio = payload["portfolioDecisions"]

    lines = [
        "# Rolling Daily Stage 13 - Four-Model Business Acceptance",
        "",
        f"Timestamp: {payload['generatedAt']}",
        f"Controlled Benchmark: {SERIES_ID}",
        f"Method: {FORECAST_METHOD}",
        f"Method Version: {METHOD_VERSION}",
        f"Target Basis: {TARGET_BASIS}",
        "Models: Naive / Damped Holt / ETS / ARIMA",
        "",
        "## Executive Result",
        "",
        "Stage 13 - Four-Model Business Acceptance: PASS",
        "Forecast Portfolio Business Acceptance: ACCEPTED",
        "Business Deployment Readiness: READY",
        "",
        "The accepted answer to the Stage 13 question is yes: the four-model Forecast Portfolio provides a truthful, useful, interpretable, and decision-supportive business capability on the controlled benchmark without forcing a misleading single-winner claim.",
        "",
        "## Business Dimension Table",
        "",
        "| Dimension | Status | Evidence | Business Interpretation |",
        "| --- | --- | --- | --- |",
        *build_business_table_rows(dimensions),
        "",
        "## Common Cohorts",
        "",
        f"- 1M: {payload['commonCohorts']['1M']}",
        f"- 3M: {payload['commonCohorts']['3M']}",
        f"- 6M: {payload['commonCohorts']['6M']}",
        f"- 12M: {payload['commonCohorts']['12M']}",
        "",
        "## Horizon Metric Leaders",
        "",
        "| Horizon | Lowest MAE | Lowest RMSE | Lowest MASE | Lowest sMAPE | Highest DA | Lowest |Bias| |",
        "| --- | --- | --- | --- | --- | --- | --- |",
        *build_metric_leader_markdown_rows(metric_leaders),
        "",
        "## Full Strict Common-Cohort Metrics",
        "",
        "| Horizon | Model | Verified N | MAE | RMSE | MASE | sMAPE | Directional Accuracy | Bias |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
        *build_full_metric_markdown_rows(metrics_by_horizon),
        "",
        "## Model Business Profile Table",
        "",
        "| Model | Core Business Role | Historical Profile | Current Path Character | Strength | Limitation | Portfolio Decision |",
        "| --- | --- | --- | --- | --- | --- | --- |",
        *build_model_profile_markdown_rows(profiles),
        "",
    ]

    for model_id in MODELS:
        profile = profiles[model_id]
        lines.extend(
            [
                f"## {profile['name']}",
                "",
                f"Description: {profile['description']}",
                "",
                f"Business Strength: {profile['businessStrength']}",
                f"Business Limitation: {profile['businessLimitation']}",
                f"Interpretability: {profile['interpretability']}",
                f"Compute Context: fit median {format_number(float(profile['computeContext']['fitMedianMs']))} ms; prepared read median {format_number(float(profile['computeContext']['preparedReadMedianMs']))} ms.",
                f"Portfolio Decision: {profile['portfolioDecision']}",
                "",
            ]
        )

    lines.extend(
        [
            "## Portfolio Decision",
            "",
            f"Naive: {portfolio['naive']['decision']} - {portfolio['naive']['reason']}",
            f"Damped Holt: {portfolio['damped_holt']['decision']} - {portfolio['damped_holt']['reason']}",
            f"ETS: {portfolio['ets']['decision']} - {portfolio['ets']['reason']}",
            f"ARIMA: {portfolio['arima']['decision']} - {portfolio['arima']['reason']}",
            f"Four-Model Portfolio: {portfolio['fourModelPortfolio']['decision']} - {portfolio['fourModelPortfolio']['reason']}",
            "",
            f"Naive Baseline Business Value: {portfolio['naiveBaselineBusinessValue']}",
            f"Prediction Band Business Value: {portfolio['predictionBandBusinessValue']}",
            f"Historical Verification Business Value: {portfolio['historicalVerificationBusinessValue']}",
            f"Multi-Model Comparative Value: {portfolio['multiModelComparativeValue']}",
            "",
            "## Model Policy",
            "",
            f"Champion: {policy['champion']}",
            f"Preferred Model: {policy['preferredModel']}",
            f"Global Default: {policy['globalDefault']}",
            f"Automatic Model Selection: {policy['automaticSelection']}",
            f"Auto / Automa: {policy['autoAutoma']}",
            "Model Ranking:",
            policy["modelRanking"],
            "",
            f"Why not defined: {policy['reason']}",
            "",
            "## What User Should Understand",
            "",
            f"Naive answers: {payload['whatUserShouldUnderstand']['naive']}",
            f"Damped Holt answers: {payload['whatUserShouldUnderstand']['damped_holt']}",
            f"ETS answers: {payload['whatUserShouldUnderstand']['ets']}",
            f"ARIMA answers: {payload['whatUserShouldUnderstand']['arima']}",
            f"Prediction Band answers: {payload['whatUserShouldUnderstand']['predictionBand']}",
            f"Historical Verification answers: {payload['whatUserShouldUnderstand']['historicalVerification']}",
            "",
            "## What User Must Not Infer",
            "",
            *[f"- {item}" for item in payload["whatUserMustNotInfer"]],
            "",
            "## Future Auto / Automa",
            "",
            f"Automatic Selection Requirements: {payload['futureAutoRequirements']['summary']}",
            *[f"- {item}" for item in payload["futureAutoRequirements"]["candidateInputs"]],
            f"Selection Policy: {payload['futureAutoRequirements']['selectionPolicy']}",
            f"Implementation: {payload['futureAutoRequirements']['implementation']}",
            "",
            "## Generalization",
            "",
            f"Controlled Benchmark Acceptance: {payload['generalization']['controlledBenchmarkAcceptance']}",
            f"Multi-Benchmark Generalization: {payload['generalization']['multiBenchmarkGeneralization']}",
            f"Broader Multi-Benchmark Validation: {payload['generalization']['broaderMultiBenchmarkValidation']}",
            "",
            "## Technical Foundation",
            "",
            f"Stage 8 ARIMA Acceptance: {payload['technicalFoundation']['stage8ArimaAcceptance']}",
            f"Stage 9 Incremental Maintenance: {payload['technicalFoundation']['stage9IncrementalMaintenance']}",
            f"Stage 10 Production Contract: {payload['technicalFoundation']['stage10ProductionContract']}",
            f"Stage 11 Fast Presentation: {payload['technicalFoundation']['stage11FastPresentation']}",
            f"Stage 12 Portfolio Presentation: {payload['technicalFoundation']['stage12PortfolioPresentation']}",
            f"Stage 12.1 Consumer Freshness: {payload['technicalFoundation']['stage12_1ConsumerFreshness']}",
            "",
            "## Business Deployment",
            "",
            f"Business Deployment Readiness: {payload['businessDeploymentReadiness']}",
            "Deployment: NOT PERFORMED",
            "Render: NOT TOUCHED",
            "",
            "## Scope",
            "",
            f"New Model Fits: {payload['scope']['newModelFits']}",
            f"Historical 681-Origin Replay: {payload['scope']['historical681OriginReplay']}",
            f"Stage 5 Metrics Recompute: {payload['scope']['stage5MetricsRecompute']}",
            f"Forecast Methodology: {payload['scope']['forecastMethodology']}",
            f"Fit Logic: {payload['scope']['fitLogic']}",
            f"ARIMA Candidate Policy: {payload['scope']['arimaCandidatePolicy']}",
            f"Forecast Persistence: {payload['scope']['forecastPersistence']}",
            f"Dashboard UX: {payload['scope']['dashboardUx']}",
            f"Benchmark Finder: {payload['scope']['benchmarkFinder']}",
            f"AppShell: {payload['scope']['appShell']}",
            f"New Database: {payload['scope']['newDatabase']}",
            f"New Table: {payload['scope']['newTable']}",
            f"Schema Migration: {payload['scope']['schemaMigration']}",
            f"Deployment: {payload['scope']['deployment']}",
            "",
            "## Final Business Conclusion",
            "",
            "The controlled benchmark slice supports business acceptance of the four-model portfolio. Naive remains valuable as a transparent baseline, ETS leads directional and longer-horizon MAE-family evidence, Damped Holt adds an interpretable trend-decay view, and ARIMA adds a differentiated dynamic challenger without earning default status. The accepted evidence supports keeping all four models visible while explicitly not defining a Champion, preferred model, global default, or automatic selector from one benchmark.",
            "",
            "## Recommended Next Decision",
            "",
            "If separately authorized, choose one follow-up direction only: deployment hardening, broader multi-benchmark validation, Auto / Automa design, champion/default policy design, or production maintenance scheduling. Do not execute any of them automatically from Stage 13.",
        ]
    )
    return "\n".join(lines) + "\n"


def write_outputs(payload: dict[str, Any]) -> None:
    OUTPUT_JSON.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    OUTPUT_MD.write_text(render_acceptance(payload), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Stage 13 four-model business acceptance artifacts from accepted evidence.")
    parser.add_argument("--write", action="store_true", help="Write the canonical Stage 13 JSON and Markdown artifacts.")
    args = parser.parse_args()

    payload = build_stage13_payload()
    if args.write:
        write_outputs(payload)
        print(str(OUTPUT_JSON.relative_to(ROOT)))
        print(str(OUTPUT_MD.relative_to(ROOT)))
        return

    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()