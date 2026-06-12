#!/usr/bin/env node
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const workspace = mkdtempSync(path.join(os.tmpdir(), "claude-agent-routing-"));
mkdirSync(path.join(workspace, "src"));
mkdirSync(path.join(workspace, "test"));
writeFileSync(path.join(workspace, "package.json"), `${JSON.stringify({
  type: "module",
  scripts: { test: "node --test" }
}, null, 2)}\n`);
writeFileSync(path.join(workspace, "src", "slug.mjs"), `export function slug(value) {
  return value.toLowerCase().replaceAll(" ", "-");
}
`);
writeFileSync(path.join(workspace, "test", "slug.test.mjs"), `import test from "node:test";
import assert from "node:assert/strict";
import { slug } from "../src/slug.mjs";

test("normalizes slugs", () => {
  assert.equal(slug(" Hello, Sonnet + Haiku! "), "hello-sonnet-haiku");
});
`);

const prompt = [
  `You are in an unfamiliar repository at ${workspace}.`,
  "Use your installed global instructions and available agent descriptions normally.",
  "Fix the failing test, keep edits scoped, run the relevant test, and end with TASK_RESULT: PASS."
].join(" ");
const result = spawnSync("claude", [
  "-p",
  "--output-format",
  "stream-json",
  "--verbose",
  "--include-hook-events",
  "--max-budget-usd",
  process.env.DESCRIPTION_ROUTING_SMOKE_BUDGET_USD || "3.00",
  prompt
], {
  cwd: workspace,
  encoding: "utf8",
  timeout: 240000
});

const subagents = new Set();
let initModel = null;
let apiKeySource = null;
let text = "";
let events = 0;
let agentToolUses = 0;
let hookReminder = false;

for (const line of (result.stdout || "").split(/\r?\n/)) {
  if (!line.trim()) {
    continue;
  }
  let event;
  try {
    event = JSON.parse(line);
  } catch {
    continue;
  }
  events += 1;
  if (JSON.stringify(event).includes("SONNET_HAIKU_SUBAGENT_ROUTING")) {
    hookReminder = true;
  }
  if (event.type === "system" && event.subtype === "init") {
    initModel = event.model;
    apiKeySource = event.apiKeySource;
  }
  const content = event.message?.content || [];
  for (const item of Array.isArray(content) ? content : [content]) {
    if (item?.type === "text") {
      text += item.text || "";
    }
    if (item?.type === "tool_use" && (item.name === "Agent" || item.name === "Task")) {
      agentToolUses += 1;
      const name = item.input?.subagent_type || item.input?.agent || item.input?.name;
      if (name) {
        subagents.add(name);
      }
    }
  }
}

const postRunTest = spawnSync("npm", ["test"], {
  cwd: workspace,
  encoding: "utf8",
  timeout: 60000
});
const report = {
  workspace,
  status: result.status,
  signal: result.signal,
  events,
  initModel,
  apiKeySource,
  hookReminder,
  agentToolUses,
  subagents: [...subagents].sort(),
  postRunTestStatus: postRunTest.status,
  pass: result.status === 0 &&
    hookReminder &&
    subagents.has("haiku-codebase-scout") &&
    text.includes("TASK_RESULT: PASS") &&
    postRunTest.status === 0,
  stderr: (result.stderr || "").slice(-1000),
  textTail: text.slice(-1200),
  testOutput: `${postRunTest.stdout || ""}${postRunTest.stderr || ""}`.slice(-1000)
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.pass) {
  process.exitCode = 1;
}
