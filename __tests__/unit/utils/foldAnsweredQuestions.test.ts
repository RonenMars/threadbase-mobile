import { foldAnsweredQuestions, parseAnswers } from '@/utils/foldAnsweredQuestions'
import type { Message } from '@/types/api'

function msg(id: string, role: 'user' | 'assistant', content: Message['content']): Message {
  return { id, uuid: id, role, content, timestamp: '2026-06-23T10:00:00Z', is_sidechain: false, parent_uuid: null }
}

const QUESTION = 'Which project area do you want to work on?'

const askBlock = (toolId: string) => ({
  type: 'tool_use' as const,
  id: toolId,
  name: 'AskUserQuestion',
  input: {
    questions: [
      {
        question: QUESTION,
        header: 'Project area',
        options: [{ label: 'Botik', description: '' }, { label: 'Apps', description: '' }],
      },
    ],
  },
})

const result = (toolUseId: string, content: string, isError = false) => ({
  type: 'tool_result' as const,
  toolUseId,
  toolName: '',
  content,
  isError,
})

describe('foldAnsweredQuestions', () => {
  it('returns messages unchanged when there is no AskUserQuestion', () => {
    const messages = [msg('m1', 'assistant', [{ type: 'text', text: 'hi' }])]
    expect(foldAnsweredQuestions(messages)).toBe(messages)
  })

  it('replaces the tool_use with a question_answer block and drops the result message', () => {
    const messages = [
      msg('m1', 'assistant', [{ type: 'text', text: 'Let me ask.' }, askBlock('toolu_1')]),
      msg('m2', 'user', [
        result('toolu_1', `User has answered your questions: "${QUESTION}"="Botik". You can now continue with the user's answers in mind.`),
      ]),
    ]
    const out = foldAnsweredQuestions(messages)
    expect(out.map((m) => m.id)).toEqual(['m1'])
    expect(out[0].content).toEqual([
      { type: 'text', text: 'Let me ask.' },
      {
        type: 'question_answer',
        toolUseId: 'toolu_1',
        items: [{ header: 'Project area', question: QUESTION, answer: 'Botik' }],
      },
    ])
  })

  it('keeps other blocks that share a message with the answered result', () => {
    const messages = [
      msg('m1', 'assistant', [askBlock('toolu_1')]),
      msg('m2', 'user', [result('toolu_1', '"Project area"="Botik"'), { type: 'text', text: 'extra note' }]),
    ]
    const m2 = foldAnsweredQuestions(messages).find((m) => m.id === 'm2')
    expect(m2?.content).toEqual([{ type: 'text', text: 'extra note' }])
  })

  it('leaves a pending question untouched', () => {
    const messages = [msg('m1', 'assistant', [askBlock('toolu_1')])]
    expect(foldAnsweredQuestions(messages)).toBe(messages)
  })

  it('leaves an errored (cancelled) question as raw tool cards', () => {
    const messages = [
      msg('m1', 'assistant', [askBlock('toolu_1')]),
      msg('m2', 'user', [result('toolu_1', "The user doesn't want to proceed", true)]),
    ]
    expect(foldAnsweredQuestions(messages)).toBe(messages)
  })
})

describe('parseAnswers', () => {
  const qs = [
    { header: 'Gate', question: 'Should the gate apply?' },
    { header: 'Scope', question: 'Which profile?' },
  ]

  it('splits a multi-question result, keeping quotes inside answers', () => {
    const content =
      'User has answered your questions: "Should the gate apply?"="Depends: if it "exists" now, no", ' +
      '"Which profile?"="Integration". You can now continue with the user\'s answers in mind.'
    expect(parseAnswers(content, qs)).toEqual(['Depends: if it "exists" now, no', 'Integration'])
  })

  it('puts an unrecognised result whole on the last question', () => {
    expect(parseAnswers('User has answered your questions: free text', qs)).toEqual(['', 'free text'])
  })
})
