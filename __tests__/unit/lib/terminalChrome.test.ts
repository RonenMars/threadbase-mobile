import {
  getTerminalChromeFilter,
  isClaudeTerminalChrome,
  isCodexTerminalChrome,
  isCopilotTerminalChrome,
  isPassthroughChrome,
  keepTranscriptLine,
  dropGhostPromptLine,
} from '@/lib/terminalChrome'

describe('terminalChrome adapters', () => {
  it('filters Claude Code spinner and banner chrome', () => {
    expect(isClaudeTerminalChrome('Welcome to Claude Code')).toBe(true)
    expect(isClaudeTerminalChrome('· Thinking…')).toBe(true)
    expect(isClaudeTerminalChrome('❯ ship the fix')).toBe(false)
  })

  it('keeps Codex non-chrome lines and drops empty separators', () => {
    expect(isCodexTerminalChrome('────')).toBe(true)
    expect(isCodexTerminalChrome('editing main.ts')).toBe(false)
  })

  it('selects passthrough for unknown providers', () => {
    const filter = getTerminalChromeFilter('mystery-agent')
    expect(keepTranscriptLine('any line', filter)).toBe(true)
  })

  it('raw mode keeps non-empty lines', () => {
    const filter = getTerminalChromeFilter('claude-code', { raw: true })
    expect(keepTranscriptLine('Welcome to Claude Code', filter)).toBe(true)
  })
})

/**
 * Rows read off the rendered 120x40 screen of the Copilot CLI 1.0.92 captures in
 * tb-streamer (__tests__/fixtures/turn-signals/copilot-1.0.92-{gate,ask,turn}.json),
 * replayed through @xterm/headless. Copied verbatim, padding and gutters included.
 */
const COPILOT_CAPTURED = {
  cardPrompt: "│ Do you want to run this command?                                                                                     │",
  trustPrompt: "│ Do you trust the files in this folder?                                                                               │",
  opt1: "│ ❯ 1. Yes                                                                                                             │",
  opt2: "│   2. Yes, and don't ask again for `touch` in this directory (/private/tmp/tb-capture-copilot-gate)                   │",
  opt2trust: "│   2. Yes, and remember this folder for future sessions                                                               │",
  opt3: "│   3. No, and tell Copilot what to do differently (Esc to stop)                                                       │",
  opt3trust: "│   3. No (Esc)                                                                                                        │",
  cardFooter: "│ ↑/↓ to navigate · enter to select · esc to cancel                                                                    │",
  border: "╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮",
  bareCursor: "❯",
  idleFooter: " ← open sidebar · Interactive · Manual Approval · / commands · ? help · tab next tab          Auto → mai-code-1.1-flash ",
  sessionFooter: " /private/tmp/tb-capture-copilot-gate                                                            Session: 0.08 AIC used ",
  busy: " ● Working · 138 B esc interrupt                                                              Auto → mai-code-1.1-flash ",
  formHeader: " Copilot needs information.",
  formFooter: " ↑/↓ select · enter accept · ctrl+d decline · esc cancel",
  asking: " ○ Asking user Waiting for response",
  keepDone: " ● Done.",
  keepRed: " ● red",
  keepAsked: " ● Asked user Pick one color out of red, green, and blue.",
  keepUser: " ❯ Run the shell command `touch a.txt`. Do not ask me any questions.                                             21:53",
  keepShell: " $ Shell Create the requested empty file in the current workspace No Content",
}

