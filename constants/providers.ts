export const CLAUDE_CODE_PROVIDER = "claude-code" as const;
export const CODEX_CLI_PROVIDER = "codex-cli" as const;
export const CURSOR_CLI_PROVIDER = "cursor-cli" as const;

export const PROVIDER_NAMES = [
  CLAUDE_CODE_PROVIDER,
  CODEX_CLI_PROVIDER,
  CURSOR_CLI_PROVIDER,
] as const;

export type ProviderName = (typeof PROVIDER_NAMES)[number];

export type ProviderLabelKey = "claude" | "codex" | "cursor";

export function isProviderName(value: string): value is ProviderName {
  return (PROVIDER_NAMES as readonly string[]).includes(value);
}

/** i18n key under `sessions:provider.*` and `brand.*` token. Unknown names read as Claude. */
export function providerLabelKey(
  provider: string | undefined | null,
): ProviderLabelKey {
  if (provider === CODEX_CLI_PROVIDER) return "codex";
  if (provider === CURSOR_CLI_PROVIDER) return "cursor";
  return "claude";
}
