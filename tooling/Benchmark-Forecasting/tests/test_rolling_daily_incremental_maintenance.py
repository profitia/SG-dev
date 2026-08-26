from __future__ import annotations

import json
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

from forecasting.rolling_daily_policy import ROLLING_DAILY_POINT_IN_TIME_METHOD_VERSION, ROLLING_DAILY_TARGET_BASIS
from scripts import export_rolling_daily_current_forecast as current_forecast_script
from scripts import export_rolling_daily_incremental_maintenance as incremental_script


SUPPORTED_MODELS = ("naive", "damped_holt", "ets")


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
    last_processed_origin_date: str | None,
    existing_records: list[dict[str, object]],
    model_id: str = "naive",
    method_version: str = ROLLING_DAILY_POINT_IN_TIME_METHOD_VERSION,
    input_source: str = "Macrobond",
    force_calibration_refresh: bool = False,
) -> dict[str, object]:
    return {
        "seriesId": "wocaes0074",
        "modelId": model_id,
        "targetBasis": ROLLING_DAILY_TARGET_BASIS,
        "methodId": "ROLLING_DAILY_POINT_IN_TIME",
        "methodVersion": method_version,
        "historicalOriginStartDate": "2024-01-01",
        "minimumTrainingObservations": 5,
        "minimumCalibrationSamples": 20,
        "lastProcessedOriginDate": last_processed_origin_date,
        "forceCalibrationRefresh": force_calibration_refresh,
        "sourceHistoryFingerprint": "ignored-by-script",
        "existingRecords": existing_records,
        "history": {
            "seriesId": "wocaes0074",
            "displayName": "Brent, Spot, FOB North Sea",
            "description": "Brent, Spot, FOB North Sea",
            "frequency": "DAILY",
            "source": input_source,
            "points": weekday_points(date(2024, 1, 1), end),
        },
    }


def run_script(payload: dict[str, object]) -> dict[str, object]:
    with tempfile.TemporaryDirectory() as temp_dir:
        input_path = Path(temp_dir) / "input.json"
        output_path = Path(temp_dir) / "output.json"
        input_path.write_text(json.dumps(payload), encoding="utf-8")
        with patch("sys.argv", [
            "export_rolling_daily_incremental_maintenance.py",
            "--input-json",
            str(input_path),
            "--output-json",
            str(output_path),
        ]):
            exit_code = incremental_script.main()
        if exit_code != 0:
            raise AssertionError(f"Script returned exit code {exit_code}.")
        return json.loads(output_path.read_text(encoding="utf-8"))


def run_current_script(payload: dict[str, object]) -> dict[str, object]:
    with tempfile.TemporaryDirectory() as temp_dir:
        input_path = Path(temp_dir) / "input.json"
        output_path = Path(temp_dir) / "output.json"
        input_path.write_text(json.dumps(payload), encoding="utf-8")
        with patch("sys.argv", [
            "export_rolling_daily_current_forecast.py",
            "--input-json",
            str(input_path),
            "--output-json",
            str(output_path),
        ]):
            exit_code = current_forecast_script.main()
        if exit_code != 0:
            raise AssertionError(f"Current-forecast script returned exit code {exit_code}.")
        return json.loads(output_path.read_text(encoding="utf-8"))


def merge_records(*groups: list[dict[str, object]]) -> list[dict[str, object]]:
    merged: dict[tuple[str, str], dict[str, object]] = {}
    for group in groups:
        for record in group:
            merged[(str(record["forecastOriginAt"]), str(record["horizonLabel"]))] = record
    return list(merged.values())


def canonicalize_records(records: list[dict[str, object]]) -> list[dict[str, object]]:
    normalized: list[dict[str, object]] = []
    for record in records:
        clone = dict(record)
        clone.pop("sourceHistoryFingerprint", None)
        normalized.append(clone)
    return sorted(normalized, key=lambda record: (
        str(record["forecastOriginAt"]),
        int(record["horizonMonths"]),
        str(record["horizonLabel"]),
    ))


def canonicalize_groups(groups: list[dict[str, object]]) -> list[dict[str, object]]:
    return sorted(groups, key=lambda group: (
        int(group["horizonMonths"]),
        str(group["horizonLabel"]),
        str(group["methodVersion"]),
        str(group["modelId"]),
    ))


