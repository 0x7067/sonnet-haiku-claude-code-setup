#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEEPSWE_DIR="${DEEPSWE_DIR:-$ROOT/benchmarks/deepswe/vendor/deep-swe}"
TASK_PATH="${DEEPSWE_TASK_PATH:-$DEEPSWE_DIR/tasks}"
TOKEN_FILE_WAS_PROVIDED=0
if [[ -n "${CLAUDE_CODE_OAUTH_TOKEN_FILE:-}" ]]; then
  TOKEN_FILE="$CLAUDE_CODE_OAUTH_TOKEN_FILE"
  TOKEN_FILE_WAS_PROVIDED=1
else
  TOKEN_FILE="$(mktemp -t claude-code-oauth-access.XXXXXX)"
fi
KEYCHAIN_SERVICE="${CLAUDE_CODE_KEYCHAIN_SERVICE:-Claude Code-credentials}"
KEYCHAIN_ACCOUNT="${CLAUDE_CODE_KEYCHAIN_ACCOUNT:-${USER:-}}"
TASKS="${DEEPSWE_TASKS:-1}"
CONCURRENCY="${DEEPSWE_CONCURRENCY:-1}"
SAMPLE_SEED="${DEEPSWE_SAMPLE_SEED:-0}"
JOBS_DIR="${DEEPSWE_JOBS_DIR:-jobs/deepswe-sonnet-haiku}"
MODEL="${DEEPSWE_MODEL:-anthropic/claude-sonnet-4-6}"

cleanup() {
  if [[ "$TOKEN_FILE_WAS_PROVIDED" -eq 0 ]]; then
    rm -f "$TOKEN_FILE"
  fi
}
trap cleanup EXIT

"$ROOT/scripts/ensure-deepswe.sh"

if [[ ! -s "$TOKEN_FILE" ]]; then
  umask 077
  security find-generic-password -s "$KEYCHAIN_SERVICE" -a "$KEYCHAIN_ACCOUNT" -w \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["claudeAiOauth"]["accessToken"])' \
    > "$TOKEN_FILE"
fi

CLAUDE_CODE_OAUTH_TOKEN_FILE="$TOKEN_FILE" \
ANTHROPIC_BASE_URL= \
pier run \
  -p "$TASK_PATH" \
  --agent-import-path pier_agents.sonnet_haiku_claude_code:SonnetHaikuClaudeCode \
  -m "$MODEL" \
  --n-tasks "$TASKS" \
  --sample-seed "$SAMPLE_SEED" \
  --n-concurrent "$CONCURRENCY" \
  --jobs-dir "$JOBS_DIR" \
  --yes \
  "$@"
