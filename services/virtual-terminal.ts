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
// getLines() an O(total-lines) scan on every frame. Kept well above any TUI
// screen height so absolute cursor positioning (H/f) never hits the trim.
const MAX_ROWS = 10_000

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
  /** Holds a trailing ESC that was at the end of a feed() chunk. */
  private pendingEsc = false
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
    let i = 0
    // If previous chunk ended with a bare ESC, prepend it
    if (this.pendingEsc) {
      this.pendingEsc = false
      if (data.length > 0) {
        i = this.parseEscape(data, 0)
      }
    }
    while (i < data.length) {
      const ch = data[i]

      if (ch === '\x1b') {
        if (i + 1 >= data.length) {
          // ESC at end of chunk — save for next feed
          this.pendingEsc = true
          return
        }
        i = this.parseEscape(data, i + 1)
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
   * The last `count` unfiltered visible rows, newest last. Same rows
   * `getRawLines()` would end with, but it walks the grid backwards and stops,
   * so a caller that only needs the status line does not pay an O(MAX_ROWS)
   * join on every frame.
   */
  getTailLines(count: number): string[] {
    const out: string[] = []
    for (let i = this.grid.length - 1; i >= 0 && out.length < count; i--) {
      const line = this.grid[i].join('').trimEnd()
      if (line.length === 0 || BOX_BORDER_RE.test(line)) continue
      out.push(line)
    }
    return out.reverse()
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
    this.pendingEsc = false
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

  private parseEscape(data: string, i: number): number {
    if (i >= data.length) return i

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
      // Truncated OSC — count as uncertain
      this.truncatedEscapeCount++
      return i
    }

    // DCS / SOS / PM / APC — skip until ST when present; otherwise mark unsupported
    if (data[i] === 'P' || data[i] === 'X' || data[i] === '^' || data[i] === '_') {
      const start = i
      i++
      while (i < data.length) {
        if (data[i] === '\x1b' && i + 1 < data.length && data[i + 1] === '\\') return i + 2
        if (data[i] === '\x07') return i + 1
        i++
      }
      this.unsupportedSequenceCount++
      this.truncatedEscapeCount++
      return start + 1
    }

    // Single-character escape (ESC M, ESC 7, ESC 8, etc.) — skip
    return i + 1
  }

  private parseCSI(data: string, i: number): number {
    let params = ''
    while (i < data.length && /[0-9;?>=<:]/.test(data[i])) {
      params += data[i]
      i++
    }
    while (i < data.length && data.charCodeAt(i) >= 0x20 && data.charCodeAt(i) <= 0x2f) {
      i++
    }
    if (i >= data.length) {
      this.truncatedEscapeCount++
      return i
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
        this.row = Math.max(0, this.row - n)
        break
      case 'B':
        this.row += n
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
        this.row = Math.max(0, (args[0] || 1) - 1)
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
