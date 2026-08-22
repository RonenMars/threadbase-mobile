import React from 'react'
import { render } from '@testing-library/react-native'
import type { NativeStackNavigationOptions } from 'expo-router'
import i18n from '@/lib/i18n'
import SessionLayout from '@/app/session/_layout'

let capturedScreenOptions: NativeStackNavigationOptions | undefined

jest.mock('expo-router', () => {
  const ReactActual = require('react') as typeof React
  const { View } = require('react-native')
  const Stack = ({
    children,
    screenOptions,
  }: {
    children?: React.ReactNode
    screenOptions?: NativeStackNavigationOptions
  }) => {
    capturedScreenOptions = screenOptions
    return ReactActual.createElement(View, null, children)
  }
  Stack.Screen = () => null
  return { Stack }
})

describe('Session stack directional motion', () => {
  beforeEach(async () => {
    capturedScreenOptions = undefined
    await i18n.changeLanguage('en')
  })

  it('keeps the platform-default transition in LTR', async () => {
    await render(<SessionLayout />)

    expect(capturedScreenOptions?.animation).toBeUndefined()
  })

  it('enters from the left in RTL without overriding gestures', async () => {
    await i18n.changeLanguage('he')
    await render(<SessionLayout />)

    expect(capturedScreenOptions?.animation).toBe('slide_from_left')
    expect(capturedScreenOptions?.gestureDirection).toBeUndefined()
    expect(capturedScreenOptions?.animationMatchesGesture).toBeUndefined()
  })
})
