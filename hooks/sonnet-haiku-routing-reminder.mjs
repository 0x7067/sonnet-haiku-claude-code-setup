#!/usr/bin/env node

const chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}

const raw = Buffer.concat(chunks).toString("utf8");
const lower = raw.toLowerCase();
const codingSignals = [
  "repo",
  "repository",
  "code",
  "file",
  "test",
  "fix",
  "bug",
  "build",
  "ci",
  "diff",
  "commit",
  "review",
  "refactor",
  "implement",
  "edit"
];

if (raw && !codingSignals.some((signal) => lower.includes(signal))) {
  process.exit(0);
}

const additionalContext = [
  "<SONNET_HAIKU_SUBAGENT_ROUTING>",
  "For coding or repository work, treat subagent descriptions as routing policy.",
  "Before repo orientation, file discovery, or unclear ownership: call Agent with subagent_type=haiku-codebase-scout instead of doing that scouting inline.",
  "Before difficult, ambiguous, risky, or multi-phase edits: call Agent with subagent_type=sonnet-task-architect.",
  "After failing or noisy commands: call Agent with subagent_type=haiku-log-triage before fixing.",
  "When raw context is large: call Agent with subagent_type=haiku-context-compressor.",
  "After edits, before review/commit/handoff: call Agent with subagent_type=haiku-diff-summarizer.",
  "Do not inline these support tasks unless the user explicitly says no subagents or the Agent tool is unavailable.",
  "</SONNET_HAIKU_SUBAGENT_ROUTING>"
].join("\\n");

process.stdout.write(`${JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext
  }
})}\n`);
