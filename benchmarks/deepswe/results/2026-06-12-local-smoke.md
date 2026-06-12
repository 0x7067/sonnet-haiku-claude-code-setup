# 2026-06-12 Local DeepSWE Smoke

Environment:

- Runner: Pier `0.2.1`
- DeepSWE corpus: `benchmarks/deepswe/vendor/deep-swe`
- DeepSWE commit observed locally: `578129c4334f6656a92a1c629af63a530596f169`
- Task sample seed: `0`
- Task sampled: `meriyah-explicit-resource-declarations`

## Oracle Smoke

Command:

```bash
npm run deepswe:oracle
```

Result:

- Job: `jobs/deepswe-oracle-smoke/2026-06-12__08-54-10`
- Trials: `1`
- Exceptions: `0`
- Mean score: `1.000`
- Runtime: `2m 52s`

## Sonnet/Haiku Claude Code Smoke

Command:

```bash
npm run deepswe:smoke
```

Result:

- Job: `jobs/deepswe-sonnet-haiku/2026-06-12__08-57-20`
- Trials: `1`
- Exceptions: `1`
- Mean score: `0.000`
- Runtime: `15m 19s`
- Cost reported by Pier/Claude logs: `$1.0244462999999997`
- Stop reason: Claude Code reached the intentional smoke budget cap
  (`--ak max_budget_usd=1.00`).

Useful evidence:

- Claude Code launched inside the DeepSWE container with model
  `claude-sonnet-4-6`.
- The injected setup exposed the expected custom agents, including
  `haiku-codebase-scout`, `haiku-log-triage`, `haiku-diff-summarizer`,
  `haiku-context-compressor`, `sonnet-task-architect`, and
  `sonnet-code-steward`.
- The main agent delegated initial repository scouting to
  `haiku-codebase-scout`.
- The run progressed past scouting into source edits before the budget cap
  stopped it.

## Findings Addressed

- Host-only global settings are unsafe in benchmark containers. The wrapper now
  uploads a benchmark-safe settings subset that preserves Sonnet/Haiku routing
  and the prompt routing hook while stripping host UI, plugin, and memory
  toggles.
- Pier's stock Claude Code path passes OAuth credentials through process
  environment arguments visible to local process listings. The wrapper now
  uploads the OAuth token as a temporary container-local file and installs a
  tiny in-container Claude shim that reads it at process start.

## Not Overfit

No DeepSWE task-specific prompt, patch, task selection shortcut, verifier
shortcut, or solution corpus copy was added. The changes are harness-level:
configuration injection, credential handling, and reproducible local commands.
