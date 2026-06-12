#!/usr/bin/env node
import { chmod, copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");
const claudeDir = defaultClaudeDir();
const settingsPath = path.join(claudeDir, "settings.json");
const claudeMdPath = path.join(claudeDir, "CLAUDE.md");
const templatePath = path.join(root, "templates", "settings.sonnet-haiku.json");
const claudeMdTemplatePath = path.join(root, "templates", "CLAUDE.sonnet-haiku.md");
const claudeMdStartMarker = "<!-- sonnet-haiku-model-routing:start -->";
const claudeMdEndMarker = "<!-- sonnet-haiku-model-routing:end -->";

const summary = {
  dryRun,
  claudeDir,
  settingsPath,
  backupPath: null,
  claudeMdBackupPath: null,
  claudeMdChanged: false,
  settingsChanged: false,
  copied: [],
  skipped: [],
  warnings: []
};

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function readJson(filePath, fallback) {
  if (!existsSync(filePath)) {
    return fallback;
  }
  const text = await readFile(filePath, "utf8");
  return JSON.parse(text);
}

export function defaultClaudeDir({
  env = process.env,
  homedir = os.homedir,
  platform = process.platform
} = {}) {
  if (env.CLAUDE_CONFIG_DIR) {
    return env.CLAUDE_CONFIG_DIR;
  }
  const home = platform === "win32"
    ? env.USERPROFILE || env.HOME || homedir()
    : env.HOME || homedir();
  const pathModule = platform === "win32" ? path.win32 : path;
  return pathModule.join(home, ".claude");
}

export function buildHookCommand() {
  const runner = [
    "const { spawnSync } = require('node:child_process');",
    "const { join } = require('node:path');",
    "const { homedir } = require('node:os');",
    "const home = process.platform === 'win32' ? process.env.USERPROFILE || process.env.HOME || homedir() : process.env.HOME || homedir();",
    "const dir = process.env.CLAUDE_CONFIG_DIR || join(home, '.claude');",
    "const hook = join(dir, 'hooks', 'sonnet-haiku-routing-reminder.mjs');",
    "const result = spawnSync(process.execPath, [hook], { stdio: 'inherit' });",
    "process.exit(result.status ?? (result.error ? 1 : 0));"
  ].join(" ");
  return `node -e ${JSON.stringify(runner)}`;
}

function isSonnetHaikuHookCommand(command) {
  return typeof command === "string"
    && command.includes("sonnet-haiku-routing-reminder.mjs");
}

export function mergeSettings(settings, template, options = {}) {
  const next = structuredClone(settings);
  next.model = template.model;
  next.advisorModel = template.advisorModel;
  next.availableModels = [...(template.availableModels || [])];
  next.fallbackModel = [...(template.fallbackModel || [])];
  next.env = { ...(next.env || {}) };

  for (const [key, value] of Object.entries(template.env || {})) {
    const override = process.env[key];
    const desired = override && override.trim() ? override : value;
    if (next.env[key] !== desired) {
      next.env[key] = desired;
    }
  }

  for (const [key, value] of Object.entries(template.defaults || {})) {
    if (next[key] === undefined) {
      next[key] = value;
    }
  }

  next.hooks = { ...(next.hooks || {}) };
  for (const [event, entries] of Object.entries(template.hooks || {})) {
    const currentEntries = Array.isArray(next.hooks[event])
      ? next.hooks[event]
        .map((currentEntry) => ({
          ...currentEntry,
          hooks: (currentEntry.hooks || []).filter((hook) =>
            !isSonnetHaikuHookCommand(hook.command)
          )
        }))
        .filter((currentEntry) => (currentEntry.hooks || []).length > 0)
      : [];
    for (const entry of entries) {
      const desiredEntry = structuredClone(entry);
      desiredEntry.hooks = (desiredEntry.hooks || []).map((hook) => {
        if (hook.type !== "command") {
          return hook;
        }
        return {
          ...hook,
          command: buildHookCommand()
        };
      });
      const desiredCommand = desiredEntry.hooks?.[0]?.command;
      const alreadyInstalled = desiredCommand && currentEntries.some((currentEntry) =>
        (currentEntry.hooks || []).some((hook) => hook.command === desiredCommand)
      );
      if (!alreadyInstalled) {
        currentEntries.push(desiredEntry);
      }
    }
    next.hooks[event] = currentEntries;
  }

  next.enabledPlugins = { ...(next.enabledPlugins || {}) };
  for (const plugin of [
    "basic-memory@basicmachines-co",
    "code-simplifier@claude-plugins-official",
    "commit-commands@claude-plugins-official",
    "codex@openai-codex",
    "deslop@vibe-tooling"
  ]) {
    if (next.enabledPlugins[plugin] === undefined) {
      next.enabledPlugins[plugin] = true;
    }
  }

  return next;
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function mergeClaudeMd(currentText, templateText) {
  const current = currentText.trimEnd();
  const template = templateText.trimEnd();
  const start = current.indexOf(claudeMdStartMarker);
  const end = current.indexOf(claudeMdEndMarker);
  if (start >= 0 && end > start) {
    const prefix = current.slice(0, start);
    const headingMatch = prefix.match(/(?:^|\n)(?:## Model routing\n\s*)+$/);
    const blockStart = headingMatch
      ? prefix.length - headingMatch[0].length
      : start;
    const before = current.slice(0, blockStart).trimEnd();
    const after = current.slice(end + claudeMdEndMarker.length).trimStart();
    return `${before}${before ? "\n\n" : ""}${template}${after ? `\n\n${after}` : ""}\n`;
  }
  return `${current}${current ? "\n\n" : ""}${template}\n`;
}

async function copyTree(srcDir, destDir) {
  if (!existsSync(srcDir)) {
    return;
  }
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyTree(src, dest);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (existsSync(dest) && !force) {
      const [srcText, destText] = await Promise.all([
        readFile(src, "utf8"),
        readFile(dest, "utf8")
      ]);
      if (srcText === destText) {
        summary.skipped.push({ path: dest, reason: "unchanged" });
      } else {
        summary.skipped.push({ path: dest, reason: "exists; pass --force to replace" });
      }
      continue;
    }
    summary.copied.push(dest);
    if (!dryRun) {
      await mkdir(path.dirname(dest), { recursive: true });
      await copyFile(src, dest);
      if (
        process.platform !== "win32"
        && dest.includes(`${path.sep}hooks${path.sep}`)
      ) {
        await chmod(dest, 0o755);
      }
    }
  }
}

async function main() {
  const template = await readJson(templatePath, {});
  const claudeMdTemplate = await readFile(claudeMdTemplatePath, "utf8");
  const current = await readJson(settingsPath, {});
  const next = mergeSettings(current, template, { claudeDir });
  const currentText = stableJson(current);
  const nextText = stableJson(next);

  if (currentText !== nextText) {
    summary.settingsChanged = true;
    summary.backupPath = `${settingsPath}.bak.${timestamp()}`;
    if (!dryRun) {
      await mkdir(path.dirname(settingsPath), { recursive: true });
      if (existsSync(settingsPath)) {
        await writeFile(summary.backupPath, currentText, "utf8");
      }
      await writeFile(settingsPath, nextText, "utf8");
    }
  }

  const currentClaudeMd = existsSync(claudeMdPath) ? await readFile(claudeMdPath, "utf8") : "";
  const nextClaudeMd = mergeClaudeMd(currentClaudeMd, claudeMdTemplate);
  if (currentClaudeMd !== nextClaudeMd) {
    summary.claudeMdChanged = true;
    summary.claudeMdBackupPath = `${claudeMdPath}.bak.${timestamp()}`;
    if (!dryRun) {
      await mkdir(path.dirname(claudeMdPath), { recursive: true });
      if (existsSync(claudeMdPath)) {
        await writeFile(summary.claudeMdBackupPath, currentClaudeMd, "utf8");
      }
      await writeFile(claudeMdPath, nextClaudeMd, "utf8");
    }
  }

  await copyTree(path.join(root, "agents"), path.join(claudeDir, "agents"));
  await copyTree(path.join(root, "skills"), path.join(claudeDir, "skills"));
  await copyTree(path.join(root, "hooks"), path.join(claudeDir, "hooks"));

  if (dryRun) {
    summary.warnings.push("dry run only; no files were written");
  }

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  });
}
