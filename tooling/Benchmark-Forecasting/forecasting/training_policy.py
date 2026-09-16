from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = ROOT / "metadata" / "model-technical-requirements.json"


def _read_positive_int(value: object, label: str) -> int:
    if not isinstance(value, int) or value < 1:
        raise ValueError(f"{label} must be a positive integer.")
    return value


@lru_cache(maxsize=1)
def load_period_forecast_training_policy() -> dict[str, object]:
    payload = json.loads(POLICY_PATH.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Forecast model technical requirements must be a JSON object.")
    return payload


def resolve_period_model_minimum_training_observations(model_id: str) -> int:
    payload = load_period_forecast_training_policy()
    model_policy = payload.get(model_id)
    if not isinstance(model_policy, dict):
        raise ValueError(f"Unsupported period forecast model id: {model_id}")
    return _read_positive_int(model_policy.get("minimumTrainingObservations"), f"{model_id}.minimumTrainingObservations")


def resolve_period_forecast_policy_version() -> str:
    payload = load_period_forecast_training_policy()
    version = payload.get("policyVersion")
    if not isinstance(version, str) or not version.strip():
        raise ValueError("Forecast model technical requirements must define policyVersion.")
    return version.strip()


def resolve_ets_seasonal_minimum_training_observations() -> int:
    payload = load_period_forecast_training_policy()
    return _read_positive_int(payload.get("etsSeasonalMinimumObservations"), "etsSeasonalMinimumObservations")
