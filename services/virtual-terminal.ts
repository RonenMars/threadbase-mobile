/**
 * Minimal VT100 terminal emulator.
 * Processes raw PTY data (ANSI escape sequences, cursor movement, screen
 * clearing) and maintains a 2D character grid. Produces clean text lines
 * suitable for display in a non-terminal context.
 */
export class VirtualTerminal {
  private grid: string[][] = [[]]
  private row = 0
  private col = 0
  /** Holds a trailing ESC that was at the end of a feed() chunk. */
  private pendingEsc = false

  /** Feed a chunk of raw terminal data. Can be called incrementally. */
  feed(data: string): void {
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
        // Fill with spaces up to tab stop
        this.ensureRow(this.row)
        while (this.col < tabStop) {
          this.putChar(' ')
        }
        i++
      } else if (ch.charCodeAt(0) < 32 || ch === '\x7f') {
        // Skip other control characters
        i++
      } else {
        this.ensureRow(this.row)
        this.putChar(ch)
        i++
      }
    }
  }

  /** Extract visible lines, filtering Claude Code TUI chrome.
   *  Informed by tweakcc (MIT) knowledge of Claude Code's UI structure:
   *  - Input border box (round border style with ─ chars)
   *  - Startup banner / "Clawd" ASCII art (▛███▜)
   *  - Thinker/spinner symbols (·✢*✳✶✻✽ and braille patterns)
   *  - Status line (model info, prompt indicator, token counts)
   *  - Decorative separators (box-drawing characters)
   */
  getLines(): string[] {
    return this.grid
      .map((chars) => chars.join('').trimEnd())
      .filter((line) => {
        if (line.length === 0) return false
        const trimmed = line.trim()

        // --- Decorative separators ---
        // Lines made entirely of box-drawing, block elements, or whitespace
        const stripped = line.replace(/[\s=\-─━═│┃┌┐└┘├┤┬┴┼╭╮╯╰╱╲\u2500-\u257F\u2580-\u259F]/g, '')
        if (stripped.length === 0) return false
        // Banner borders like "╭─ Claude Code v2.1.185 ────" survive the separator
        // check because text remains after stripping box chars (incl. spaces) — match
        // the compacted form "ClaudeCodev..." as well as the spaced form.
        const strippedTrimmed = stripped.trim()
        if (/^Claude\s*Code\s*v\d/.test(strippedTrimmed)) return false
        if (/^Welcome\s*back/.test(strippedTrimmed)) return false

        // --- Startup banner / Clawd ASCII art ---
        if (/[▛▜▙▟███]{3,}/.test(trimmed)) return false
        if (/Welcome to Claude Code/.test(trimmed)) return false
        // v2.x greeting and version line
        if (/^Welcome back\b/.test(trimmed)) return false
        if (/^Claude Code\s+v\d/.test(trimmed)) return false

        // --- Thinker / spinner symbols ---
        // Claude Code uses: · ✢ * ✳ ✶ ✻ ✽ and braille spinners (from tweakcc defaultSettings)
        if (/^[·✢*✳✶✻✽⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏◐◑◒◓\s]+$/.test(trimmed)) return false
        // Sautéed/cooking timer lines (thinker format): "✱ Sautéed for 3m 5s"
        if (/^[✱✳✶✻✽*·✢]\s+Saut[ée]+d\s+for\s/.test(trimmed)) return false
        // Thinking verb + ellipsis: "Thinking…", "Computing…" (180+ verbs from tweakcc)
        if (/^[·✢*✳✶✻✽]\s+\w+ing…\s*$/.test(trimmed)) return false
        if (/^\w+ing…\s*$/.test(trimmed)) return false

        // --- Status line / prompt chrome ---
        // Prompt indicator bare (❯ 0q) AND prompt echo/suggestions ("> Hi", "> Try ...")
        if (/^[❯›>]\s/.test(trimmed) || /^[❯›>]$/.test(trimmed)) return false
        // Capybara mascot (Bramble)
        if (/\(●oo●\)/.test(trimmed) || /\(◐oo◐\)/.test(trimmed)) return false
        // Model info line: "Opus 4.6 (1M context) | ~/path..." or compact "Sonnet 4.6 | ~/path time | ⚓N"
        if (/^(Opus|Sonnet|Haiku)\s+\d+\.\d+[\s(|]/.test(trimmed)) return false
        // "Claude" model variant: "Claude 4.6 Opus..."
        if (/^Claude\s+\d+\.\d+\s+(Opus|Sonnet|Haiku)/.test(trimmed)) return false
        // Bare pipe fragment: "| ~/Desktop/dev/apps |"
        if (/^\|/.test(trimmed)) return false
        // Accept edits / update available / mode chrome
        if (/^[►▶❯]{1,2}\s*(accept edits|auto|plan)\b/i.test(trimmed)) return false
        if (/Update available!/.test(trimmed)) return false
        // Run: command status hints
        if (/^Run:\s+\S/.test(trimmed)) return false
        // Token/cost display: "$0.02  12.3k tokens"
        if (/^\$[\d.]+\s+[\d.]+[kmb]?\s+tokens?$/i.test(trimmed)) return false
        // Medium/high effort indicators
        if (/^[◑◐●]\s*(low|medium|high)\b/i.test(trimmed)) return false
        // Hotkey hints
        if (/\(shift\+tab to cycle\)/.test(trimmed)) return false
        if (/\(ctrl\+o to expand\)/.test(trimmed)) return false
        // Compact line expand hints: "... +14 lines (ctrl+o to expand)"
        if (/^\.\.\.\s+\+\d+\s+lines\s/.test(trimmed)) return false
        // Rate limit indicators (from tweakcc suppressRateLimitOptions)
        if (/rate limit/i.test(trimmed) && /\d+\s*(req|request|min)/i.test(trimmed)) return false

        // --- Agent-status / boot-tip chrome (sub-agent runs, first-run tips) ---
        // Backgrounded sub-agent status: "Backgrounded agent Explore (running)",
        // "Explore … came to rest", and the transient "Invalid tool parameters"
        // banner the orchestrator prints mid-turn.
        if (/^Backgrounded agent\b/i.test(trimmed)) return false
        if (/\b(came to rest|is running|backgrounded)\b/i.test(trimmed) && /^(Explore|Plan|Task|Agent)\b/.test(trimmed)) return false
        if (/^Invalid tool parameters\b/i.test(trimmed)) return false
        // First-run boot tips block: "Tips for getting started", "Tip:" lines.
        if (/^Tips? for getting started/i.test(trimmed)) return false

        // --- Input border box remnants ---
        // Lines that are just the border corners/edges after stripping
        if (/^[╭╮╯╰│─┌┐└┘┤├]+$/.test(trimmed)) return false

        return true
      })
  }

  /** Reset terminal state. */
  reset(): void {
    this.grid = [[]]
    this.row = 0
    this.col = 0
    this.pendingEsc = false
  }

  private putChar(ch: string): void {
    const line = this.grid[this.row]
    // Extend line with spaces if cursor is past the end
    while (line.length <= this.col) {
      line.push(' ')
    }
    line[this.col] = ch
    this.col++
  }

  private parseEscape(data: string, i: number): number {
    if (i >= data.length) return i

    if (data[i] === '[') {
      // CSI sequence: ESC [ params cmd
      return this.parseCSI(data, i + 1)
    }

    if (data[i] === ']') {
      // OSC sequence: ESC ] ... BEL/ST — skip entirely
      i++
      while (i < data.length) {
        if (data[i] === '\x07') return i + 1
        if (data[i] === '\x1b' && i + 1 < data.length && data[i + 1] === '\\') return i + 2
        i++
      }
      return i
    }

    // Single-character escape (ESC M, ESC 7, ESC 8, etc.) — skip
    return i + 1
  }

  private parseCSI(data: string, i: number): number {
    let params = ''
    // Collect parameter bytes (ECMA-48 0x30-0x3F): digits, semicolons, and
    // private-use prefixes like ? (DEC), > (xterm), < = : etc.
    while (i < data.length && /[0-9;?>=<:]/.test(data[i])) {
      params += data[i]
      i++
    }
    // Skip intermediate bytes (ECMA-48 0x20-0x2F): space, !, ", #, $, etc.
    while (i < data.length && data.charCodeAt(i) >= 0x20 && data.charCodeAt(i) <= 0x2f) {
      i++
    }
    // The next character is the final byte (command)
    if (i >= data.length) return i
    const cmd = data[i]
    i++

    this.handleCSI(params, cmd)
    return i
  }

  private handleCSI(params: string, cmd: string): void {
    const args = params.split(';').map((s) => parseInt(s, 10) || 0)
    // Default to 1 for most commands, but J/K use 0 as a valid mode
    const n = (cmd === 'J' || cmd === 'K') ? args[0] : (args[0] || 1)

    switch (cmd) {
      case 'A': // Cursor up
        this.row = Math.max(0, this.row - n)
        break
      case 'B': // Cursor down
        this.row += n
        this.ensureRow(this.row)
        break
      case 'C': // Cursor forward
        this.col += n
        break
      case 'D': // Cursor back
        this.col = Math.max(0, this.col - n)
        break
      case 'G': // Cursor horizontal absolute
        this.col = Math.max(0, n - 1)
        break
      case 'H': // Cursor position (row;col)
      case 'f':
        this.row = Math.max(0, (args[0] || 1) - 1)
        this.col = Math.max(0, (args[1] || 1) - 1)
        this.ensureRow(this.row)
        break
      case 'J': // Erase in display
        if (n === 2 || n === 3) {
          // Clear entire screen
          this.grid = [[]]
          this.row = 0
          this.col = 0
        } else if (n === 0) {
          // Clear from cursor to end of screen
          if (this.grid[this.row]) {
            this.grid[this.row].length = this.col
          }
          this.grid.length = this.row + 1
        }
        break
      case 'K': { // Erase in line
        const mode = args[0] || 0
        this.ensureRow(this.row)
        if (mode === 0) {
          // Clear from cursor to end of line
          this.grid[this.row].length = this.col
        } else if (mode === 1) {
          // Clear from start of line to cursor
          for (let c = 0; c <= this.col && c < this.grid[this.row].length; c++) {
            this.grid[this.row][c] = ' '
          }
        } else if (mode === 2) {
          // Clear entire line
          this.grid[this.row] = []
        }
        break
      }
      case 'L': // Insert lines
        this.ensureRow(this.row)
        for (let j = 0; j < n; j++) {
          this.grid.splice(this.row, 0, [])
        }
        break
      case 'M': // Delete lines
        this.grid.splice(this.row, n)
        this.ensureRow(this.row)
        break
      case 'S': // Scroll Up — shift content up n lines
        this.grid.splice(0, Math.min(n, this.grid.length))
        this.ensureRow(this.row)
        break
      case 'T': // Scroll Down — insert n blank lines at top
        for (let j = 0; j < n; j++) {
          this.grid.unshift([])
        }
        this.row += n
        break
      case 'r': // DECSTBM — Set Scroll Region (ignored, just track)
        break
      // SGR (m), cursor show/hide (h/l), etc. — ignore
    }
  }

  private ensureRow(row: number): void {
    while (this.grid.length <= row) {
      this.grid.push([])
    }
  }
}
