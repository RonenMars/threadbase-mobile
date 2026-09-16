export const CLAUDE_CODE_PROVIDER = 'claude-code' as const
export const CODEX_CLI_PROVIDER = 'codex-cli' as const
export const CURSOR_PROVIDER = 'cursor' as const
/** Live PTY on main shipped this wire name; accept it and treat it as `cursor`. */
export const LEGACY_CURSOR_PROVIDER = 'cursor-cli' as const

export const PROVIDER_NAMES = [
  CLAUDE_CODE_PROVIDER,
  CODEX_CLI_PROVIDER,
  CURSOR_PROVIDER,
] as const

export type ProviderName = (typeof PROVIDER_NAMES)[number]

export type ProviderLabelKey = 'claude' | 'codex' | 'cursor'

export function canonicalizeProviderName(value: string | undefined | null): ProviderName | undefined {
  if (value === LEGACY_CURSOR_PROVIDER) return CURSOR_PROVIDER
  if (value && (PROVIDER_NAMES as readonly string[]).includes(value)) return value as ProviderName
  return undefined
}

/** Claude fill matches lobe-icons `claude-color`; Codex/Cursor are the product tokens. */
export const PROVIDER_COLOR = {
  claude: "#D97757",
  codex: "#7B5EA7",
  cursor: "#3D8BFF",
} as const satisfies Record<ProviderLabelKey, string>;

export function isProviderName(value: string): value is ProviderName {
  return canonicalizeProviderName(value) !== undefined
}

/** i18n key under `sessions:provider.*`. Unknown names read as Claude. */
export function providerLabelKey(
  provider: string | undefined | null,
): ProviderLabelKey {
  const name = canonicalizeProviderName(provider ?? undefined)
  if (name === CODEX_CLI_PROVIDER) return 'codex'
  if (name === CURSOR_PROVIDER) return 'cursor'
  return 'claude'
}

export function providerColor(provider: string | undefined | null): string {
  return PROVIDER_COLOR[providerLabelKey(provider)];
}
