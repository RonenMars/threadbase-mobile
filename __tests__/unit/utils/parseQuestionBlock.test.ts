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
    expect(result!.questionText).toBe('Add fallback to ConversationCache?')
    expect(result!.options).toEqual([
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
    expect(result!.options[0]).toBe('yes please')
    expect(result!.options[1]).toBe('no thanks')
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
    expect(result!.options).toEqual(['Option A', 'Option B'])
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
    expect(result!.questionText).toBe('Second question?')
    expect(result!.options).toEqual(['new option A', 'new option B'])
  })

  it('strips leading ? and whitespace from question text', () => {
    const lines = [
      '?  What should we do?',
      '❯ something',
      '  nothing',
    ]
    const result = parseQuestionBlock(lines)
    expect(result!.questionText).toBe('What should we do?')
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
    expect(result!.questionText).toBe('Do something?')
    expect(result!.options).toEqual(['yes please', 'no thanks'])
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
    expect(result!.options).toEqual(['Option A', 'Option B'])
  })
})
