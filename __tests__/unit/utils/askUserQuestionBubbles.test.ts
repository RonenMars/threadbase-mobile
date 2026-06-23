import { extractAnsweredQuestions } from '@/utils/askUserQuestionBubbles'
import type { Message } from '@/types/api'

function msg(id: string, role: 'user' | 'assistant', content: Message['content']): Message {
  return { id, uuid: id, role, content, timestamp: '2026-06-23T10:00:00Z', is_sidechain: false, parent_uuid: null }
}

const askBlock = (toolId: string) => ({
  type: 'tool_use' as const,
  id: toolId,
  name: 'AskUserQuestion',
  input: {
    questions: [
      {
        question: 'Which project area do you want to work on?',
        header: 'Project area',
        options: [{ label: 'Botik', description: '' }, { label: 'Apps', description: '' }],
      },
    ],
  },
})

describe('extractAnsweredQuestions', () => {
  it('returns messages unchanged when there is no AskUserQuestion', () => {
    const messages = [msg('m1', 'assistant', [{ type: 'text', text: 'hi' }])]
    const r = extractAnsweredQuestions(messages)
    expect(r.messages).toBe(messages)
    expect(r.answeredToolUseIds.size).toBe(0)
  })

  it('splices a question + answer bubble after the tool_use message once answered', () => {
    const messages = [
      msg('m1', 'assistant', [askBlock('toolu_1')]),
      msg('m2', 'user', [
        { type: 'tool_result', toolUseId: 'toolu_1', toolName: '', content: '"Project area"="Botik"' },
      ]),
    ]
    const r = extractAnsweredQuestions(messages)
    expect(r.answeredToolUseIds.has('toolu_1')).toBe(true)
    // m1 (keeps the tool_use summary), then injected question + answer bubbles.
    // m2 held ONLY the answered tool_result → stripped → dropped (its content is
    // now the answer bubble; rendering the raw tool_result too would duplicate it).
    const ids = r.messages.map((m) => m.id)
    expect(ids).toEqual(['m1', 'auq-q-toolu_1', 'auq-a-toolu_1'])
    const qBubble = r.messages[1]
    expect(qBubble.role).toBe('assistant')
    expect(qBubble.content).toEqual([
      { type: 'text', text: 'Project area\nWhich project area do you want to work on?' },
    ])
    const aBubble = r.messages[2]
    expect(aBubble.role).toBe('user')
    expect(aBubble.content).toEqual([{ type: 'text', text: '"Project area"="Botik"' }])
  })

  it('strips only the answered tool_result, keeping other blocks in the same message', () => {
    const messages = [
      msg('m1', 'assistant', [askBlock('toolu_1')]),
      msg('m2', 'user', [
        { type: 'tool_result', toolUseId: 'toolu_1', toolName: '', content: '"Project area"="Botik"' },
        { type: 'text', text: 'extra note' },
      ]),
    ]
    const r = extractAnsweredQuestions(messages)
    // m2 survives but without the answered tool_result block.
    const m2 = r.messages.find((m) => m.id === 'm2')
    expect(m2).toBeDefined()
    expect(m2?.content).toEqual([{ type: 'text', text: 'extra note' }])
    // No tool_result for toolu_1 remains anywhere.
    const hasResult = r.messages.some((m) =>
      m.content.some((b) => b.type === 'tool_result' && b.toolUseId === 'toolu_1'),
    )
    expect(hasResult).toBe(false)
  })

  it('does not inject bubbles for a still-pending question (no tool_result yet)', () => {
    const messages = [msg('m1', 'assistant', [askBlock('toolu_1')])]
    const r = extractAnsweredQuestions(messages)
    expect(r.answeredToolUseIds.size).toBe(0)
    expect(r.messages).toBe(messages)
  })

  it('omits the header line when a question has no header', () => {
    const noHeader = {
      type: 'tool_use' as const,
      id: 'toolu_2',
      name: 'AskUserQuestion',
      input: { questions: [{ question: 'Proceed?', options: [{ label: 'Yes', description: '' }] }] },
    }
    const messages = [
      msg('m1', 'assistant', [noHeader]),
      msg('m2', 'user', [{ type: 'tool_result', toolUseId: 'toolu_2', toolName: '', content: 'Yes' }]),
    ]
    const r = extractAnsweredQuestions(messages)
    expect(r.messages[1].content).toEqual([{ type: 'text', text: 'Proceed?' }])
  })
})
