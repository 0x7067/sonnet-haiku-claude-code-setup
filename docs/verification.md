# Verification

Use these commands from the bundle root:

```bash
pnpm run check
pnpm run install:dry
pnpm run install
pnpm run verify
pnpm run test:transparent
pnpm run test:progressive
```

Expected result:

- `pnpm run check` exits 0.
- `install:dry` reports planned copies and settings merge without writing.
- `install` reports a settings backup when needed and copied/unchanged files.
- `verify` reports `PASS`.
- `test:transparent` launches plain `claude -p` with no model override flags and confirms Sonnet startup, subscription auth (`apiKeySource: none`), installed agents, and the `sonnet-haiku-code` slash command.
- `test:progressive` runs easy, medium, and hard live repair tasks and grades actual subagent tool events, not text mentions.

The structural verifier intentionally does not run `claude -p`. The two `test:*` commands are live Claude Code subscription checks and should be run only when that spend is acceptable.
