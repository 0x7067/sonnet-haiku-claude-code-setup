import assert from "node:assert/strict";
import test from "node:test";
import {
  buildClaudeArgs,
  gradeTranscript,
  summarizeStreamEvents
} from "../scripts/progressive-claude-tests.mjs";

test("buildClaudeArgs uses print stream-json with Sonnet/Haiku guardrails", () => {
  const args = buildClaudeArgs({
    prompt: "Fix the task",
    cwd: "/tmp/example",
    budgetUsd: "0.25"
  });

  assert.deepEqual(args.slice(0, 9), [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-hook-events",
    "--dangerously-skip-permissions",
    "--model",
    "sonnet",
    "--fallback-model"
  ]);
  assert.equal(args.includes("opus"), false);
  assert.equal(args.includes("fable"), false);
  assert.equal(args.includes("--dangerously-skip-permissions"), true);
  assert.equal(args.at(-1), "Fix the task");
});

test("summarizeStreamEvents detects subagent Task usage by agent name", () => {
  const lines = [
    JSON.stringify({
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Task",
            input: {
              subagent_type: "haiku-codebase-scout",
              description: "Map files"
            }
          }
        ]
      }
    }),
    JSON.stringify({
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Task",
            input: {
              subagent_type: "sonnet-task-architect",
              description: "Plan"
            }
          }
        ]
      }
    })
  ].join("\n");

  const summary = summarizeStreamEvents(lines);

  assert.equal(summary.taskToolUses, 2);
  assert.deepEqual(summary.subagents.sort(), [
    "haiku-codebase-scout",
    "sonnet-task-architect"
  ]);
});

test("summarizeStreamEvents detects Claude Code Agent subagent usage", () => {
  const lines = JSON.stringify({
    type: "assistant",
    message: {
      content: [
        {
          type: "tool_use",
          name: "Agent",
          input: {
            subagent_type: "haiku-log-triage",
            description: "Triage failing tests"
          }
        }
      ]
    }
  });

  const summary = summarizeStreamEvents(lines);

  assert.equal(summary.agentToolUses, 1);
  assert.equal(summary.taskToolUses, 1);
  assert.deepEqual(summary.subagents, ["haiku-log-triage"]);
});

test("gradeTranscript requires actual subagent events, not text mentions", () => {
  const grade = gradeTranscript({
    stdout: "TASK_RESULT: PASS\nnpm test\nhaiku-log-triage",
    eventSummary: {
      taskToolUses: 0,
      subagents: [],
      text: ""
    },
    expectedSubagents: ["haiku-log-triage"]
  });

  assert.equal(grade.pass, false);
  assert.match(grade.findings.join("\n"), /missing expected subagent usage: haiku-log-triage/);
});

test("gradeTranscript requires task marker, tests, and expected subagents", () => {
  const grade = gradeTranscript({
    stdout: "TASK_RESULT: PASS\nnpm test\nhaiku-codebase-scout\nsonnet-task-architect",
    eventSummary: {
      taskToolUses: 2,
      subagents: ["haiku-codebase-scout", "sonnet-task-architect"]
    },
    expectedSubagents: ["haiku-codebase-scout", "sonnet-task-architect"]
  });

  assert.equal(grade.pass, true);
  assert.deepEqual(grade.findings, []);
});

test("gradeTranscript reports missing subagents and missing success marker", () => {
  const grade = gradeTranscript({
    stdout: "I changed the code.",
    eventSummary: {
      taskToolUses: 0,
      subagents: []
    },
    expectedSubagents: ["haiku-codebase-scout"]
  });

  assert.equal(grade.pass, false);
  assert.match(grade.findings.join("\n"), /TASK_RESULT: PASS/);
  assert.match(grade.findings.join("\n"), /haiku-codebase-scout/);
});
