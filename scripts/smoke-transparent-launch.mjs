#!/usr/bin/env node
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedAgents = [
  "haiku-codebase-scout",
  "haiku-context-compressor",
  "haiku-diff-summarizer",
  "haiku-log-triage",
  "sonnet-code-steward",
  "sonnet-task-architect"
];
const forbiddenModelFlags = [
  "--model",
  "--fallback-model",
  "--permission-mode",
  "--dangerously-skip-permissions"
];

function parseStream(streamText) {
  const report = {
    init: null,
    assistantText: "",
    parseErrors: 0
  };
  for (const line of streamText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    let event;
    try {
      event = JSON.parse(trimmed);
    } catch {
      report.parseErrors += 1;
      continue;
    }
    if (event.type === "system" && event.subtype === "init") {
      report.init = event;
    }
    const content = event.message?.content || [];
    for (const item of Array.isArray(content) ? content : [content]) {
      if (item?.type === "text" && item.text) {
        report.assistantText += item.text;
      }
    }
  }
  return report;
}

function runStreaming(command, args, options) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const stdoutStream = createWriteStream(options.stdoutPath);
    const stderrStream = createWriteStream(options.stderrPath);
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000).unref();
    }, options.timeoutMs);
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      stdout += text;
      stdoutStream.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      stderr += text;
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

async function main() {
  const reportDir = path.join(root, "reports", "transparent-launch", new Date().toISOString().replace(/[:.]/g, "-"));
  const workspace = await mkdtemp(path.join(os.tmpdir(), "claude-transparent-"));
  await mkdir(reportDir, { recursive: true });
  await writeFile(path.join(workspace, "package.json"), `${JSON.stringify({ type: "module" }, null, 2)}\n`, "utf8");

  const prompt = [
    "Transparent launch smoke test.",
    "Do not edit files and do not use tools.",
    "Reply with exactly: TRANSPARENT_SMOKE: PASS"
  ].join(" ");
  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--max-budget-usd",
    process.env.TRANSPARENT_SMOKE_BUDGET_USD || "2.00",
    prompt
  ];
  const result = await runStreaming("claude", args, {
    cwd: workspace,
    stdoutPath: path.join(reportDir, "stream.jsonl"),
    stderrPath: path.join(reportDir, "stderr.txt"),
    timeoutMs: 1000 * 60 * 3
  });
  const stream = parseStream(result.stdout || "");
  const init = stream.init || {};
  const failures = [];
  const check = (condition, message) => {
    if (!condition) {
      failures.push(message);
    }
  };

  check(result.status === 0, `plain claude -p exited ${result.status}`);
  check(!result.timedOut, "plain claude -p timed out");
  check(!args.some((arg) => forbiddenModelFlags.includes(arg)), "smoke command should not pass model or permission override flags");
  check(init.model === "claude-sonnet-4-6", `plain claude launch should initialize Sonnet, got ${init.model || "missing"}`);
  check(init.apiKeySource === "none", `plain claude launch should use subscription auth, got ${init.apiKeySource || "missing"}`);
  check(init.slash_commands?.includes("sonnet-haiku-code"), "plain claude launch should load sonnet-haiku-code slash command");
  for (const agent of expectedAgents) {
    check(init.agents?.includes(agent), `plain claude launch should load agent ${agent}`);
  }
  check(stream.assistantText.includes("TRANSPARENT_SMOKE: PASS"), "assistant did not return transparent smoke pass marker");

  const report = {
    reportDir,
    pass: failures.length === 0,
    failures,
    command: ["claude", ...args.slice(0, -1), "<prompt>"].join(" "),
    workspace,
    status: result.status,
    signal: result.signal,
    timedOut: result.timedOut,
    init: {
      model: init.model,
      apiKeySource: init.apiKeySource,
      claude_code_version: init.claude_code_version,
      loadedAgents: expectedAgents.filter((agent) => init.agents?.includes(agent)),
      hasSonnetHaikuSkill: init.slash_commands?.includes("sonnet-haiku-code") || false
    },
    stderr: (result.stderr || "").slice(-2000)
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
