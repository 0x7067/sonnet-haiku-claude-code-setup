#!/usr/bin/env bash
set -euo pipefail

TOKEN_FILE_WAS_PROVIDED=0
if [[ -n "${CLAUDE_CODE_OAUTH_TOKEN_FILE:-}" ]]; then
  TOKEN_FILE="$CLAUDE_CODE_OAUTH_TOKEN_FILE"
  TOKEN_FILE_WAS_PROVIDED=1
else
  TOKEN_FILE="$(mktemp -t claude-code-oauth-access.XXXXXX)"
fi
KEYCHAIN_SERVICE="${CLAUDE_CODE_KEYCHAIN_SERVICE:-Claude Code-credentials}"
KEYCHAIN_ACCOUNT="${CLAUDE_CODE_KEYCHAIN_ACCOUNT:-${USER:-}}"
TASKS="${TBENCH_TASKS:-1}"
CONCURRENCY="${TBENCH_CONCURRENCY:-1}"
JOBS_DIR="${TBENCH_JOBS_DIR:-jobs/tbench-sonnet-haiku-claude}"
MODEL="${TBENCH_MODEL:-anthropic/claude-sonnet-4-6}"

cleanup() {
  if [[ "$TOKEN_FILE_WAS_PROVIDED" -eq 0 ]]; then
    rm -f "$TOKEN_FILE"
  fi
}
trap cleanup EXIT

if [[ ! -s "$TOKEN_FILE" ]]; then
  umask 077
  security find-generic-password -s "$KEYCHAIN_SERVICE" -a "$KEYCHAIN_ACCOUNT" -w \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["claudeAiOauth"]["accessToken"])' \
    > "$TOKEN_FILE"
fi

CLAUDE_FORCE_OAUTH=1 \
CLAUDE_CODE_OAUTH_TOKEN="$(cat "$TOKEN_FILE")" \
ANTHROPIC_BASE_URL= \
harbor run \
  -d terminal-bench/terminal-bench-2 \
  --agent-import-path harbor_agents.sonnet_haiku_claude_code:SonnetHaikuClaudeCode \
  -m "$MODEL" \
  --n-tasks "$TASKS" \
  --n-concurrent "$CONCURRENCY" \
  --jobs-dir "$JOBS_DIR" \
  --yes \
  "$@"
