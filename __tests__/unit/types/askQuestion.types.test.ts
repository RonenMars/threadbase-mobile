import type { AskQuestion, QuestionWsMessage } from '@/types/api'

describe('AskQuestion types', () => {
  it('accepts a well-formed structured question message', () => {
    const msg: QuestionWsMessage = {
      type: 'question',
      sessionId: 's1',
      toolUseId: 'toolu_1',
      questions: [
        {
          question: 'How should I format the output?',
          header: 'Format',
          multiSelect: false,
          options: [
            { label: 'Summary', description: 'Brief overview' },
            { label: 'Detailed', description: 'Full explanation', preview: 'a\nb' },
          ],
        },
      ],
    }
    expect(msg.questions[0].options).toHaveLength(2)
    const q: AskQuestion = msg.questions[0]
    expect(q.multiSelect).toBe(false)
  })
})
