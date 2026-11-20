import React from 'react'
import { act, render, screen } from '@testing-library/react-native'
import { DateTime } from '@/components/ui/DateTime'
import { useSettingsStore } from '@/stores/settings'

const AT = new Date(2026, 4, 15, 9, 7, 0).toISOString()

beforeEach(() => {
  useSettingsStore.setState({ dateFormat: 'auto', timeFormat: '24h' })
})

describe('DateTime', () => {
  it.each([['empty string', ''], ['unparsable string', 'not-a-date'], ['null', null]])(
    'renders nothing for %s',
    async (_label, value) => {
      await render(<DateTime value={value} variant="time" testID="t" />)
      expect(screen.queryByTestId('t')).toBeNull()
    },
  )

  it('time variant follows the stored clock choice, live', async () => {
    await render(<DateTime value={AT} variant="time" testID="t" />)
    expect(screen.getByTestId('t').props.children).toBe('09:07')

    await act(async () => {
      useSettingsStore.setState({ timeFormat: '12h' })
    })
    expect(screen.getByTestId('t').props.children).toMatch(/^9:07\s?AM$/i)
  })

  it('carries an accessibility label', async () => {
    await render(<DateTime value={AT} variant="time" testID="t" />)
    expect(screen.getByTestId('t').props.accessibilityLabel).toBeTruthy()
  })
})
