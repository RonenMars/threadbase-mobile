import React from 'react'
import { StyleSheet, Text } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { Star } from 'phosphor-react-native'
import { SwipeableRow } from '@/components/sessions/shared/SwipeableRow'
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext'

function Probe({ onTheme }: { onTheme: (bg: string) => void }) {
  onTheme(useTheme().bg.primary)
  return null
}

describe('SwipeableRow', () => {
  beforeAll(() => {
    global.__renderSwipeActions = true
  })
  afterAll(() => {
    global.__renderSwipeActions = false
  })

  it('paints the swiped row opaque so the action panel underneath cannot show through', async () => {
    let listBackground = ''
    await render(
      <ThemeProvider>
        <Probe onTheme={(bg) => (listBackground = bg)} />
        <SwipeableRow leading={[{ key: 'fav', label: 'Favorite', icon: Star, color: '#f5c518', onPress: jest.fn() }]}>
          <Text testID="row-content">row</Text>
        </SwipeableRow>
      </ThemeProvider>,
    )

    const wrapper = screen.getByTestId('row-content').parent
    expect(StyleSheet.flatten(wrapper?.props.style).backgroundColor).toBe(listBackground)
    expect(listBackground).toBeTruthy()
  })

  it('drops the visible label in compact rows so the panel fits a short row, keeping the a11y label', async () => {
    const leading = [{ key: 'fav', label: 'Favorite', icon: Star, color: '#f5c518', onPress: jest.fn(), testID: 'fav' }]
    await render(
      <ThemeProvider>
        <SwipeableRow leading={leading}>
          <Text>tall</Text>
        </SwipeableRow>
        <SwipeableRow leading={leading} compact>
          <Text>short</Text>
        </SwipeableRow>
      </ThemeProvider>,
    )

    expect(screen.getAllByText('Favorite')).toHaveLength(1)
    const [tall, short] = screen.getAllByTestId('fav')
    expect(short.props.accessibilityLabel).toBe('Favorite')
    const size = (action: typeof tall) => {
      const circle = action.children[0]
      return typeof circle === 'string' ? 0 : StyleSheet.flatten(circle?.props.style).height
    }
    expect(size(short)).toBeLessThan(size(tall))
  })
})
