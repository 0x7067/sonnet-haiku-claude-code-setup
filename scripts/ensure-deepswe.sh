#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEEPSWE_DIR="${DEEPSWE_DIR:-$ROOT/benchmarks/deepswe/vendor/deep-swe}"

if [[ -d "$DEEPSWE_DIR/.git" ]]; then
  exit 0
fi

mkdir -p "$(dirname "$DEEPSWE_DIR")"
git clone --depth=1 https://github.com/datacurve-ai/deep-swe.git "$DEEPSWE_DIR"
