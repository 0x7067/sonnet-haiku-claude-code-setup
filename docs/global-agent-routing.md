# Global Agent Routing

Date: 2026-06-12

The installed `~/.claude/agents` fleet is routed only to Sonnet or Haiku.

## Sonnet Agents

- `adversarial-reviewer`
- `doc-researcher`
- `harness-config-auditor`
- `memory-curator`
- `meta-agent`
- `railway-ops`
- `refactor-surgeon`
- `sonnet-code-steward`
- `sonnet-task-architect`
- `tdd-implementer`
- `test-fixer`
- `work-verifier`

Sonnet owns planning, implementation, debugging, review, verification, research, memory judgment, infrastructure, and agent creation.

## Haiku Agents

- `haiku-codebase-scout`
- `haiku-context-compressor`
- `haiku-diff-summarizer`
- `haiku-log-triage`

Haiku owns bounded read-only support packets: scouting, compression, noisy-output triage, and diff summaries.

## Converted Agents

- `adversarial-reviewer`: `opus` -> `sonnet`
- `meta-agent`: `opus` -> `sonnet`
- `test-fixer`: `inherit` -> `sonnet`

## Current Audit Command

```bash
node -e "const fs=require('fs'); const path=require('path'); const os=require('os'); const home=process.platform==='win32' ? process.env.USERPROFILE || process.env.HOME || os.homedir() : process.env.HOME || os.homedir(); const dir=path.join(process.env.CLAUDE_CONFIG_DIR || path.join(home,'.claude'),'agents'); for (const f of fs.readdirSync(dir).filter(f=>f.endsWith('.md')).sort()) { const t=fs.readFileSync(path.join(dir,f),'utf8'); const m=t.match(/^---\n([\s\S]*?)\n---/); const model=(m&&m[1].split('\n').find(l=>l.startsWith('model:'))||'model: missing').replace(/^model:\s*/,''); console.log(f+': '+model); }"
```
