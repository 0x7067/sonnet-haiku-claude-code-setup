#!/usr/bin/env node
import { createWriteStream } from "node:fs";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function buildClaudeArgs({ prompt, budgetUsd = "2.00" }) {
  return [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-hook-events",
    "--dangerously-skip-permissions",
    "--model",
    "sonnet",
    "--fallback-model",
    "sonnet,haiku",
    "--effort",
    "medium",
    "--permission-mode",
    "acceptEdits",
    "--allowedTools",
    "Read,Edit,Write,Bash,Grep,Glob,Task",
    "--max-budget-usd",
    budgetUsd,
    prompt
  ];
}

export function summarizeStreamEvents(streamText) {
  const summary = {
    events: 0,
    assistantMessages: 0,
    toolUses: 0,
    agentToolUses: 0,
    taskToolUses: 0,
    subagents: [],
    text: ""
  };
  const subagents = new Set();
  for (const line of streamText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    let event;
    try {
      event = JSON.parse(trimmed);
    } catch {
      summary.text += `${trimmed}\n`;
      continue;
    }
    summary.events += 1;
    const content = event.message?.content || event.content || [];
    if (event.type === "assistant") {
      summary.assistantMessages += 1;
    }
    for (const item of Array.isArray(content) ? content : [content]) {
      if (item?.type === "text" && item.text) {
        summary.text += item.text;
      }
      if (item?.type === "tool_use") {
        summary.toolUses += 1;
        if (item.name === "Task" || item.name === "Agent") {
          if (item.name === "Agent") {
            summary.agentToolUses += 1;
          }
          summary.taskToolUses += 1;
          const agent = item.input?.subagent_type || item.input?.agent || item.input?.name;
          if (agent) {
            subagents.add(agent);
          }
        }
      }
    }
  }
  summary.subagents = [...subagents].sort();
  return summary;
}

export function gradeTranscript({ stdout, eventSummary, expectedSubagents }) {
  const findings = [];
  const combined = `${stdout}\n${eventSummary.text || ""}`;
  if (!combined.includes("TASK_RESULT: PASS")) {
    findings.push("missing final TASK_RESULT: PASS marker");
  }
  if (!/(npm test|node --test|pnpm test)/.test(combined)) {
    findings.push("missing explicit test command evidence in transcript");
  }
  for (const agent of expectedSubagents) {
    if (!eventSummary.subagents.includes(agent)) {
      findings.push(`missing expected subagent usage: ${agent}`);
    }
  }
  if (eventSummary.taskToolUses < expectedSubagents.length) {
    findings.push(`expected at least ${expectedSubagents.length} Task tool uses, saw ${eventSummary.taskToolUses}`);
  }
  return {
    pass: findings.length === 0,
    findings
  };
}

