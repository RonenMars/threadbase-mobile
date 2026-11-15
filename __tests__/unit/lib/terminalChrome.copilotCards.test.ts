import {
  dropChromeRegions,
  getTerminalChromeFilter,
  isClaudeTerminalChrome,
  isCodexTerminalChrome,
  isCopilotTerminalChrome,
  isPassthroughChrome,
} from '@/lib/terminalChrome'
import { VirtualTerminal } from '@/services/virtual-terminal'
import { parseQuestionBlock } from '@/utils/parseQuestionBlock'

/**
 * Screen rows of the Copilot CLI 1.0.92 captures in tb-streamer
 * (__tests__/fixtures/turn-signals/copilot-1.0.92-{gate,ask}.json), replayed
 * through @xterm/headless at 120x40 and copied verbatim, padding and gutters
 * included. GATE_CARD / TRUST_CARD are the screen at the `gateOpen` and
 * `trustOpen` marks, ASK_FORM the one at `askOpen`.
 */
const GATE_TRANSCRIPT = [
  " ❯ Run the shell command `touch a.txt`. Do not ask me any questions.                                             21:53",
  " $ Shell Create the requested empty file in the current workspace",
  "   touch a.txt",
]
const GATE_CARD = [
  "╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮",
  "│ Create the requested empty file in the current workspace                                                             │",
  "│ ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────── │",
  "│ ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮ │",
  "│ │ touch a.txt                                                                                                      │ │",
  "│ ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯ │",
  "│                                                                                                                      │",
  "│ Do you want to run this command?                                                                                     │",
  "│                                                                                                                      │",
  "│ ❯ 1. Yes                                                                                                             │",
  "│   2. Yes, and don't ask again for `touch` in this directory (/private/tmp/tb-capture-copilot-gate)                   │",
  "│   3. No, and tell Copilot what to do differently (Esc to stop)                                                       │",
  "│                                                                                                                      │",
  "│ ↑/↓ to navigate · enter to select · esc to cancel                                                                    │",
  "╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯",
]
const TRUST_TRANSCRIPT = [
  " ● Tip: /allow-all",
  "   └ Enable all permissions (tools, paths, and URLs)",
]
const TRUST_CARD = [
  "╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮",
  "│ Confirm folder trust                                                                                                 │",
  "│ ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────── │",
  "│ ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮ │",
  "│ │ /private/tmp/tb-capture-copilot-gate                                                                             │ │",
  "│ ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯ │",
  "│                                                                                                                      │",
  "│ Copilot can read files in this folder and, with your permission, edit them or run code and shell commands. It will   │",
  "│ remember your permissions for the rest of this session.                                                              │",
  "│                                                                                                                      │",
  "│ Do you trust the files in this folder?                                                                               │",
  "│                                                                                                                      │",
  "│ ❯ 1. Yes                                                                                                             │",
  "│   2. Yes, and remember this folder for future sessions                                                               │",
  "│   3. No (Esc)                                                                                                        │",
  "│                                                                                                                      │",
  "│ ↑/↓ to navigate · enter to select · esc to cancel                                                                    │",
  "╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯",
]
const ASK_TRANSCRIPT = [
  " ❯ Use the ask_user tool to ask me to pick one color out of red, green and blue, then reply with only the color  21:53",
  "   I picked.",
]
const ASK_FORM = [
  "────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────",
  " Copilot needs information.",
  " Pick one color out of red, green, and blue.",
  "",
  " Color:",
  " Choose exactly one color.",
  " ❯ red",
  "   green",
  "   blue",
  "   Other (type your answer)",
  "",
  " ↑/↓ select · enter accept · ctrl+d decline · esc cancel",
  "────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────",
]

const feed = (vt: VirtualTerminal, rows: string[]) => vt.feed(rows.join('\r\n') + '\r\n')
const copilot = (...parts: string[][]) => {
  const vt = new VirtualTerminal()
  vt.setProvider('copilot')
  feed(vt, parts.flat())
  return vt
}
const TABLE = ['│ name │ size │', '│ a.txt │ 0 │']
const cardBodyFrom = (card: string[], from: number) => card.slice(from)

