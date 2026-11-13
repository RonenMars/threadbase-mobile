import { boardQuestions, isAnswerableOnBoard, needsYouLine, openPrompts, promptRefetchKey, promptResponses, terminalTailLine } from '@/lib/boardPrompts'
import type { MergedItem } from '@/components/sessions/now/mergedItems'
import type { MultiSession, Prompt, PromptQuestion, Session } from '@/types/api'

const question = (questionId: string, overrides: Partial<PromptQuestion> = {}): PromptQuestion => ({
  questionId,
  text: `text ${questionId}`,
  inputMode: 'single',
  options: [{ optionId: 'yes', label: 'Yes' }],
  allowOther: false,
  secret: 'unknown',
  ...overrides,
})

const prompt = (promptId: string, questions: PromptQuestion[], state = 'open'): Prompt => ({
  schemaVersion: 1,
  sessionId: 's',
  promptId,
  revision: 1,
  state,
  intent: 'question',
  questions,
  answerRequirement: 'blocking',
  expiresAt: null,
  provenance: { source: 'pty', confidence: 'high' },
})

const withPrompts = (hasOpenPrompt: boolean | undefined, pendingPrompts?: Prompt[]) =>
  ({ hasOpenPrompt, pendingPrompts }) as Session

describe('openPrompts', () => {
  it('keeps only open and updated prompts that carry a question', () => {
    const kept = openPrompts(
      withPrompts(true, [
        prompt('a', [question('1')]),
        prompt('b', [question('1')], 'updated'),
        prompt('c', [question('1')], 'resolved'),
        prompt('d', [question('1')], 'something-new'),
        prompt('e', []),
      ]),
    )
    expect(kept.map((p) => p.promptId)).toEqual(['a', 'b'])
  })

  it('treats an older server as having none', () => {
    expect(openPrompts(withPrompts(undefined))).toEqual([])
  })

  it('drops a cached list once the session reports no open prompt', () => {
    expect(openPrompts(withPrompts(false, [prompt('a', [question('1')])]))).toEqual([])
  })
})

describe('isAnswerableOnBoard', () => {
  it('accepts single-choice questions, including the unknown secret the PTY adapter sends', () => {
    expect(isAnswerableOnBoard(prompt('a', [question('1'), question('2')]))).toBe(true)
  })

  it.each([
    ['multi-select', question('1', { inputMode: 'multi' })],
    ['free text', question('1', { inputMode: 'text' })],
    ['an unknown mode', question('1', { inputMode: 'drawing' })],
    ['no options', question('1', { options: [] })],
    ['a secret', question('1', { secret: true })],
  ])('fails closed on %s', (_name, q) => {
    expect(isAnswerableOnBoard(prompt('a', [question('ok'), q]))).toBe(false)
  })
})

describe('boardQuestions', () => {
  it('numbers questions across every pending prompt', () => {
    const list = boardQuestions([prompt('a', [question('1'), question('2')]), prompt('b', [question('3')])])
    expect(list.map((q) => [q.prompt.promptId, q.question.questionId])).toEqual([['a', '1'], ['a', '2'], ['b', '3']])
  })
})

describe('promptResponses', () => {
  const two = prompt('a', [question('1'), question('2')])

  it('waits until every question of the prompt has a reply', () => {
    expect(promptResponses(two, { 1: 'yes' })).toBeNull()
  })

  it('sends every reply in one list, in question order', () => {
    expect(promptResponses(two, { 2: 'no', 1: 'yes' })).toEqual([
      { questionId: '1', optionIds: ['yes'] },
      { questionId: '2', optionIds: ['no'] },
    ])
  })
})

describe('promptRefetchKey', () => {
  const row = (id: string, hasOpenPrompt: boolean | undefined): MergedItem => ({
    kind: 'session',
    ms: 0,
    item: { id, serverId: 'one', hasOpenPrompt } as MultiSession,
  })

  it('changes when a session flips, and ignores order', () => {
    expect(promptRefetchKey([row('a', true), row('b', true)])).toBe(promptRefetchKey([row('b', true), row('a', true)]))
    expect(promptRefetchKey([row('a', true), row('b', false)])).not.toBe(promptRefetchKey([row('a', true), row('b', true)]))
  })

  it('ignores conversations', () => {
    const conversation = { kind: 'conversation', ms: 0, item: { id: 'c', serverId: 'one' } } as MergedItem
    expect(promptRefetchKey([conversation])).toBe('')
  })
})

