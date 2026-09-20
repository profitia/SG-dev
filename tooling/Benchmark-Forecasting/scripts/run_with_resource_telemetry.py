#!/usr/bin/env python3
"""Run a Forecast Python script and emit exact process resource usage to stderr."""

from __future__ import annotations

import json
import os
import resource
import runpy
import sys
import time


MARKER = "SG_FORECAST_RESOURCE_TELEMETRY="


def _max_rss_bytes(value: int) -> int:
    # Linux reports KiB, macOS reports bytes.
    return value if sys.platform == "darwin" else value * 1024


def main() -> int:
    args = sys.argv[1:]
    if not args or args[0] != "--" or len(args) < 2:
        raise SystemExit("usage: run_with_resource_telemetry.py -- SCRIPT [ARGS...]")

    script = os.path.abspath(args[1])
    script_args = args[2:]
    started = time.perf_counter()
    usage_started = resource.getrusage(resource.RUSAGE_SELF)
    exit_code = 0

    try:
        sys.argv = [script, *script_args]
        sys.path[0] = os.path.dirname(script)
        runpy.run_path(script, run_name="__main__")
    except SystemExit as exc:
        if isinstance(exc.code, int):
            exit_code = exc.code
        elif exc.code:
            print(exc.code, file=sys.stderr)
            exit_code = 1
    finally:
        usage = resource.getrusage(resource.RUSAGE_SELF)
        payload = {
            "script": os.path.basename(script),
            "wallMs": (time.perf_counter() - started) * 1000,
            "userCpuMs": max(0.0, usage.ru_utime - usage_started.ru_utime) * 1000,
            "systemCpuMs": max(0.0, usage.ru_stime - usage_started.ru_stime) * 1000,
            "maxRssBytes": _max_rss_bytes(int(usage.ru_maxrss)),
        }
        print(f"{MARKER}{json.dumps(payload, separators=(',', ':'))}", file=sys.stderr, flush=True)

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
