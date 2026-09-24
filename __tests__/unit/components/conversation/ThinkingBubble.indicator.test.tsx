import { render } from '@testing-library/react-native'
import React from 'react'
import { ThinkingBubble } from '@/components/conversation/ThinkingBubble'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'

// The Knight Rider scanner is the bubble's only working cue. A placeholder
// skeleton used to appear under it whenever the PTY went quiet, stacking two
// "loading" treatments on one bubble.
describe('ThinkingBubble working indicator', () => {
  it('shows only the scanner once terminal output has arrived', async () => {
    const { queryByTestId } = await render(
      <ThinkingBubble lines={['Reading file…', 'Done']} subStatus="working" />,
    )
    expect(queryByTestId('thinking-scanner')).toBeTruthy()
    expect(queryByTestId('thinking-skeleton')).toBeNull()
  })

  it('shows only the scanner before any output has arrived', async () => {
    const { queryByTestId } = await render(
      <ThinkingBubble lines={[]} subStatus={null} />,
    )
    expect(queryByTestId('thinking-scanner')).toBeTruthy()
    expect(queryByTestId('thinking-skeleton')).toBeNull()
  })

  it('shows no indicator once a question card takes over the bubble', async () => {
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
      <ThinkingBubble lines={['x']} subStatus="working" activeQuestion={question} />,
    )
    expect(queryByTestId('thinking-scanner')).toBeNull()
  })
})
