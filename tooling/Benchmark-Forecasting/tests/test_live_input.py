from __future__ import annotations

import json
import tempfile
import unittest
from datetime import date
from pathlib import Path

from forecasting.contracts import Frequency
from forecasting.runtime_catalog import HORIZONS, build_model
from forecasting.service import ForecastingService
from scripts.export_forecast_bundle import InMemoryHistoricalSource, load_history_payload_context, serialize_verification_result


def create_payload() -> dict:
    return {
        "benchmark": {
            "seriesId": "wocaes0074",
            "component": "BRENT_SPOT",
            "description": "Brent, Spot, FOB North Sea",
            "frequency": "MONTHLY",
            "expectedObservations": 2,
        },
        "source": {
            "kind": "DYNAMIC_MARKET_DATA_STORE",
            "runId": None,
        },
        "canonicalization": {
            "method": "AVERAGE_OF_LAWFUL_DAILY_OBSERVATIONS",
            "version": "daily-market-price-monthly-average-v2",
            "partialMonthRule": "EXCLUDE_OPEN_CALENDAR_MONTH",
            "missingDayRule": "USE_AVAILABLE_LAWFUL_OBSERVATIONS_ONLY",
            "sourceObservationCount": 4,
            "sourceObservationsUsed": 4,
            "excludedPartialPeriods": 0,
        },
        "history": {
            "seriesId": "wocaes0074",
            "benchmarkName": "Brent, Spot, FOB North Sea",
            "description": "Brent, Spot, FOB North Sea",
            "frequency": "MONTHLY",
            "start": "2026-01-01T00:00:00.000Z",
            "end": "2026-02-01T00:00:00.000Z",
            "observations": 2,
            "canonicalization": {
                "method": "AVERAGE_OF_LAWFUL_DAILY_OBSERVATIONS",
                "version": "daily-market-price-monthly-average-v2",
            },
            "points": [
                {"date": "2026-01-01T00:00:00.000Z", "value": 20.0},
                {"date": "2026-02-01T00:00:00.000Z", "value": 30.0},
            ],
        },
    }


