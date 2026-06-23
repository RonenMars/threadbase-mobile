import { render } from '@testing-library/react-native'
import React from 'react'
import { ThinkingBubble } from '@/components/conversation/ThinkingBubble'

// The structured question / permission card no longer lives in ThinkingBubble —
// it moved to LiveConversationView so it can render independent of the thinking
// state (an AskUserQuestion parks the agent, which used to hide the bubble +
// card together). ThinkingBubble is now strictly the dots + PTY preview.
describe('ThinkingBubble', () => {
  it('renders the live PTY lines and no question card', () => {
    const { getByText, getByTestId, queryByLabelText } = render(
      <ThinkingBubble lines={['Scanning project...']} isStreaming={false} />,
    )
    expect(getByTestId('thinking-bubble')).toBeTruthy()
    expect(getByText('Scanning project...')).toBeTruthy()
    // No radio option rows are rendered here anymore.
    expect(queryByLabelText('A')).toBeNull()
  })

  it('hides the PTY preview when hidePreview is set (a card renders the prompt instead)', () => {
    // The same prompt text shows in the question card below; suppress the raw
    // terminal echo so it isn't duplicated.
    const { queryByText, queryByTestId } = render(
      <ThinkingBubble lines={['Do you want to proceed?']} isStreaming={false} hidePreview />,
    )
    expect(queryByText('Do you want to proceed?')).toBeNull()
    // Not streaming + preview hidden → the bubble renders nothing at all.
    expect(queryByTestId('thinking-bubble')).toBeNull()
  })

  it('still shows the dots while streaming even when hidePreview is set', () => {
    const { getByTestId, queryByText } = render(
      <ThinkingBubble lines={['Do you want to proceed?']} isStreaming hidePreview />,
    )
    expect(getByTestId('thinking-bubble')).toBeTruthy()
    expect(queryByText('Do you want to proceed?')).toBeNull()
  })
})
