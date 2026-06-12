from pathlib import Path
import json
import os
import shlex
import shutil
import tempfile

from pier.agents.installed.claude_code import ClaudeCode
from pier.environments.base import BaseEnvironment
from pier.models.agent.context import AgentContext
from pier.models.trial.paths import EnvironmentPaths

BENCHMARK_UNSAFE_SETTING_KEYS = {
    "autoDreamEnabled",
    "autoMemoryEnabled",
    "enabledPlugins",
    "extraKnownMarketplaces",
    "pluginConfigs",
    "preferredNotifChannel",
    "remoteControlAtStartup",
    "statusLine",
    "voice",
}


class SonnetHaikuClaudeCode(ClaudeCode):
    """Pier Claude Code agent with the host Sonnet/Haiku setup injected per trial."""

    @staticmethod
    def name() -> str:
        return "sonnet-haiku-claude-code"

    async def _upload_optional_dir(
        self, environment: BaseEnvironment, source: Path, target: str
    ) -> None:
        if source.is_dir():
            with tempfile.TemporaryDirectory(prefix="pier-claude-setup-") as tmp:
                materialized = Path(tmp) / source.name
                shutil.copytree(
                    source,
                    materialized,
                    symlinks=False,
                    ignore_dangling_symlinks=True,
                )
                await environment.upload_dir(materialized, target)

    async def _upload_optional_file(
        self, environment: BaseEnvironment, source: Path, target: str
    ) -> None:
        if source.is_file():
            await environment.upload_file(source, target)

    async def _upload_settings_file(
        self, environment: BaseEnvironment, source: Path, target: str, config_dir: str
    ) -> None:
        if not source.is_file():
            return

        host_prefix = f"{Path.home()}/.claude"

        def rewrite(value):
            if isinstance(value, str):
                return (
                    value.replace(host_prefix, "$CLAUDE_CONFIG_DIR")
                    .replace("$HOME/.claude", "$CLAUDE_CONFIG_DIR")
                    .replace("${HOME}/.claude", "$CLAUDE_CONFIG_DIR")
                )
            if isinstance(value, list):
                return [rewrite(item) for item in value]
            if isinstance(value, dict):
                return {key: rewrite(item) for key, item in value.items()}
            return value

        def benchmark_safe_settings(settings: dict) -> dict:
            safe = {
                key: value
                for key, value in settings.items()
                if key not in BENCHMARK_UNSAFE_SETTING_KEYS
            }

            env = dict(safe.get("env") or {})
            env.pop("ENABLE_CLAUDEAI_MCP_SERVERS", None)
            env["CLAUDE_CONFIG_DIR"] = config_dir
            safe["env"] = env

            prompt_hooks = []
            for hook_group in (safe.get("hooks") or {}).get("UserPromptSubmit") or []:
                hooks = []
                for hook in hook_group.get("hooks") or []:
                    command = hook.get("command", "")
                    if "sonnet-haiku-routing-reminder.mjs" in command:
                        hooks.append({**hook, "command": rewrite(command)})
                if hooks:
                    prompt_hooks.append({**hook_group, "hooks": hooks})

            safe["hooks"] = {"UserPromptSubmit": prompt_hooks} if prompt_hooks else {}
            return safe

        with tempfile.TemporaryDirectory(prefix="pier-claude-settings-") as tmp:
            materialized = Path(tmp) / "settings.json"
            settings = json.loads(source.read_text(encoding="utf-8"))
            settings = benchmark_safe_settings(settings)
            materialized.write_text(
                json.dumps(rewrite(settings), indent=2) + "\n", encoding="utf-8"
            )
            await environment.upload_file(materialized, target)

    async def _upload_oauth_token_file(
        self, environment: BaseEnvironment, config_dir: str
    ) -> bool:
        token_file = os.environ.get("CLAUDE_CODE_OAUTH_TOKEN_FILE")
        token_value = os.environ.get("CLAUDE_CODE_OAUTH_TOKEN")
        target = f"{config_dir}/.oauth-token"

        if token_file and Path(token_file).is_file():
            await environment.upload_file(Path(token_file), target)
            await self.exec_as_agent(environment, command=f"chmod 600 {shlex.quote(target)}")
            return True

        if not token_value:
            return False

        with tempfile.TemporaryDirectory(prefix="pier-claude-oauth-") as tmp:
            materialized = Path(tmp) / "oauth-token"
            materialized.write_text(token_value, encoding="utf-8")
            materialized.chmod(0o600)
            await environment.upload_file(materialized, target)
            await self.exec_as_agent(environment, command=f"chmod 600 {shlex.quote(target)}")
            return True

    async def _install_oauth_file_wrapper(
        self, environment: BaseEnvironment, config_dir: str
    ) -> None:
        token_path = shlex.quote(f"{config_dir}/.oauth-token")
        command = f"""set -euo pipefail
mkdir -p "$HOME/.local/bin"
if [ -x "$HOME/.local/bin/claude" ] && [ ! -e "$HOME/.local/bin/claude-real" ]; then
  mv "$HOME/.local/bin/claude" "$HOME/.local/bin/claude-real"
fi
cat > "$HOME/.local/bin/claude" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
token_file={token_path}
if [ -s "$token_file" ] && [ -z "${{CLAUDE_CODE_OAUTH_TOKEN:-}}" ]; then
  export CLAUDE_CODE_OAUTH_TOKEN="$(cat "$token_file")"
fi
exec "$HOME/.local/bin/claude-real" "$@"
EOF
chmod 700 "$HOME/.local/bin/claude"
"""
        await self.exec_as_agent(environment, command=command)

    async def run(
        self, instruction: str, environment: BaseEnvironment, context: AgentContext
    ) -> None:
        host_claude = Path.home() / ".claude"
        config_dir = (EnvironmentPaths.agent_dir / "sessions").as_posix()

        quoted_dirs = " ".join(
            shlex.quote(f"{config_dir}/{name}")
            for name in ("agents", "skills", "hooks")
        )
        await self.exec_as_agent(
            environment,
            command=f"mkdir -p {quoted_dirs}",
        )

        await self._upload_optional_dir(
            environment, host_claude / "agents", f"{config_dir}/agents"
        )
        await self._upload_optional_dir(
            environment, host_claude / "skills", f"{config_dir}/skills"
        )
        await self._upload_optional_dir(
            environment, host_claude / "hooks", f"{config_dir}/hooks"
        )
        await self._upload_settings_file(
            environment,
            host_claude / "settings.json",
            f"{config_dir}/settings.json",
            config_dir,
        )
        await self._upload_optional_file(
            environment, host_claude / "CLAUDE.md", f"{config_dir}/CLAUDE.md"
        )

        token_was_uploaded = await self._upload_oauth_token_file(environment, config_dir)
        if token_was_uploaded:
            await self._install_oauth_file_wrapper(environment, config_dir)

        previous_oauth_token = os.environ.pop("CLAUDE_CODE_OAUTH_TOKEN", None)
        try:
            await super().run(instruction, environment, context)
        finally:
            if previous_oauth_token is not None:
                os.environ["CLAUDE_CODE_OAUTH_TOKEN"] = previous_oauth_token