const tasks = [
  {
    id: "easy",
    budgetUsd: "2.00",
    expectedSubagents: ["haiku-codebase-scout", "haiku-log-triage"],
    files: {
      "package.json": JSON.stringify({
        type: "module",
        scripts: { test: "node --test" }
      }, null, 2),
      "src/normalizeTitle.mjs": `export function normalizeTitle(value) {
  return value.toLowerCase().replaceAll(" ", "-");
}
`,
      "test/normalizeTitle.test.mjs": `import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTitle } from "../src/normalizeTitle.mjs";

test("normalizes titles into stable slugs", () => {
  assert.equal(normalizeTitle("  Hello,   Sonnet + Haiku!  "), "hello-sonnet-haiku");
  assert.equal(normalizeTitle("Already---Slugged"), "already-slugged");
});

test("rejects non-string titles", () => {
  assert.throws(() => normalizeTitle(null), /title must be a string/i);
});
`
    },
    prompt: `Use the /sonnet-haiku-code workflow. First dispatch haiku-codebase-scout to orient on the files. Run the tests. After the first failing test run, you MUST dispatch Agent with subagent_type=haiku-log-triage on the exact failing output before editing. Fix the implementation only after haiku-log-triage returns, rerun tests, and end with exactly:
TASK_RESULT: PASS
Include the exact final test command and pass output.`
  },
  {
    id: "medium",
    budgetUsd: "3.00",
    expectedSubagents: ["sonnet-task-architect", "haiku-codebase-scout", "haiku-log-triage"],
    files: {
      "package.json": JSON.stringify({
        type: "module",
        scripts: { test: "node --test" }
      }, null, 2),
      "src/mergeIntervals.mjs": `export function mergeIntervals(intervals) {
  if (!Array.isArray(intervals)) return [];
  const merged = [];
  for (const interval of intervals) {
    if (merged.length === 0) {
      merged.push(interval);
      continue;
    }
    const last = merged[merged.length - 1];
    if (interval.start <= last.end) {
      last.end = interval.end;
    } else {
      merged.push(interval);
    }
  }
  return merged;
}
`,
      "test/mergeIntervals.test.mjs": `import assert from "node:assert/strict";
import test from "node:test";
import { mergeIntervals } from "../src/mergeIntervals.mjs";

test("sorts and merges overlapping and adjacent intervals without mutating input", () => {
  const input = [
    { start: 10, end: 12 },
    { start: 1, end: 3 },
    { start: 3, end: 5 },
    { start: 8, end: 9 },
    { start: 11, end: 14 }
  ];
  const original = structuredClone(input);
  assert.deepEqual(mergeIntervals(input), [
    { start: 1, end: 5 },
    { start: 8, end: 9 },
    { start: 10, end: 14 }
  ]);
  assert.deepEqual(input, original);
});

test("rejects malformed intervals", () => {
  assert.throws(() => mergeIntervals([{ start: 5, end: 4 }]), /invalid interval/i);
  assert.throws(() => mergeIntervals([{ start: "1", end: 4 }]), /invalid interval/i);
});
`
    },
    prompt: `Use the /sonnet-haiku-code workflow. Dispatch sonnet-task-architect to make a short plan, then haiku-codebase-scout to map the files. Run tests. After the first failing test run, you MUST dispatch Agent with subagent_type=haiku-log-triage on the exact failing output before editing. Fix root cause only after haiku-log-triage returns, rerun tests, and end with exactly:
TASK_RESULT: PASS
Include exact final test command and pass output.`
  },
  {
    id: "hard",
    budgetUsd: "5.00",
    expectedSubagents: [
      "sonnet-task-architect",
      "haiku-codebase-scout",
      "haiku-context-compressor",
      "haiku-log-triage",
      "haiku-diff-summarizer"
    ],
    files: {
      "package.json": JSON.stringify({
        type: "module",
        scripts: { test: "node --test" }
      }, null, 2),
      "src/taskScheduler.mjs": `export function scheduleTasks(tasks) {
  return tasks.map((task) => task.id);
}
`,
      "test/taskScheduler.test.mjs": `import assert from "node:assert/strict";
import test from "node:test";
import { scheduleTasks } from "../src/taskScheduler.mjs";

test("returns deterministic execution levels for dependency graph", () => {
  const tasks = [
    { id: "deploy", deps: ["test", "migrate"] },
    { id: "build", deps: ["lint"] },
    { id: "lint", deps: [] },
    { id: "test", deps: ["build"] },
    { id: "migrate", deps: ["build"] },
    { id: "notify", deps: ["deploy"] }
  ];

  assert.deepEqual(scheduleTasks(tasks), [
    ["lint"],
    ["build"],
    ["migrate", "test"],
    ["deploy"],
    ["notify"]
  ]);
});

test("rejects duplicate ids, unknown deps, and cycles with useful errors", () => {
  assert.throws(() => scheduleTasks([
    { id: "a", deps: [] },
    { id: "a", deps: [] }
  ]), /duplicate task id: a/i);

  assert.throws(() => scheduleTasks([
    { id: "a", deps: ["missing"] }
  ]), /unknown dependency missing for task a/i);

  assert.throws(() => scheduleTasks([
    { id: "a", deps: ["b"] },
    { id: "b", deps: ["c"] },
    { id: "c", deps: ["a"] }
  ]), /cycle/i);
});

test("does not mutate the input task list", () => {
  const input = [
    { id: "b", deps: ["a"] },
    { id: "a", deps: [] }
  ];
  const original = structuredClone(input);
  scheduleTasks(input);
  assert.deepEqual(input, original);
});
`
    },
    prompt: `Use the /sonnet-haiku-code workflow. This is the hardest test: dispatch sonnet-task-architect for decomposition, haiku-codebase-scout for orientation, and haiku-context-compressor for a compact evidence map. Run tests. After the first failing test run, you MUST dispatch Agent with subagent_type=haiku-log-triage on the exact failing output before editing. After the fix and passing tests, you MUST dispatch haiku-diff-summarizer before the final answer. Address any findings from the diff summary, and end with exactly:
TASK_RESULT: PASS
Include exact final test command and pass output.`
  }
];