describe("copilot terminal chrome", () => {
  const filter = getTerminalChromeFilter("copilot")
  const dropped = (row: string) => !keepTranscriptLine(row, filter)

  it("no longer routes copilot to passthrough, while unknown providers still do", () => {
    expect(filter).not.toBe(isPassthroughChrome)
    expect(filter).toBe(isCopilotTerminalChrome)
    expect(getTerminalChromeFilter("mystery-agent")).toBe(isPassthroughChrome)
    expect(getTerminalChromeFilter("cursor")).toBe(isPassthroughChrome)
    expect(getTerminalChromeFilter("copilot", { raw: true })).toBe(isPassthroughChrome)
  })

  it.each([
    "cardPrompt",
    "trustPrompt",
    "opt1",
    "opt2",
    "opt2trust",
    "opt3",
    "opt3trust",
    "cardFooter",
    "border",
    "bareCursor",
    "idleFooter",
    "sessionFooter",
    "busy",
    "formHeader",
    "formFooter",
    "asking",
  ] as const)("drops the captured %s row", (name) => {
    expect(dropped(COPILOT_CAPTURED[name])).toBe(true)
  })

  it("drops the same rows without the card gutter", () => {
    expect(dropped("Do you want to run this command?")).toBe(true)
    expect(dropped("❯ 1. Yes")).toBe(true)
    expect(dropped('  2. Yes, and approve all URLs from "https://example.com" for the rest of the running session')).toBe(true)
    expect(dropped("  4. No, and tell Copilot what to do differently (Esc to stop)")).toBe(true)
    expect(dropped("↑/↓ to navigate · enter to select · ctrl+e to show full plan · esc to cancel")).toBe(true)
  })

  it("drops a bare prompt glyph of any of the three kinds", () => {
    for (const glyph of ["❯", "›", ">", " ❯ "]) expect(dropped(glyph)).toBe(true)
  })

  it("drops the footer variants of an ask_user form", () => {
    expect(dropped(" ↑/↓ select · space toggle · enter accept · tab next · shift+tab prev · ctrl+d decline · esc cancel")).toBe(true)
    expect(dropped(" enter accept · ctrl+d decline · esc cancel")).toBe(true)
    // documented in copilot-cli-questions.md: a numeric field adds `↑/↓ adjust`
    expect(dropped(" ↑/↓ adjust · enter accept · ctrl+d decline · esc cancel")).toBe(true)
  })

  it("drops the newer build busy row and status footer from the bug report", () => {
    expect(dropped(" ● Working · 13.7 KiB ctrl+c interrupt                                  Copilot Fusion → gpt")).toBe(true)
    expect(dropped(" ~/dev/ai-tools/tb-mobile [⎇ main]                                       Session: 1.95 AIC used")).toBe(true)
    expect(dropped(" ◎ Working esc edit prompt                                                  Auto")).toBe(true)
    expect(dropped(" Interactive · Manual Approval · @ files · # issues")).toBe(true)
  })

  it.each([
    "keepDone",
    "keepRed",
    "keepAsked",
    "keepUser",
    "keepShell",
  ] as const)("keeps the captured %s row", (name) => {
    expect(dropped(COPILOT_CAPTURED[name])).toBe(false)
  })

  it("keeps ordinary assistant output", () => {
    for (const row of [
      "README.md and package.json",
      "● The repo has README.md and package.json at the root.",
      "I was Working on it, press esc to stop.",
      "Working directory: /tmp/x",
      "1. Yes it works, but the second case fails",
      "2. No change was needed",
      "Do you want to run the tests next?",
      "Use ↑/↓ to navigate the list",
      "Session: restored from disk",
      "Press enter to select, esc to cancel",
      "> quoted text",
      "● Working tree is clean",
      "Working on the fix; press ctrl+c to interrupt it",
      "↑/↓ to navigate the history",
      "The agent is Asking user Waiting for response",
    ]) {
      expect(dropped(row)).toBe(false)
    }
  })
})

describe('dropGhostPromptLine', () => {
  const ghost = 'add type hints and a docstring'

  it('drops the trailing `❯ <suggestion>` row and nothing else', () => {
    const lines = ['⏺ Done.', '❯ add tests', '⏺ Added.', `❯ ${ghost}`]
    expect(dropGhostPromptLine(lines, ghost)).toEqual(['⏺ Done.', '❯ add tests', '⏺ Added.'])
  })

  it('ignores ANSI around the row', () => {
    expect(dropGhostPromptLine([`\x1b[2m❯ ${ghost}\x1b[0m`], ghost)).toEqual([])
  })

  it('keeps the row unless the text matches exactly', () => {
    const lines = [`❯ ${ghost} please`]
    expect(dropGhostPromptLine(lines, ghost)).toBe(lines)
    expect(dropGhostPromptLine([`❯ ${ghost.slice(0, -1)}`], ghost)).toEqual([`❯ ${ghost.slice(0, -1)}`])
  })

  it('never reaches past the last prompt row to an older message with the same text', () => {
    const lines = [`❯ ${ghost}`, '⏺ Done.', '❯ something else']
    expect(dropGhostPromptLine(lines, ghost)).toBe(lines)
  })

  it('is a no-op without an active suggestion', () => {
    const lines = [`❯ ${ghost}`]
    expect(dropGhostPromptLine(lines, null)).toBe(lines)
    expect(dropGhostPromptLine(lines, undefined)).toBe(lines)
    expect(dropGhostPromptLine(lines, '')).toBe(lines)
  })
})
