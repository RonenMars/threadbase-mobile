import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { RemoteKeyboardControls } from '@/components/sessions/RemoteKeyboardControls'

describe('RemoteKeyboardControls', () => {
  it('keeps every key reachable in one row, with close', async () => {
    const onClose = jest.fn()
    const onSend = jest.fn()
    const { getByLabelText, getByTestId } = await render(
      <ThemeProvider><RemoteKeyboardControls onClose={onClose} onSend={onSend} /></ThemeProvider>,
    )

    for (const action of ['escape', 'tab', 'shift_tab', 'left', 'up', 'down', 'right'] as const) {
      expect(getByTestId(`remote-key-${action}`)).toBeTruthy()
    }
    expect(getByTestId('remote-key-enter')).toBeTruthy()
    fireEvent.press(getByLabelText('Close remote keyboard'))
    expect(onClose).toHaveBeenCalled()
  })

  it('sends each constrained navigation action with the current prompt identity', async () => {
    const onSend = jest.fn()
    const { getByLabelText, getByTestId } = await render(
      <ThemeProvider><RemoteKeyboardControls promptId="prompt-1" onClose={jest.fn()} onSend={onSend} /></ThemeProvider>,
    )

    fireEvent.press(getByLabelText('Tab'))
    fireEvent.press(getByLabelText('Esc'))
    fireEvent.press(getByTestId('remote-key-enter'))
    fireEvent(getByLabelText('Confirm selected option. Hold to send Enter.'), 'longPress')

    expect(onSend).toHaveBeenNthCalledWith(1, 'tab', undefined)
    expect(onSend).toHaveBeenNthCalledWith(2, 'escape', undefined)
    expect(onSend).toHaveBeenNthCalledWith(3, 'enter', true)
    expect(onSend).toHaveBeenNthCalledWith(4, 'enter', true)
  })
})
