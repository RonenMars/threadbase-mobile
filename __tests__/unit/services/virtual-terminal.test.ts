import { VirtualTerminal } from '@/services/virtual-terminal'

// ── Helpers ──────────────────────────────────────────────────────────────────
const ESC = '\x1b'
const CSI = `${ESC}[`

function feedAndGet(data: string): string[] {
  const vt = new VirtualTerminal()
  vt.feed(data)
  return vt.getLines()
}

// ── VT100 Emulation ─────────────────────────────────────────────────────────
describe('VirtualTerminal – VT100 emulation', () => {
  it('renders plain text lines', () => {
    expect(feedAndGet('hello\nworld')).toEqual(['hello', 'world'])
  })

  it('handles carriage return (overwrites line start)', () => {
    expect(feedAndGet('abcdef\rXY')).toEqual(['XYcdef'])
  })

  it('newline resets column to 0', () => {
    // After \n, next text starts at col 0
    expect(feedAndGet('abc\ndef')).toEqual(['abc', 'def'])
  })

  it('handles tabs as 8-space stops', () => {
    expect(feedAndGet('a\tb')).toEqual(['a       b'])
  })

  it('strips control characters', () => {
    expect(feedAndGet('he\x01ll\x02o')).toEqual(['hello'])
  })

  it('ignores DEL character', () => {
    expect(feedAndGet('he\x7fllo')).toEqual(['hello'])
  })

  // ── Cursor movement ──
  it('cursor up (CSI A) preserves column', () => {
    const vt = new VirtualTerminal()
    vt.feed('line1\nline2\nline3')
    // After line3, cursor at row=2, col=5
    vt.feed(`${CSI}2A`) // up 2 → row 0, col stays 5
    vt.feed('X')
    const lines = vt.getLines()
    // 'line1' is 5 chars, X goes at col 5 → 'line1X'
    expect(lines[0]).toBe('line1X')
  })

  it('cursor down (CSI B) preserves column', () => {
    const vt = new VirtualTerminal()
    vt.feed('line1')
    // After 'line1', cursor at row=0, col=5. CSI 2B → row=2, col=5
    vt.feed(`${CSI}2B`)
    vt.feed('text')
    const lines = vt.getLines()
    expect(lines).toContain('line1')
    // 'text' starts at col 5
    expect(lines.some(l => l.includes('text'))).toBe(true)
  })

  it('cursor forward (CSI C)', () => {
    expect(feedAndGet(`ab${CSI}3Ccd`)).toEqual(['ab   cd'])
  })

  it('cursor back (CSI D)', () => {
    expect(feedAndGet(`abcdef${CSI}3DXY`)).toEqual(['abcXYf'])
  })

  it('cursor horizontal absolute (CSI G)', () => {
    expect(feedAndGet(`abcdef${CSI}3GX`)).toEqual(['abXdef'])
  })

  it('cursor position (CSI H)', () => {
    const vt = new VirtualTerminal()
    vt.feed('aaa\nbbb\nccc')
    vt.feed(`${CSI}2;2HX`)
    expect(vt.getLines()).toEqual(['aaa', 'bXb', 'ccc'])
  })

  // ── Erase ──
  it('erase in display: clear screen (CSI 2J)', () => {
    const vt = new VirtualTerminal()
    vt.feed('line1\nline2')
    vt.feed(`${CSI}2J`)
    vt.feed('fresh')
    expect(vt.getLines()).toEqual(['fresh'])
  })

  it('erase in display: clear to end (CSI 0J)', () => {
    const vt = new VirtualTerminal()
    vt.feed('line1\nline2\nline3')
    vt.feed(`${CSI}2;1H`)
    vt.feed(`${CSI}0J`)
    expect(vt.getLines()).toEqual(['line1'])
  })

  it('erase in line: clear to end (CSI 0K)', () => {
    const vt = new VirtualTerminal()
    vt.feed('hello world')
    vt.feed(`${CSI}6G`)
    vt.feed(`${CSI}0K`)
    expect(vt.getLines()).toEqual(['hello'])
  })

  it('erase in line: clear entire line (CSI 2K)', () => {
    const vt = new VirtualTerminal()
    vt.feed('hello')
    vt.feed(`${CSI}2K`)
    expect(vt.getLines()).toEqual([])
  })

  // ── Scroll ──
  it('scroll up (CSI S)', () => {
    const vt = new VirtualTerminal()
    vt.feed('line1\nline2\nline3')
    vt.feed(`${CSI}1S`)
    expect(vt.getLines()[0]).toBe('line2')
  })

  it('scroll down (CSI T)', () => {
    const vt = new VirtualTerminal()
    vt.feed('line1\nline2')
    vt.feed(`${CSI}1T`)
    const lines = vt.getLines()
    expect(lines).toContain('line1')
    expect(lines).toContain('line2')
  })

  it('ignores scroll region (CSI r) without crashing', () => {
    const vt = new VirtualTerminal()
    vt.feed(`${CSI}1;24r`)
    vt.feed('still works')
    expect(vt.getLines()).toEqual(['still works'])
  })

  // ── Insert/Delete lines ──
  it('delete lines (CSI M)', () => {
    const vt = new VirtualTerminal()
    vt.feed('aaa\nbbb\nccc')
    vt.feed(`${CSI}2;1H`)
    vt.feed(`${CSI}1M`)
    expect(vt.getLines()).toEqual(['aaa', 'ccc'])
  })

  // ── ANSI color stripping ──
  it('strips SGR (color) sequences', () => {
    expect(feedAndGet(`${CSI}31mred${CSI}0m normal`)).toEqual(['red normal'])
  })

  it('strips 256-color sequences', () => {
    expect(feedAndGet(`${CSI}38;5;196mcolored${CSI}0m`)).toEqual(['colored'])
  })

  it('strips RGB color sequences', () => {
    expect(feedAndGet(`${CSI}38;2;255;0;0mred text${CSI}0m`)).toEqual(['red text'])
  })

  // ── OSC sequences ──
  it('strips OSC hyperlinks', () => {
    expect(feedAndGet(`${ESC}]8;;https://example.com${ESC}\\link text${ESC}]8;;${ESC}\\`))
      .toEqual(['link text'])
  })

  it('strips OSC with BEL terminator', () => {
    expect(feedAndGet(`${ESC}]0;window title\x07normal text`))
      .toEqual(['normal text'])
  })

  // ── Incremental feeding ──
  it('handles data split across multiple feed() calls', () => {
    const vt = new VirtualTerminal()
    vt.feed('hel')
    vt.feed('lo ')
    vt.feed('wor')
    vt.feed('ld')
    expect(vt.getLines()).toEqual(['hello world'])
  })

  it('handles ANSI sequences split across feeds', () => {
    const vt = new VirtualTerminal()
    vt.feed(`text${ESC}`)
    vt.feed('[31m')
    vt.feed(`red${ESC}[0m`)
    expect(vt.getLines()).toEqual(['textred'])
  })

  // ── Reset ──
  it('reset() clears all state', () => {
    const vt = new VirtualTerminal()
    vt.feed('some content')
    vt.reset()
    expect(vt.getLines()).toEqual([])
    vt.feed('new content')
    expect(vt.getLines()).toEqual(['new content'])
  })
})

