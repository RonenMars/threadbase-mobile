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
})
