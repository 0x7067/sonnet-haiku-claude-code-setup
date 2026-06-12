$env:ANTHROPIC_DEFAULT_SONNET_MODEL = if ($env:ANTHROPIC_DEFAULT_SONNET_MODEL) { $env:ANTHROPIC_DEFAULT_SONNET_MODEL } else { "claude-sonnet-4-6" }
$env:ANTHROPIC_DEFAULT_HAIKU_MODEL = if ($env:ANTHROPIC_DEFAULT_HAIKU_MODEL) { $env:ANTHROPIC_DEFAULT_HAIKU_MODEL } else { "claude-haiku-4-5-20251001" }
$env:CLAUDE_CODE_SUBAGENT_MODEL = if ($env:CLAUDE_CODE_SUBAGENT_MODEL) { $env:CLAUDE_CODE_SUBAGENT_MODEL } else { "inherit" }
$env:ANTHROPIC_BETA = if ($env:ANTHROPIC_BETA) { $env:ANTHROPIC_BETA } else { "context-1m-2025-08-07" }

claude --model sonnet --effort $(if ($env:CLAUDE_CODE_EFFORT) { $env:CLAUDE_CODE_EFFORT } else { "low" }) @args
