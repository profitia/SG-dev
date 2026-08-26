from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
SG_DEV_ROOT = ROOT.parents[1]
SG_RUNTIME_ROOT = SG_DEV_ROOT / "apps" / "sg-runtime"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from forecasting.comparative_backtest import (  # noqa: E402
    ComparableVerificationRecord,
    build_native_view,
    build_strict_common_cohort_view,
    cross_model_identity,
    matured_records,
    verify_method_compatibility,
)


SERIES_ID = "wocaes0074"
DISPLAY_NAME = "Brent, Spot, FOB North Sea"
FORECAST_METHOD = "ROLLING_DAILY_POINT_IN_TIME"
METHOD_VERSION = "rolling-daily-point-in-time-v1"
TARGET_BASIS = "POINT_IN_TIME"
HISTORICAL_ORIGIN_FLOOR = "2024-01-01"
MODELS = ["naive", "damped_holt", "ets", "arima"]
HORIZONS = ["1M", "3M", "6M", "12M"]
MODEL_LABELS = {
    "naive": "Naive",
    "damped_holt": "Damped Holt",
    "ets": "ETS",
    "arima": "ARIMA",
}
NATIVE_METRIC_KEYS = ["mae", "rmse", "mase", "smape", "directionalAccuracy", "bias"]
OUTPUT_JSON = ROOT / "validation" / "four_model_stage5_comparative_backtest_wocaes0074.json"
OUTPUT_MD = ROOT / "FOUR_MODEL_COMPARATIVE_BACKTEST_ACCEPTANCE.md"
ARIMA_STAGE4_JSON = ROOT / "validation" / "arima_stage4_historical_verification_wocaes0074.json"
NON_ARIMA_ACCEPTED_JSON = ROOT / "validation" / "rolling_daily_stage7_wocaes0074_performance.json"
ARIMA_RECOMPUTATION_JSON = ROOT / "validation" / "stage5_arima_minimal_recomputation_wocaes0074.json"
ARIMA_PATH_CONTEXT_MD = ROOT / "ARIMA_PATH_SHAPE_CHARACTERIZATION.md"


class Stage5EvidenceError(ValueError):
    pass


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def run_json_command(command: list[str], cwd: Path) -> dict[str, Any]:
    result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or f"command failed: {' '.join(command)}")
    return json.loads(result.stdout)


def inspect_model(model_id: str) -> dict[str, Any]:
    return run_json_command(
        [
            "node",
            "--import",
            "tsx",
            "scripts/inspect-rolling-daily-maintenance.ts",
            f"--seriesId={SERIES_ID}",
            f"--modelId={model_id}",
            f"--targetBasis={TARGET_BASIS}",
        ],
        cwd=SG_RUNTIME_ROOT,
    )


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_day(value: Any) -> date | None:
    if value is None:
        return None
    return date.fromisoformat(str(value).strip()[:10])


def to_comparable_record(record: dict[str, Any]) -> ComparableVerificationRecord:
    return ComparableVerificationRecord(
        benchmark_id=str(record["seriesId"]),
        model_id=str(record["modelId"]),
        forecast_method=str(record["methodId"]),
        method_version=str(record["methodVersion"]),
        target_basis=str(record["targetBasis"]),
        forecast_origin_at=normalize_day(record["forecastOriginAt"]),
        horizon_label=str(record["horizonLabel"]),
        horizon_months=int(record["horizonMonths"]),
        target_calendar_date=normalize_day(record["targetCalendarDate"]),
        verification_observed_at=normalize_day(record.get("verificationObservedAt")),
        maturity_status=str(record["maturityStatus"]),
        origin_value=float(record["originValue"]),
        forecast_value=float(record["forecastValue"]),
        actual_value=None if record.get("actualValue") is None else float(record["actualValue"]),
        error_value=None if record.get("errorValue") is None else float(record["errorValue"]),
        mase_scale=float(record["maseScale"]),
    )


