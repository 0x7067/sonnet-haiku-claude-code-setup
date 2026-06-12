from pathlib import Path
import json
import shlex
import shutil
import tempfile

from harbor.agents.installed.claude_code import ClaudeCode
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext
from harbor.models.trial.paths import EnvironmentPaths


class SonnetHaikuClaudeCode(ClaudeCode):
    """Claude Code with the host Sonnet/Haiku setup injected per Harbor trial."""

    @staticmethod
    def name() -> str:
        return "sonnet-haiku-claude-code"

    async def _upload_optional_dir(
        self, environment: BaseEnvironment, source: Path, target: str
    ) -> None:
        if source.is_dir():
            with tempfile.TemporaryDirectory(prefix="harbor-claude-setup-") as tmp:
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
                return value.replace(host_prefix, "$CLAUDE_CONFIG_DIR")
            if isinstance(value, list):
                return [rewrite(item) for item in value]
            if isinstance(value, dict):
                return {key: rewrite(item) for key, item in value.items()}
            return value

        with tempfile.TemporaryDirectory(prefix="harbor-claude-settings-") as tmp:
            materialized = Path(tmp) / "settings.json"
            settings = json.loads(source.read_text(encoding="utf-8"))
            settings.setdefault("env", {})
            settings["env"]["CLAUDE_CONFIG_DIR"] = config_dir
            materialized.write_text(
                json.dumps(rewrite(settings), indent=2) + "\n", encoding="utf-8"
            )
            await environment.upload_file(materialized, target)

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

        await super().run(instruction, environment, context)
