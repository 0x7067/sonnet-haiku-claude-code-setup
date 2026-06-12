#!/usr/bin/env node
import { chmod, copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");
const home = process.env.HOME || os.homedir();
const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(home, ".claude");
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

function mergeSettings(settings, template) {
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

  next.enabledPlugins = { ...(next.enabledPlugins || {}) };
  for (const plugin of [
    "basic-memory@basicmachines-co",
    "superpowers@claude-plugins-official",
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
      if (dest.includes(`${path.sep}bin${path.sep}`)) {
        await chmod(dest, 0o755);
      }
    }
  }
}

async function main() {
  const template = await readJson(templatePath, {});
  const claudeMdTemplate = await readFile(claudeMdTemplatePath, "utf8");
  const current = await readJson(settingsPath, {});
  const next = mergeSettings(current, template);
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
  await copyTree(path.join(root, "bin"), path.join(claudeDir, "bin"));

  if (dryRun) {
    summary.warnings.push("dry run only; no files were written");
  }

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
