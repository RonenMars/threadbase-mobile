import React from 'react'
import { Keyboard, type KeyboardEventName } from 'react-native'
import { act, fireEvent, render } from '@testing-library/react-native'
import { KeyboardDismissOverlay } from '@/components/ui/KeyboardDismissOverlay'
import '@/test-utils/i18n-setup'

const listeners = new Map<KeyboardEventName, () => void>()

beforeEach(() => {
  listeners.clear()
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false)
  jest.spyOn(Keyboard, 'addListener').mockImplementation((event, listener) => {
    listeners.set(event, () => listener({} as Parameters<typeof listener>[0]))
    return { remove: () => listeners.delete(event) } as ReturnType<typeof Keyboard.addListener>
  })
})

afterEach(() => jest.restoreAllMocks())

const emit = (suffix: 'Show' | 'Hide') =>
  act(() => {
    for (const [event, fire] of listeners) if (event.endsWith(suffix)) fire()
  })

describe('KeyboardDismissOverlay', () => {
  it('covers the screen only while the keyboard is up, and a tap closes it', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {})
    const r = await render(<KeyboardDismissOverlay />)
    expect(r.queryByTestId('keyboard-dismiss-overlay')).toBeNull()

    await emit('Show')
    await fireEvent.press(r.getByTestId('keyboard-dismiss-overlay'))
    expect(dismiss).toHaveBeenCalledTimes(1)

    await emit('Hide')
    expect(r.queryByTestId('keyboard-dismiss-overlay')).toBeNull()
  })

  it('shows at once when it mounts with the keyboard already up', async () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true)
    const r = await render(<KeyboardDismissOverlay />)
    expect(r.getByTestId('keyboard-dismiss-overlay')).toBeTruthy()
  })
})
