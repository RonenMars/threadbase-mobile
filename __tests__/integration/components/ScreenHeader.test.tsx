import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { useRouter } from 'expo-router'
import { ScreenHeader } from '@/components/shared/ScreenHeader'

describe('ScreenHeader – back button', () => {
  it('pops the stack when there is a screen to go back to', () => {
    const back = jest.fn()
    const replace = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({
      back,
      replace,
      canGoBack: () => true,
    })

    const { getByTestId } = render(<ScreenHeader title="Test" />)
    fireEvent.press(getByTestId('screen-header-back-button'))

    expect(back).toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  // Deep links can mount a screen as the only stack entry — GO_BACK would be
  // unhandled, so the header must fall back to the hub instead.
  it('falls back to the hub when the stack cannot go back', () => {
    const back = jest.fn()
    const replace = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({
      back,
      replace,
      canGoBack: () => false,
    })

    const { getByTestId } = render(<ScreenHeader title="Test" />)
    fireEvent.press(getByTestId('screen-header-back-button'))

    expect(back).not.toHaveBeenCalled()
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('prefers a caller-provided onBack handler', () => {
    const onBack = jest.fn()
    const back = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({
      back,
      replace: jest.fn(),
      canGoBack: () => true,
    })

    const { getByTestId } = render(<ScreenHeader title="Test" onBack={onBack} />)
    fireEvent.press(getByTestId('screen-header-back-button'))

    expect(onBack).toHaveBeenCalled()
    expect(back).not.toHaveBeenCalled()
  })
})
