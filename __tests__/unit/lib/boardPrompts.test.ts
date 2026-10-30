import { boardQuestions, isAnswerableOnBoard, openPrompts, promptRefetchKey, promptResponses, terminalTailLine } from '@/lib/boardPrompts'
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
})
