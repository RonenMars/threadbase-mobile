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

  /** Feed a chunk of raw terminal data. Can be called incrementally. */
  feed(data: string): void {
    let i = 0
    while (i < data.length) {
      const ch = data[i]

      if (ch === '\x1b') {
        i = this.parseEscape(data, i + 1)
      } else if (ch === '\n') {
        this.row++
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

  /** Extract visible lines (non-empty, trimmed). */
  getLines(): string[] {
    return this.grid
      .map((chars) => chars.join('').trimEnd())
      .filter((line) => line.length > 0)
  }

  /** Reset terminal state. */
  reset(): void {
    this.grid = [[]]
    this.row = 0
    this.col = 0
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
    // Collect parameter bytes: digits, semicolons, question mark
    while (i < data.length && /[0-9;?]/.test(data[i])) {
      params += data[i]
      i++
    }
    // The next character is the command
    if (i >= data.length) return i
    const cmd = data[i]
    i++

    this.handleCSI(params, cmd)
    return i
  }

  private handleCSI(params: string, cmd: string): void {
    const args = params.split(';').map((s) => parseInt(s, 10) || 0)
    const n = args[0] || 1

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
      // SGR (m), cursor show/hide (h/l), etc. — ignore
    }
  }

  private ensureRow(row: number): void {
    while (this.grid.length <= row) {
      this.grid.push([])
    }
  }
}
