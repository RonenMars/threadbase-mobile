import React from 'react'
import { StyleSheet, type ViewStyle } from 'react-native'
import { render, fireEvent, cleanup } from '@testing-library/react-native'
import { useRouter } from 'expo-router'
import { ScreenHeader } from '@/components/shared/ScreenHeader'
import { DirectionRoot } from '@/lib/direction-root'
import i18n from '@/test-utils/i18n-setup'

function isMirrored(element: { props: { style?: ViewStyle | ViewStyle[] } }): boolean {
  const style = StyleSheet.flatten(element.props.style)
  const transform = style.transform
  if (!Array.isArray(transform)) return false
  return transform.some((entry) => 'scaleX' in entry && entry.scaleX === -1)
}

describe('ScreenHeader – back button', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('pops the stack when there is a screen to go back to', async () => {
    const back = jest.fn()
    const replace = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({
      back,
      replace,
      canGoBack: () => true,
    })

    const { getByTestId } = await render(
      <DirectionRoot>
        <ScreenHeader title="Test" />
      </DirectionRoot>,
    )
    await fireEvent.press(getByTestId('screen-header-back-button'))

    expect(back).toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  // Deep links can mount a screen as the only stack entry — GO_BACK would be
  // unhandled, so the header must fall back to the hub instead.
  it('falls back to the hub when the stack cannot go back', async () => {
    const back = jest.fn()
    const replace = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({
      back,
      replace,
      canGoBack: () => false,
    })

    const { getByTestId } = await render(
      <DirectionRoot>
        <ScreenHeader title="Test" />
      </DirectionRoot>,
    )
    await fireEvent.press(getByTestId('screen-header-back-button'))

    expect(back).not.toHaveBeenCalled()
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('prefers a caller-provided onBack handler', async () => {
    const onBack = jest.fn()
    const back = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({
      back,
      replace: jest.fn(),
      canGoBack: () => true,
    })

    const { getByTestId } = await render(
      <DirectionRoot>
        <ScreenHeader title="Test" onBack={onBack} />
      </DirectionRoot>,
    )
    await fireEvent.press(getByTestId('screen-header-back-button'))

    expect(onBack).toHaveBeenCalled()
    expect(back).not.toHaveBeenCalled()
  })

  it('leaves the back caret unmirrored in LTR and mirrors it in RTL', async () => {
    ;(useRouter as jest.Mock).mockReturnValue({
      back: jest.fn(),
      replace: jest.fn(),
      canGoBack: () => true,
    })

    const ltr = await render(
      <DirectionRoot>
        <ScreenHeader title="Test" />
      </DirectionRoot>,
    )
    expect(isMirrored(ltr.getByTestId('phosphor-react-native-caret-left-undefined'))).toBe(false)
    expect(StyleSheet.flatten(ltr.getByText('Test').props.style)).toEqual(
      expect.objectContaining({ direction: 'ltr', writingDirection: 'ltr', textAlign: 'auto' }),
    )

    cleanup()
    await i18n.changeLanguage('he')
    const rtl = await render(
      <DirectionRoot>
        <ScreenHeader title="Test" />
      </DirectionRoot>,
    )
    expect(isMirrored(rtl.getByTestId('phosphor-react-native-caret-left-undefined'))).toBe(true)
    expect(StyleSheet.flatten(rtl.getByText('Test').props.style)).toEqual(
      expect.objectContaining({ direction: 'rtl', writingDirection: 'rtl', textAlign: 'auto' }),
    )
  })
})