describe('copilot card regions: the whole card body is hidden', () => {
  it('hides the permission card, title and command text included', () => {
    expect(copilot(GATE_TRANSCRIPT, GATE_CARD).getLines()).toEqual(GATE_TRANSCRIPT)
  })

  it('hides the trust card, title, path and paragraph included', () => {
    expect(copilot(TRUST_TRANSCRIPT, TRUST_CARD).getLines()).toEqual(TRUST_TRANSCRIPT)
  })

  it('hides option rows that wrap onto a continuation row', () => {
    const opt2 = GATE_CARD.findIndex((row) => row.includes('2. Yes, and'))
    const wrapped = [...GATE_CARD]
    // derived from the captured option 2: its tail moved onto a second gutter row
    wrapped.splice(
      opt2,
      1,
      '│   2. Yes, and don\'t ask again for `touch` in this directory                                                        │',
      '│      (/private/tmp/tb-capture-copilot-gate)                                                                          │',
    )
    expect(copilot(GATE_TRANSCRIPT, wrapped).getLines()).toEqual(GATE_TRANSCRIPT)
  })

  it('hides the ask_user form body between its header and footer', () => {
    expect(copilot(ASK_TRANSCRIPT, ASK_FORM).getLines()).toEqual(ASK_TRANSCRIPT)
  })

  it('applies to the frame view too', () => {
    expect(copilot(GATE_TRANSCRIPT, GATE_CARD).getFrameLines()).toEqual(GATE_TRANSCRIPT)
  })

  it('hides two cards in one history and keeps what is between them', () => {
    const between = ['  ● Done.', ...TABLE]
    expect(copilot(GATE_CARD, between, TRUST_CARD).getLines()).toEqual(between)
  })

  it('hides a card that follows a table without touching the table', () => {
    expect(copilot(TABLE, GATE_CARD).getLines()).toEqual(TABLE)
    expect(copilot(GATE_CARD, TABLE).getLines()).toEqual(TABLE)
  })
})

describe('copilot card regions: what counts as a card', () => {
  const drop = (rows: string[]) => dropChromeRegions(rows, isCopilotTerminalChrome)
  const upTo = (card: string[], text: string) => card.slice(0, card.findIndex((row) => row.includes(text)) + 1)

  it('recognises a card by its footer alone', () => {
    const noPrompt = GATE_CARD.filter((row) => !row.includes('Do you want'))
    expect(drop(noPrompt)).toEqual([GATE_CARD[GATE_CARD.length - 1]])
  })

  it('recognises a trust card by its prompt alone', () => {
    expect(drop(upTo(TRUST_CARD, 'Do you trust'))).toEqual([])
  })

  it('recognises a permission card by its prompt alone', () => {
    expect(drop(upTo(GATE_CARD, 'Do you want'))).toEqual([])
  })

  it('reads a heavy-line gutter the way the row filter does', () => {
    const heavy = GATE_CARD.map((row) => row.replaceAll('│', '┃'))
    expect(drop(heavy)).toEqual([GATE_CARD[GATE_CARD.length - 1]])
  })

  it('tolerates padding around the rows', () => {
    const padded = GATE_CARD.map((row) => `  ${row}   `)
    expect(drop(padded)).toEqual([`  ${GATE_CARD[GATE_CARD.length - 1]}   `])
  })

  it('ends the span at a gutter row that is never closed', () => {
    const note = '│ trailing note with no closing gutter'
    expect(drop([...upTo(GATE_CARD, 'esc to cancel'), note])).toEqual([note])
  })

  it('hides a card sitting in the kept history as well as one on screen', () => {
    const vt = new VirtualTerminal()
    vt.setProvider('copilot')
    vt.seedArchive([...GATE_TRANSCRIPT, ...GATE_CARD])
    feed(vt, ['  ● next'])
    expect(vt.getLines()).toEqual([...GATE_TRANSCRIPT, '  ● next'])
    expect(vt.getFrameLines()).toEqual(['  ● next'])
  })
})

describe('copilot card regions: rows outside a card survive', () => {
  it('keeps markdown table rows that start with a gutter glyph', () => {
    expect(copilot(GATE_TRANSCRIPT, TABLE).getLines()).toEqual([...GATE_TRANSCRIPT, ...TABLE])
  })

  it('keeps a table between two cards', () => {
    expect(copilot(GATE_TRANSCRIPT, GATE_CARD, TABLE, TRUST_CARD).getLines()).toEqual([
      ...GATE_TRANSCRIPT,
      ...TABLE,
    ])
  })

  it('keeps a boxed block that carries no card prompt or footer', () => {
    const boxed = [GATE_CARD[0], GATE_CARD[1], GATE_CARD[4], GATE_CARD[GATE_CARD.length - 1]]
    expect(copilot(boxed).getLines()).toEqual([GATE_CARD[1], GATE_CARD[4]])
  })

  it('keeps ask_user form text when no header opens it', () => {
    const noHeader = ASK_FORM.filter((row) => !row.includes('needs information'))
    expect(copilot(ASK_TRANSCRIPT, noHeader).getLines()).toEqual([
      ...ASK_TRANSCRIPT,
      ' Pick one color out of red, green, and blue.',
      ' Color:',
      ' Choose exactly one color.',
      ' ❯ red',
      '   green',
      '   blue',
      '   Other (type your answer)',
    ])
  })
})

