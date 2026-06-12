# Claude Code Sonnet/Haiku Research

Date: 2026-06-12

## Current Model Pair

Anthropic's current model comparison lists Claude Sonnet 4.6 as the best speed/intelligence blend and Claude Haiku 4.5 as the fastest near-frontier model. The relevant first-party IDs are:

- Sonnet: `claude-sonnet-4-6`
- Haiku: `claude-haiku-4-5-20251001`

Source: <https://platform.claude.com/docs/en/about-claude/models/overview>

## Claude Code Control Surface

Claude Code uses these model controls:

- `model`: startup model.
- `availableModels`: selectable model allowlist.
- `ANTHROPIC_MODEL`: startup model override.
- `ANTHROPIC_DEFAULT_SONNET_MODEL` / `ANTHROPIC_DEFAULT_HAIKU_MODEL`: alias pins for `sonnet`, `haiku`, and Default behavior.
- `ANTHROPIC_DEFAULT_OPUS_MODEL` / `ANTHROPIC_DEFAULT_FABLE_MODEL`: alias pins for Opus/Fable families; this setup maps them to Sonnet as a guardrail.
- `fallbackModel`: ordered fallback chain; entries outside `availableModels` are dropped.
- `CLAUDE_CODE_SUBAGENT_MODEL=inherit`: keeps each subagent's own `model:` frontmatter instead of forcing every subagent to one model.

Source: <https://code.claude.com/docs/en/model-config>

## Enforcement Boundary

User settings at `~/.claude/settings.json` are the right scope for a personal global Claude Code setup. Enterprise managed settings can enforce policy above user/project scope, but that is out of scope here and is not required for the daily-driver setup.

Sources:

- <https://code.claude.com/docs/en/settings>
- <https://code.claude.com/docs/en/admin-setup>

## Opinionated Decision

Default daily-driver routing should be:

- Main sessions: `sonnet` pinned to `claude-sonnet-4-6`.
- Fast bounded support: `haiku` pinned to `claude-haiku-4-5-20251001`.
- Startup override: `ANTHROPIC_MODEL=sonnet`.
- Advisor: `advisorModel=sonnet`.
- Opus/Fable aliases: map to `claude-sonnet-4-6`.
- Fallback chain: `sonnet`, then `haiku`, never Opus or Fable.
- Subagents: Sonnet for implementation, review, verification, research, memory, infrastructure, and agent creation; Haiku for read-only scouting, log triage, diff summaries, and context compression.

Sonnet 1M context is useful for oversized codebase sessions, but Claude Code's own docs say Sonnet 1M requires usage credits on subscription plans. This setup keeps it opt-in through `cc-sonnet-1m` instead of making it the daily default.
