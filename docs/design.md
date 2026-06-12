# Design

## Goal

Make Claude Code efficient for day-to-day coding by keeping Sonnet as the default implementation brain and Haiku as the fast path for bounded, low-risk work. The pair should be able to handle difficult tasks through decomposition, verification, and context management without falling back to Opus or Fable by default.

## Model Routing

- Main interactive coding sessions use Sonnet via `model: "sonnet"` and `--model sonnet`.
- `ANTHROPIC_MODEL=sonnet` makes Sonnet the startup model even when a saved user model would otherwise drift.
- `advisorModel` is `sonnet`.
- User settings restrict normal selection to `availableModels: ["sonnet", "haiku"]`.
- `fallbackModel` is `["sonnet", "haiku"]`, so availability fallback never leaves the duo.
- The Sonnet alias is pinned to `claude-sonnet-4-6`.
- The Haiku alias is pinned to `claude-haiku-4-5-20251001`.
- The Opus and Fable aliases are deliberately mapped to `claude-sonnet-4-6` as an extra user-scope guard against accidental expensive-family routing.
- `CLAUDE_CODE_SUBAGENT_MODEL=inherit` preserves each subagent's own `model:` frontmatter instead of forcing every subagent onto one model.
- `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=80` avoids premature compaction loops during subagent-heavy work while still leaving room for long sessions.
- 1M Sonnet is not configured by this package; Claude Code's docs say Sonnet 1M can require usage credits on subscription plans.

## Agents

Add cheap Haiku agents for work that benefits from isolated context but does not need Sonnet:

- `haiku-codebase-scout`: read-only code search and map building.
- `haiku-log-triage`: read-only log/test failure clustering.
- `haiku-diff-summarizer`: read-only diff summaries and risk lists.
- `haiku-context-compressor`: read-only context packing for large repos, plans, logs, and histories.

Add Sonnet coordinators:

- `sonnet-code-steward`: implementation owner for multi-file code work that should remain on Sonnet.
- `sonnet-task-architect`: hard-task decomposition, verification matrix, and handoff plans before implementation.

Agent names and descriptions are written as routing triggers, not passive summaries. The bundle also installs a `UserPromptSubmit` hook that injects a short reminder for coding prompts:

- unfamiliar repo orientation -> `haiku-codebase-scout`
- hard/ambiguous/risky work -> `sonnet-task-architect`
- failing/noisy command output -> `haiku-log-triage`
- large raw context -> `haiku-context-compressor`
- after edits / before review or commit -> `haiku-diff-summarizer`

The hook exists because live testing showed description-only steering was not enough for simple `claude -p` runs; the main model would still inline orientation and small fixes.

Convert existing global agents:

- `adversarial-reviewer`: Opus to Sonnet. Its rigor should come from concrete failure hypotheses and read-only proof, not raw model escalation.
- `meta-agent`: Opus to Sonnet. Generated agent templates must default to Sonnet or Haiku only.
- `test-fixer`: inherit to Sonnet, because autonomous test repair is implementation work and should not accidentally run on Haiku.

These names avoid collisions with existing user agents.

## Skill

Add `sonnet-haiku-code` as a lightweight routing policy. It is intentionally a skill, not global `CLAUDE.md` bloat, because the details only need to load when this workflow matters.

## Installer

The installer is reversible and additive:

- Back up `~/.claude/settings.json`.
- Back up `~/.claude/CLAUDE.md` before appending the routing block.
- Merge model controls and env model pins into the existing settings object.
- Merge the prompt-time routing reminder hook into `hooks.UserPromptSubmit` without removing existing hooks.
- Fill only missing low-risk defaults for speed and readability.
- Copy agents, skill files, hook files, and launch helpers.
- Skip existing conflicting files unless `--force` is passed.
- Never delete files.

## Verification

Verification avoids Claude API token spend. It checks:

- JavaScript syntax for installer and verifier.
- Template JSON parse.
- Installed settings JSON parse.
- Expected `model`, `availableModels`, and `fallbackModel`.
- Expected env pins.
- Expected copied agents and skill.
- Expected prompt-time routing reminder hook.
- Expected launch helpers.
- Local Claude version, plugin list, and MCP list.
