import { render, fireEvent } from '@testing-library/react-native'
import React from 'react'
import { ThinkingBubble } from '@/components/conversation/ThinkingBubble'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'

const aq: QuestionBlock = {
  source: 'structured', toolUseId: 't1',
  questions: [{ question: 'Q?', header: 'H', multiSelect: false, options: [{ label: 'A', description: 'a' }, { label: 'B', description: 'b' }] }],
}

describe('ThinkingBubble structured question', () => {
  it('renders the structured QuestionCard and routes answers to onAnswer', async () => {
    const onAnswer = jest.fn()
    const { getByLabelText } = await render(
      <ThinkingBubble lines={[]} isStreaming={false} activeQuestion={aq} onAnswer={onAnswer} />,
    )
    await fireEvent.press(getByLabelText('B'))
    expect(onAnswer).toHaveBeenCalledWith('t1', { 'Q?': 'B' })
  })
})