describe('copilot card regions: a card cut by the edge of the rows', () => {
  const cardWithTopCut = cardBodyFrom(GATE_CARD, 3) // starts at the inner box, top border and title gone

  it('drops a card whose top is cut off, up to its footer', () => {
    expect(dropChromeRegions(cardWithTopCut, isCopilotTerminalChrome)).toEqual([GATE_CARD[GATE_CARD.length - 1]])
  })

  it('drops a card whose bottom is cut off once its prompt has painted', () => {
    const cut = GATE_CARD.slice(0, GATE_CARD.findIndex((row) => row.includes('Do you want')) + 1)
    expect(dropChromeRegions([...GATE_TRANSCRIPT, ...cut], isCopilotTerminalChrome)).toEqual(GATE_TRANSCRIPT)
  })

  it('keeps a half-painted card that has shown neither prompt nor footer yet', () => {
    const cut = GATE_CARD.slice(0, 5)
    expect(dropChromeRegions(cut, isCopilotTerminalChrome)).toEqual(cut)
  })

  it('keeps a top-cut span that never reaches a prompt or footer', () => {
    const cut = GATE_CARD.slice(3, 6)
    expect(dropChromeRegions(cut, isCopilotTerminalChrome)).toEqual(cut)
  })

  it('does not reach back past a plain row to guess where a cut card began', () => {
    const rows = ['● Done.', ...cardWithTopCut]
    expect(dropChromeRegions(rows, isCopilotTerminalChrome)).toEqual(rows)
  })

  it('keeps an ask_user body whose footer has not painted, and one whose header is cut off', () => {
    const noFooter = ASK_FORM.slice(0, ASK_FORM.findIndex((row) => row.includes('↑/↓ select')))
    expect(dropChromeRegions(noFooter, isCopilotTerminalChrome)).toEqual(noFooter)
    const noHeader = ASK_FORM.slice(ASK_FORM.findIndex((row) => row.includes('Pick one')))
    expect(dropChromeRegions(noHeader, isCopilotTerminalChrome)).toEqual(noHeader)
  })

  it('does not pair a header with the footer of a later form', () => {
    const rows = [ASK_FORM[1], 'plain row', ASK_FORM[1], ...ASK_FORM.slice(2)]
    expect(dropChromeRegions(rows, isCopilotTerminalChrome)).toEqual([ASK_FORM[1], 'plain row', ASK_FORM[ASK_FORM.length - 1]]) // the closing rule stays; the border pass drops it
  })
})

describe('copilot card regions: the question scraper on a live card', () => {
  const scrape = (vt: VirtualTerminal) => parseQuestionBlock(vt.getLines().slice(-30))

  it('still reads a numbered picker, so a null below is a result and not a dead parser', () => {
    const picker = ['Pick one', '', '❯ 1. red', '  2. green', '', 'Enter to select · Esc to cancel']
    expect(parseQuestionBlock(picker)).not.toBeNull()
  })

  it.each([
    ['permission card', [GATE_TRANSCRIPT, GATE_CARD]],
    ['trust card', [TRUST_TRANSCRIPT, TRUST_CARD]],
    ['ask_user form', [ASK_TRANSCRIPT, ASK_FORM]],
  ])('the %s scrapes to null both before and after the region pass', (_name, parts) => {
    const vt = copilot(...parts)
    // the rows the scraper got before this change (per-row filter only) and the unfiltered rows
    const before = vt.getRawLines().filter((row) => !isCopilotTerminalChrome(row))
    expect(parseQuestionBlock(before.slice(-30))).toBeNull()
    expect(parseQuestionBlock(vt.getRawLines().slice(-30))).toBeNull()
    expect(scrape(vt)).toBeNull()
  })

  it('removes nothing but card rows from what the scraper is handed', () => {
    const vt = copilot(GATE_TRANSCRIPT, GATE_CARD)
    const before = vt.getRawLines().filter((row) => !isCopilotTerminalChrome(row))
    const after = vt.getLines()
    expect(before.filter((row) => !after.includes(row)).every((row) => row.startsWith('│'))).toBe(true)
    expect(after).toEqual(GATE_TRANSCRIPT)
  })
})

describe('other providers are untouched', () => {
  const rows = [...GATE_TRANSCRIPT, ...GATE_CARD]

  it('returns the very same rows for every non-copilot filter', () => {
    for (const filter of [isClaudeTerminalChrome, isCodexTerminalChrome, isPassthroughChrome]) {
      expect(dropChromeRegions(rows, filter)).toBe(rows)
    }
  })

  it('keeps the card rows for claude, codex, raw and unknown providers', () => {
    const titleRow = GATE_CARD[1]
    for (const provider of ['claude-code', 'codex-cli', 'mystery-agent']) {
      const vt = new VirtualTerminal()
      vt.setProvider(provider)
      feed(vt, rows)
      expect(vt.getLines()).toEqual(vt.getRawLines().filter((row) => !getTerminalChromeFilter(provider)(row)))
      expect(vt.getRawLines()).toContain(titleRow)
    }
    const raw = new VirtualTerminal()
    raw.setProvider('copilot')
    raw.setRawMode(true)
    feed(raw, rows)
    expect(raw.getLines()).toEqual(raw.getRawLines())
    expect(raw.getLines()).toContain(titleRow)
  })
})
