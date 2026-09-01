import React from 'react'
import { StyleSheet } from 'react-native'
import { render } from '@testing-library/react-native'
import { NoServersWelcome } from '@/components/servers/NoServersWelcome'
import { nord } from '@/constants/theme'

const mockUseIsGlass = jest.fn(() => true)

jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => require('@/constants/theme').nord,
  useIsGlass: () => mockUseIsGlass(),
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

describe('NoServersWelcome', () => {
  beforeEach(() => {
    mockUseIsGlass.mockReturnValue(true)
  })

  it('uses a high-contrast description color over the glass card', async () => {
    const screen = await render(<NoServersWelcome />)

    expect(StyleSheet.flatten(screen.getByText(/Threadbase connects/).props.style)).toEqual(
      expect.objectContaining({ color: nord.text.primary }),
    )
  })

  it('uses the palette foreground on its accent CTA', async () => {
    const screen = await render(<NoServersWelcome />)

    expect(StyleSheet.flatten(screen.getByText('Add Server').props.style)).toEqual(
      expect.objectContaining({ color: nord.text.onAccent }),
    )
  })
})
