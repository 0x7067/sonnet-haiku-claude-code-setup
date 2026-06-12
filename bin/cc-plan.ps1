$env:ANTHROPIC_DEFAULT_SONNET_MODEL = if ($env:ANTHROPIC_DEFAULT_SONNET_MODEL) { $env:ANTHROPIC_DEFAULT_SONNET_MODEL } else { "claude-sonnet-4-6" }
$env:ANTHROPIC_DEFAULT_HAIKU_MODEL = if ($env:ANTHROPIC_DEFAULT_HAIKU_MODEL) { $env:ANTHROPIC_DEFAULT_HAIKU_MODEL } else { "claude-haiku-4-5-20251001" }
$env:CLAUDE_CODE_SUBAGENT_MODEL = if ($env:CLAUDE_CODE_SUBAGENT_MODEL) { $env:CLAUDE_CODE_SUBAGENT_MODEL } else { "inherit" }

claude --model sonnet --effort $(if ($env:CLAUDE_CODE_EFFORT) { $env:CLAUDE_CODE_EFFORT } else { "medium" }) --permission-mode plan @args