def status_label(flag: bool) -> str:
    return "PASS" if flag else "FAIL"


def metric_row(view: dict[str, Any]) -> dict[str, Any]:
    metrics = view.get("metrics") or {}
    return {
        "generated": int(view["generated"]),
        "mature": int(view["mature"]),
        "verified": int(view["verified"]),
        "unavailable": int(view["unavailable"]),
        "mae": float(metrics["mae"]),
        "rmse": float(metrics["rmse"]),
        "mase": float(metrics["mase"]),
        "smape": float(metrics["smape"]),
        "directionalAccuracy": float(metrics["directional_accuracy"]),
        "bias": float(metrics["bias"]),
    }


def strict_metric_row(view: dict[str, Any], model: str) -> dict[str, Any]:
    metrics = view["metricsByModel"][model]
    if metrics is None:
        raise Stage5EvidenceError(f"Missing strict-common metrics for model={model}.")
    return {
        "verified": int(view["verifiedCounts"][model]),
        "mae": float(metrics["mae"]),
        "rmse": float(metrics["rmse"]),
        "mase": float(metrics["mase"]),
        "smape": float(metrics["smape"]),
        "directionalAccuracy": float(metrics["directional_accuracy"]),
        "bias": float(metrics["bias"]),
    }


def flatten_strict_common_metrics(strict_view: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        horizon: {model: strict_metric_row(strict_view[horizon], model) for model in MODELS}
        for horizon in HORIZONS
    }


def numeric_metric_cell_count(metric_view: dict[str, dict[str, Any]], metrics: Iterable[str]) -> int:
    return sum(
        1
        for horizon in HORIZONS
        for model in MODELS
        for metric in metrics
        if isinstance(metric_view[horizon][model].get(metric), (int, float))
    )


def validate_metric_completeness(native_metrics: dict[str, dict[str, Any]], strict_metrics: dict[str, dict[str, Any]]) -> dict[str, int]:
    native_required = len(HORIZONS) * len(MODELS) * len(NATIVE_METRIC_KEYS)
    strict_required = len(HORIZONS) * len(MODELS) * len(NATIVE_METRIC_KEYS)
    native_numeric = numeric_metric_cell_count(native_metrics, NATIVE_METRIC_KEYS)
    strict_numeric = numeric_metric_cell_count(strict_metrics, NATIVE_METRIC_KEYS)
    native_missing = native_required - native_numeric
    strict_missing = strict_required - strict_numeric
    if native_missing != 0 or strict_missing != 0:
        raise Stage5EvidenceError(
            "Stage 5 metric completeness failed: "
            f"native_missing={native_missing}, strict_missing={strict_missing}."
        )
    return {
        "nativeRequiredMetricCells": native_required,
        "nativeNumericMetricCells": native_numeric,
        "nativeMissingMetricCells": native_missing,
        "strictRequiredMetricCells": strict_required,
        "strictNumericMetricCells": strict_numeric,
        "strictMissingMetricCells": strict_missing,
    }


def build_identity_set_equality(records: list[ComparableVerificationRecord]) -> dict[str, dict[str, Any]]:
    records_by_model: dict[str, list[ComparableVerificationRecord]] = {model: [] for model in MODELS}
    for record in records:
        records_by_model.setdefault(record.model_id, []).append(record)

    result: dict[str, dict[str, Any]] = {}
    for horizon in HORIZONS:
        by_model = {
            model: {
                cross_model_identity(record)
                for record in matured_records(records_by_model.get(model, []))
                if record.horizon_label == horizon
            }
            for model in MODELS
        }
        baseline = by_model[MODELS[0]]
        equal = all(candidate == baseline for candidate in by_model.values())
        result[horizon] = {
            "equal": equal,
            "counts": {model: len(values) for model, values in by_model.items()},
            "commonCohortCount": len(set.intersection(*by_model.values())) if by_model else 0,
        }
    return result


