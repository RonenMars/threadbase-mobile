import { render, fireEvent } from '@testing-library/react-native'
import React from 'react'
import { ThinkingBubble } from '@/components/conversation/ThinkingBubble'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'

// The global mock renders the provider as a bare View; tag it so the test can see where it sits.
jest.mock('react-native-safe-area-context', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    __esModule: true,
    SafeAreaView: ({ children, ...props }: any) => React.createElement(View, props, children),
    SafeAreaProvider: ({ children }: any) => React.createElement(View, { testID: 'modal-safe-area-provider' }, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    initialWindowMetrics: null,
  }
})

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
  it('gives the modal its own SafeAreaProvider so insets are not 0 inside the native window', async () => {
    const { getByTestId } = await render(
      <ThinkingBubble lines={[]} activeQuestion={aq} onAnswer={jest.fn()} />,
    )
    expect(getByTestId('modal-safe-area-provider')).toContainElement(getByTestId('question-fullscreen'))
  })

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
