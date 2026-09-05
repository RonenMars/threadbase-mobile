import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { RemoteKeyboardControls } from '@/components/sessions/RemoteKeyboardControls'

describe('RemoteKeyboardControls', () => {
  it('sends each constrained navigation action with the current prompt identity', async () => {
    const onSend = jest.fn()
    const { getByLabelText } = await render(
      <ThemeProvider><RemoteKeyboardControls promptId="prompt-1" onClose={jest.fn()} onSend={onSend} /></ThemeProvider>,
    )

    fireEvent.press(getByLabelText('Tab'))
    fireEvent.press(getByLabelText('Esc'))
    fireEvent(getByLabelText('Confirm selected option. Hold to send Enter.'), 'longPress')

    expect(onSend).toHaveBeenNthCalledWith(1, 'tab', undefined)
    expect(onSend).toHaveBeenNthCalledWith(2, 'escape', undefined)
    expect(onSend).toHaveBeenNthCalledWith(3, 'enter', true)
  })
})
