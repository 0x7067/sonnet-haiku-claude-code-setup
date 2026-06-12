# Current Audit

Date: 2026-06-12

## Local State

- Workspace: this repository checkout
- Workspace contents before this bundle: empty
- Git status before this bundle: not a git repository
- Claude Code binary: `claude`
- Claude Code version: `2.1.175`

## Existing User Settings Signals

Observed in `~/.claude/settings.json`:

- RTK pre-tool hook for Bash: `rtk hook claude`
- Sonnet/Haiku prompt routing hook after install: `node "$HOME/.claude/hooks/sonnet-haiku-routing-reminder.mjs"`
- `effortLevel`: `low`
- `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`: `25`
- `MAX_MCP_OUTPUT_TOKENS`: `10000`
- `BASH_MAX_OUTPUT_LENGTH`: `15000`
- `CLAUDE_CODE_NO_FLICKER`: `1`
- `autoMemoryEnabled`: `true`
- `autoDreamEnabled`: `true`

## Shareable Plugin Baseline

The installer enables only the shareable default plugins:

- `basic-memory@basicmachines-co`
- `code-simplifier@claude-plugins-official`
- `codex@openai-codex`
- `commit-commands@claude-plugins-official`
- `deslop@vibe-tooling`

## Existing MCP Health

`claude mcp list` reported:

- Connected: Slack, Google Calendar, Google Drive, Gmail, agent-bridge, basic-memory
- Needs authentication: Railway

Railway auth is not changed by this setup.

## Existing Agent Gap

Existing `~/.claude/agents` are mostly Sonnet or Opus:

- Sonnet: work verifier, memory curator, TDD implementer, config auditor, Railway ops, doc researcher, refactor surgeon
- Opus: adversarial reviewer, meta-agent
- Inherit: test fixer

The prior setup pinned Sonnet and Haiku aliases, but it did not set `model`, `availableModels`, or `fallbackModel`; the user could still drift into Opus/Fable through Default, command-line selection, project settings, or fallback.

Two existing agents were still pinned to Opus: `adversarial-reviewer` and `meta-agent`.

One implementation agent used `model: inherit`: `test-fixer`.

The original missing pieces were strict Sonnet/Haiku model controls, all-agent routing cleanup, and cheap Haiku specialists for context compression and bounded side work. Live testing later showed one more gap: subagent descriptions alone did not consistently steer simple print-mode runs, so the setup now includes a prompt-time routing reminder hook.
