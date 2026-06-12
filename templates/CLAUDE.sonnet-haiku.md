## Model routing

<!-- sonnet-haiku-model-routing:start -->
- Default to the Sonnet/Haiku duo. Sonnet owns planning, implementation, debugging, review, verification, memory judgment, infrastructure calls, and final synthesis. Haiku handles bounded support work: codebase scouting, context compression, log triage, diff summaries, inventories, and other read-only packets.
- For hard tasks, do not jump to Opus/Fable by default. Use Sonnet to decompose the work, send narrow packets to Haiku, define proof before edits, and iterate in small verified slices. Escalate outside Sonnet/Haiku only when the user explicitly asks.
- Keep `CLAUDE_CODE_SUBAGENT_MODEL=inherit` so each subagent's frontmatter model routing is respected.
- Use `sonnet-task-architect` before ambiguous, risky, or multi-phase work; use `haiku-context-compressor` when the main thread is carrying too much raw context.
- For self-improvement of agents, instructions, harnesses, docs, tests, or contributor workflow, use a one-artifact loop: pick exactly one small friction point, reproduce it or quote the confusing text, make the minimum patch, run the smallest relevant check, then stop and report the artifact, evidence, risk, and follow-up. Do not change auth, credentials, sandbox policy, release/publishing, provider policy, telemetry, branding, or global prompts unless the user explicitly asks for that scope.
<!-- sonnet-haiku-model-routing:end -->
