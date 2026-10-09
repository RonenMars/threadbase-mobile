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
      <ThinkingBubble lines={[]} activeQuestion={aq} onAnswer={onAnswer} />,
    )
    await fireEvent.press(getByLabelText('B'))
    expect(onAnswer).toHaveBeenCalledWith('t1', { 'Q?': 'B' })
  })
})

describe('ThinkingBubble full-screen question', () => {
  it('opens full screen, minimizes into the transcript, and re-opens', async () => {
    const { getByTestId, queryByTestId } = await render(
      <ThinkingBubble lines={[]} activeQuestion={aq} onAnswer={jest.fn()} />,
    )
    expect(getByTestId('question-fullscreen')).toBeTruthy()

    await fireEvent.press(getByTestId('question-fullscreen-minimize'))
    expect(queryByTestId('question-fullscreen')).toBeNull()
    expect(getByTestId('question-card')).toBeTruthy()

    await fireEvent.press(getByTestId('question-open-fullscreen'))
    expect(getByTestId('question-fullscreen')).toBeTruthy()
  })

  it('re-opens full screen for the next prompt after one was minimized', async () => {
    const { getByTestId, rerender } = await render(
      <ThinkingBubble lines={[]} activeQuestion={aq} onAnswer={jest.fn()} />,
    )
    await fireEvent.press(getByTestId('question-fullscreen-minimize'))
    const next: QuestionBlock = { ...aq, toolUseId: 't2', questions: [{ ...aq.questions[0], question: 'Next?' }] }
    await rerender(<ThinkingBubble lines={[]} activeQuestion={next} onAnswer={jest.fn()} />)
    expect(getByTestId('question-fullscreen')).toBeTruthy()
  })

  it('keeps a pending (ghost) answer inline', async () => {
    const { queryByTestId, getByTestId } = await render(
      <ThinkingBubble lines={[]} activeQuestion={aq} answerPhase="pending" onAnswer={jest.fn()} />,
    )
    expect(queryByTestId('question-fullscreen')).toBeNull()
    expect(getByTestId('question-card-ghost')).toBeTruthy()
  })
})
