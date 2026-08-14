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

  it('renders nothing when there is no phase', async () => {
    const { queryByTestId } = await render(
      <ThinkingBubble lines={['Reading file…']} isStreaming subStatus={null} />,
    )
    expect(queryByTestId('thinking-phase')).toBeNull()
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
