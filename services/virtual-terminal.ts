/**
 * Minimal VT100 terminal emulator.
 * Processes raw PTY data (ANSI escape sequences, cursor movement, screen
 * clearing) and maintains a 2D character grid. Produces clean text lines
 * suitable for display in a non-terminal context.
 */
import type { ProviderName } from '@/constants/providers'
import {
  getTerminalChromeFilter,
  keepTranscriptLine,
  type TerminalChromeFilter,
} from '@/lib/terminalChrome'
import { parseConfidenceFromCounters, type ParseConfidence } from '@/lib/renderConfidence'

// Hard cap on retained rows. The rendered view only ever shows the last
// `terminalMaxLines` (default 5000), so anything older is dead weight — a
// long append-only session would otherwise grow the grid forever and make
// getLines() an O(total-lines) scan on every frame.
const MAX_ROWS = 10_000
const MAX_PENDING_ESCAPE_BYTES = 8_192

// The TUI paints against a fixed-geometry screen — the streamer spawns every
// PTY at 120x40 (tb-streamer src/pty-manager.ts:42-43 and
// src/codex-pty-runner.ts:36-37, whose own comment notes the render terminal
// MUST match so absolute cursor moves resolve to the same coordinates). So
// absolute row addressing targets that VIEWPORT, not the whole scrollback grid.
//
// The viewport origin is DERIVED, never stored — `grid.length` is the single
// source of truth. Do not introduce a `viewTop` field: a stored origin has to
// be maintained correctly through every splice, and each grid mutation becomes
// a way to desynchronise it. Derived state is self-correcting, and reset()
// already restores `grid = [[]]`, which is the origin.
const VIEWPORT_ROWS = 40

// CSI finals we intentionally ignore (SGR, modes, reports) without counting
// as unsupported — they are expected noise in agent TUIs.
const IGNORED_CSI = new Set(['m', 'h', 'l', 'n', 't', 'q', 'c', 's', 'u', 'p'])

const HANDLED_CSI = new Set(['A', 'B', 'C', 'D', 'G', 'H', 'f', 'J', 'K', 'L', 'M', 'S', 'T', 'r'])

// Whole-line box-drawing borders (e.g. the status-bar box Claude Code draws)
// — box-drawing/block glyphs and whitespace only, nothing else.
const BOX_BORDER_RE = /^[\s─-╿▀-▟]+$/

export class VirtualTerminal {
  private grid: string[][] = [[]]
  private row = 0
  private col = 0

  /** Top of the TUI's viewport within the scrollback grid. Derived, never stored. */
  private viewportTop(): number {
    return Math.max(0, this.grid.length - VIEWPORT_ROWS)
  }

  /** Incomplete escape sequence retained across WebSocket frame boundaries. */
  private pendingEscape = ''
  private chromeFilter: TerminalChromeFilter = getTerminalChromeFilter('claude-code')
  private rawMode = false
  private unsupportedSequenceCount = 0
  private truncatedEscapeCount = 0
  private bytesFed = 0

  setProvider(provider?: ProviderName | string | null): void {
    this.chromeFilter = getTerminalChromeFilter(provider, { raw: this.rawMode })
  }

  /** When true, skip provider chrome filters and return nearly-raw grid lines. */
  setRawMode(raw: boolean): void {
    this.rawMode = raw
    this.chromeFilter = getTerminalChromeFilter(null, { raw })
  }

  /** Feed a chunk of raw terminal data. Can be called incrementally. */
  feed(data: string): void {
    this.bytesFed += data.length
    const input = this.pendingEscape + data
    this.pendingEscape = ''
    let i = 0
    while (i < input.length) {
      const ch = input[i]

      if (ch === '\x1b') {
        const next = this.parseEscape(input, i + 1)
        if (next === null) {
          this.pendingEscape = input.slice(i)
          if (this.pendingEscape.length > MAX_PENDING_ESCAPE_BYTES) {
            this.pendingEscape = ''
            this.truncatedEscapeCount++
          }
          return
        }
        i = next
      } else if (ch === '\n') {
        this.row++
        this.col = 0
        this.ensureRow(this.row)
        i++
      } else if (ch === '\r') {
        this.col = 0
        i++
      } else if (ch === '\t') {
        const tabStop = (Math.floor(this.col / 8) + 1) * 8
        this.ensureRow(this.row)
        while (this.col < tabStop) {
          this.putChar(' ')
        }
        i++
      } else if (ch.charCodeAt(0) < 32 || ch === '\x7f') {
        i++
      } else {
        this.ensureRow(this.row)
        this.putChar(ch)
        i++
      }
    }
  }

