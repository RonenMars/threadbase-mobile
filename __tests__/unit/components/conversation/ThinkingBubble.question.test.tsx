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

describe('ThinkingBubble multi-select structured question', () => {
  const multi: QuestionBlock = { ...aq, questions: [{ ...aq.questions[0], multiSelect: true }] }

  it('sends every checked label as an array on Submit, and nothing before', async () => {
    const onAnswer = jest.fn()
    const { getByLabelText, getByRole } = await render(
      <ThinkingBubble lines={[]} activeQuestion={multi} onAnswer={onAnswer} />,
    )
    await fireEvent.press(getByLabelText('B'))
    await fireEvent.press(getByLabelText('A'))
    expect(onAnswer).not.toHaveBeenCalled()
    await fireEvent.press(getByRole('button', { name: 'Submit' }))
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer).toHaveBeenCalledWith('t1', { 'Q?': ['A', 'B'] })
  })

  it('still sends a plain string for a single-select question', async () => {
    const onAnswer = jest.fn()
    const { getByLabelText } = await render(
      <ThinkingBubble lines={[]} activeQuestion={aq} onAnswer={onAnswer} />,
    )
    await fireEvent.press(getByLabelText('A'))
    expect(onAnswer).toHaveBeenCalledWith('t1', { 'Q?': 'A' })
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

  // The full-screen key is the card's content, so a scraped card whose option
  // list changes between repaints is a "new prompt" every time and re-opens
  // after a minimize. The echoed numbered user message (#1424) was such a card:
  // the agent's "Ran 1 shell command" row came and went under it.
  it('never opens a full-screen card for an echoed numbered message while agent chrome repaints under it', async () => {
    const echo = [
      '✻ Churned for 1m 56s · done 3:57 PM',
      '',
      '❯ 1. After work hours page and open PR.',
      '  2. Write a prompt to fix it in the streamer',
    ]
    const frames = [[...echo, '  Ran 1 shell command'], echo, [...echo, '  Ran 1 shell command'], echo]
    const { queryByTestId, rerender } = await render(
      <ThinkingBubble lines={frames[0]} onSendKeys={jest.fn()} />,
    )
    for (const lines of frames) {
      await rerender(<ThinkingBubble lines={lines} onSendKeys={jest.fn()} />)
      expect(queryByTestId('question-fullscreen')).toBeNull()
      expect(queryByTestId('question-card')).toBeNull()
    }
  })

  it('keeps a pending (ghost) answer inline', async () => {
    const { queryByTestId, getByTestId } = await render(
      <ThinkingBubble lines={[]} activeQuestion={aq} answerPhase="pending" onAnswer={jest.fn()} />,
    )
    expect(queryByTestId('question-fullscreen')).toBeNull()
    expect(getByTestId('question-card-ghost')).toBeTruthy()
  })
})
