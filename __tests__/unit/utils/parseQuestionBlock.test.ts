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
})
