from __future__ import annotations

import json
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

from forecasting.rolling_daily_policy import (
    ROLLING_DAILY_POINT_IN_TIME_METHOD_ID,
    ROLLING_DAILY_POINT_IN_TIME_METHOD_VERSION,
    ROLLING_DAILY_PROJECTION_CALENDAR_STRATEGY_V1,
)
from scripts import export_rolling_daily_current_forecast as current_script


def weekday_points(start: date, end: date) -> list[dict[str, float]]:
    points: list[dict[str, float]] = []
    current = start
    value = 100.0
    while current <= end:
        if current.weekday() < 5:
            points.append({"date": current.isoformat(), "value": value})
            value += 1.0
        current += timedelta(days=1)
    return points


def build_payload(
    *,
    end: date,
    model_id: str = "naive",
    minimum_training_observations: int = 5,
    calibration_groups: list[dict[str, object]] | None = None,
) -> dict[str, object]:
    return {
        "seriesId": "wocaes0074",
        "modelId": model_id,
        "methodId": ROLLING_DAILY_POINT_IN_TIME_METHOD_ID,
        "methodVersion": ROLLING_DAILY_POINT_IN_TIME_METHOD_VERSION,
        "minimumTrainingObservations": minimum_training_observations,
        "minimumCalibrationSamples": 20,
        "history": {
            "seriesId": "wocaes0074",
            "displayName": "Brent, Spot, FOB North Sea",
            "description": "Brent, Spot, FOB North Sea",
            "frequency": "DAILY",
            "source": "Macrobond",
            "points": weekday_points(date(2024, 1, 1), end),
        },
        "calibrationGroups": calibration_groups
        if calibration_groups is not None
        else [
            {
                "horizonLabel": "1M",
                "horizonMonths": 1,
                "sampleCount": 25,
                "residualP10": -2.0,
                "residualP90": 3.0,
                "status": "AVAILABLE",
            },
            {
                "horizonLabel": "3M",
                "horizonMonths": 3,
                "sampleCount": 25,
                "residualP10": -4.0,
                "residualP90": 5.0,
                "status": "AVAILABLE",
            },
            {
                "horizonLabel": "6M",
                "horizonMonths": 6,
                "sampleCount": 25,
                "residualP10": -6.0,
                "residualP90": 7.0,
                "status": "AVAILABLE",
            },
            {
                "horizonLabel": "12M",
                "horizonMonths": 12,
                "sampleCount": 25,
                "residualP10": -8.0,
                "residualP90": 9.0,
                "status": "AVAILABLE",
            },
        ],
    }


def run_script(payload: dict[str, object]) -> dict[str, object]:
    with tempfile.TemporaryDirectory() as temp_dir:
        input_path = Path(temp_dir) / "input.json"
        output_path = Path(temp_dir) / "output.json"
        input_path.write_text(json.dumps(payload), encoding="utf-8")
        with patch(
            "sys.argv",
            [
                "export_rolling_daily_current_forecast.py",
                "--input-json",
                str(input_path),
                "--output-json",
                str(output_path),
            ],
        ):
            exit_code = current_script.main()
        if exit_code != 0:
            raise AssertionError(f"Script returned exit code {exit_code}.")
        return json.loads(output_path.read_text(encoding="utf-8"))


class RollingDailyCurrentForecastExportTests(unittest.TestCase):
    def test_exports_exact_anchor_and_interpolated_band_semantics(self) -> None:
        output = run_script(build_payload(end=date(2024, 3, 29)))

        self.assertEqual(output["status"], "AVAILABLE")
        self.assertEqual(output["sourceHistory"]["latestObservationDate"], "2024-03-29")
        self.assertEqual(output["currentForecast"]["calendarProjectionMode"], ROLLING_DAILY_PROJECTION_CALENDAR_STRATEGY_V1)

        anchors = {anchor["horizon"]: anchor for anchor in output["currentForecast"]["anchors"]}
        self.assertEqual(set(anchors.keys()), {"1M", "3M", "6M", "12M"})

        path = output["currentForecast"]["path"]
        self.assertEqual(path[-1]["date"], anchors["12M"]["targetCalendarDate"])

        point_by_date = {point["date"]: point for point in path}
        exact_anchor_point = point_by_date[anchors["3M"]["targetCalendarDate"]]
        self.assertEqual(exact_anchor_point["bandSource"], "EMPIRICAL_ANCHOR")
        self.assertEqual(exact_anchor_point["bandStatus"], "AVAILABLE")

        before_first_anchor = next(point for point in path if point["date"] < anchors["1M"]["targetCalendarDate"])
        self.assertEqual(before_first_anchor["bandStatus"], "AVAILABLE")
        self.assertEqual(before_first_anchor["bandSource"], "INTERPOLATED_BETWEEN_EMPIRICAL_ANCHORS")
        self.assertLess(before_first_anchor["lowerP10"], before_first_anchor["pointForecast"])
        self.assertGreater(before_first_anchor["upperP90"], before_first_anchor["pointForecast"])
        self.assertLess(before_first_anchor["p10ResidualOffset"], 0.0)
        self.assertGreater(before_first_anchor["p90ResidualOffset"], 0.0)

        interpolated_point = next(
            point
            for point in path
            if anchors["1M"]["targetCalendarDate"] < point["date"] < anchors["3M"]["targetCalendarDate"]
        )
        self.assertEqual(interpolated_point["bandSource"], "INTERPOLATED_BETWEEN_EMPIRICAL_ANCHORS")

    def test_exports_arima_current_forecast_without_special_dto(self) -> None:
        output = run_script(
            build_payload(
                end=date(2024, 3, 29),
                model_id="arima",
                minimum_training_observations=60,
            )
        )

        self.assertEqual(output["status"], "AVAILABLE")
        self.assertEqual(output["modelId"], "arima")
        self.assertEqual(output["methodId"], ROLLING_DAILY_POINT_IN_TIME_METHOD_ID)
        self.assertEqual(output["methodVersion"], ROLLING_DAILY_POINT_IN_TIME_METHOD_VERSION)
        self.assertTrue(output["currentForecast"]["selectedCandidate"].startswith("ARIMA("))
        self.assertEqual(output["currentForecast"]["selectedParameters"]["policyIdentity"], "ARIMA_NON_SEASONAL_BOUNDED_AICC_V1")
        self.assertEqual(output["currentForecast"]["selectedParameters"]["candidateCount"], 17)
        self.assertEqual(len(output["currentForecast"]["anchors"]), 4)
        self.assertGreater(len(output["currentForecast"]["path"]), 0)

    def test_insufficient_history_is_reported_without_crashing(self) -> None:
        output = run_script(build_payload(end=date(2024, 1, 5), minimum_training_observations=60, calibration_groups=[]))

        self.assertEqual(output["status"], "INSUFFICIENT_HISTORY")
        self.assertEqual(output["methodId"], ROLLING_DAILY_POINT_IN_TIME_METHOD_ID)
        self.assertEqual(output["methodVersion"], ROLLING_DAILY_POINT_IN_TIME_METHOD_VERSION)
        self.assertEqual(output["currentForecast"]["path"], [])
        self.assertEqual(output["currentForecast"]["anchors"], [])


if __name__ == "__main__":
    unittest.main()