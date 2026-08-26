from __future__ import annotations

import os
from pathlib import Path

from forecasting.contracts import BenchmarkDefinition, Frequency, NativeCadenceExecutionPlan
from forecasting.models.arima import ARIMAModelFamily
from forecasting.models.damped_holt import DampedHoltModel
from forecasting.models.ets import ETSModelFamily
from forecasting.models.naive import NaiveLastValueModel

ROOT = Path(__file__).resolve().parents[1]

RUN_ID = "cmrd3xvlu0000cedt8gczw378"
METHOD_VERSION = "benchmark-forecasting-mvp-phase2-v1"
SOURCE_KIND = "POSTGRES_RUNTIME_SNAPSHOT"

LEGACY_HORIZON_MONTHS = {
    "1M": 1,
    "3M": 3,
    "6M": 6,
    "12M": 12,
}

HORIZONS = LEGACY_HORIZON_MONTHS

BENCHMARKS = [
    BenchmarkDefinition(
        series_id="wocaes0280",
        component="FRACHT_DRY",
        description="Baltic Exchange, Dry Index (BDI), USD",
        frequency=Frequency.MONTHLY,
        expected_observations=64,
    ),
    BenchmarkDefinition(
        series_id="PET_RESIN",
        component="PET_RESIN",
        description="Vesper, EU, PET resin producer prices",
        frequency=Frequency.MONTHLY,
        expected_observations=64,
    ),
    BenchmarkDefinition(
        series_id="CEM_I_PORR",
        component="CEM_I",
        description="SpendGuru, CEM I 42.5 R-SR 5/NA bulk",
        frequency=Frequency.MONTHLY,
        expected_observations=64,
    ),
]

BENCHMARKS_BY_SERIES_ID = {benchmark.series_id: benchmark for benchmark in BENCHMARKS}

USER_FACING_MODEL_IDS = (
    "naive",
    "damped_holt",
    "ets",
    "arima",
)

SUPPORTED_MODEL_IDS = USER_FACING_MODEL_IDS


def get_benchmark_definition(series_id: str) -> BenchmarkDefinition | None:
    return BENCHMARKS_BY_SERIES_ID.get(series_id)


def build_model(
    model_id: str,
    frequency: Frequency = Frequency.MONTHLY,
    cadence_plan: NativeCadenceExecutionPlan | None = None,
):
    normalized = model_id.strip().lower()

    if normalized == "naive":
        return NaiveLastValueModel(frequency, cadence_plan)

    if normalized == "damped_holt":
        return DampedHoltModel(frequency, cadence_plan)

    if normalized == "ets":
        return ETSModelFamily(frequency, cadence_plan)

    if normalized == "arima":
        return ARIMAModelFamily(frequency, cadence_plan)

    raise ValueError(f"Unsupported model id: {model_id}")


def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        value = value.strip().strip('"').strip("'")
        os.environ[key.strip()] = value


def load_default_env_files() -> None:
    repo_root = ROOT.parents[1]
    load_env_file(repo_root / "apps/data-runtime/.env.local")
    load_env_file(ROOT / ".env")