async function writeFixture(task, workspace) {
  for (const [relative, content] of Object.entries(task.files)) {
    const filePath = path.join(workspace, relative);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");
  }
}

function runStreaming(command, args, options) {
  return new Promise((resolve) => {
    const stdoutStream = createWriteStream(options.stdoutPath);
    const stderrStream = createWriteStream(options.stderrPath);
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000).unref();
    }, options.timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
      stdoutStream.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
      stderrStream.write(chunk);
    });
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      stdoutStream.end();
      stderrStream.end();
      resolve({ status, signal, stdout, stderr, timedOut });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      stdoutStream.end();
      stderrStream.end();
      resolve({ status: 1, signal: null, stdout, stderr: `${stderr}\n${error.stack || error.message}`, timedOut });
    });
  });
}

async function runTask(task, reportDir) {
  const workspace = await mkdtemp(path.join(os.tmpdir(), `claude-${task.id}-`));
  await writeFixture(task, workspace);
  const prompt = `${task.prompt}

Workspace: ${workspace}
  Do not edit files outside this workspace.`;
  const args = buildClaudeArgs({ prompt, cwd: workspace, budgetUsd: task.budgetUsd });
  const stdoutPath = path.join(reportDir, `${task.id}.stream.jsonl`);
  const stderrPath = path.join(reportDir, `${task.id}.stderr.txt`);
  const result = await runStreaming("claude", args, {
    cwd: workspace,
    stdoutPath,
    stderrPath,
    timeoutMs: 1000 * 60 * 12,
    timeout: 1000 * 60 * 12,
    env: {
      ...process.env,
      ANTHROPIC_MODEL: "sonnet",
      ANTHROPIC_DEFAULT_SONNET_MODEL: "claude-sonnet-4-6",
      ANTHROPIC_DEFAULT_HAIKU_MODEL: "claude-haiku-4-5-20251001",
      ANTHROPIC_DEFAULT_OPUS_MODEL: "claude-sonnet-4-6",
      ANTHROPIC_DEFAULT_FABLE_MODEL: "claude-sonnet-4-6",
      CLAUDE_CODE_SUBAGENT_MODEL: "inherit"
    }
  });
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  const eventSummary = summarizeStreamEvents(stdout);
  const grade = gradeTranscript({
    stdout,
    eventSummary,
    expectedSubagents: task.expectedSubagents
  });
  const testResult = spawnSync("npm", ["test"], {
    cwd: workspace,
    encoding: "utf8",
    timeout: 1000 * 60
  });
  if (testResult.status !== 0) {
    grade.pass = false;
    grade.findings.push(`post-run npm test failed with exit ${testResult.status}`);
  }
  const record = {
    id: task.id,
    workspace,
    status: result.status,
    signal: result.signal,
    timedOut: result.timedOut,
    grade,
    eventSummary,
    postRunTest: {
      status: testResult.status,
      output: `${testResult.stdout || ""}${testResult.stderr || ""}`.slice(-4000)
    },
    stderr: stderr.slice(-4000)
  };
  await writeFile(path.join(reportDir, `${task.id}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return record;
}

async function main() {
  const selected = process.argv.includes("--only")
    ? new Set([process.argv[process.argv.indexOf("--only") + 1]])
    : null;
  const reportDir = path.join(root, "reports", "progressive-claude-tests", new Date().toISOString().replace(/[:.]/g, "-"));
  await mkdir(reportDir, { recursive: true });
  const records = [];
  for (const task of tasks) {
    if (selected && !selected.has(task.id)) {
      continue;
    }
    records.push(await runTask(task, reportDir));
  }
  const report = {
    reportDir,
    pass: records.every((record) => record.status === 0 && record.grade.pass),
    records
  };
  await writeFile(path.join(reportDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.pass) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  });
}
