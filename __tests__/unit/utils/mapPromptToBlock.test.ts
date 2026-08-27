import { mapPromptToBlock, unsupportedPromptShape } from '@/utils/mapPromptToBlock'
import type { Prompt } from '@/types/api'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'

const PROMPT: Prompt = {
  schemaVersion: 1,
  sessionId: 's1',
  promptId: 'prompt-1',
  revision: 1,
  state: 'open',
  intent: 'approval',
  title: 'Approval',
  message: 'Do you want to proceed?',
  detail: 'Bash command\ngit push',
  questions: [
    {
      questionId: 'q-1',
      text: 'Do you want to proceed?',
      header: 'Approval',
      inputMode: 'single',
      options: [
        { optionId: 'opt-yes', label: 'Yes' },
        { optionId: 'opt-no', label: 'No' },
      ],
      allowOther: false,
      secret: 'unknown',
    },
  ],
  answerRequirement: 'unknown',
  expiresAt: null,
  provenance: { source: 'screen', confidence: 'inferred' },
}

describe('mapPromptToBlock', () => {
  it('maps a single-select prompt with its ids, revision and approval detail', () => {
    const block = mapPromptToBlock(PROMPT)
    expect(block.source).toBe('prompt')
    expect(block.promptId).toBe('prompt-1')
    expect(block.promptRevision).toBe(1)
    expect(block.unsupportedShape).toBeUndefined()
    expect(block.questions).toHaveLength(1)
    expect(block.questions[0]).toMatchObject({
      question: 'Do you want to proceed?',
      header: 'Approval',
      detail: 'Bash command\ngit push',
      questionId: 'q-1',
      multiSelect: false,
    })
    expect(block.questions[0].options).toEqual([
      { label: 'Yes', optionId: 'opt-yes' },
      { label: 'No', optionId: 'opt-no' },
    ])
  })

  it('carries option description and preview through', () => {
    const prompt: Prompt = {
      ...PROMPT,
      intent: 'question',
      detail: undefined,
      questions: [{
        ...PROMPT.questions[0],
        options: [{ optionId: 'o1', label: 'TypeScript', description: 'Typed', preview: 'ts' }],
      }],
    }
    expect(mapPromptToBlock(prompt).questions[0].options[0]).toEqual({
      label: 'TypeScript', optionId: 'o1', description: 'Typed', preview: 'ts',
    })
    expect(mapPromptToBlock(prompt).questions[0].detail).toBeUndefined()
  })

  // Fail closed (D10): the card must not offer a tap that would need bytes this
  // client cannot produce. No options means no row can be pressed.
  const shapes: [string, Prompt, QuestionBlock['unsupportedShape']][] = [
    ['multi', { ...PROMPT, questions: [{ ...PROMPT.questions[0], inputMode: 'multi' }] }, 'multi'],
    ['text', { ...PROMPT, questions: [{ ...PROMPT.questions[0], inputMode: 'text', options: [] }] }, 'text'],
    ['form', { ...PROMPT, questions: [PROMPT.questions[0], { ...PROMPT.questions[0], questionId: 'q-2' }] }, 'form'],
    ['unknown mode', { ...PROMPT, questions: [{ ...PROMPT.questions[0], inputMode: 'ranked' }] }, 'unknown'],
  ]
  it.each(shapes)('marks a %s prompt unsupported and renders zero options', (_name, prompt, shape) => {
    expect(unsupportedPromptShape(prompt)).toBe(shape)
    const block = mapPromptToBlock(prompt)
    expect(block.unsupportedShape).toBe(shape)
    for (const q of block.questions) expect(q.options).toEqual([])
    expect(block.questions[0].question).toBe('Do you want to proceed?')
  })
})
