import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WRAPPER = ROOT / "scripts" / "run_with_resource_telemetry.py"


class ResourceTelemetryWrapperTest(unittest.TestCase):
    def test_emits_machine_readable_resource_summary(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            script = Path(temp_dir) / "sample.py"
            helper = Path(temp_dir) / "helper.py"
            helper.write_text("VALUE = 'ok'\n", encoding="utf-8")
            script.write_text("from helper import VALUE\nprint(VALUE)\n", encoding="utf-8")
            completed = subprocess.run(
                [sys.executable, str(WRAPPER), "--", str(script)],
                check=True,
                capture_output=True,
                text=True,
            )

        self.assertEqual(completed.stdout.strip(), "ok")
        marker = "SG_FORECAST_RESOURCE_TELEMETRY="
        line = next(item for item in completed.stderr.splitlines() if item.startswith(marker))
        payload = json.loads(line[len(marker):])
        self.assertEqual(payload["script"], "sample.py")
        self.assertGreaterEqual(payload["wallMs"], 0)
        self.assertGreater(payload["maxRssBytes"], 0)


if __name__ == "__main__":
    unittest.main()