def create_long_payload(observations: int = 48) -> dict:
    points = []
    for index in range(observations):
        year = 2020 + ((index) // 12)
        month = (index % 12) + 1
        points.append(
            {
                "date": date(year, month, 1).isoformat(),
                "value": float(50 + index),
            }
        )

    return {
        "benchmark": {
            "seriesId": "wocaes0074",
            "component": "BRENT_SPOT",
            "description": "Brent, Spot, FOB North Sea",
            "frequency": "MONTHLY",
            "expectedObservations": observations,
        },
        "source": {
            "kind": "DYNAMIC_MARKET_DATA_STORE",
            "runId": None,
        },
        "canonicalization": {
            "method": "AVERAGE_OF_LAWFUL_DAILY_OBSERVATIONS",
            "version": "daily-market-price-monthly-average-v2",
            "partialMonthRule": "EXCLUDE_OPEN_CALENDAR_MONTH",
            "missingDayRule": "USE_AVAILABLE_LAWFUL_OBSERVATIONS_ONLY",
            "sourceObservationCount": observations * 20,
            "sourceObservationsUsed": observations * 20,
            "excludedPartialPeriods": 1,
        },
        "history": {
            "seriesId": "wocaes0074",
            "benchmarkName": "Brent, Spot, FOB North Sea",
            "description": "Brent, Spot, FOB North Sea",
            "frequency": "MONTHLY",
            "start": points[0]["date"],
            "end": points[-1]["date"],
            "observations": observations,
            "canonicalization": {
                "method": "AVERAGE_OF_LAWFUL_DAILY_OBSERVATIONS",
                "version": "daily-market-price-monthly-average-v2",
            },
            "points": points,
        },
    }


def create_eop_payload() -> dict:
    return {
        "benchmark": {
            "seriesId": "wocaes0074",
            "component": "BRENT_SPOT",
            "description": "Brent, Spot, FOB North Sea",
            "frequency": "MONTHLY",
            "expectedObservations": 2,
        },
        "source": {
            "kind": "DYNAMIC_MARKET_DATA_STORE",
            "runId": None,
        },
        "canonicalization": {
            "method": "LAST_LAWFUL_OBSERVATION_IN_CLOSED_PERIOD",
            "version": "daily-market-price-end-of-period-v1",
            "partialMonthRule": "EXCLUDE_OPEN_CALENDAR_MONTH",
            "missingDayRule": "USE_AVAILABLE_LAWFUL_OBSERVATIONS_ONLY",
            "sourceObservationCount": 40,
            "sourceObservationsUsed": 40,
            "excludedPartialPeriods": 0,
        },
        "history": {
            "seriesId": "wocaes0074",
            "benchmarkName": "Brent, Spot, FOB North Sea",
            "description": "Brent, Spot, FOB North Sea",
            "frequency": "MONTHLY",
            "start": "2026-01-01T00:00:00.000Z",
            "end": "2026-02-01T00:00:00.000Z",
            "observations": 2,
            "canonicalization": {
                "method": "LAST_LAWFUL_OBSERVATION_IN_CLOSED_PERIOD",
                "version": "daily-market-price-end-of-period-v1",
            },
            "points": [
                {"date": "2026-01-01T00:00:00.000Z", "value": 20.0, "sourceObservedAt": "2026-01-30T00:00:00.000Z"},
                {"date": "2026-02-01T00:00:00.000Z", "value": 30.0, "sourceObservedAt": "2026-02-27T00:00:00.000Z"},
            ],
        },
    }


def create_quarterly_payload(observations: int = 40) -> dict:
    points = []
    for index in range(observations):
        zero_based_month = index * 3
        points.append({
            "date": date(2015 + zero_based_month // 12, zero_based_month % 12 + 1, 1).isoformat(),
            "value": float(100 + index),
        })
    return {
        "benchmark": {
            "seriesId": "quarterly.series",
            "component": "QUARTERLY_SERIES",
            "description": "Controlled quarterly series",
            "frequency": "QUARTERLY",
            "expectedObservations": observations,
        },
        "source": {"kind": "DYNAMIC_MARKET_DATA_STORE", "runId": None},
        "canonicalization": {
            "method": "VALIDATE_NATIVE_PERIOD_END_OF_PERIOD",
            "version": "native-period-end-of-period-v1",
        },
        "execution": {
            "frequency": "QUARTERLY",
            "historicalPeriodStarts": [point["date"] for point in points],
            "horizons": {"3M": 1, "6M": 2, "12M": 4},
            "currentTargetDates": {
                "3M": "2025-01-01",
                "6M": "2025-04-01",
                "12M": "2025-10-01",
            },
        },
        "history": {
            "seriesId": "quarterly.series",
            "benchmarkName": "Controlled quarterly series",
            "description": "Controlled quarterly series",
            "frequency": "QUARTERLY",
            "start": points[0]["date"],
            "end": points[-1]["date"],
            "observations": observations,
            "canonicalization": {
                "method": "VALIDATE_NATIVE_PERIOD_END_OF_PERIOD",
                "version": "native-period-end-of-period-v1",
            },
            "points": points,
        },
    }


class LiveForecastInputTests(unittest.TestCase):
    def test_history_payload_context_loads_native_quarterly_execution_plan(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            payload_path = Path(temp_dir) / "history.json"
            payload_path.write_text(json.dumps(create_quarterly_payload()), encoding="utf-8")
            context = load_history_payload_context(str(payload_path))

        self.assertEqual(context["series"].frequency, Frequency.QUARTERLY)
        self.assertEqual(context["cadence_plan"].frequency, Frequency.QUARTERLY)
        self.assertEqual(context["horizons"], {"3M": 1, "6M": 2, "12M": 4})
        self.assertEqual(context["current_target_dates"]["12M"], date(2025, 10, 1))

    def test_history_payload_context_loads_monthly_series(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            payload_path = Path(temp_dir) / "history.json"
            payload_path.write_text(json.dumps(create_payload()), encoding="utf-8")

            context = load_history_payload_context(str(payload_path))

        benchmark = context["benchmark"]
        series = context["series"]
        self.assertEqual(benchmark.series_id, "wocaes0074")
        self.assertEqual(benchmark.component, "BRENT_SPOT")
        self.assertEqual(benchmark.frequency, Frequency.MONTHLY)
        self.assertEqual(benchmark.expected_observations, 2)
        self.assertEqual(series.series_id, "wocaes0074")
        self.assertEqual(series.benchmark_name, "Brent, Spot, FOB North Sea")
        self.assertEqual(series.frequency, Frequency.MONTHLY)
        self.assertEqual(series.observation_count, 2)
        self.assertEqual(series.start.isoformat(), "2026-01-01")
        self.assertEqual(series.end.isoformat(), "2026-02-01")
        self.assertEqual(context["source"]["kind"], "DYNAMIC_MARKET_DATA_STORE")
        self.assertEqual(context["canonicalization"]["version"], "daily-market-price-monthly-average-v2")
        self.assertEqual(context["history_points"][0]["date"], "2026-01-01")

    def test_in_memory_source_returns_loaded_series(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            payload_path = Path(temp_dir) / "history.json"
            payload_path.write_text(json.dumps(create_payload()), encoding="utf-8")
            context = load_history_payload_context(str(payload_path))

        source = InMemoryHistoricalSource(context["series"])
        loaded = source.load_series(context["benchmark"], "ignored-run-id")

        self.assertEqual(loaded.series_id, "wocaes0074")
        self.assertEqual(loaded.observation_count, 2)
        self.assertEqual(loaded.observations[0].value, 20.0)
        self.assertEqual(loaded.observations[1].value, 30.0)

    def test_verification_serialization_preserves_live_canonicalization(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            payload_path = Path(temp_dir) / "history.json"
            payload_path.write_text(json.dumps(create_long_payload()), encoding="utf-8")
            context = load_history_payload_context(str(payload_path))

        service = ForecastingService(
            data_source=InMemoryHistoricalSource(context["series"]),
            model=build_model("naive"),
            run_id="test-live-input",
            horizons=HORIZONS,
            min_training_window=36,
        )

        result = service.run_benchmark(context["benchmark"])
        payload = serialize_verification_result(result, canonicalization=context["canonicalization"])

        self.assertEqual(payload["history"]["canonicalization"]["method"], "AVERAGE_OF_LAWFUL_DAILY_OBSERVATIONS")
        self.assertEqual(payload["history"]["canonicalization"]["version"], "daily-market-price-monthly-average-v2")

    def test_verification_serialization_preserves_live_source_observation_provenance(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            payload_path = Path(temp_dir) / "history.json"
            payload_path.write_text(json.dumps(create_eop_payload()), encoding="utf-8")
            context = load_history_payload_context(str(payload_path))

        service = ForecastingService(
            data_source=InMemoryHistoricalSource(context["series"]),
            model=build_model("naive"),
            run_id="test-live-input",
            horizons=HORIZONS,
            min_training_window=36,
        )

        result = service.run_benchmark(context["benchmark"])
        payload = serialize_verification_result(
            result,
            canonicalization=context["canonicalization"],
            history_points=context["history_points"],
        )

        self.assertEqual(payload["history"]["points"][0]["sourceObservedAt"], "2026-01-30T00:00:00.000Z")
        self.assertEqual(payload["history"]["points"][1]["sourceObservedAt"], "2026-02-27T00:00:00.000Z")


if __name__ == "__main__":
    unittest.main()