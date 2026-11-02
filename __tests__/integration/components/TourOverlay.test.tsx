import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { TourOverlay } from '@/components/tour/TourOverlay'
import { THEMES, type Theme } from '@/constants/theme'

const mockTheme: { current: Theme } = { current: THEMES.dark }

jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => mockTheme.current,
}))
import i18n from 'i18next'

const TARGET = { x: 20, y: 100, width: 100, height: 50 }

describe('TourOverlay', () => {
  it('renders the tooltip text', async () => {
    const { getByText } = await render(
      <TourOverlay
        target={TARGET}
        text="Each card is a Claude Code session."
        onGotIt={jest.fn()}
        onSkip={jest.fn()}
      />
    )
    expect(getByText('Each card is a Claude Code session.')).toBeTruthy()
  })

  it('calls onGotIt when Got it is pressed', async () => {
    const onGotIt = jest.fn()
    const { getByTestId } = await render(
      <TourOverlay
        target={TARGET}
        text="Some tip"
        onGotIt={onGotIt}
        onSkip={jest.fn()}
      />
    )
    await fireEvent.press(getByTestId('tour-got-it'))
    expect(onGotIt).toHaveBeenCalledTimes(1)
  })

  it('calls onSkip when Skip tour is pressed', async () => {
    const onSkip = jest.fn()
    const { getByTestId } = await render(
      <TourOverlay
        target={TARGET}
        text="Some tip"
        onGotIt={jest.fn()}
        onSkip={onSkip}
      />
    )
    await fireEvent.press(getByTestId('tour-skip'))
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('shows step indicator when stepLabel is provided', async () => {
    const { getByText } = await render(
      <TourOverlay
        target={TARGET}
        text="Some tip"
        onGotIt={jest.fn()}
        onSkip={jest.fn()}
        stepLabel="1 / 3"
      />
    )
    expect(getByText('1 / 3')).toBeTruthy()
  })

  it('does not show step indicator when stepLabel is omitted', async () => {
    const { queryByTestId } = await render(
      <TourOverlay
        target={TARGET}
        text="Some tip"
        onGotIt={jest.fn()}
        onSkip={jest.fn()}
      />
    )
    expect(queryByTestId('tour-step-label')).toBeNull()
  })

  describe('button labels', () => {
    afterEach(async () => {
      await i18n.changeLanguage('en')
    })

    it.each([
      ['en', 'Skip tour', 'Got it →'],
      ['he', 'דלג על הסיור', 'הבנתי ←'],
      ['ar', 'تخطي الجولة', 'فهمت ←'],
      ['ru', 'Пропустить обзор', 'Понятно →'],
    ])('renders the %s skip and got-it labels', async (lng, skip, gotIt) => {
      await i18n.changeLanguage(lng)
      const { getByText } = await render(
        <TourOverlay target={TARGET} text="Some tip" onGotIt={jest.fn()} onSkip={jest.fn()} />
      )
      expect(getByText(skip)).toBeTruthy()
      expect(getByText(gotIt)).toBeTruthy()
    })
  })
})

describe('TourOverlay theming', () => {
  afterEach(() => {
    mockTheme.current = THEMES.dark
  })

  it.each(Object.entries(THEMES))('follows the %s palette', async (_id, theme) => {
    mockTheme.current = theme
    const { getByText, getByTestId } = await render(
      <TourOverlay target={TARGET} text="Some tip" onGotIt={jest.fn()} onSkip={jest.fn()} />
    )
    expect(StyleSheet.flatten(getByText('Some tip').props.style).color).toBe(theme.text.primary)
    expect(StyleSheet.flatten(getByTestId('tour-got-it').props.style).backgroundColor).toBe(theme.text.accent)
    expect(StyleSheet.flatten(getByText('Got it →').props.style).color).toBe(theme.text.onAccent)
  })
})
