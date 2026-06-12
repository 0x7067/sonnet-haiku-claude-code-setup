#!/usr/bin/env node
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildHookCommand, defaultClaudeDir } from "./install.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const claudeDir = defaultClaudeDir();
const settingsPath = path.join(claudeDir, "settings.json");
const templatePath = path.join(root, "templates", "settings.sonnet-haiku.json");
const claudeMdTemplatePath = path.join(root, "templates", "CLAUDE.sonnet-haiku.md");
const expectedAgents = [
  "haiku-codebase-scout.md",
  "haiku-log-triage.md",
  "haiku-diff-summarizer.md",
  "haiku-context-compressor.md",
  "sonnet-task-architect.md",
  "sonnet-code-steward.md"
];
const expectedSkill = path.join(claudeDir, "skills", "sonnet-haiku-code", "SKILL.md");
const expectedHook = path.join(claudeDir, "hooks", "sonnet-haiku-routing-reminder.mjs");
const globalInstructionsPath = path.join(claudeDir, "CLAUDE.md");
const failures = [];
const warnings = [];
const evidence = [];

async function readJson(filePath) {
  const text = await readFile(filePath, "utf8");
  return JSON.parse(text);
}

function frontmatterModel(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return null;
  }
  const modelLine = match[1].split("\n").find((line) => line.startsWith("model:"));
  return modelLine ? modelLine.replace(/^model:\s*/, "").trim() : null;
}

function frontmatterDescription(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return "";
  }
  const line = match[1].split("\n").find((item) => item.startsWith("description:"));
  return line ? line.replace(/^description:\s*/, "").trim().replace(/^"|"$/g, "") : "";
}

function check(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout: options.timeout ?? 30000
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  evidence.push({
    command: [command, ...args].join(" "),
    status: result.status,
    output: output.slice(0, 1200)
  });
  return result;
}

