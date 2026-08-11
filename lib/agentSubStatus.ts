import { CODEX_CLI_PROVIDER, type ProviderName } from '@/constants/providers'

/**
 * What a `running` session is actually doing, scraped from the rendered
 * terminal screen we already paint.
 *
 * The streamer's `status` is set by construction, not by observation: it flips
 * to `running` when the streamer writes bytes to the PTY (or spawns it) and
 * only leaves on a prompt marker. So `running` covers thinking, streaming,
 * tool calls and a wedged TUI identically, and no wire field separates them.
 * This refines it locally — no protocol change, and when Claude's TUI shifts
 * the damage is a stale label in one release rather than a wrong field
 * broadcast to every client.
 *
 * Each provider is read with its own rules — see the Codex section below, which
 * has a named state on screen and needs none of the inference this comment
 * describes.
 *
 * The Claude rules were derived against two captured live turns (2026-08-12,
 * Claude Code v2.1.x); each one is there because a naive version of it failed
 * on that data:
 *
 *  - Chunks are differential repaints (48-70 bytes carrying one spinner glyph
 *    and a digit or two of the token counter), so per-chunk text is useless.
 *    This must run on the rendered grid.
 *  - `❯` is the composer and is ALWAYS on screen. It is not an idle marker;
 *    treating it as one reported "idle" three times mid-turn.
 *  - The verb is randomized per turn — "Worked for 5s", "Brewed for 5s",
 *    "Moseying…", "Roosting…" all observed. Never match the word.
 *  - A screen sampled mid-repaint is torn: the status line exists but its
 *    closing paren has not been painted yet. Hold the previous value rather
 *    than inventing an idle, which is why this takes `prev`.
 */

export type AgentSubStatus =
  | 'thinking'
  | 'streaming'
  | 'hooks'
  | 'working'
  /** The turn's summary line painted — this turn is over. */
  | 'idle'
  /** No refinement available; callers fall back to the plain `status` label. */
  | 'unknown'

/**
 * Claude's live status line: `<spinner> <Verb>… (<N>s · <detail…>)`. The
 * parenthetical is the in-progress marker — it is gone the moment the turn
 * ends, and `esc to interrupt` never appeared once in 185 captured chunks, so
 * it is not usable as one.
 */
const WORKING = /\([^)]*\b\d+[smh]\b[^)]*\)?/

/** `✻ Worked for 5s` — the only positive end-of-turn marker on screen. */
const DONE = /(^|\s)[✻✶✳✢✽⏺❯]\s*\w+ for \d+[smh]/

/** Output tokens are arriving — leads the first painted prose by ~600ms. */
const TOKENS = /↓\s*[\d.]+k?\s*tokens/

/** Post-turn hooks, e.g. `running stop hooks… 0/6`. */
const HOOKS = /hooks…/i

/** How many trailing rendered rows carry the status line. */
export const SUB_STATUS_TAIL_ROWS = 6

// ── Codex ───────────────────────────────────────────────────────────────────
// Codex is easier than Claude and must not go through Claude's rules: its
// status bar carries a NAMED state, so there is nothing to infer.
//
//   gpt-5.6-sol high · ~/dev/proj · gpt-5.6-sol · high · Working · Workspace · …
//
// Captured 2026-08-12 against codex-cli 0.147.0: a turn walks Ready → Working
// → Ready, and no other state appeared. So Codex reports `working` / `idle`
// only — it never distinguishes thinking from streaming, and claiming
// otherwise would be invention.
//
// Running Codex through Claude's rules is not merely imprecise, it latches:
// `• Working (5s • esc to interrupt)` satisfies Claude's WORKING marker, while
// Codex paints no `<verb> for <N>s` line, so DONE never fires and the label
// sticks on `working` for the rest of the session.

/** The bar's ` · ` separator identifies it among the tail rows. */
const CODEX_BAR_SEPARATOR = ' · '

