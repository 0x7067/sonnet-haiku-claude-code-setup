import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  buildHookCommand,
  defaultClaudeDir,
  mergeSettings
} from "../scripts/install.mjs";

test("defaultClaudeDir prefers CLAUDE_CONFIG_DIR over platform home", () => {
  const claudeDir = defaultClaudeDir({
    env: {
      CLAUDE_CONFIG_DIR: "C:\\Users\\teammate\\.claude-custom",
      USERPROFILE: "C:\\Users\\teammate"
    },
    homedir: () => "C:\\Users\\fallback",
    platform: "win32"
  });

  assert.equal(claudeDir, "C:\\Users\\teammate\\.claude-custom");
});

test("defaultClaudeDir uses USERPROFILE on Windows when HOME is absent", () => {
  const claudeDir = defaultClaudeDir({
    env: {
      USERPROFILE: "C:\\Users\\teammate"
    },
    homedir: () => "C:\\Users\\fallback",
    platform: "win32"
  });

  assert.equal(claudeDir, path.win32.join("C:\\Users\\teammate", ".claude"));
});

test("mergeSettings installs a runtime-resolved hook command", () => {
  const claudeDir = "C:\\Users\\teammate\\.claude";
  const next = mergeSettings(
    {},
    {
      hooks: {
        UserPromptSubmit: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command: "node \"$HOME/.claude/hooks/sonnet-haiku-routing-reminder.mjs\""
              }
            ]
          }
        ]
      }
    },
    { claudeDir, pathModule: path.win32 }
  );

  const command = next.hooks.UserPromptSubmit[0].hooks[0].command;
  assert.equal(command, buildHookCommand());
  assert.equal(command.includes(claudeDir), false);
  assert.equal(command.includes("C:\\Users"), false);
  assert.equal(command.includes("CLAUDE_CONFIG_DIR"), true);
  assert.equal(command.includes("sonnet-haiku-routing-reminder.mjs"), true);
});

test("mergeSettings replaces stale HOME hook commands instead of duplicating them", () => {
  const claudeDir = "C:\\Users\\teammate\\.claude";
  const next = mergeSettings(
    {
      hooks: {
        UserPromptSubmit: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command: "node \"$HOME/.claude/hooks/sonnet-haiku-routing-reminder.mjs\""
              }
            ]
          }
        ]
      }
    },
    {
      hooks: {
        UserPromptSubmit: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command: "__SONNET_HAIKU_ROUTING_HOOK__"
              }
            ]
          }
        ]
      }
    },
    { claudeDir, pathModule: path.win32 }
  );

  const commands = next.hooks.UserPromptSubmit.flatMap((entry) =>
    (entry.hooks || []).map((hook) => hook.command)
  );

  assert.deepEqual(commands, [buildHookCommand()]);
});

test("mergeSettings enables only the shareable default plugins", () => {
  const next = mergeSettings({}, {}, { claudeDir: "/tmp/.claude" });

  assert.deepEqual(Object.keys(next.enabledPlugins).sort(), [
    "basic-memory@basicmachines-co",
    "code-simplifier@claude-plugins-official",
    "codex@openai-codex",
    "commit-commands@claude-plugins-official",
    "deslop@vibe-tooling"
  ]);
});
