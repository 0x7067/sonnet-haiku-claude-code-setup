# Terminal-Bench Notes

Date: 2026-06-12

## Harness

Harbor `0.13.2` was installed with `uv tool install harbor`.

The oracle smoke passed:

```bash
harbor run -d terminal-bench/terminal-bench-2 -a oracle --n-tasks 1 --n-concurrent 1 --jobs-dir jobs/tbench-oracle-smoke --yes
```

Result: `1/1`, mean `1.000`.

## Claude Code Agent

Harbor's built-in `claude-code` agent does not automatically load the host
`~/.claude` agents, hooks, skills, or settings because it sets
`CLAUDE_CONFIG_DIR=/logs/agent/sessions` inside each trial container.

This repo provides `harbor_agents.sonnet_haiku_claude_code:SonnetHaikuClaudeCode`
to copy the host Sonnet/Haiku setup into that per-trial config directory.

Run a smoke sample with:

```bash
npm run tbench:smoke
```

The runner reads the Claude Code OAuth access token from macOS Keychain at
runtime and removes its temporary token file on exit. It does not write tokens
to the repo.

## Sample Result

Command:

```bash
TBENCH_TASKS=1 TBENCH_CONCURRENCY=1 TBENCH_JOBS_DIR=jobs/tbench-sonnet-haiku-oauth-sample scripts/run-terminal-bench-sonnet-haiku.sh --agent-setup-timeout-multiplier 0.2 --ak max_budget_usd=5.00
```

Task: `terminal-bench/make-mips-interpreter`

Result: `0/1`, mean `0.000`, no exceptions, cost `$1.7276686499999996`.

Evidence that the setup loaded:

- `haiku-codebase-scout` appeared repeatedly in the Claude trajectory.
- The agent completed the trial and wrote `vm.js`.

Failure mode:

- The agent produced valid BMP frames as `/app/frame_0000.bmp` and later files.
- The verifier required `/tmp/frame.bmp` within 30 seconds.

General lesson folded into the global prompt:

- Do not declare success until the exact artifact contract is satisfied:
  requested path, filename, format, timing/window, and verifier-visible location.
