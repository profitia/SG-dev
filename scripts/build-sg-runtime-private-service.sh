#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$REPO_ROOT/apps/sg-runtime"
LAB_ROOT="$REPO_ROOT/tooling/Benchmark-Forecasting"
VENV_DIR="$LAB_ROOT/.venv"
PYTHON_RUNTIME_BIN="$VENV_DIR/bin/python"

if command -v python >/dev/null 2>&1; then
  PYTHON_BOOTSTRAP_BIN="python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BOOTSTRAP_BIN="python3"
else
  echo "Python is required to provision the forecast runtime." >&2
  exit 1
fi

"$PYTHON_BOOTSTRAP_BIN" -m venv "$VENV_DIR"
"$PYTHON_RUNTIME_BIN" -m pip install --upgrade pip
"$PYTHON_RUNTIME_BIN" -m pip install -r "$LAB_ROOT/requirements.txt"

cd "$APP_DIR"
npm install
npm run build