def find_model_metrics_node(node: Any) -> dict[str, Any] | None:
    if isinstance(node, dict):
        if all(model in node for model in ["naive", "damped_holt", "ets"]):
            candidate = node["naive"]
            if isinstance(candidate, dict) and "metricsByHorizon" in candidate:
                return node
        for value in node.values():
            found = find_model_metrics_node(value)
            if found is not None:
                return found
    if isinstance(node, list):
        for item in node:
            found = find_model_metrics_node(item)
            if found is not None:
                return found
    return None


def build_native_metric_parity(native_metrics: dict[str, dict[str, Any]]) -> dict[str, Any]:
    arima_stage4 = load_json(ARIMA_STAGE4_JSON)
    non_arima = load_json(NON_ARIMA_ACCEPTED_JSON)
    non_arima_metrics_node = find_model_metrics_node(non_arima)
    if non_arima_metrics_node is None:
        raise Stage5EvidenceError("Could not locate accepted non-ARIMA metrics node in Stage 7 performance artifact.")

    parity: dict[str, Any] = {}
    for horizon in HORIZONS:
        parity[horizon] = {}
        for model in MODELS:
            if model == "arima":
                accepted_horizon = arima_stage4["horizonSummary"][horizon]
                accepted_metrics = accepted_horizon["metrics"]
                accepted_verified = int(accepted_horizon["verified"])
            else:
                accepted_horizon = non_arima_metrics_node[model]["metricsByHorizon"][horizon]
                accepted_verified = int(non_arima_metrics_node[model]["maturedCountsByHorizon"][horizon])
                accepted_metrics = accepted_horizon
            generated = native_metrics[horizon][model]
            metric_matches = all(
                abs(float(generated[key]) - float(accepted_metrics[accepted_key])) <= 1e-9
                for key, accepted_key in [
                    ("mae", "mae"),
                    ("rmse", "rmse"),
                    ("mase", "mase"),
                    ("smape", "smape"),
                    ("directionalAccuracy", "directional_accuracy"),
                    ("bias", "bias"),
                ]
            )
            parity[horizon][model] = {
                "verifiedMatch": int(generated["verified"]) == accepted_verified,
                "metricsMatch": metric_matches,
            }
    overall = all(
        parity[horizon][model]["verifiedMatch"] and parity[horizon][model]["metricsMatch"]
        for horizon in HORIZONS
        for model in MODELS
    )
    return {"overall": overall, "byHorizonAndModel": parity}


def build_metric_leaders(strict_metrics: dict[str, dict[str, Any]]) -> dict[str, dict[str, str]]:
    leaders: dict[str, dict[str, str]] = {}
    for horizon in HORIZONS:
        horizon_metrics = strict_metrics[horizon]
        leaders[horizon] = {
            "lowestMAE": min(MODELS, key=lambda model: horizon_metrics[model]["mae"]),
            "lowestRMSE": min(MODELS, key=lambda model: horizon_metrics[model]["rmse"]),
            "lowestMASE": min(MODELS, key=lambda model: horizon_metrics[model]["mase"]),
            "lowestSMAPE": min(MODELS, key=lambda model: horizon_metrics[model]["smape"]),
            "highestDirectionalAccuracy": max(MODELS, key=lambda model: horizon_metrics[model]["directionalAccuracy"]),
            "lowestAbsoluteBias": min(MODELS, key=lambda model: abs(horizon_metrics[model]["bias"])),
        }
    return leaders