def without_method_version(items: list[dict[str, object]]) -> list[dict[str, object]]:
    normalized: list[dict[str, object]] = []
    for item in items:
        clone = dict(item)
        clone.pop("methodVersion", None)
        normalized.append(clone)
    return normalized


class RollingDailyIncrementalMaintenanceTests(unittest.TestCase):
    def test_rolling_daily_policy_uses_point_in_time_basis_without_bumping_method_version(self) -> None:
        self.assertEqual(ROLLING_DAILY_TARGET_BASIS, "POINT_IN_TIME")
        self.assertEqual(ROLLING_DAILY_POINT_IN_TIME_METHOD_VERSION, "rolling-daily-point-in-time-v1")

    def test_explicit_input_source_overrides_history_source_for_persisted_identity(self) -> None:
        payload = build_payload(
            end=date(2024, 3, 29),
            last_processed_origin_date=None,
            existing_records=[],
            model_id="naive",
            input_source="src_macrobond",
        )
        payload["inputSource"] = "DYNAMIC_MARKET_DATA_STORE"

        output = run_script(payload)

        self.assertEqual(output["status"], "AVAILABLE")
        self.assertTrue(output["newRecords"])
        self.assertTrue(output["calibrationGroups"])
        self.assertTrue(all(record["targetBasis"] == "POINT_IN_TIME" for record in output["newRecords"]))
        self.assertTrue(all(group["targetBasis"] == "POINT_IN_TIME" for group in output["calibrationGroups"]))
        self.assertTrue(all(record["inputSource"] == "DYNAMIC_MARKET_DATA_STORE" for record in output["newRecords"]))
        self.assertTrue(all(group["inputSource"] == "DYNAMIC_MARKET_DATA_STORE" for group in output["calibrationGroups"]))

    def test_one_new_observation_computes_one_new_origin(self) -> None:
        for model_id in SUPPORTED_MODELS:
            with self.subTest(model_id=model_id):
                payload = build_payload(
                    end=date(2024, 2, 16),
                    last_processed_origin_date="2024-02-15",
                    existing_records=[],
                    model_id=model_id,
                )

                output = run_script(payload)

                self.assertEqual(output["status"], "AVAILABLE")
                self.assertEqual(output["maintenance"]["newOriginCount"], 1)
                self.assertEqual(output["maintenance"]["newOriginDates"], ["2024-02-16"])
                self.assertEqual(len(output["newRecords"]), 4)
                self.assertEqual(output["maintenance"]["maturedRecordCount"], 0)
                self.assertTrue(all(record["modelId"] == model_id for record in output["newRecords"]))

    def test_arima_historical_origin_floor_keeps_pre_2024_training_history(self) -> None:
        payload = {
            "seriesId": "wocaes0074",
            "modelId": "arima",
            "targetBasis": ROLLING_DAILY_TARGET_BASIS,
            "methodId": "ROLLING_DAILY_POINT_IN_TIME",
            "methodVersion": ROLLING_DAILY_POINT_IN_TIME_METHOD_VERSION,
            "historicalOriginStartDate": "2024-01-01",
            "minimumTrainingObservations": 60,
            "minimumCalibrationSamples": 20,
            "lastProcessedOriginDate": None,
            "sourceHistoryFingerprint": "ignored-by-script",
            "existingRecords": [],
            "history": {
                "seriesId": "wocaes0074",
                "displayName": "Brent, Spot, FOB North Sea",
                "description": "Brent, Spot, FOB North Sea",
                "frequency": "DAILY",
                "source": "DYNAMIC_MARKET_DATA_STORE",
                "points": weekday_points(date(2023, 10, 1), date(2024, 3, 29)),
            },
        }

        output = run_script(payload)

        self.assertEqual(output["status"], "AVAILABLE")
        first_record = min(output["newRecords"], key=lambda record: (record["forecastOriginAt"], record["horizonMonths"]))
        self.assertGreaterEqual(first_record["forecastOriginAt"], "2024-01-01")
        self.assertLess(first_record["trainingHistoryStartAt"], "2024-01-01")
        self.assertEqual(first_record["trainingHistoryEndAt"], first_record["forecastOriginAt"])

    def test_arima_uses_one_fit_per_origin_and_lawful_daily_origins_only(self) -> None:
        original_fit_path_model = incremental_script.fit_path_model
        captured_histories = []

        def capture_fit(model, history):
            captured_histories.append(history)
            return original_fit_path_model(model, history)

        payload = build_payload(
            end=date(2024, 5, 31),
            last_processed_origin_date=None,
            existing_records=[],
            model_id="arima",
        )
        payload["minimumTrainingObservations"] = 60

        with patch("scripts.export_rolling_daily_incremental_maintenance.fit_path_model", side_effect=capture_fit):
            output = run_script(payload)

        self.assertEqual(output["status"], "AVAILABLE")
        self.assertEqual(len(captured_histories), output["maintenance"]["newOriginCount"])
        self.assertTrue(all(history[-1].date.isoformat() in output["maintenance"]["newOriginDates"] for history in captured_histories))
        self.assertTrue(all(date.fromisoformat(origin).weekday() < 5 for origin in output["maintenance"]["newOriginDates"]))

    def test_arima_actual_resolution_is_as_of_target_date_and_immature_targets_are_not_failures(self) -> None:
        output = run_script({**build_payload(
            end=date(2024, 5, 31),
            last_processed_origin_date=None,
            existing_records=[],
            model_id="arima",
        ), "minimumTrainingObservations": 60})

        self.assertEqual(output["status"], "AVAILABLE")
        matured = [record for record in output["newRecords"] if record["maturityStatus"] == "MATURED"]
        immature = [record for record in output["newRecords"] if record["maturityStatus"] == "NOT_YET_MATURED"]

        self.assertTrue(matured)
        self.assertTrue(immature)
        self.assertTrue(all(record["verificationObservedAt"] <= record["targetCalendarDate"] for record in matured))
        self.assertTrue(all(record["actualValue"] is not None for record in matured))
        self.assertTrue(all(record["actualValue"] is None for record in immature))
        self.assertTrue(all(record["errorValue"] is None for record in immature))
        self.assertTrue(all(record["residualValue"] is None for record in immature))

    def test_arima_incremental_catchup_matches_full_rebuild_and_rerun_is_idempotent(self) -> None:
        initial_output = run_script(
            {**build_payload(
                end=date(2024, 3, 29),
                last_processed_origin_date=None,
                existing_records=[],
                model_id="arima",
            ), "minimumTrainingObservations": 60}
        )

        catchup_output = run_script(
            {**build_payload(
                end=date(2024, 5, 31),
                last_processed_origin_date="2024-03-29",
                existing_records=initial_output["newRecords"],
                model_id="arima",
            ), "minimumTrainingObservations": 60}
        )

        self.assertEqual(catchup_output["status"], "AVAILABLE")
        self.assertGreater(catchup_output["maintenance"]["newOriginCount"], 0)
        self.assertGreater(catchup_output["maintenance"]["maturedRecordCount"], 0)

        rerun_output = run_script(
            {**build_payload(
                end=date(2024, 5, 31),
                last_processed_origin_date="2024-05-31",
                existing_records=merge_records(
                    initial_output["newRecords"],
                    catchup_output["newRecords"],
                    catchup_output["maturedRecords"],
                ),
                model_id="arima",
            ), "minimumTrainingObservations": 60}
        )

        self.assertEqual(rerun_output["status"], "AVAILABLE")
        self.assertEqual(rerun_output["maintenance"]["newOriginCount"], 0)
        self.assertEqual(rerun_output["maintenance"]["maturedRecordCount"], 0)
        self.assertEqual(rerun_output["maintenance"]["calibrationRefreshCount"], 0)

        full_rebuild_output = run_script(
            {**build_payload(
                end=date(2024, 5, 31),
                last_processed_origin_date=None,
                existing_records=[],
                model_id="arima",
            ), "minimumTrainingObservations": 60}
        )

        incremental_final_records = canonicalize_records(
            merge_records(
                initial_output["newRecords"],
                catchup_output["newRecords"],
                catchup_output["maturedRecords"],
            )
        )
        rebuilt_records = canonicalize_records(full_rebuild_output["newRecords"])
        self.assertEqual(incremental_final_records, rebuilt_records)

    def test_extended_history_matures_existing_records_and_rerun_is_idempotent(self) -> None:
        for model_id in SUPPORTED_MODELS:
            with self.subTest(model_id=model_id):
                initial_output = run_script(
                    build_payload(
                        end=date(2024, 2, 16),
                        last_processed_origin_date=None,
                        existing_records=[],
                        model_id=model_id,
                    )
                )

                incremental_output = run_script(
                    build_payload(
                        end=date(2024, 3, 29),
                        last_processed_origin_date="2024-02-16",
                        existing_records=initial_output["newRecords"],
                        model_id=model_id,
                    )
                )

                self.assertEqual(incremental_output["status"], "AVAILABLE")
                self.assertGreater(incremental_output["maintenance"]["newOriginCount"], 0)
                self.assertGreater(incremental_output["maintenance"]["maturedRecordCount"], 0)
                self.assertGreater(incremental_output["maintenance"]["calibrationRefreshCount"], 0)

                rerun_output = run_script(
                    build_payload(
                        end=date(2024, 3, 29),
                        last_processed_origin_date="2024-03-29",
                        existing_records=merge_records(
                            initial_output["newRecords"],
                            incremental_output["newRecords"],
                            incremental_output["maturedRecords"],
                        ),
                        model_id=model_id,
                    )
                )

                self.assertEqual(rerun_output["status"], "AVAILABLE")
                self.assertEqual(rerun_output["maintenance"]["newOriginCount"], 0)
                self.assertEqual(rerun_output["maintenance"]["maturedRecordCount"], 0)
                self.assertEqual(rerun_output["maintenance"]["calibrationRefreshCount"], 0)

    def test_incremental_catchup_matches_full_rebuild_for_supported_models(self) -> None:
        for model_id in SUPPORTED_MODELS:
            with self.subTest(model_id=model_id):
                initial_output = run_script(
                    build_payload(
                        end=date(2024, 2, 16),
                        last_processed_origin_date=None,
                        existing_records=[],
                        model_id=model_id,
                    )
                )

                catchup_output = run_script(
                    build_payload(
                        end=date(2024, 3, 29),
                        last_processed_origin_date="2024-02-16",
                        existing_records=initial_output["newRecords"],
                        model_id=model_id,
                    )
                )

                full_rebuild_output = run_script(
                    build_payload(
                        end=date(2024, 3, 29),
                        last_processed_origin_date=None,
                        existing_records=[],
                        model_id=model_id,
                    )
                )

                incremental_final_records = canonicalize_records(
                    merge_records(
                        initial_output["newRecords"],
                        catchup_output["newRecords"],
                        catchup_output["maturedRecords"],
                    )
                )
                rebuilt_records = canonicalize_records(full_rebuild_output["newRecords"])

                self.assertEqual(incremental_final_records, rebuilt_records)
                self.assertEqual(
                    canonicalize_groups(catchup_output["calibrationGroups"]),
                    canonicalize_groups(full_rebuild_output["calibrationGroups"]),
                )

    def test_foreign_method_version_records_are_ignored(self) -> None:
        control_output = run_script(
            build_payload(
                end=date(2024, 3, 29),
                last_processed_origin_date="2024-02-16",
                existing_records=[],
                model_id="naive",
            )
        )

        foreign_seed_output = run_script(
            build_payload(
                end=date(2024, 2, 16),
                last_processed_origin_date=None,
                existing_records=[],
                model_id="naive",
                method_version="rolling-daily-point-in-time-v1",
            )
        )

        isolated_output = run_script(
            build_payload(
                end=date(2024, 3, 29),
                last_processed_origin_date="2024-02-16",
                existing_records=foreign_seed_output["newRecords"],
                model_id="naive",
                method_version="rolling-daily-point-in-time-v2",
            )
        )

        self.assertEqual(isolated_output["status"], "AVAILABLE")
        self.assertEqual(isolated_output["maintenance"], control_output["maintenance"])
        self.assertEqual(
            without_method_version(canonicalize_records(isolated_output["newRecords"])),
            without_method_version(canonicalize_records(control_output["newRecords"])),
        )
        self.assertEqual(
            without_method_version(canonicalize_groups(isolated_output["calibrationGroups"])),
            without_method_version(canonicalize_groups(control_output["calibrationGroups"])),
        )
        self.assertTrue(all(record["methodVersion"] == "rolling-daily-point-in-time-v2" for record in isolated_output["newRecords"]))
        self.assertTrue(all(group["methodVersion"] == "rolling-daily-point-in-time-v2" for group in isolated_output["calibrationGroups"]))

    def test_error_and_residual_signs_remain_canonical_for_matured_records(self) -> None:
        for model_id in (*SUPPORTED_MODELS, "arima"):
            with self.subTest(model_id=model_id):
                minimum_training = 60 if model_id == "arima" else 5
                initial_output = run_script(
                    {**build_payload(
                        end=date(2024, 3, 29),
                        last_processed_origin_date=None,
                        existing_records=[],
                        model_id=model_id,
                    ), "minimumTrainingObservations": minimum_training}
                )

                extended_output = run_script(
                    {**build_payload(
                        end=date(2024, 5, 31),
                        last_processed_origin_date="2024-03-29",
                        existing_records=initial_output["newRecords"],
                        model_id=model_id,
                    ), "minimumTrainingObservations": minimum_training}
                )

                matured_records = extended_output["maturedRecords"]
                self.assertTrue(matured_records)
                for record in matured_records:
                    self.assertAlmostEqual(record["errorValue"], record["forecastValue"] - record["actualValue"])
                    self.assertAlmostEqual(record["residualValue"], record["actualValue"] - record["forecastValue"])
                    self.assertAlmostEqual(record["deltaValue"], record["errorValue"])

    def test_calibration_uses_only_matured_lawful_residuals(self) -> None:
        output = run_script(
            {**build_payload(
                end=date(2024, 5, 31),
                last_processed_origin_date=None,
                existing_records=[],
                model_id="arima",
            ), "minimumTrainingObservations": 60}
        )

        matured_records = [record for record in output["newRecords"] if record["maturityStatus"] == "MATURED"]
        self.assertTrue(matured_records)
        latest_date = max(record["verificationObservedAt"] for record in matured_records if record["verificationObservedAt"] is not None)
        for group in output["calibrationGroups"]:
            eligible = [
                record for record in matured_records
                if record["horizonLabel"] == group["horizonLabel"]
                and record["verificationObservedAt"] is not None
                and record["verificationObservedAt"] <= latest_date
            ]
            self.assertEqual(group["sampleCount"], len(eligible))
            self.assertTrue(all(record["verificationObservedAt"] <= record["targetCalendarDate"] for record in eligible))

    def test_current_origin_point_path_matches_independent_fresh_computation_for_all_models(self) -> None:
        for model_id in (*SUPPORTED_MODELS, "arima"):
            with self.subTest(model_id=model_id):
                minimum_training = 60 if model_id == "arima" else 5
                initial_output = run_script(
                    {**build_payload(
                        end=date(2024, 3, 29),
                        last_processed_origin_date=None,
                        existing_records=[],
                        model_id=model_id,
                    ), "minimumTrainingObservations": minimum_training}
                )

                incremental_output = run_script(
                    {**build_payload(
                        end=date(2024, 5, 31),
                        last_processed_origin_date="2024-03-29",
                        existing_records=initial_output["newRecords"],
                        model_id=model_id,
                    ), "minimumTrainingObservations": minimum_training}
                )

                merged_records = merge_records(
                    initial_output["newRecords"],
                    incremental_output["newRecords"],
                    incremental_output["maturedRecords"],
                )

                incremental_current = run_current_script({
                    **build_payload(
                        end=date(2024, 5, 31),
                        last_processed_origin_date=None,
                        existing_records=[],
                        model_id=model_id,
                    ),
                    "minimumTrainingObservations": minimum_training,
                    "calibrationGroups": incremental_output["calibrationGroups"],
                })
                fresh_rebuild = run_script(
                    {**build_payload(
                        end=date(2024, 5, 31),
                        last_processed_origin_date=None,
                        existing_records=[],
                        model_id=model_id,
                    ), "minimumTrainingObservations": minimum_training}
                )
                fresh_current = run_current_script({
                    **build_payload(
                        end=date(2024, 5, 31),
                        last_processed_origin_date=None,
                        existing_records=[],
                        model_id=model_id,
                    ),
                    "minimumTrainingObservations": minimum_training,
                    "calibrationGroups": fresh_rebuild["calibrationGroups"],
                })

                self.assertEqual(incremental_current["currentForecast"]["originDate"], fresh_current["currentForecast"]["originDate"])
                self.assertEqual(incremental_current["currentForecast"]["path"], fresh_current["currentForecast"]["path"])
                self.assertEqual(incremental_current["currentForecast"]["anchors"], fresh_current["currentForecast"]["anchors"])
                if model_id == "arima":
                    self.assertEqual(incremental_current["currentForecast"]["selectedCandidate"], fresh_current["currentForecast"]["selectedCandidate"])
                    self.assertEqual(incremental_current["currentForecast"]["selectedParameters"], fresh_current["currentForecast"]["selectedParameters"])
                    first_anchor_date = incremental_current["currentForecast"]["anchors"][0]["targetCalendarDate"]
                    incremental_pre_1m = [point for point in incremental_current["currentForecast"]["path"] if point["date"] < first_anchor_date]
                    fresh_pre_1m = [point for point in fresh_current["currentForecast"]["path"] if point["date"] < first_anchor_date]
                    self.assertTrue(incremental_pre_1m)
                    self.assertEqual(incremental_pre_1m, fresh_pre_1m)
                self.assertEqual(merged_records[-1]["forecastOriginAt"], incremental_current["currentForecast"]["originDate"])

    def test_force_calibration_refresh_rebuilds_groups_from_existing_mature_records_without_new_origins(self) -> None:
        initial_output = run_script(
            build_payload(
                end=date(2024, 5, 31),
                last_processed_origin_date=None,
                existing_records=[],
                model_id="naive",
            )
        )

        no_force_output = run_script(
            build_payload(
                end=date(2024, 5, 31),
                last_processed_origin_date="2024-05-31",
                existing_records=initial_output["newRecords"],
                model_id="naive",
            )
        )
        forced_output = run_script(
            build_payload(
                end=date(2024, 5, 31),
                last_processed_origin_date="2024-05-31",
                existing_records=initial_output["newRecords"],
                model_id="naive",
                force_calibration_refresh=True,
            )
        )

        self.assertEqual(no_force_output["maintenance"]["newOriginCount"], 0)
        self.assertEqual(no_force_output["maintenance"]["maturedRecordCount"], 0)
        self.assertEqual(no_force_output["calibrationGroups"], [])
        self.assertTrue(forced_output["calibrationGroups"])
        self.assertEqual(forced_output["maintenance"]["calibrationRefreshCount"], len(forced_output["calibrationGroups"]))
        self.assertEqual(canonicalize_groups(forced_output["calibrationGroups"]), canonicalize_groups(initial_output["calibrationGroups"]))

    def test_same_observation_replay_is_no_op_for_all_models(self) -> None:
        for model_id in (*SUPPORTED_MODELS, "arima"):
            with self.subTest(model_id=model_id):
                minimum_training = 60 if model_id == "arima" else 5
                output = run_script(
                    {**build_payload(
                        end=date(2024, 5, 31),
                        last_processed_origin_date=None,
                        existing_records=[],
                        model_id=model_id,
                    ), "minimumTrainingObservations": minimum_training}
                )

                replay = run_script(
                    {**build_payload(
                        end=date(2024, 5, 31),
                        last_processed_origin_date="2024-05-31",
                        existing_records=output["newRecords"],
                        model_id=model_id,
                    ), "minimumTrainingObservations": minimum_training}
                )

                self.assertEqual(replay["maintenance"]["newOriginCount"], 0)
                self.assertEqual(replay["maintenance"]["maturedRecordCount"], 0)
                self.assertEqual(replay["maintenance"]["calibrationRefreshCount"], 0)