// ── Claude Code TUI Chrome Filtering ────────────────────────────────────────
// Patterns informed by tweakcc (MIT) knowledge of Claude Code's UI structure.
describe('VirtualTerminal – Claude Code TUI chrome filtering', () => {
  // ── Box-drawing separators ──
  it('filters pure box-drawing separator lines', () => {
    expect(feedAndGet('content\n────────────────────\nmore content'))
      .toEqual(['content', 'more content'])
  })

  it('filters lines of dashes/equals', () => {
    expect(feedAndGet('title\n========================\nbody'))
      .toEqual(['title', 'body'])
  })

  it('filters border box corners and edges', () => {
    expect(feedAndGet('╭────────╮')).toEqual([])
    expect(feedAndGet('╰────────╯')).toEqual([])
  })

  it('drops box-drawing border rows from raw lines too', () => {
    const vt = new VirtualTerminal()
    vt.feed('content\n╭────────╮\nmore content\n╰────────╯')
    expect(vt.getRawLines()).toEqual(['content', 'more content'])
  })

  // ── Startup banner / Clawd ──
  it('filters Clawd ASCII art (block elements)', () => {
    expect(feedAndGet('▛███▜\n▙███▟')).toEqual([])
  })

  it('filters "Welcome to Claude Code" banner', () => {
    expect(feedAndGet('Welcome to Claude Code\nActual content'))
      .toEqual(['Actual content'])
  })

  it('filters "Welcome back <name>!" v2.x greeting', () => {
    expect(feedAndGet('Welcome back Ronen!')).toEqual([])
    expect(feedAndGet('Welcome back Ronen!\nActual content')).toEqual(['Actual content'])
  })

  it('filters "Claude Code v<N>" version line', () => {
    expect(feedAndGet('Claude Code v2.1.185')).toEqual([])
  })

  it('filters banner border with embedded version text', () => {
    expect(feedAndGet('╭─ Claude Code v2.1.185 ──────────────────────────')).toEqual([])
  })

  // ── Thinker / Spinner symbols (from tweakcc defaultSettings) ──
  it('filters lines of pure spinner symbols', () => {
    expect(feedAndGet('· ✢ ✳ ✶')).toEqual([])
  })

  it('filters braille spinner patterns', () => {
    expect(feedAndGet('⠋')).toEqual([])
    expect(feedAndGet('⠙⠹⠸')).toEqual([])
  })

  it('filters "Sautéed for" timer lines (with accent)', () => {
    expect(feedAndGet('✱ Sautéed for 3m 5s')).toEqual([])
  })

  it('filters "Sauteed for" timer lines (no accent)', () => {
    expect(feedAndGet('✶ Sauteed for 12s')).toEqual([])
  })

  it('filters thinking verb + ellipsis lines', () => {
    expect(feedAndGet('Thinking…')).toEqual([])
    expect(feedAndGet('Computing…')).toEqual([])
    expect(feedAndGet('✳ Synthesizing…')).toEqual([])
  })

  // ── Status line / prompt chrome ──
  it('filters prompt indicator lines', () => {
    expect(feedAndGet('❯ 0q')).toEqual([])
    expect(feedAndGet('> 2q')).toEqual([])
    expect(feedAndGet('›')).toEqual([])
  })

  it('filters Bramble capybara mascot', () => {
    expect(feedAndGet('(●oo●) Bramble')).toEqual([])
    expect(feedAndGet('(◐oo◐)')).toEqual([])
  })

  it('filters model info lines', () => {
    expect(feedAndGet('Opus 4.6 (1M context) | ~/Desktop/dev/project...')).toEqual([])
    expect(feedAndGet('Sonnet 4.6 (200k context) | ~/code')).toEqual([])
    expect(feedAndGet('Haiku 4.5 (200k context) | ~/test')).toEqual([])
  })

  it('filters compact status bar without (context) suffix', () => {
    expect(feedAndGet('Sonnet 4.6 | ~/Desktop/dev/apps 20:30 | ⚓ 4')).toEqual([])
    expect(feedAndGet('Sonnet 4.6 | ~/Desktop/dev/ai-tools/tb-mobile  main |...')).toEqual([])
  })

  it('filters ghost placeholder suggestions but keeps user transcript lines', () => {
    expect(feedAndGet('> Try "how do I log an error?"')).toEqual([])
    expect(feedAndGet('❯ 0q')).toEqual([])
    // '❯/> <text>' is how Claude Code renders the submitted user message in
    // the transcript — it must survive the chrome filter.
    expect(feedAndGet('> Hi')).toEqual(['> Hi'])
    expect(feedAndGet('❯ Explain the content of this project')).toEqual([
      '❯ Explain the content of this project',
    ])
  })

  it('keeps the user transcript line while dropping surrounding prompt chrome', () => {
    const vt = new VirtualTerminal()
    vt.feed('❯ Explain the content of this project\n')
    vt.feed('❯\n')
    vt.feed('  Fable 5 [Explain project content] │ │ ~/dev/cv  main ✎ │  24.15.0 05:27 | ⚓4\n')
    expect(vt.getLines()).toContain('❯ Explain the content of this project')
    expect(vt.getLines()).not.toContain('❯')
  })

  it('filters bare pipe fragment lines', () => {
    expect(feedAndGet('| ~/Desktop/dev/apps |')).toEqual([])
  })

  it('filters Claude model variant lines', () => {
    expect(feedAndGet('Claude 4.6 Opus (1M context)')).toEqual([])
  })

  it('filters accept edits / mode chrome', () => {
    expect(feedAndGet('►► accept edits on (shift+tab to cycle)')).toEqual([])
    expect(feedAndGet('▶ auto')).toEqual([])
    expect(feedAndGet('▶ plan')).toEqual([])
  })

  it('filters "Update available!" line', () => {
    expect(feedAndGet('Update available!')).toEqual([])
  })

  it('filters backgrounded sub-agent status lines', () => {
    expect(feedAndGet('Backgrounded agent Explore (running)')).toEqual([])
    expect(feedAndGet('Explore … came to rest')).toEqual([])
    expect(feedAndGet('Invalid tool parameters')).toEqual([])
  })

  it('filters the first-run "Tips for getting started" banner', () => {
    expect(feedAndGet('Tips for getting started:')).toEqual([])
  })

  it('filters leaked OSC 777 permission-notify remnants (tmux passthrough)', () => {
    expect(feedAndGet('tmux;]777;notify;Claude Code;Claude needs your permission')).toEqual([])
    expect(feedAndGet(']777;notify;Claude Code;Claude needs your permission')).toEqual([])
    // legitimate gate text must survive
    expect(feedAndGet('Do you want to proceed?')).toEqual(['Do you want to proceed?'])
  })

  it('filters "Run:" status hints', () => {
    expect(feedAndGet('Run: brew...')).toEqual([])
    expect(feedAndGet('Run: npm install')).toEqual([])
  })

  it('filters token/cost display', () => {
    expect(feedAndGet('$0.02  12.3k tokens')).toEqual([])
    expect(feedAndGet('$1.50  100k tokens')).toEqual([])
  })

  it('filters effort indicators', () => {
    expect(feedAndGet('◑ medium')).toEqual([])
    expect(feedAndGet('● high')).toEqual([])
  })

  // Claude only repaints the spinner when it has other output to draw, so the
  // elapsed number freezes at its last painted value and reads as a hung
  // session. Elapsed time is surfaced natively from the session detail instead.
  it('filters the spinner line carrying the live counter', () => {
    expect(feedAndGet('✽ Swirling… (56s · ↑ 3.4k tokens)')).toEqual([])
    expect(feedAndGet('✽ Blanching… (15s · ↓ 271 tokens)')).toEqual([])
    expect(feedAndGet('Swirling… (5s)')).toEqual([])
  })

  it('filters completed-turn timers', () => {
    expect(feedAndGet('✻ Crunched for 3m 17s')).toEqual([])
    expect(feedAndGet('✽ Cogitated for 13s')).toEqual([])
  })

  it('keeps real output that merely looks like a spinner line', () => {
    const keep = [
      'Testing… (this is real output)',
      'Refactoring… (see notes below)',
      'Building the project for 10s of users',
    ]
    for (const line of keep) {
      expect(feedAndGet(line)).toEqual([line])
    }
  })

  it('filters the model status line without a minor version', () => {
    // "Sonnet 5" has no ".x" part, and the separator is a box-drawing pipe.
    expect(feedAndGet('Sonnet 5 │ ~/dev/ai-tools/tb-streamer')).toEqual([])
    expect(feedAndGet('Sonnet 5 [Check local streamer session timeout limits]')).toEqual([])
    expect(feedAndGet('Opus is a great model')).toEqual(['Opus is a great model'])
  })

  it('filters hotkey hints', () => {
    expect(feedAndGet('some text (shift+tab to cycle)')).toEqual([])
    expect(feedAndGet('(ctrl+o to expand)')).toEqual([])
  })

  it('filters compact expand hints', () => {
    expect(feedAndGet('... +14 lines (ctrl+o to expand)')).toEqual([])
  })

  // ── Content preservation ──
  it('preserves actual code diff output', () => {
    const lines = feedAndGet([
      'diff --git a/src/app.ts b/src/app.ts',
      '--- a/src/app.ts',
      '+++ b/src/app.ts',
      '@@ -10,3 +10,4 @@',
      ' const x = 1',
      '+const y = 2',
      '-const z = 3',
    ].join('\n'))
    expect(lines).toContain('diff --git a/src/app.ts b/src/app.ts')
    expect(lines).toContain('+const y = 2')
    expect(lines).toContain('-const z = 3')
  })

  it('preserves bash command output', () => {
    const lines = feedAndGet([
      'Bash(npm test)',
      '  PASS src/app.test.ts',
      '  Tests: 3 passed, 3 total',
    ].join('\n'))
    expect(lines.length).toBe(3)
  })

  it('preserves assistant text messages', () => {
    const lines = feedAndGet(
      'I\'ll fix the bug by updating the handler.\n\nHere\'s the change:'
    )
    expect(lines).toContain("I'll fix the bug by updating the handler.")
    expect(lines).toContain("Here's the change:")
  })

  it('preserves error messages', () => {
    const lines = feedAndGet('Error: Cannot find module \'@/hooks/useAuth\'')
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain('Cannot find module')
  })

  it('preserves lines containing filtered words in real context', () => {
    expect(feedAndGet('Update the database schema')).toEqual(['Update the database schema'])
    expect(feedAndGet('Running the test suite now')).toEqual(['Running the test suite now'])
  })

  it('does not over-filter lines with dashes in real content', () => {
    // A line with dashes as part of content (e.g., command flags) should stay
    expect(feedAndGet('npm install --save-dev jest')).toEqual(['npm install --save-dev jest'])
  })
})

