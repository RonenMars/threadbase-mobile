import { render } from '@testing-library/react-native'
import React from 'react'
import { ThinkingBubble } from '@/components/conversation/ThinkingBubble'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'

// A phase label beside a question card would contradict it: the card means the
// turn is waiting on the user, not that the agent is working. Both card paths —
// the structured WS question and the PTY-scraped block — must suppress it.
const structured: QuestionBlock = {
  source: 'structured',
  toolUseId: 't1',
  questions: [
    {
      question: 'Proceed?',
      header: 'H',
      multiSelect: false,
      options: [{ label: 'Yes', description: 'y' }],
    },
  ],
}

const ptyQuestionLines = [
  '? Add fallback to ConversationCache?',
  '❯ both (Recommended)',
  '  indicator only',
]

describe('ThinkingBubble agent phase', () => {
  it('renders the phase label while the agent is working', async () => {
    const { getByTestId } = await render(
      <ThinkingBubble lines={['Reading file…']} isStreaming subStatus="working" />,
    )
    expect(getByTestId('thinking-phase')).toBeTruthy()
  })

  // Claude never emits a phase (the streamer stubs subStatus to null), so the
  // working cue can't hinge on one: the scanner still shows, only the text label
  // is dropped. The footer's mount gate is what means "the agent is working".
  it('still shows the working scanner when there is no phase', async () => {
    const { queryByTestId } = await render(
      <ThinkingBubble lines={['Reading file…']} isStreaming subStatus={null} />,
    )
    expect(queryByTestId('thinking-bubble')).toBeTruthy()
    expect(queryByTestId('thinking-scanner')).toBeTruthy()
  })

  it('shows the scanner alongside the phase label when a phase is present', async () => {
    const { queryByTestId } = await render(
      <ThinkingBubble lines={['Reading file…']} isStreaming subStatus="working" />,
    )
    expect(queryByTestId('thinking-scanner')).toBeTruthy()
    expect(queryByTestId('thinking-phase')).toBeTruthy()
  })

  it('still renders a question card when there is no phase', async () => {
    const { queryByTestId } = await render(
      <ThinkingBubble lines={['x']} isStreaming subStatus={null} activeQuestion={structured} />,
    )
    expect(queryByTestId('thinking-bubble')).toBeTruthy()
  })

  it('hides the phase behind a structured question card', async () => {
    const { queryByTestId } = await render(
      <ThinkingBubble
        lines={['Reading file…']}
        isStreaming
        subStatus="working"
        activeQuestion={structured}
      />,
    )
    expect(queryByTestId('thinking-phase')).toBeNull()
  })

  it('hides the phase behind a PTY-scraped question card', async () => {
    const { queryByTestId } = await render(
      <ThinkingBubble
        lines={ptyQuestionLines}
        isStreaming
        subStatus="working"
        onSendKeys={() => {}}
      />,
    )
    expect(queryByTestId('thinking-phase')).toBeNull()
  })
})
