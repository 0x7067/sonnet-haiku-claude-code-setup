# DeepSWE Harness

This directory is the DeepSWE-first benchmark harness for the Sonnet/Haiku
Claude Code setup.

DeepSWE's official runner is Pier. Pier is Harbor-compatible, but it adds
per-agent network allowlists for tasks whose environments have
`allow_internet = false`.

## One-Time Setup

```bash
uv tool install git+https://github.com/datacurve-ai/pier
```

The runner clones DeepSWE into `benchmarks/deepswe/vendor/deep-swe` on demand.
That vendor directory is intentionally ignored by git.

Verify the task corpus and local Docker runner without spending Claude usage:

```bash
npm run deepswe:oracle
```

## Claude Code With This Setup

Run one deterministic DeepSWE task locally:

```bash
npm run deepswe:smoke
```

The script:

- reads the Claude Code OAuth access token from macOS Keychain into a temporary
  file at runtime, then removes that file on exit;
- uploads the token as a container-local file read by a small Claude shim,
  avoiding host-visible `docker compose exec -e TOKEN=...` process arguments;
- injects `~/.claude/agents`, `~/.claude/skills`, `~/.claude/hooks`,
  a benchmark-safe subset of `~/.claude/settings.json`, and
  `~/.claude/CLAUDE.md` into Pier's per-trial `CLAUDE_CONFIG_DIR`;
- strips host-only UI, plugin, and memory toggles from the uploaded settings
  while preserving Sonnet/Haiku model routing and the prompt routing hook;
- keeps raw job logs under ignored `jobs/`.

## Other Agents

Pier 0.2.1 supports these local agent names:

```text
oracle, nop, claude-code, codex, cursor-cli, gemini-cli, mini-swe-agent,
swe-agent, opencode, taiga
```

For future DeepSWE agent variants, use `pier run --agent ...` or
`pier run --agent-import-path module:Class`. Keep new wrappers under
`pier_agents/` and save concise result summaries under
`benchmarks/deepswe/results/`.

## Local Resource Note

DeepSWE task configs currently request 2 CPUs, 8GB RAM, and 20GB storage per
trial. Check local Docker/disk headroom before launching larger samples.