  /**
   * Unfiltered visible lines (empty rows and box-drawing border rows
   * dropped). Used for raw fallback UI. Only whole border rows (e.g. the
   * status-bar box drawn by Claude Code's TUI) are dropped — a content line
   * that merely contains a box-drawing glyph is kept as-is.
   */
  getRawLines(): string[] {
    return this.grid
      .map((chars) => chars.join('').trimEnd())
      .filter((line) => line.length > 0 && !BOX_BORDER_RE.test(line))
  }

  /**
   * Extract visible lines, applying the active provider chrome filter unless
   * raw mode is on.
   */
  getLines(): string[] {
    return this.getRawLines().filter((line) => keepTranscriptLine(line, this.chromeFilter))
  }

  getParseConfidence(): ParseConfidence {
    return parseConfidenceFromCounters({
      unsupportedSequenceCount: this.unsupportedSequenceCount,
      truncatedEscapeCount: this.truncatedEscapeCount,
      bytesFed: this.bytesFed,
    })
  }

  getParseStats(): {
    unsupportedSequenceCount: number
    truncatedEscapeCount: number
    bytesFed: number
  } {
    return {
      unsupportedSequenceCount: this.unsupportedSequenceCount,
      truncatedEscapeCount: this.truncatedEscapeCount,
      bytesFed: this.bytesFed,
    }
  }

  /** Reset terminal state. */
  reset(): void {
    this.grid = [[]]
    this.row = 0
    this.col = 0
    this.pendingEscape = ''
    this.unsupportedSequenceCount = 0
    this.truncatedEscapeCount = 0
    this.bytesFed = 0
  }

  private putChar(ch: string): void {
    const line = this.grid[this.row]
    while (line.length <= this.col) {
      line.push(' ')
    }
    line[this.col] = ch
    this.col++
  }

  private parseEscape(data: string, i: number): number | null {
    if (i >= data.length) return null

    if (data[i] === '[') {
      return this.parseCSI(data, i + 1)
    }

    if (data[i] === ']') {
      i++
      while (i < data.length) {
        if (data[i] === '\x07') return i + 1
        if (data[i] === '\x1b' && i + 1 < data.length && data[i + 1] === '\\') return i + 2
        i++
      }
      return null
    }

    // DCS / SOS / PM / APC — skip until ST when present; otherwise mark unsupported
    if (data[i] === 'P' || data[i] === 'X' || data[i] === '^' || data[i] === '_') {
      i++
      while (i < data.length) {
        if (data[i] === '\x1b' && i + 1 < data.length && data[i + 1] === '\\') return i + 2
        if (data[i] === '\x07') return i + 1
        i++
      }
      return null
    }

    // ESC I…I F (ECMA-48): intermediate bytes in 0x20–0x2F, then one final byte.
    // Claude Code emits `ESC ( B` (designate ASCII into G0) after every keystroke
    // write, so skipping only the `(` left the `B` to be drawn as text — a stray
    // glyph at the cursor, i.e. on the prompt row, until the next repaint of that
    // row wiped it.
    if (data[i] >= '\x20' && data[i] <= '\x2f') {
      while (i < data.length && data[i] >= '\x20' && data[i] <= '\x2f') i++
      if (i >= data.length) return null
      return i + 1
    }

    // Single-character escape (ESC M, ESC 7, ESC 8, etc.) — skip
    return i + 1
  }

  private parseCSI(data: string, i: number): number | null {
    let params = ''
    while (i < data.length && /[0-9;?>=<:]/.test(data[i])) {
      params += data[i]
      i++
    }
    while (i < data.length && data.charCodeAt(i) >= 0x20 && data.charCodeAt(i) <= 0x2f) {
      i++
    }
    if (i >= data.length) {
      return null
    }
    const cmd = data[i]
    i++

    this.handleCSI(params, cmd)
    return i
  }