async function main() {
  const template = await readJson(templatePath);
  const claudeMdTemplate = await readFile(claudeMdTemplatePath, "utf8");
  check(template.model === "sonnet", "template startup model should be sonnet");
  check(template.advisorModel === "sonnet", "template advisor model should be sonnet");
  check(JSON.stringify(template.availableModels) === JSON.stringify(["sonnet", "haiku"]), "template allowlist should be sonnet/haiku only");
  check(JSON.stringify(template.fallbackModel) === JSON.stringify(["sonnet", "haiku"]), "template fallback should stay inside sonnet/haiku");
  check(template.env.ANTHROPIC_MODEL === "sonnet", "template ANTHROPIC_MODEL should be sonnet");
  check(template.env.ANTHROPIC_DEFAULT_SONNET_MODEL === "claude-sonnet-4-6", "template Sonnet pin mismatch");
  check(template.env.ANTHROPIC_DEFAULT_HAIKU_MODEL === "claude-haiku-4-5-20251001", "template Haiku pin mismatch");
  check(template.env.ANTHROPIC_DEFAULT_OPUS_MODEL === "claude-sonnet-4-6", "template Opus alias should resolve to Sonnet");
  check(template.env.ANTHROPIC_DEFAULT_FABLE_MODEL === "claude-sonnet-4-6", "template Fable alias should resolve to Sonnet");
  check(template.env.CLAUDE_CODE_SUBAGENT_MODEL === "inherit", "template subagent model should be inherit");
  check(template.env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE === "80", "template should keep autocompact late enough for subagent-heavy tasks");
  const settings = await readJson(settingsPath);
  check(settings.model === "sonnet", "installed settings should start on Sonnet");
  check(settings.advisorModel === "sonnet", "installed advisor model should be Sonnet");
  check(JSON.stringify(settings.availableModels) === JSON.stringify(["sonnet", "haiku"]), "installed settings should allow only Sonnet/Haiku at user scope");
  check(JSON.stringify(settings.fallbackModel) === JSON.stringify(["sonnet", "haiku"]), "installed settings fallback should stay inside Sonnet/Haiku");
  check(settings.env?.ANTHROPIC_MODEL === "sonnet", "installed settings should force startup ANTHROPIC_MODEL to Sonnet");
  check(settings.env?.ANTHROPIC_DEFAULT_SONNET_MODEL === template.env.ANTHROPIC_DEFAULT_SONNET_MODEL, "installed settings missing Sonnet pin");
  check(settings.env?.ANTHROPIC_DEFAULT_HAIKU_MODEL === template.env.ANTHROPIC_DEFAULT_HAIKU_MODEL, "installed settings missing Haiku pin");
  check(settings.env?.ANTHROPIC_DEFAULT_OPUS_MODEL === template.env.ANTHROPIC_DEFAULT_OPUS_MODEL, "installed settings should map Opus alias to Sonnet");
  check(settings.env?.ANTHROPIC_DEFAULT_FABLE_MODEL === template.env.ANTHROPIC_DEFAULT_FABLE_MODEL, "installed settings should map Fable alias to Sonnet");
  check(settings.env?.CLAUDE_CODE_SUBAGENT_MODEL === "inherit", "installed settings should keep subagent model inherit");
  check(settings.env?.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE === "80", "installed settings should keep autocompact late enough for subagent-heavy tasks");
  const userPromptHooks = settings.hooks?.UserPromptSubmit || [];
  check(
    userPromptHooks.some((entry) =>
      (entry.hooks || []).some((hook) => hook.command === buildHookCommand(claudeDir))
    ),
    "installed settings missing Sonnet/Haiku UserPromptSubmit routing reminder hook"
  );

  for (const fileName of expectedAgents) {
    const agentPath = path.join(claudeDir, "agents", fileName);
    check(existsSync(agentPath), `missing installed agent ${fileName}`);
    if (existsSync(agentPath)) {
      const text = await readFile(agentPath, "utf8");
      const description = frontmatterDescription(text).toLowerCase();
      check(
        /(must delegate|use first|use before|use after edits)/.test(description),
        `installed agent ${fileName} description should contain a strong delegation trigger`
      );
    }
  }
  check(existsSync(expectedSkill), "missing installed sonnet-haiku-code skill");
  check(existsSync(expectedHook), "missing installed sonnet-haiku routing reminder hook");

  const agentFiles = (await readdir(path.join(claudeDir, "agents"))).filter((fileName) => fileName.endsWith(".md"));
  for (const fileName of agentFiles) {
    const text = await readFile(path.join(claudeDir, "agents", fileName), "utf8");
    const model = frontmatterModel(text);
    check(model === "sonnet" || model === "haiku", `agent ${fileName} should be explicitly routed to sonnet or haiku, found ${model || "missing"}`);
  }

  const globalInstructions = await readFile(globalInstructionsPath, "utf8");
  check(globalInstructions.includes("sonnet-haiku-model-routing:start"), "global CLAUDE.md missing Sonnet/Haiku routing marker");
  check(globalInstructions.includes("Default to the Sonnet/Haiku duo"), "global CLAUDE.md missing Sonnet/Haiku routing instructions");
  check(globalInstructions.includes("one-artifact loop"), "global CLAUDE.md missing one-artifact self-improvement loop");
  check(globalInstructions.includes(claudeMdTemplate.trim()), "global CLAUDE.md Sonnet/Haiku block is stale");

  const skillText = await readFile(expectedSkill, "utf8");
  check(skillText.includes("## One-Artifact Improvement Loop"), "installed sonnet-haiku-code skill missing one-artifact loop");

  for (const filePath of [
    path.join(root, "scripts", "install.mjs"),
    path.join(root, "scripts", "verify.mjs"),
    path.join(root, "hooks", "sonnet-haiku-routing-reminder.mjs")
  ]) {
    const result = run("node", ["--check", filePath]);
    check(result.status === 0, `syntax check failed for ${filePath}`);
  }

  const version = run("claude", ["--version"]);
  check(version.status === 0, "claude --version failed");

  const plugins = run("claude", ["plugin", "list"]);
  check(plugins.status === 0, "claude plugin list failed");
  if (plugins.status === 0 && !(plugins.stdout || "").includes("basic-memory@basicmachines-co")) {
    warnings.push("basic-memory plugin not listed; install it separately if you want memory-backed workflows");
  }
  const mcp = run("claude", ["mcp", "list"], { timeout: 45000 });
  check(mcp.status === 0, "claude mcp list failed");
  if (mcp.status === 0 && !(mcp.stdout || "").includes("basic-memory")) {
    warnings.push("basic-memory MCP not listed; memory instructions need a configured Basic Memory MCP");
  }

  const report = {
    verdict: failures.length === 0 ? "PASS" : "FAIL",
    failures,
    warnings,
    claudeDir,
    settingsPath,
    evidence
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