// ── Realistic Claude Code PTY streams ───────────────────────────────────────
describe('VirtualTerminal – realistic Claude Code PTY data', () => {
  it('handles a typical session with colors + cursor overwrite', () => {
    const vt = new VirtualTerminal()
    vt.feed(`${CSI}38;2;100;200;150mI'll read the file.${CSI}0m\n`)
    vt.feed(`${CSI}38;2;140;140;140m✱ Sautéed for 2s${CSI}0m\n`)
    // Cursor up 2, erase, write new content
    vt.feed(`${CSI}2A${CSI}2K`)
    vt.feed(`${CSI}38;2;100;200;150mFile looks good.${CSI}0m`)

    const lines = vt.getLines()
    expect(lines).toContain('File looks good.')
    expect(lines.every(l => !l.includes('Sautéed'))).toBe(true)
  })

  it('handles tool use blocks with ANSI formatting', () => {
    const data = [
      `${CSI}1;34m◻ Read${CSI}0m(src/index.ts)`,
      `  1 │ import express from 'express'`,
      `  2 │ const app = express()`,
      `${CSI}1;34m◻ Edit${CSI}0m(src/index.ts)`,
      `  1 + import cors from 'cors'`,
    ].join('\n')

    const lines = feedAndGet(data)
    expect(lines.length).toBe(5)
    expect(lines[0]).toContain('Read')
    expect(lines[3]).toContain('Edit')
  })

  it('handles screen clear followed by fresh content', () => {
    const vt = new VirtualTerminal()
    vt.feed('old stale content\nmore old content')
    vt.feed(`${CSI}2J${CSI}1;1H`)
    vt.feed('New session started\nWorking on task')
    expect(vt.getLines()).toEqual(['New session started', 'Working on task'])
  })

  it('handles status bar redraw cycle (cursor up, erase, rewrite)', () => {
    const vt = new VirtualTerminal()
    vt.feed('Processing files...\n')
    vt.feed('✳ Thinking…\n')
    // Redraw: cursor up, erase, new status
    vt.feed(`${CSI}1A${CSI}2K`)
    vt.feed('✶ Computing…\n')
    // Final: replace spinner with result
    vt.feed(`${CSI}1A${CSI}2K`)
    vt.feed('Done processing.\n')

    const lines = vt.getLines()
    expect(lines).toContain('Processing files...')
    expect(lines).toContain('Done processing.')
    expect(lines.every(l => !l.includes('Thinking'))).toBe(true)
    expect(lines.every(l => !l.includes('Computing'))).toBe(true)
  })

  it('handles a full Claude Code chrome bottom bar', () => {
    const bar = [
      '─────────────────────────────────────────────',
      '   ◐◑◒                                       ',
      '❯ 0q',
      '─────────────────────────────────────────────',
      '─────────────────────────────────────────────',
      'Opus 4.6 (1M context) | ~/Desktop/dev/proj...  ◑ medium',
      '►► accept edits on (shift+tab to cycle)',
      'Run: brew...                    (●oo●) Bramble',
    ].join('\n')

    expect(feedAndGet(bar)).toEqual([])
  })

  it('preserves content alongside filtered chrome', () => {
    const data = [
      '────────────────────────────────',
      '◻ Read(package.json)',
      '  "name": "my-app",',
      '  "version": "1.0.0"',
      '────────────────────────────────',
      '✱ Sautéed for 5s',
      'The package.json looks correct.',
      '❯ 0q',
      '(●oo●) Bramble',
    ].join('\n')

    const lines = feedAndGet(data)
    expect(lines).toEqual([
      '◻ Read(package.json)',
      '  "name": "my-app",',
      '  "version": "1.0.0"',
      'The package.json looks correct.',
    ])
  })

  it('handles multiple screen clears (session with several tasks)', () => {
    const vt = new VirtualTerminal()
    // First task
    vt.feed('Working on task 1\n')
    vt.feed('Done with task 1\n')
    // Screen clear between tasks
    vt.feed(`${CSI}2J${CSI}1;1H`)
    // Second task
    vt.feed('Working on task 2\n')
    vt.feed('Done with task 2\n')

    const lines = vt.getLines()
    // Only second task visible after screen clear
    expect(lines).toEqual(['Working on task 2', 'Done with task 2'])
  })

  it('handles \r\n line endings (Windows-style)', () => {
    expect(feedAndGet('line1\r\nline2\r\nline3')).toEqual(['line1', 'line2', 'line3'])
  })
})