  private handleCSI(params: string, cmd: string): void {
    const args = params.split(';').map((s) => parseInt(s, 10) || 0)
    const n = (cmd === 'J' || cmd === 'K') ? args[0] : (args[0] || 1)

    if (!HANDLED_CSI.has(cmd) && !IGNORED_CSI.has(cmd)) {
      this.unsupportedSequenceCount++
      return
    }

    switch (cmd) {
      case 'A':
        // Clamped to the top of the viewport, not row 0: cursor-up from the
        // footer region would otherwise walk into scrollback and the next
        // putChar would overwrite transcript. Note this can move the cursor
        // *forward* when row is already above viewportTop (reachable via CSI L,
        // which grows the grid at an interior row) — that lands writes on the
        // screen instead of in scrollback, which is the intent, not an
        // off-by-one.
        this.row = Math.max(this.viewportTop(), this.row - n)
        break
      case 'B':
        // Clamped to the viewport bottom so a cursor move can never grow the
        // grid — growth mid-frame shifts the derived origin, and a later
        // absolute move in the same frame then lands somewhere else.
        this.row = Math.min(this.row + n, this.viewportTop() + VIEWPORT_ROWS - 1)
        this.ensureRow(this.row)
        break
      case 'C':
        this.col += n
        break
      case 'D':
        this.col = Math.max(0, this.col - n)
        break
      case 'G':
        this.col = Math.max(0, n - 1)
        break
      case 'H':
      case 'f':
        // Clamped to the screen, as a real terminal does. This is what keeps
        // viewportTop() safe to read before ensureRow(): the target is at most
        // (grid.length - 40) + 39 = grid.length - 1 whenever the grid is at
        // least a screen tall, so CUP can never extend the grid and invalidate
        // the origin it just read. Unclamped, a stray out-of-range row (the
        // HTTP fallback can start mid-escape) appends a screenful of blanks
        // each time and eventually evicts real transcript through MAX_ROWS.
        this.row =
          this.viewportTop() + Math.min(Math.max(0, (args[0] || 1) - 1), VIEWPORT_ROWS - 1)
        this.col = Math.max(0, (args[1] || 1) - 1)
        this.ensureRow(this.row)
        break
      case 'J':
        if (n === 2 || n === 3) {
          this.grid = [[]]
          this.row = 0
          this.col = 0
        } else if (n === 0) {
          if (this.grid[this.row]) {
            this.grid[this.row].length = this.col
          }
          this.grid.length = this.row + 1
        }
        break
      case 'K': {
        const mode = args[0] || 0
        this.ensureRow(this.row)
        if (mode === 0) {
          this.grid[this.row].length = this.col
        } else if (mode === 1) {
          for (let c = 0; c <= this.col && c < this.grid[this.row].length; c++) {
            this.grid[this.row][c] = ' '
          }
        } else if (mode === 2) {
          this.grid[this.row] = []
        }
        break
      }
      case 'L':
        this.ensureRow(this.row)
        for (let j = 0; j < n; j++) {
          this.grid.splice(this.row, 0, [])
        }
        break
      case 'M':
        this.grid.splice(this.row, n)
        this.ensureRow(this.row)
        break
      case 'S':
        // Destroys the n oldest scrollback rows instead of appending blanks at
        // the viewport bottom. Not a cursor bug — the splice's implicit shift
        // compensates exactly — so it is left alone here; see the follow-up.
        this.grid.splice(0, Math.min(n, this.grid.length))
        this.ensureRow(this.row)
        break
      case 'T':
        for (let j = 0; j < n; j++) {
          this.grid.unshift([])
        }
        this.row += n
        break
      case 'r':
        break
    }
  }

  private ensureRow(row: number): void {
    while (this.grid.length <= row) {
      this.grid.push([])
    }
    if (this.grid.length > MAX_ROWS) {
      const excess = this.grid.length - MAX_ROWS
      this.grid.splice(0, excess)
      this.row = Math.max(0, this.row - excess)
    }
  }
}
