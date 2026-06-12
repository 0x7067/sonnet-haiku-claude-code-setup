#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TASKS="${DEEPSWE_TASKS:-1}"
CONCURRENCY="${DEEPSWE_CONCURRENCY:-1}"
SAMPLE_SEED="${DEEPSWE_SAMPLE_SEED:-0}"
JOBS_DIR="${DEEPSWE_ORACLE_JOBS_DIR:-jobs/deepswe-oracle-smoke}"

"$ROOT/scripts/ensure-deepswe.sh"

pier run \
  -p "$ROOT/benchmarks/deepswe/vendor/deep-swe/tasks" \
  -a oracle \
  --n-tasks "$TASKS" \
  --sample-seed "$SAMPLE_SEED" \
  --n-concurrent "$CONCURRENCY" \
  --jobs-dir "$JOBS_DIR" \
  --yes \
  "$@"