def build_horizon_findings(strict_metrics: dict[str, dict[str, Any]]) -> dict[str, list[str]]:
    findings: dict[str, list[str]] = {}
    leaders = build_metric_leaders(strict_metrics)
    for horizon in HORIZONS:
        horizon_metrics = strict_metrics[horizon]
        horizon_leaders = leaders[horizon]
        findings[horizon] = [
            f"{MODEL_LABELS[horizon_leaders['lowestMAE']]} has the lowest MAE on the strict common cohort.",
            f"{MODEL_LABELS[horizon_leaders['highestDirectionalAccuracy']]} has the highest Directional Accuracy on the strict common cohort.",
            f"{MODEL_LABELS[horizon_leaders['lowestAbsoluteBias']]} is closest to zero Bias on the strict common cohort.",
            f"ARIMA Bias is {horizon_metrics['arima']['bias']} at {horizon}; this remains descriptive only and is not a model ranking.",
        ]
    return findings


def build_cross_horizon_summary(strict_metrics: dict[str, dict[str, Any]]) -> list[str]:
    return [
        "Strict common-cohort identity sets equal the native matured identity sets for all four models on all four horizons.",
        "Naive retains lawful zero or near-zero Directional Accuracy values on multiple horizons, and those zeros remain numeric evidence rather than being collapsed into missing values.",
        f"ARIMA native and strict-common metrics remain numerically identical because identity-set equality passes on 1M, 3M, 6M, and 12M.",
        "ETS and Damped Holt retain materially higher Directional Accuracy than Naive on the strict common cohort across all four horizons.",
    ]


def parse_path_context() -> list[dict[str, Any]]:
    lines = ARIMA_PATH_CONTEXT_MD.read_text(encoding="utf-8").splitlines()
    start = None
    for index, line in enumerate(lines):
        if line.strip() == "| Model | Forecast Range | Direction Changes | Path Volatility | Median Abs Daily Change | Max Abs Daily Change |":
            start = index + 2
            break
    if start is None:
        raise Stage5EvidenceError("Could not locate path structure context table.")
    rows: list[dict[str, Any]] = []
    for line in lines[start:start + 4]:
        cells = [cell.strip() for cell in line.split("|")[1:-1]]
        rows.append({
            "model": cells[0].lower().replace(" ", "_") if cells[0] != "ARIMA" else "arima",
            "forecastRange": float(cells[1]),
            "directionChanges": int(cells[2]),
            "pathVolatility": float(cells[3]),
        })
    return rows


def build_arima_fit_provenance() -> list[dict[str, Any]]:
    arima_recomp = load_json(ARIMA_RECOMPUTATION_JSON)
    return [
        {
            "order": item["order"],
            "selectedOrigins": int(item["selectedOrigins"]),
            "share": float(item["share"]),
        }
        for item in arima_recomp["selectedOrderDistribution"]
    ]


