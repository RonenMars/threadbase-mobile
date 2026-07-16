import { parseQuestionBlock } from '@/utils/parseQuestionBlock'

describe('parseQuestionBlock', () => {
  it('returns null for empty lines', () => {
    expect(parseQuestionBlock([])).toBeNull()
  })

  it('returns null when no question line present', () => {
    const lines = ['some output', '  not an option', 'more output']
    expect(parseQuestionBlock(lines)).toBeNull()
  })

  it('returns null when question line has no options following it', () => {
    const lines = ['some output', '? Is this a question?']
    expect(parseQuestionBlock(lines)).toBeNull()
  })

  it('parses a basic question with ❯-prefixed and indented options', () => {
    const lines = [
      'some prior output',
      '? Add fallback to ConversationCache?',
      '❯ both (Recommended)',
      '  indicator only',
      '  discriminator only',
      '  Nothing.',
    ]
    const result = parseQuestionBlock(lines)
    expect(result).not.toBeNull()
    const q = result!.questions[0]
    expect(q.question).toBe('Add fallback to ConversationCache?')
    expect(q.options.map(o => o.label)).toEqual([
      'both (Recommended)',
      'indicator only',
      'discriminator only',
      'Nothing.',
    ])
    expect(result!.selectedIndex).toBe(0)
  })

  it('detects selectedIndex from ❯ position', () => {
    const lines = [
      '? Choose an option',
      '  Option A',
      '❯ Option B',
      '  Option C',
    ]
    const result = parseQuestionBlock(lines)
    expect(result!.selectedIndex).toBe(1)
  })

  it('strips the ❯ prefix from option text', () => {
    const lines = [
      '? Do something?',
      '❯ yes please',
      '  no thanks',
    ]
    const result = parseQuestionBlock(lines)
    const q = result!.questions[0]
    expect(q.options[0].label).toBe('yes please')
    expect(q.options[1].label).toBe('no thanks')
  })

  it('stops collecting options at a non-option line', () => {
    const lines = [
      '? Do something?',
      '❯ Option A',
      '  Option B',
      'unrelated output line',
      '  not an option',
    ]
    const result = parseQuestionBlock(lines)
    expect(result!.questions[0].options.map(o => o.label)).toEqual(['Option A', 'Option B'])
  })

  it('uses last question block when multiple exist', () => {
    const lines = [
      '? First question?',
      '❯ old option',
      'some output',
      '? Second question?',
      '❯ new option A',
      '  new option B',
    ]
    const result = parseQuestionBlock(lines)
    const q = result!.questions[0]
    expect(q.question).toBe('Second question?')
    expect(q.options.map(o => o.label)).toEqual(['new option A', 'new option B'])
  })

  it('strips leading ? and whitespace from question text', () => {
    const lines = [
      '?  What should we do?',
      '❯ something',
      '  nothing',
    ]
    const result = parseQuestionBlock(lines)
    expect(result!.questions[0].question).toBe('What should we do?')
  })

  it('returns null when options array would be empty', () => {
    const lines = ['? A question?', 'no options follow']
    expect(parseQuestionBlock(lines)).toBeNull()
  })

  it('parses question and options wrapped in ANSI color codes', () => {
    const ESC = '\x1b'
    const lines = [
      `${ESC}[32m? Do something?${ESC}[0m`,
      `${ESC}[36m❯ yes please${ESC}[0m`,
      `  no thanks`,
    ]
    const result = parseQuestionBlock(lines)
    expect(result).not.toBeNull()
    const q = result!.questions[0]
    expect(q.question).toBe('Do something?')
    expect(q.options.map(o => o.label)).toEqual(['yes please', 'no thanks'])
    expect(result!.selectedIndex).toBe(0)
  })

  it('stops at 4-space-indented lines (tool output), not treating them as options', () => {
    const lines = [
      '? Do something?',
      '❯ Option A',
      '  Option B',
      '    deeper indented tool output',
    ]
    const result = parseQuestionBlock(lines)
    expect(result!.questions[0].options.map(o => o.label)).toEqual(['Option A', 'Option B'])
  })

  it('parses numbered-list format with no leading ? (skill picker style)', () => {
    const lines = [
      'The MultiStore writes to multiple backends. What happens when Neon is unreachable?',
      '❯ 1. Crashes with unhandled exception',
      '  2. Falls back to JSON file store',
      '  3. Retries 3 times then skips',
      'Enter to select  ↑/↓ to navigate · Esc to cancel',
    ]
    const result = parseQuestionBlock(lines)
    expect(result).not.toBeNull()
    const q = result!.questions[0]
    expect(q.question).toBe('The MultiStore writes to multiple backends. What happens when Neon is unreachable?')
    expect(q.options.map(o => o.label)).toEqual([
      'Crashes with unhandled exception',
      'Falls back to JSON file store',
      'Retries 3 times then skips',
    ])
    expect(result!.selectedIndex).toBe(0)
  })

  it('strips numbered prefix from options in ? format too', () => {
    const lines = [
      '? Which approach?',
      '❯ 1. First option',
      '  2. Second option',
    ]
    const result = parseQuestionBlock(lines)
    expect(result!.questions[0].options.map(o => o.label)).toEqual(['First option', 'Second option'])
  })

  it('accepts 3-space-indented options (aligned numbered lists)', () => {
    const lines = ['? Pick one', '❯ 1. First', '   2. Second', '   3. Third']
    const q = parseQuestionBlock(lines)!.questions[0]
    expect(q.options.map(o => o.label)).toEqual(['First', 'Second', 'Third'])
  })

  it('does not treat a box-drawing border as the question (Format 2)', () => {
    const lines = ['────────────', '❯ Option A', '  Option B']
    expect(parseQuestionBlock(lines)).toBeNull()
  })

  it('reports source as pty', () => {
    const lines = ['? Q', '❯ A', '  B']
    expect(parseQuestionBlock(lines)!.source).toBe('pty')
  })

  // ── Chrome line guards (Format 2) ──────────────────────────────────────────

  it('returns null when question text is a prompt suggestion line', () => {
    // "> Try ..." lines are Claude Code prompt suggestions, not real questions
    const lines = ['> Try "how do I log an error?"', '❯ Tell me more about the']
    expect(parseQuestionBlock(lines)).toBeNull()
  })

  it('does not treat a user transcript line (❯ <text>) as a menu cursor', () => {
    // The VT chrome filter lets '❯ <message>' transcript lines through; an
    // un-numbered ❯ line must never open a phantom question card.
    const lines = [
      '⚠ 3 MCP servers need authentication · run /mcp',
      '❯ Analyze this folder content and write a report about it content',
    ]
    expect(parseQuestionBlock(lines)).toBeNull()
  })

  it('does not build a card from transcript + status bar lines', () => {
    const lines = [
      '✳ Cogitated for 9s',
      '❯ B',
      '  Fable 5 [Analyze folder content and write report] ││ ~/dev/dev-tools 06:18 │ ⚓4',
    ]
    expect(parseQuestionBlock(lines)).toBeNull()
  })

  it('returns null when question text is a prompt echo line', () => {
    const lines = ['> Hi', '❯ Option A', '  Option B']
    expect(parseQuestionBlock(lines)).toBeNull()
  })

  it('returns null when question text is a status bar fragment', () => {
    const lines = ['Sonnet 4.6 | ~/Desktop/dev/apps 20:30 | ⚓ 4', '❯ Option A']
    expect(parseQuestionBlock(lines)).toBeNull()
  })

  it('returns null when question text is a bare pipe fragment', () => {
    const lines = ['| ~/Desktop/dev/apps |', '❯ Option A']
    expect(parseQuestionBlock(lines)).toBeNull()
  })

  it('stops collecting options at a file path line', () => {
    // Attachment paths should not become option labels
    const lines = [
      '? Do something?',
      '❯ Yes',
      '  @/Users/ronenmars/Desktop/dev/ai-tools/tb-mobile/.threadbase-uploads/abc.jpg',
    ]
    const result = parseQuestionBlock(lines)
    expect(result!.questions[0].options.map(o => o.label)).toEqual(['Yes'])
  })

  it('stops collecting options at a status bar line (pipe-delimited)', () => {
    const lines = [
      '? Do something?',
      '❯ Yes',
      '  Sonnet 4.6 | ~/Desktop/dev/apps 20:30 | ⚓ 4',
    ]
    const result = parseQuestionBlock(lines)
    expect(result!.questions[0].options.map(o => o.label)).toEqual(['Yes'])
  })

  // ── Format 3: AskUserQuestion menu (?-suffix, numbered, no ❯ cursor) ────────

  it('parses the AskUserQuestion menu shape: ?-suffix question, numbered options, NO ❯', () => {
    // The real menu that Format 1 (needs "? " at start) and Format 2 (needs ❯)
    // both miss — this is the bug being fixed.
    const lines = [
      'Which area are you focused on?',
      '  1. macOS / Chrome',
      '  2. iOS / Safari',
      '  3. Android',
      '  6. Chat about this',
    ]
    const result = parseQuestionBlock(lines)
    expect(result).not.toBeNull()
    const q = result!.questions[0]
    expect(q.question).toBe('Which area are you focused on?')
    expect(q.options.map(o => o.label)).toEqual([
      'macOS / Chrome',
      'iOS / Safari',
      'Android',
      'Chat about this',
    ])
  })

  it('reads the ❯ cursor position for a ?-suffixed numbered menu', () => {
    const lines = [
      'Which area are you focused on?',
      '  1. macOS / Chrome',
      '❯ 2. iOS / Safari',
      '  3. Android',
    ]
    const result = parseQuestionBlock(lines)
    expect(result!.selectedIndex).toBe(1)
  })

  it('parses the AskUserQuestion menu drawn inside a box (│ gutters)', () => {
    const lines = [
      '╭──────────────────────────────────────╮',
      '│ Which area are you focused on?        │',
      '│   1. macOS / Chrome                   │',
      '│   2. iOS / Safari                     │',
      '╰──────────────────────────────────────╯',
    ]
    const q = parseQuestionBlock(lines)!.questions[0]
    expect(q.question).toBe('Which area are you focused on?')
    expect(q.options.map(o => o.label)).toEqual(['macOS / Chrome', 'iOS / Safari'])
  })

  it('returns null for a permission gate (numbered Yes/No), leaving it to the permission event', () => {
    const lines = [
      'Do you want to proceed?',
      '❯ 1. Yes',
      '  2. No, and tell Claude what to do differently',
    ]
    expect(parseQuestionBlock(lines)).toBeNull()
  })

  it('returns null for a ?-suffixed line with @-path "options" (not a real menu)', () => {
    const lines = [
      'Attach a file?',
      '  1. @/Users/ronenmars/Desktop/a.jpg',
      '  2. @/Users/ronenmars/Desktop/b.jpg',
    ]
    // The @-path guard stops option collection → <2 options → null.
    expect(parseQuestionBlock(lines)).toBeNull()
  })
})
