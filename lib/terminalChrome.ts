import {
  CLAUDE_CODE_PROVIDER,
  CODEX_CLI_PROVIDER,
  COPILOT_PROVIDER,
  type ProviderName,
} from '@/constants/providers'
import { stripAnsi } from '@/utils/stripAnsi'

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

const peelGutter = (line: string) => line.trim().replace(/^[│┃]\s*/, '').replace(/\s*[│┃]$/, '')
const CARD_PROMPT = /^Do you (?:want to run this command|trust the files in this folder)\?$/
const CARD_FOOTER = /^↑\/↓ to navigate\b.*\besc to cancel$/
const FORM_HEADER = 'Copilot needs information.'
const FORM_FOOTER = /^(?:↑\/↓ (?:select|adjust)\b|enter accept\b).*\bctrl\+d decline\b/
const CARD_TOP = /^╭─+╮$/
const CARD_ROW = /^[│┃].*[│┃]$/

/**
 * Copilot CLI draws no title or transcript line for its own chrome, and
 * VirtualTerminal keeps every row it has painted, so the busy row, the status
 * footer and a dismissed permission / `ask_user` card would otherwise sit in the
 * last rows for good. Patterns are read off the 1.0.92 captures in tb-streamer
 * (`__tests__/fixtures/turn-signals/copilot-1.0.92-*.json`). A card's box gutter
 * is peeled first; anchored so a reply that quotes a phrase is kept. The card's
 * title, body and command rows carry no fixed text and are not matched.
 */
export function isCopilotTerminalChrome(line: string): boolean {
  if (isCodexTerminalChrome(line)) return true
  const row = peelGutter(line)
  if (/^[❯›>]$/.test(row)) return true
  if (/^\S\s+Working\b.*\b(?:interrupt|edit prompt)\b/.test(row)) return true
  if (/\bSession: [\d.]+ AIC\b/.test(row)) return true
  if (/^←\s*open sidebar\b/.test(row) || /^Interactive · Manual Approval\b/.test(row)) return true
  if (CARD_PROMPT.test(row)) return true
  if (/^(?:❯\s*)?\d+\.\s+(?:Yes(?:, and\b.*)?|No(?: \(Esc\)|, and tell Copilot\b.*))$/.test(row)) return true
  if (CARD_FOOTER.test(row)) return true
  if (row === FORM_HEADER) return true
  if (FORM_FOOTER.test(row)) return true
  if (/^\S\s+Asking user\s+Waiting for response\b/.test(row)) return true
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
  if (provider === COPILOT_PROVIDER) return isCopilotTerminalChrome
  if (provider === CLAUDE_CODE_PROVIDER || provider == null || provider === '') {
    return isClaudeTerminalChrome
  }
  // Unknown provider: prefer passthrough over wrong Claude filters.
  return isPassthroughChrome
}

/**
 * A permission / trust card is one `╭─╮ … ╰─╯` box whose rows all sit in a `│`
 * gutter, and its title, command, wrapped options and body carry no text the
 * per-row filter can match. So the card is cut as a region: from its top border
 * (or from the first row, when the window starts mid-card) over the gutter rows
 * that follow, when one of them is the prompt or the footer. An `ask_user` form
 * has no box: it runs from its header to the next footer. A gutter row outside
 * such a span, a markdown table row for one, is kept, and so is a span that never
 * shows a prompt or footer (a card still being painted). Runs before the border
 * rows are dropped, since the top border is what bounds the card.
 */
function dropCopilotCards(rows: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < rows.length; ) {
    const row = rows[i].trim()
    let end = -1
    if (CARD_TOP.test(row) || (i === 0 && CARD_ROW.test(row))) {
      end = i + 1
      while (end < rows.length && CARD_ROW.test(rows[end].trim())) end++
      if (!rows.slice(i, end).some((r) => CARD_PROMPT.test(peelGutter(r)) || CARD_FOOTER.test(peelGutter(r)))) end = -1
    } else if (peelGutter(row) === FORM_HEADER) {
      let k = i + 1
      while (k < rows.length && peelGutter(rows[k]) !== FORM_HEADER && !FORM_FOOTER.test(peelGutter(rows[k]))) k++
      if (k < rows.length && FORM_FOOTER.test(peelGutter(rows[k]))) end = k + 1
    }
    if (end > i) i = end
    else out.push(rows[i++])
  }
  return out
}

/**
 * The rows the filter's provider keeps whole regions of: Copilot only, any other
 * filter gets its rows back untouched (the same array).
 */
export function dropChromeRegions(rows: string[], filter: TerminalChromeFilter): string[] {
  return filter === isCopilotTerminalChrome ? dropCopilotCards(rows) : rows
}

/** Keep line when the chrome filter says it is NOT chrome. */
export function keepTranscriptLine(line: string, filter: TerminalChromeFilter): boolean {
  return !filter(line)
}

/**
 * Claude Code paints its dim "suggested next prompt" into the input line, and
 * VirtualTerminal ignores SGR dim, so it arrives as an ordinary `❯ <text>` row.
 * Drops the last `❯` row, and only when its text is exactly `suggestion`: the
 * live input row is always below any earlier user message, so an old message
 * with the same text is not the one removed. Anything else keeps every line.
 */
export function dropGhostPromptLine(
  lines: string[],
  suggestion: string | null | undefined,
): string[] {
  if (!suggestion) return lines
  for (let i = lines.length - 1; i >= 0; i--) {
    const row = stripAnsi(lines[i]).trim()
    if (!row.startsWith('❯')) continue
    if (row.slice(1).trim() !== suggestion.trim()) return lines
    return [...lines.slice(0, i), ...lines.slice(i + 1)]
  }
  return lines
}
