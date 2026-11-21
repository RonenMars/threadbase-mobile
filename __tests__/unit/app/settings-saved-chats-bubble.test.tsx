import React from 'react'
import { fireEvent, render, within } from '@testing-library/react-native'
import SettingsScreen from '@/app/settings'
import { useQuickAccessStore } from '@/stores/quickAccess'

async function bubbleSwitch() {
  const screen = await render(<SettingsScreen />)
  return () => within(screen.getByTestId('settings-saved-chats-bubble')).getByRole('switch')
}

describe('settings saved-chats bubble switch', () => {
  beforeEach(() => useQuickAccessStore.setState({ shelfHidden: false }))

  it('is on while the bubble shows, and turns it off and on again', async () => {
    const getSwitch = await bubbleSwitch()
    expect(getSwitch().props.value).toBe(true)

    await fireEvent(getSwitch(), 'valueChange', false)
    expect(useQuickAccessStore.getState().shelfHidden).toBe(true)

    await fireEvent(getSwitch(), 'valueChange', true)
    expect(useQuickAccessStore.getState().shelfHidden).toBe(false)
  })

  it('shows the switch off when the bubble was dragged away', async () => {
    useQuickAccessStore.setState({ shelfHidden: true })
    const getSwitch = await bubbleSwitch()
    expect(getSwitch().props.value).toBe(false)
  })
})
