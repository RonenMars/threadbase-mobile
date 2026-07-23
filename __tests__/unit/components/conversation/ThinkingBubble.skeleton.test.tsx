import { render } from '@testing-library/react-native'
import React from 'react'
import { ThinkingBubble } from '@/components/conversation/ThinkingBubble'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'

// isStreaming goes false after 1500ms of PTY silence, but Claude routinely
// thinks for 30s+ without emitting anything. That window used to render a
// frozen block of stale terminal text with nothing moving, which reads as a
// dead session — the skeleton is what keeps the in-progress turn legible.
describe('ThinkingBubble progress skeleton', () => {
  it('shows the skeleton when the agent is working but the PTY has gone quiet', async () => {
    const { queryByTestId } = await render(
      <ThinkingBubble lines={['Reading file…', 'Done']} isStreaming={false} />,
    )
    expect(queryByTestId('thinking-skeleton')).toBeTruthy()
  })

  it('shows dots instead of the skeleton while output is actively streaming', async () => {
    const { queryByTestId } = await render(
      <ThinkingBubble lines={['Reading file…']} isStreaming />,
    )
    expect(queryByTestId('thinking-skeleton')).toBeNull()
  })

  it('shows dots (not the skeleton) before any output has arrived', async () => {
    const { queryByTestId } = await render(<ThinkingBubble lines={[]} isStreaming={false} />)
    expect(queryByTestId('thinking-skeleton')).toBeNull()
  })

  it('shows neither once a question card takes over the bubble', async () => {
    const question: QuestionBlock = {
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
    const { queryByTestId } = await render(
      <ThinkingBubble lines={['x']} isStreaming={false} activeQuestion={question} />,
    )
    expect(queryByTestId('thinking-skeleton')).toBeNull()
  })
})