/**
 * The state is a whole FIELD of the bar, so compare fields exactly rather than
 * searching the line. The project path is a field of that same bar, and a
 * substring or even word-boundary search would let a directory named
 * `Working-copy` drive the label; `~/dev/Working-copy` can never be *equal* to
 * `Working`.
 *
 * A bar too narrow to fit the state truncates it ("Read…"), which matches
 * nothing and holds the previous value — the safe direction.
 */
const CODEX_WORKING_FIELD = 'Working'
const CODEX_READY_FIELD = 'Ready'
/** MCP servers still loading. A boot, not a turn — so it claims nothing. */
const CODEX_STARTING_FIELD = 'Starting'

function codexStatusFields(tailLines: readonly string[]): string[] | null {
  // Last row carrying the separator, not simply the last non-empty row: mid
  // turn the composer (`› Reply with exactly: hello`) is repainted after the
  // bar and is transiently the last row, which would read as "no bar".
  for (let i = tailLines.length - 1; i >= 0; i--) {
    const line = tailLines[i]
    if (line.includes(CODEX_BAR_SEPARATOR)) {
      return line.split(CODEX_BAR_SEPARATOR).map((f) => f.trim())
    }
  }
  return null
}

function deriveCodexSubStatus(
  tailLines: readonly string[],
  prev: AgentSubStatus,
): AgentSubStatus {
  const fields = codexStatusFields(tailLines)
  // No bar on screen — a gate dialog replaced it, or the frame is torn.
  if (fields === null) return prev
  if (fields.includes(CODEX_WORKING_FIELD)) return 'working'
  if (fields.includes(CODEX_READY_FIELD)) return 'idle'
  if (fields.includes(CODEX_STARTING_FIELD)) return 'unknown'
  return prev
}

/**
 * @param tailLines the last few *rendered* rows, unfiltered — the status line
 *   is exactly the chrome `VirtualTerminal.getLines()` strips, so pass raw rows.
 * @param prev the previous result, held through torn repaints.
 * @param provider which agent painted the screen. Anything that is not Codex
 *   is read with Claude's rules, which is also the safe default for an unknown
 *   provider: they key off Claude-specific glyphs and degrade to `unknown`.
 */
export function deriveAgentSubStatus(
  tailLines: readonly string[],
  prev: AgentSubStatus = 'unknown',
  provider?: ProviderName | string | null,
): AgentSubStatus {
  if (provider === CODEX_CLI_PROVIDER) return deriveCodexSubStatus(tailLines, prev)
  const tail = tailLines.join('\n')
  const working = tail.match(WORKING)
  if (!working) {
    if (DONE.test(tail)) return 'idle'
    return prev
  }
  if (HOOKS.test(tail)) return 'hooks'
  if (TOKENS.test(working[0])) return 'streaming'
  if (/thinking/i.test(working[0])) return 'thinking'
  // `working` means only "a turn is in flight", so it must not overwrite a
  // state already identified positively in this turn. The status line drops
  // its token counter between repaints, which otherwise flickered
  // streaming → working → streaming inside one second. Only `hooks` (above)
  // and `idle` (the turn ending) move off a specific state.
  return prev === 'thinking' || prev === 'streaming' ? prev : 'working'
}

export type AgentSubStatusLabelKey =
  | 'status.thinking'
  | 'status.writing'
  | 'status.hooks'
  | 'status.working'

/**
 * The `sessions` label key refining a `running` badge, or null when there is
 * nothing to refine — `unknown` (no status line parsed yet, or a TUI we no
 * longer recognise) and `idle` (turn over; `status` itself is about to flip)
 * both fall back to the plain label rather than guessing.
 */
export function agentSubStatusLabelKey(sub: AgentSubStatus): AgentSubStatusLabelKey | null {
  switch (sub) {
    case 'thinking':
      return 'status.thinking'
    case 'streaming':
      return 'status.writing'
    case 'hooks':
      return 'status.hooks'
    case 'working':
      return 'status.working'
    default:
      return null
  }
}
