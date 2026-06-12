# Sonnet/Haiku Claude Code Setup

This bundle makes Claude Code run as a Sonnet-first daily coding environment with Haiku used for cheap, fast side work: codebase scouting, log triage, diff summaries, and quick print-mode tasks.

It is designed for Pedro's current Claude Code install:

- Claude Code `2.1.175`
- Sonnet daily driver: `claude-sonnet-4-6`
- Haiku fast path: `claude-haiku-4-5-20251001`
- Subagent model behavior: `CLAUDE_CODE_SUBAGENT_MODEL=inherit`

## What It Installs

- User-scope model controls in `~/.claude/settings.json`:
  - `model=sonnet`
  - `advisorModel=sonnet`
  - `availableModels=["sonnet","haiku"]`
  - `fallbackModel=["sonnet","haiku"]`
  - `ANTHROPIC_MODEL=sonnet`
  - `ANTHROPIC_DEFAULT_SONNET_MODEL=claude-sonnet-4-6`
  - `ANTHROPIC_DEFAULT_HAIKU_MODEL=claude-haiku-4-5-20251001`
  - `ANTHROPIC_DEFAULT_OPUS_MODEL=claude-sonnet-4-6`
  - `ANTHROPIC_DEFAULT_FABLE_MODEL=claude-sonnet-4-6`
  - `CLAUDE_CODE_SUBAGENT_MODEL=inherit`
  - `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=80`
- User-level agents:
  - `haiku-codebase-scout`
  - `haiku-log-triage`
  - `haiku-diff-summarizer`
  - `haiku-context-compressor`
  - `sonnet-code-steward`
  - `sonnet-task-architect`
- User-level skill:
  - `sonnet-haiku-code`
- User prompt hook:
  - `hooks/sonnet-haiku-routing-reminder.mjs`
  - Injects a short routing reminder for coding prompts so matching subagent descriptions steer the main agent before it starts scouting, fixing, or reviewing inline.
- Launch helpers:
  - `bin/cc-sonnet`
  - `bin/cc-sonnet-1m`
  - `bin/cc-haiku`
  - `bin/cc-plan`

The installer creates timestamped backups before touching `~/.claude/settings.json` or appending global instructions to `~/.claude/CLAUDE.md`.

## Install

Preview first:

```bash
pnpm run install:dry
```

Apply:

```bash
pnpm run install
```

Verify the installed files and settings without launching Claude Code:

```bash
pnpm run verify
```

Verify the plain launch path with a small live Claude Code subscription smoke:

```bash
pnpm run test:transparent
```

## Daily Usage

Start Claude Code normally:

```bash
claude
```

The global `~/.claude/settings.json`, `~/.claude/CLAUDE.md`, user agents, `sonnet-haiku-code` skill, and prompt-time routing reminder are loaded automatically. The normal launch path starts on Sonnet, keeps fallback inside Sonnet/Haiku, and leaves each subagent's frontmatter model in control.

The helper commands are optional shortcuts, not required for daily use. Start an explicit Sonnet session:

```bash
~/.claude/bin/cc-sonnet
```

Start a large-context Sonnet session when the task justifies usage credits:

```bash
~/.claude/bin/cc-sonnet-1m
```

Start in plan mode on Sonnet with medium effort:

```bash
~/.claude/bin/cc-plan
```

Run cheap one-shot Haiku tasks:

```bash
~/.claude/bin/cc-haiku -p "summarize this git diff"
```

Inside Claude Code, invoke:

```text
/sonnet-haiku-code
```

That skill tells Claude to keep Sonnet on the main implementation path while pushing read-only scouting, log triage, and diff summaries to Haiku agents.

## Benchmarks

DeepSWE is the primary benchmark harness in this repo. It uses Pier and keeps
the DeepSWE corpus under ignored `benchmarks/deepswe/vendor/`.

Run an oracle Docker smoke without spending Claude usage:

```bash
npm run deepswe:oracle
```

Run one bounded Claude Code subscription smoke through the Sonnet/Haiku wrapper:

```bash
npm run deepswe:smoke
```

The wrapper injects the installed global `~/.claude` agents, skills, prompt
routing hook, model routing settings, and instructions into Pier's per-trial
`CLAUDE_CONFIG_DIR`, so the benchmark exercises the same Sonnet/Haiku routing
used by normal `claude` launches. Host-only UI, plugin, and memory toggles are
stripped for benchmark containers. Terminal-Bench notes remain in
`docs/terminal-bench.md` as secondary history.

## Scope

This is a personal global Claude Code setup. It installs under `~/.claude` and does not require admin permissions. Enterprise managed settings can enforce policy above user/project scope, but that is deliberately out of scope for this bundle.

## Design Notes

See:

- `docs/current-audit.md`
- `docs/design.md`
- `docs/global-agent-routing.md`
- `docs/research/2026-06-12-claude-code-sonnet-haiku.md`
- `docs/verification.md`
