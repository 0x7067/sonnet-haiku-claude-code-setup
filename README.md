# Sonnet/Haiku Claude Code Setup

A small user-scope Claude Code setup that defaults coding work to Sonnet and
uses Haiku for narrow support tasks such as repo scouting, log triage, context
compression, and diff summaries.

## What It Installs

- `~/.claude/settings.json` model routing:
  - startup model: `sonnet`
  - available models: `sonnet`, `haiku`
  - fallback models: `sonnet`, `haiku`
  - Sonnet pin: `claude-sonnet-4-6`
  - Haiku pin: `claude-haiku-4-5-20251001`
- Claude Code agents under `~/.claude/agents`
- the `sonnet-haiku-code` skill under `~/.claude/skills`
- a prompt hook under `~/.claude/hooks`
- a marked routing block in `~/.claude/CLAUDE.md`

The installer creates timestamped backups before changing
`settings.json` or `CLAUDE.md`.

## Requirements

- Node.js 20+
- pnpm
- Claude Code installed and authenticated

Optional: Basic Memory plugin and MCP if you want memory-backed instructions.

## Install

```bash
pnpm install
pnpm run install:dry
pnpm run install
pnpm run verify
```

Windows PowerShell uses the same commands.

By default, files install to:

- macOS/Linux: `~/.claude`
- Windows: `$env:USERPROFILE\.claude`

Set `CLAUDE_CONFIG_DIR` to install somewhere else.

## Usage

Start Claude Code normally:

```bash
claude
```

The installed settings and instructions handle Sonnet/Haiku routing. Inside
Claude Code, you can also invoke:

```text
/sonnet-haiku-code
```

## Verify

```bash
pnpm run verify
```

`verify` checks the installed settings, agents, skill, hook, and global
instructions. Missing optional Basic Memory integration is reported as a
warning, not a failure.

For a live launch smoke:

```bash
pnpm run test:transparent
```

## Benchmarks

DeepSWE benchmark helpers live under `benchmarks/deepswe` and are intended for
macOS/Linux or WSL. They are not required for the normal Claude Code setup.