// ── Scrollback cap ───────────────────────────────────────────────────────────
describe('VirtualTerminal – scrollback cap', () => {
  const MAX_ROWS = 10_000

  it('bounds the grid for an append-only stream and keeps the newest lines', () => {
    const vt = new VirtualTerminal()
    const total = MAX_ROWS + 5000
    // Append-only feed (no screen clears) — the unbounded-growth case.
    for (let i = 0; i < total; i++) vt.feed(`line ${i}\n`)

    const lines = vt.getLines()
    expect(lines.length).toBeLessThanOrEqual(MAX_ROWS)
    // The most recent line survives; the oldest is trimmed away.
    expect(lines).toContain(`line ${total - 1}`)
    expect(lines).not.toContain('line 0')
  })
})

// ── Viewport-relative cursor positioning ─────────────────────────────────────
// A TUI paints absolute cursor moves against a fixed 40-row screen, not against
// the whole append-only grid. Every test here needs a grid TALLER than that
// screen — the pre-existing cursor tests all run on 1-3 rows, where the viewport
// origin is 0 and the distinction cannot be observed. That was the coverage hole.
describe('VirtualTerminal – viewport-relative cursor positioning', () => {
  const SEED_ROWS = 200
  // The real footer from a capture. Matters that it is this exact shape:
  // lib/terminalChrome.ts filters a correctly-placed footer out of getLines(),
  // so a "footer landed at the bottom" assertion written against getLines()
  // fails AFTER the fix, for the wrong reason. Assert on getRawLines() instead.
  const FOOTER = '✻ Brewing… (12s · ↑ 3.4k tokens)'

  /**
   * The production trigger: `terminal_replay` carries up to 200 already-rendered,
   * escape-free rows which `feedHistory` joins with `\n`
   * (hooks/useTerminalStream.ts:202) before the first live frame arrives.
   * The trailing newline leaves the cursor on a fresh bottom row, which is where
   * a 40-row screen's last line actually is.
   */
  function seededFromReplay(): VirtualTerminal {
    const vt = new VirtualTerminal()
    const rows = Array.from({ length: SEED_ROWS }, (_, i) => `transcript line ${i}`)
    vt.feed(`${rows.join('\n')}\n`)
    return vt
  }

  it('lands a footer repaint at the bottom of the screen, not mid-transcript', () => {
    const vt = seededFromReplay()
    const before = vt.getRawLines().length

    // Assert the invariant on the MOVE alone. Once text is painted the count
    // legitimately rises, because the move targets the blank bottom row and
    // getRawLines() only starts reporting that row once it has content.
    vt.feed(`${CSI}40;1H`)
    expect(vt.getRawLines().length).toBe(before)

    vt.feed(FOOTER)

    const lines = vt.getLines()
    // Carries the test. On the pre-fix emulator `CSI 40;1H` resolves to grid row
    // 39, so `transcript line 39` is overwritten and this fails.
    for (let i = 0; i < SEED_ROWS; i++) {
      expect(lines).toContain(`transcript line ${i}`)
    }
    // A correctly-placed footer is provider chrome and must not reach the
    // transcript. The mid-transcript hybrid the bug produces
    // ("tr✻ Brewing… (12s …)") fails the filter's `^` anchor and would survive.
    expect(lines.every((l) => !l.includes('Brewing'))).toBe(true)
    // It is still on screen, just filtered from the transcript view.
    expect(vt.getRawLines()[vt.getRawLines().length - 1]).toContain('Brewing')
  })

  it('clamps an out-of-range row so garbage escapes cannot evict transcript', () => {
    const vt = seededFromReplay()

    // A garbled row number is reachable: the HTTP fallback serves a byte-level
    // tail slice of the PTY ring buffer, which can begin mid-escape.
    //
    // Unclamped, each one resolves past the end and appends ~160 blank rows;
    // once the grid passes MAX_ROWS the trim evicts real transcript from the
    // top. A SINGLE stray proves nothing — getRawLines() drops blank rows, so
    // the growth is invisible to it and the obvious length assertion holds even
    // with the clamp removed. The count below is past the eviction cliff
    // (measured at 62 for this fixture), which is where the harm becomes
    // observable at all.
    //
    // This guards the clamp rather than reproducing the original bug: it also
    // passes on pre-fix code, where an out-of-range row simply saturates.
    for (let i = 0; i < 70; i++) vt.feed(`${CSI}200;1H`)

    const lines = vt.getLines()
    for (let i = 0; i < SEED_ROWS; i++) {
      expect(lines).toContain(`transcript line ${i}`)
    }
  })

  it('clamps cursor-up (CSI A) at the top of the screen, not the top of scrollback', () => {
    const vt = seededFromReplay()
    // Grid is the seeded rows plus the blank row the trailing newline opened;
    // the screen is its last VIEWPORT_ROWS, so everything below is scrollback.
    const VIEWPORT_ROWS = 40
    const viewportTop = SEED_ROWS + 1 - VIEWPORT_ROWS

    // Bottom of the screen, then further up than the screen is tall.
    vt.feed(`${CSI}40;1H`)
    vt.feed(`${CSI}45A`)
    vt.feed('XX')

    // Pre-fix this clamps at grid row 0 rather than the viewport top, so the
    // write lands five rows into scrollback and destroys `transcript line 155`.
    // The viewport's own top row IS overwritten, and that is correct — a real
    // screen row is being painted. Only scrollback is off-limits.
    const lines = vt.getLines()
    for (let i = 0; i < viewportTop; i++) {
      expect(lines).toContain(`transcript line ${i}`)
    }
    expect(vt.getRawLines().some((l) => l.includes('XX'))).toBe(true)
  })

  it('clamps cursor-down (CSI B) at the bottom of the screen so a frame cannot tear', () => {
    const vt = seededFromReplay()

    // The same absolute row, painted twice, with a cursor-down in between.
    vt.feed(`${CSI}38;1HAAA`)
    vt.feed(`${CSI}10B`)
    vt.feed(`${CSI}38;1HBBB`)

    // Pre-fix, `CSI 10B` grows the grid, which moves the derived viewport origin
    // mid-frame, so the second `CSI 38;1H` resolves somewhere else and both
    // survive — the frame tears. Clamped, the repaint overwrites itself.
    const lines = vt.getRawLines()
    expect(lines.some((l) => l.includes('BBB'))).toBe(true)
    expect(lines.every((l) => !l.includes('AAA'))).toBe(true)
  })

  it('survives a chunk that begins inside an escape sequence (HTTP fallback)', () => {
    const vt = seededFromReplay()

    // The fallback body is `session.outputBuffer` cut with a byte-level
    // `subarray` (tb-streamer src/pty-manager.ts:820-825), so a chunk can start
    // mid-escape. The parser drops the truncated sequence; the contract is only
    // that it does not throw and does not destroy transcript.
    expect(() => {
      vt.feed(`${CSI}4`)
      vt.feed(`0;1H${FOOTER}`)
    }).not.toThrow()

    const lines = vt.getLines()
    for (let i = 0; i < SEED_ROWS; i++) {
      expect(lines).toContain(`transcript line ${i}`)
    }
  })
})
