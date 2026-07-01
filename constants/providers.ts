export const CLAUDE_CODE_PROVIDER = "claude-code" as const;
export const CODEX_CLI_PROVIDER = "codex-cli" as const;
export type ProviderName = typeof CLAUDE_CODE_PROVIDER | typeof CODEX_CLI_PROVIDER;
