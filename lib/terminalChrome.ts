import {
  CLAUDE_CODE_PROVIDER,
  CODEX_CLI_PROVIDER,
  type ProviderName,
} from '@/constants/providers'

/**
 * Provider-specific filters for PTY chrome that should not appear as
 * transcript content. Keep adapters additive and fall through to keep
 * the line when uncertain — never invent streamer APIs for this.
 */
export type TerminalChromeFilter = (line: string) => boolean

/** True when the line is Claude Code TUI chrome (not transcript content). */
export function isClaudeTerminalChrome(line: string): boolean {
  if (line.length === 0) return true
  const trimmed = line.trim()

  const stripped = line.replace(/[\s=\-─━═│┃┌┐└┘├┤┬┴┼╭╮╯╰╱╲\u2500-\u257F\u2580-\u259F]/g, '')
  if (stripped.length === 0) return true
  const strippedTrimmed = stripped.trim()
  if (/^Claude\s*Code\s*v\d/.test(strippedTrimmed)) return true
  if (/^Welcome\s*back\b/.test(strippedTrimmed)) return true

  if (/[▛▜▙▟███]{3,}/.test(trimmed)) return true
  if (/Welcome to Claude Code/.test(trimmed)) return true
  if (/^Welcome back\b/.test(trimmed)) return true
  if (/^Claude Code\s+v\d/.test(trimmed)) return true

  if (/^[·✢*✳✶✻✽⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏◐◑◒◓\s]+$/.test(trimmed)) return true
  if (/^[✱✳✶✻✽*·✢]\s+Saut[ée]+d\s+for\s/.test(trimmed)) return true
  if (/^[·✢*✳✶✻✽]\s+\w+ing…\s*$/.test(trimmed)) return true
  if (/^\w+ing…\s*$/.test(trimmed)) return true
  if (/^[·✢*✳✶✻✽]?\s*\w+ing…\s*\(\d+s\b[^)]*\)\s*$/.test(trimmed)) return true
  if (/^[✱✳✶✻✽*·✢]\s+\w+\s+for\s+(\d+m\s*)?\d+s\s*$/.test(trimmed)) return true

  if (/^[❯›>]$/.test(trimmed)) return true
  if (/^[❯›>]\s+\d+q$/.test(trimmed)) return true
  if (/^[❯›>]\s+Try "/.test(trimmed)) return true
  if (/\(●oo●\)/.test(trimmed) || /\(◐oo◐\)/.test(trimmed)) return true
  if (/^(Opus|Sonnet|Haiku|Fable)\s+\d+(\.\d+)?[\s(|│[]/.test(trimmed)) return true
  if (/^Claude\s+\d+\.\d+\s+(Opus|Sonnet|Haiku)/.test(trimmed)) return true
  if (/^\|/.test(trimmed)) return true
  if (/^[►▶❯]{1,2}\s*(accept edits|auto|plan)\b/i.test(trimmed)) return true
  if (/Update available!/.test(trimmed)) return true
  if (/^Run:\s+\S/.test(trimmed)) return true
  if (/^\$[\d.]+\s+[\d.]+[kmb]?\s+tokens?$/i.test(trimmed)) return true
  if (/^[◑◐●]\s*(low|medium|high)\b/i.test(trimmed)) return true
  if (/\(shift\+tab to cycle\)/.test(trimmed)) return true
  if (/\(ctrl\+o to expand\)/.test(trimmed)) return true
  if (/^\.\.\.\s+\+\d+\s+lines\s/.test(trimmed)) return true
  if (/rate limit/i.test(trimmed) && /\d+\s*(req|request|min)/i.test(trimmed)) return true

  if (/^Backgrounded agent\b/i.test(trimmed)) return true
  if (/\b(came to rest|is running|backgrounded)\b/i.test(trimmed) && /^(Explore|Plan|Task|Agent)\b/.test(trimmed)) return true
  if (/^Invalid tool parameters\b/i.test(trimmed)) return true
  if (/^Tips? for getting started/i.test(trimmed)) return true
  if (/]777;notify/.test(trimmed) || /^tmux;\]/.test(trimmed)) return true
  if (/^[╭╮╯╰│─┌┐└┘┤├]+$/.test(trimmed)) return true

  return false
}

/** Codex TUI chrome is lighter; drop empty / box-only separators for now. */
export function isCodexTerminalChrome(line: string): boolean {
  if (line.length === 0) return true
  const trimmed = line.trim()
  const stripped = line.replace(/[\s=\-─━═│┃┌┐└┘├┤┬┴┼╭╮╯╰╱╲\u2500-\u257F\u2580-\u259F]/g, '')
  if (stripped.length === 0) return true
  if (/^codex\b/i.test(trimmed) && /v?\d/.test(trimmed) && trimmed.length < 40) return true
  return false
}

/** Keep every non-empty line — used for raw-terminal fallback. */
export function isPassthroughChrome(line: string): boolean {
  return line.length === 0
}

export function getTerminalChromeFilter(
  provider?: ProviderName | string | null,
  opts?: { raw?: boolean },
): TerminalChromeFilter {
  if (opts?.raw) return isPassthroughChrome
  if (provider === CODEX_CLI_PROVIDER) return isCodexTerminalChrome
  if (provider === CLAUDE_CODE_PROVIDER || provider == null || provider === '') {
    return isClaudeTerminalChrome
  }
  // Unknown provider: prefer passthrough over wrong Claude filters.
  return isPassthroughChrome
}

/** Keep line when the chrome filter says it is NOT chrome. */
export function keepTranscriptLine(line: string, filter: TerminalChromeFilter): boolean {
  return !filter(line)
}