describe('terminalTailLine', () => {
  it('takes the last line with text in it', () => {
    expect(terminalTailLine('Allow edit?\n  1. Yes  \n\n')).toBe('1. Yes')
  })

  it('returns nothing for empty output', () => {
    expect(terminalTailLine(' \n')).toBeUndefined()
    expect(terminalTailLine(undefined)).toBeUndefined()
  })

  it('strips terminal control codes, so a cursor-hide line does not count as text', () => {
    expect(terminalTailLine('\x1b[32mDone\x1b[0m\n\x1b[?25l')).toBe('Done')
  })
})

describe('needsYouLine', () => {
  const withOutput = (hasOpenPrompt: boolean | undefined, lastOutput: string, pendingPrompts?: Prompt[]) =>
    ({ hasOpenPrompt, pendingPrompts, lastOutput }) as Session

  it('shows the first open question when one exists', () => {
    const session = withOutput(true, 'noise', [prompt('a', [question('1')])])
    expect(needsYouLine(session)).toEqual({ text: 'text 1', question: true })
  })

  it('shows nothing for the captured /clear hint when the server says no question is open', () => {
    const session = withOutput(false, '\x1b[?25l\rnew task? /clear to save 165.2k tokens ·\x1b[?25h')
    expect(needsYouLine(session)).toBeUndefined()
  })

  it('shows nothing for a one-row partial redraw when the server says no question is open', () => {
    expect(needsYouLine(withOutput(false, '\x1b[?25l\r25\x1b[?25h'))).toBeUndefined()
  })

  it('keeps the terminal tail on an older server that omits hasOpenPrompt', () => {
    expect(needsYouLine(withOutput(undefined, 'Allow this edit? (y/n)'))).toEqual({
      text: 'Allow this edit? (y/n)',
      question: false,
    })
  })

  it('falls back to the terminal tail when hasOpenPrompt is true but the prompts have not merged in yet', () => {
    expect(needsYouLine(withOutput(true, 'Allow this edit? (y/n)'))).toEqual({
      text: 'Allow this edit? (y/n)',
      question: false,
    })
  })

  describe('last assistant reply on a finished turn', () => {
    const finished = (overrides: Partial<Session>) =>
      ({ hasOpenPrompt: false, lastOutput: '\x1b[?25l\rnew task? /clear to save 165.2k tokens ·\x1b[?25h', ...overrides }) as Session

    it('shows the reply when the streamer says no question is open and the last message is the assistant\'s', () => {
      const session = finished({ lastMessageText: 'Done.\n  Pushed the fix.', lastMessageRole: 'assistant' })
      expect(needsYouLine(session)).toEqual({ text: 'Done. Pushed the fix.', question: false })
    })

    it('omits the line when the newest message is the user\'s own prompt', () => {
      expect(needsYouLine(finished({ lastMessageText: 'fix it', lastMessageRole: 'user' }))).toBeUndefined()
    })

    it('omits the line when the streamer sends no role, rather than guessing who spoke', () => {
      expect(needsYouLine(finished({ lastMessageText: 'Done.' }))).toBeUndefined()
    })

    it('never lets a reply replace an open question', () => {
      const session = finished({ hasOpenPrompt: true, pendingPrompts: [prompt('a', [question('1')])], lastMessageText: 'Done.', lastMessageRole: 'assistant' })
      expect(needsYouLine(session)).toEqual({ text: 'text 1', question: true })
    })

    it('keeps the terminal tail on an older streamer even if a reply is present', () => {
      const session = finished({ hasOpenPrompt: undefined, lastOutput: 'Allow this edit? (y/n)', lastMessageText: 'Done.', lastMessageRole: 'assistant' })
      expect(needsYouLine(session)).toEqual({ text: 'Allow this edit? (y/n)', question: false })
    })
  })
})