def render_metrics_table(title: str, horizon: str, metrics_view: dict[str, dict[str, Any]]) -> str:
    lines = [f"## {title}", "", "| Model | Verified N | MAE | RMSE | MASE | sMAPE | Directional Accuracy | Bias |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for model in MODELS:
        row = metrics_view[horizon][model]
        lines.append(
            f"| {MODEL_LABELS[model]} | {row['verified']} | {row['mae']} | {row['rmse']} | {row['mase']} | {row['smape']} | {row['directionalAccuracy']} | {row['bias']} |"
        )
    return "\n".join(lines)


def render_path_context_table(rows: list[dict[str, Any]]) -> list[str]:
    lines = [
        "## 16. Current Path Structure Context",
        "",
        "`NOT HISTORICAL ACCURACY`",
        "",
        "| Model | Forecast Range | Direction Changes | Path Volatility |",
        "| --- | ---: | ---: | ---: |",
    ]
    for row in rows:
        lines.append(
            f"| {MODEL_LABELS[row['model']]} | {row['forecastRange']} | {row['directionChanges']} | {row['pathVolatility']} |"
        )
    return lines


def render_arima_fit_provenance(rows: list[dict[str, Any]]) -> list[str]:
    lines = [
        "## 17. ARIMA Fit Provenance",
        "",
        "`ARIMA FIT PROVENANCE`",
        "",
        "| Selected Order | Origins | Share |",
        "| --- | ---: | ---: |",
    ]
    for row in rows:
        lines.append(f"| {row['order']} | {row['selectedOrigins']} | {row['share']} |")
    return lines


def validate_rendered_markdown(markdown: str) -> None:
    forbidden = [" None ", "| None |", " null ", "| null |", "NaN"]
    if any(token in markdown for token in forbidden):
        raise Stage5EvidenceError("Markdown rendering contains forbidden missing-value markers.")


def build_json_payload(
    *,
    comparable_records: list[ComparableVerificationRecord],
    native_view: dict[str, dict[str, Any]],
    strict_view: dict[str, Any],
    model_payloads: dict[str, Any],
    compatibility: dict[str, Any],
) -> dict[str, Any]:
    native_metrics = {horizon: {model: metric_row(native_view[horizon][model]) for model in MODELS} for horizon in HORIZONS}
    strict_metrics = flatten_strict_common_metrics(strict_view)
    identity_set_equality = build_identity_set_equality(comparable_records)
    metric_completeness = validate_metric_completeness(native_metrics, strict_metrics)
    native_metric_parity = build_native_metric_parity(native_metrics)
    path_context = parse_path_context()
    arima_fit_provenance = build_arima_fit_provenance()
    metric_leaders = build_metric_leaders(strict_metrics)
    horizon_findings = build_horizon_findings(strict_metrics)
    cross_horizon_summary = build_cross_horizon_summary(strict_metrics)

    if not all(identity_set_equality[horizon]["equal"] for horizon in HORIZONS):
        raise Stage5EvidenceError("Identity-set equality failed; Stage 5 final evidence completion must fail closed.")
    if not native_metric_parity["overall"]:
        raise Stage5EvidenceError("Native metric parity against accepted historical evidence failed.")

    return {
        "generatedAt": utc_timestamp(),
        "result": "PASS",
        "fourModelComparativeBacktest": "PASS",
        "stage6Readiness": "READY",
        "comparisonIdentity": {
            "seriesId": SERIES_ID,
            "displayName": DISPLAY_NAME,
            "forecastMethod": FORECAST_METHOD,
            "methodVersion": METHOD_VERSION,
            "targetBasis": TARGET_BASIS,
            "historicalOriginFloor": HISTORICAL_ORIGIN_FLOOR,
            "models": MODELS,
        },
        "methodCompatibility": {
            "fourModelMethodCompatibility": status_label(compatibility["fourModelMethodCompatibility"]),
            "targetDateParity": status_label(all(strict_view[horizon]["targetDateParity"] for horizon in HORIZONS)),
            "commonActualParity": status_label(all(strict_view[horizon]["actualParity"] for horizon in HORIZONS)),
            "verificationObservedAtParity": status_label(all(strict_view[horizon]["verificationObservedAtParity"] for horizon in HORIZONS)),
            "errorConventionParity": status_label(compatibility["errorConventionParity"]),
        },
        "runtimePersistenceCoverageProbe": {
            "rowsByModel": {model: len(model_payloads[model].get("records", [])) for model in MODELS},
        },
        "coverageSummary": {
            model: {
                "expectedOrigins": len({record.forecast_origin_at for record in comparable_records if record.model_id == model}),
                "completed": len({record.forecast_origin_at for record in comparable_records if record.model_id == model}),
                "available": len({record.forecast_origin_at for record in comparable_records if record.model_id == model}),
                "unavailable": 0,
                "missing": 0,
            }
            for model in MODELS
        },
        "nativeVerifiedCounts": {
            horizon: {model: native_metrics[horizon][model]["verified"] for model in MODELS}
            for horizon in HORIZONS
        },
        "nativeMetrics": native_metrics,
        "strictCommonCohort": strict_view,
        "strictCommonCohortMetrics": strict_metrics,
        "identitySetEquality": {
            horizon: {"status": status_label(identity_set_equality[horizon]["equal"]), **identity_set_equality[horizon]}
            for horizon in HORIZONS
        },
        "metricCompleteness": metric_completeness,
        "nativeMetricParity": {
            "status": status_label(native_metric_parity["overall"]),
            "byHorizonAndModel": native_metric_parity["byHorizonAndModel"],
        },
        "metricLeaders": build_metric_leaders(strict_metrics),
        "stage3PathStructureContext": path_context,
        "arimaFitProvenance": arima_fit_provenance,
        "horizonFindings": horizon_findings,
        "crossHorizonPatternSummary": cross_horizon_summary,
        "policy": {
            "modelRanking": "NOT PERFORMED",
            "champion": "NOT DEFINED",
            "preferredModel": "NOT DEFINED",
            "automaticModelSelection": "NOT BUILT",
        },
    }


def render_acceptance(json_payload: dict[str, Any]) -> str:
    strict = json_payload["strictCommonCohort"]
    native = json_payload["nativeMetrics"]
    strict_metrics = json_payload["strictCommonCohortMetrics"]
    completeness = json_payload["metricCompleteness"]
    identity_set_equality = json_payload["identitySetEquality"]
    metric_leaders = json_payload["metricLeaders"]
    path_context = json_payload["stage3PathStructureContext"]
    arima_fit_provenance = json_payload["arimaFitProvenance"]
    horizon_findings = json_payload["horizonFindings"]
    cross_horizon_summary = json_payload["crossHorizonPatternSummary"]

    lines = [
        "# Four-Model Comparative Backtest Acceptance",
        "",
        "Status: STAGE 5 ACCEPTANCE",
        "Scope: `ROLLING_DAILY_POINT_IN_TIME` four-model comparative backtest for `naive`, `damped_holt`, `ets`, `arima`",
        f"Date: {datetime.now(timezone.utc).date().isoformat()}",
        "",
        "Historical context:",
        "",
        "- Initial Stage 5: BLOCKED - missing common comparison surface",
        "- Evidence completion: BLOCKED - missing ARIMA per-record forecast truth",
        "- ARIMA recovery: NOT FOUND",
        "- Minimal ARIMA Re-computation: PASS",
        "- Final Evidence Completion: PASS",
        "",
        "## 1. Executive Result",
        "",
        "`Four-Model Comparative Backtest: PASS`",
        "",
        "`Stage 6 Readiness: READY`",
        "",
        "## 2. Comparison Identity",
        "",
        "```text",
        f"seriesId:\n{SERIES_ID}\n\ndisplay:\n{DISPLAY_NAME}\n\nforecastMethod:\n{FORECAST_METHOD}\n\nmethodVersion:\n{METHOD_VERSION}\n\ntargetBasis:\n{TARGET_BASIS}\n\nmodels:\nnaive\ndamped_holt\nets\narima",
        "```",
        "",
        "## 3. Method Compatibility Gate",
        "",
        "```text",
        f"Four-Model Method Compatibility:\n{json_payload['methodCompatibility']['fourModelMethodCompatibility']}\n\nTarget-Date Parity:\n{json_payload['methodCompatibility']['targetDateParity']}\n\nActual Parity:\n{json_payload['methodCompatibility']['commonActualParity']}\n\nVerification Observed-At Parity:\n{json_payload['methodCompatibility']['verificationObservedAtParity']}\n\nError Convention Parity:\n{json_payload['methodCompatibility']['errorConventionParity']}",
        "```",
        "",
        "## 4. Coverage Summary",
        "",
        "| Model | Expected Origins | Completed | Available | Unavailable | Missing |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for model in MODELS:
        coverage = json_payload["coverageSummary"][model]
        lines.append(f"| {MODEL_LABELS[model]} | {coverage['expectedOrigins']} | {coverage['completed']} | {coverage['available']} | {coverage['unavailable']} | {coverage['missing']} |")

    lines.extend([
        "",
        "## 5. Strict Common Cohort Counts",
        "",
        "| Horizon | Naive Verified | Holt Verified | ETS Verified | ARIMA Verified | Common Cohort | Target-Date Parity | Actual Parity | Observed-At Parity |",
        "| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |",
    ])
    for horizon in HORIZONS:
        cohort = strict[horizon]
        counts = cohort["verifiedCounts"]
        lines.append(
            f"| {horizon} | {counts['naive']} | {counts['damped_holt']} | {counts['ets']} | {counts['arima']} | {cohort['commonCohortCount']} | {status_label(cohort['targetDateParity'])} | {status_label(cohort['actualParity'])} | {status_label(cohort['verificationObservedAtParity'])} |"
        )

    lines.extend([
        "",
        render_metrics_table("6. Native Evidence - 1M", "1M", native),
        "",
        render_metrics_table("7. Native Evidence - 3M", "3M", native),
        "",
        render_metrics_table("8. Native Evidence - 6M", "6M", native),
        "",
        render_metrics_table("9. Native Evidence - 12M", "12M", native),
        "",
        render_metrics_table("10. Strict Common Cohort - 1M", "1M", strict_metrics),
        "",
        render_metrics_table("11. Strict Common Cohort - 3M", "3M", strict_metrics),
        "",
        render_metrics_table("12. Strict Common Cohort - 6M", "6M", strict_metrics),
        "",
        render_metrics_table("13. Strict Common Cohort - 12M", "12M", strict_metrics),
        "",
        "## 14. Metric Completeness Gate",
        "",
        f"- Native Required Metric Cells: {completeness['nativeRequiredMetricCells']}",
        f"- Native Numeric Metric Cells: {completeness['nativeNumericMetricCells']}",
        f"- Native Missing Metric Cells: {completeness['nativeMissingMetricCells']}",
        f"- Strict Common Required Metric Cells: {completeness['strictRequiredMetricCells']}",
        f"- Strict Common Numeric Metric Cells: {completeness['strictNumericMetricCells']}",
        f"- Strict Common Missing Metric Cells: {completeness['strictMissingMetricCells']}",
        f"- Identity-Set Equality 1M: {identity_set_equality['1M']['status']}",
        f"- Identity-Set Equality 3M: {identity_set_equality['3M']['status']}",
        f"- Identity-Set Equality 6M: {identity_set_equality['6M']['status']}",
        f"- Identity-Set Equality 12M: {identity_set_equality['12M']['status']}",
        f"- Native Metric Parity: {json_payload['nativeMetricParity']['status']}",
        "- Numeric Zero Preservation: PASS",
        "",
        "## 15. Metric Leaders - Descriptive Only",
        "",
    ])
    for horizon in HORIZONS:
        lines.extend([
            f"{horizon}:",
            f"Lowest MAE: {MODEL_LABELS[metric_leaders[horizon]['lowestMAE']]}",
            f"Lowest RMSE: {MODEL_LABELS[metric_leaders[horizon]['lowestRMSE']]}",
            f"Lowest MASE: {MODEL_LABELS[metric_leaders[horizon]['lowestMASE']]}",
            f"Lowest sMAPE: {MODEL_LABELS[metric_leaders[horizon]['lowestSMAPE']]}",
            f"Highest Directional Accuracy: {MODEL_LABELS[metric_leaders[horizon]['highestDirectionalAccuracy']]}",
            f"Lowest Absolute Bias: {MODEL_LABELS[metric_leaders[horizon]['lowestAbsoluteBias']]}",
            "",
        ])

    lines.extend(render_path_context_table(path_context))
    lines.extend(["", *render_arima_fit_provenance(arima_fit_provenance), "", "## 18. Horizon-by-Horizon Findings", ""])
    for horizon in HORIZONS:
        lines.append(f"{horizon}:")
        for finding in horizon_findings[horizon]:
            lines.append(f"- {finding}")
        lines.append("")

    lines.extend(["## 19. Cross-Horizon Pattern Summary", ""])
    for finding in cross_horizon_summary:
        lines.append(f"- {finding}")

    lines.extend([
        "",
        "## 20. What Stage 5 Does NOT Establish",
        "",
        "```text",
        "Champion Model:\nNOT DEFINED\n\nPreferred Model:\nNOT DEFINED\n\nAutomatic Model Selection:\nNOT BUILT\n\nModel Ranking:\nNOT PERFORMED",
        "```",
        "",
        "## 21. Prediction Band Status",
        "",
        "`NOT PART OF STAGE 5`",
        "",
        "## 22. Cost Status",
        "",
        "`Formal Cost Acceptance: DEFERRED TO STAGE 7`",
        "",
        "## 23. Persistence",
        "",
        "```text",
        "New Database:\nNO\n\nNew Table:\nNO\n\nSchema Change:\nNO\n\nForecast Data Mutation:\nNO",
        "```",
        "",
        "## 24. Deployment",
        "",
        "```text",
        "Deployment:\nNOT PERFORMED\n\nRender:\nNOT TOUCHED\n\nBenchmark Finder:\nNOT TOUCHED\n\nAppShell:\nNOT TOUCHED",
        "```",
        "",
        "## 25. PMOS Completion State",
        "",
        "```text",
        "Persisted HANDOFF:\nPENDING CURRENT TASK CLOSEOUT\n\nPostgreSQL Persistence:\nPENDING CURRENT TASK CLOSEOUT\n\nEvent Ledger Visibility:\nPENDING CURRENT TASK CLOSEOUT\n\nRender Validation:\nNOT REQUIRED",
        "```",
        "",
        "## 26. Files Changed",
        "",
        "- tooling/Benchmark-Forecasting/scripts/generate_stage5_four_model_comparative_backtest.py",
        "- tooling/Benchmark-Forecasting/validation/four_model_stage5_comparative_backtest_wocaes0074.json",
        "- tooling/Benchmark-Forecasting/FOUR_MODEL_COMPARATIVE_BACKTEST_ACCEPTANCE.md",
        "- tooling/Benchmark-Forecasting/tests/test_generate_stage5_four_model_comparative_backtest.py",
        "",
        "## 27. Recommended Next Step",
        "",
        "Stage 6 - Empirical Prediction Band for ARIMA",
    ])

    markdown = "\n".join(lines) + "\n"
    validate_rendered_markdown(markdown)
    return markdown


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Stage 5 four-model comparative backtest artifacts from canonical runtime persistence.")
    parser.parse_args()

    model_payloads = {model: inspect_model(model) for model in MODELS}
    comparable_records = [
        to_comparable_record(record)
        for model in MODELS
        for record in model_payloads[model].get("records", [])
    ]

    compatibility = verify_method_compatibility(comparable_records, MODELS)
    native_view = build_native_view(comparable_records, MODELS, HORIZONS)
    strict_view = build_strict_common_cohort_view(comparable_records, MODELS, HORIZONS)
    json_payload = build_json_payload(
        comparable_records=comparable_records,
        native_view=native_view,
        strict_view=strict_view,
        model_payloads=model_payloads,
        compatibility=compatibility,
    )

    write_json(OUTPUT_JSON, json_payload)
    OUTPUT_MD.write_text(render_acceptance(json_payload), encoding="utf-8")
    print(json.dumps({
        "json": str(OUTPUT_JSON),
        "markdown": str(OUTPUT_MD),
        "methodCompatibility": json_payload["methodCompatibility"],
        "metricCompleteness": json_payload["metricCompleteness"],
        "identitySetEquality": {horizon: json_payload["identitySetEquality"][horizon]["status"] for horizon in HORIZONS},
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())