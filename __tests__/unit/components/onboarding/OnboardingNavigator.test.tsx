import React from 'react'
import { I18nManager } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { OnboardingNavigator, TOTAL_STEPS } from '@/components/onboarding/OnboardingNavigator'
import { useSettingsStore } from '@/stores/settings'
import i18n from '@/test-utils/i18n-setup'

const mockReloadAppAsync = jest.fn()
const mockAddServer = jest.fn().mockResolvedValue('srv_test')

jest.mock('expo', () => ({
  reloadAppAsync: (...args: unknown[]) => mockReloadAppAsync(...args),
}))

jest.mock('@/stores/servers', () => ({
  useServersStore: (selector: (state: { addServer: typeof mockAddServer }) => unknown) =>
    selector({ addServer: mockAddServer }),
}))

jest.mock('@/components/onboarding/OnboardingShell', () => {
  const React = require('react')
  const { Pressable, Text, View } = require('react-native')
  return { OnboardingShell: ({
    index,
    total,
    onNext,
    onBack,
    onSkip,
    children,
  }: {
    index: number
    total: number
    onNext: () => void
    onBack: () => void
    onSkip: () => void
    children: unknown
  }) => (
    <View testID="onboarding-shell" accessibilityValue={{ now: index, max: total }}>
      <Pressable testID="shell-next" onPress={onNext}><Text>next</Text></Pressable>
      <Pressable testID="shell-back" onPress={onBack}><Text>back</Text></Pressable>
      <Pressable testID="shell-skip" onPress={onSkip}><Text>skip</Text></Pressable>
      {children}
    </View>
  ) }
})

jest.mock('@/components/onboarding/steps/WelcomeStep', () => {
  const React = require('react')
  const { Pressable, Text } = require('react-native')
  return { WelcomeStep: ({ onNext }: { onNext: () => void }) => (
    <Pressable testID="step-welcome" onPress={onNext}><Text>welcome</Text></Pressable>
  ) }
})

jest.mock('@/components/onboarding/steps/ConnectStep', () => {
  const React = require('react')
  const { Pressable, Text } = require('react-native')
  return { ConnectStep: ({
    onPaired,
    onAdvance,
  }: {
    onPaired: (result: { url: string; apiKey: string }) => void
    onAdvance: () => void
  }) => (
    <Pressable
      testID="step-connect"
      onPress={() => {
        onPaired({ url: 'http://localhost:8766', apiKey: 'token' })
        onAdvance()
      }}
    >
      <Text>connect</Text>
    </Pressable>
  ) }
})

jest.mock('@/components/onboarding/steps/NotificationsStep', () => {
  const React = require('react')
  const { Pressable, Text } = require('react-native')
  return { NotificationsStep: ({ onNext }: { onNext: () => void }) => (
    <Pressable testID="step-notifications" onPress={onNext}>
      <Text>notifications</Text>
    </Pressable>
  ) }
})

jest.mock('@/components/onboarding/steps/DoneStep', () => {
  const React = require('react')
  const { View } = require('react-native')
  return { DoneStep: () => <View testID="step-done" /> }
})

describe('OnboardingNavigator', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
    ;(AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined)
    ;(AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined)
    mockReloadAppAsync.mockResolvedValue(undefined)
    useSettingsStore.setState({ locale: 'en' })
    await i18n.changeLanguage('en')
    Object.defineProperty(I18nManager, 'isRTL', { configurable: true, value: false })
    jest.spyOn(I18nManager, 'forceRTL').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('uses the five-step order and preserves guarded, skip, pair, and back navigation', async () => {
    const screen = await render(<OnboardingNavigator onDone={jest.fn()} />)

    expect(TOTAL_STEPS).toBe(5)
    expect(screen.getByTestId('onboarding-language-option-en')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('onboarding-language-cta'))
    expect(await screen.findByTestId('step-welcome')).toBeTruthy()

    await fireEvent.press(screen.getByTestId('shell-back'))
    expect(await screen.findByTestId('onboarding-language-option-en')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('onboarding-language-cta'))
    const welcome = await screen.findByTestId('step-welcome')
    await fireEvent.press(welcome)
    expect(await screen.findByTestId('step-connect')).toBeTruthy()

    await fireEvent.press(screen.getByTestId('shell-next'))
    expect(screen.getByTestId('step-connect')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('shell-skip'))
    expect(await screen.findByTestId('step-done')).toBeTruthy()

    await screen.unmount()
    const pairedScreen = await render(<OnboardingNavigator onDone={jest.fn()} />)
    await fireEvent.press(pairedScreen.getByTestId('onboarding-language-cta'))
    const pairedWelcome = await pairedScreen.findByTestId('step-welcome')
    await fireEvent.press(pairedWelcome)
    const connect = await pairedScreen.findByTestId('step-connect')
    await fireEvent.press(connect)
    expect(await pairedScreen.findByTestId('step-notifications')).toBeTruthy()
    await fireEvent.press(pairedScreen.getByTestId('step-notifications'))
    await waitFor(() => expect(pairedScreen.getByTestId('step-done')).toBeTruthy())
  })

  it('uses the language continuation transition for shell-forward at index zero', async () => {
    const screen = await render(<OnboardingNavigator onDone={jest.fn()} />)

    await fireEvent.press(screen.getByTestId('onboarding-language-option-ru'))
    await fireEvent.press(screen.getByTestId('shell-next'))

    expect(await screen.findByTestId('step-welcome')).toBeTruthy()
    expect(mockReloadAppAsync).not.toHaveBeenCalled()
    expect(
      (AsyncStorage.setItem as jest.Mock).mock.calls.some(
        ([key, value]) => key === 'threadbase_settings' && JSON.parse(value).locale === 'ru',
      ),
    ).toBe(true)
  })

  it('advances without a reload when the selected language changes direction', async () => {
    const screen = await render(<OnboardingNavigator onDone={jest.fn()} />)

    await fireEvent.press(screen.getByTestId('onboarding-language-option-he'))
    await fireEvent.press(screen.getByTestId('onboarding-language-cta'))

    expect(await screen.findByTestId('step-welcome')).toBeTruthy()
    expect(mockReloadAppAsync).not.toHaveBeenCalled()
    expect(I18nManager.forceRTL).not.toHaveBeenCalled()
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
      'threadbase_onboarding_resume',
      expect.anything(),
    )
    expect(
      (AsyncStorage.setItem as jest.Mock).mock.calls.some(
        ([key, value]) => key === 'threadbase_settings' && JSON.parse(value).locale === 'he',
      ),
    ).toBe(true)
    expect(i18n.dir()).toBe('rtl')
  })

  it('keeps advancing in RTL even when the native layout state is stale LTR', async () => {
    Object.defineProperty(I18nManager, 'isRTL', { configurable: true, value: false })
    const screen = await render(<OnboardingNavigator onDone={jest.fn()} />)

    await fireEvent.press(screen.getByTestId('onboarding-language-option-ar'))
    await fireEvent.press(screen.getByTestId('onboarding-language-cta'))

    expect(await screen.findByTestId('step-welcome')).toBeTruthy()
    expect(I18nManager.isRTL).toBe(false)
    expect(i18n.dir()).toBe('rtl')
    expect(mockReloadAppAsync).not.toHaveBeenCalled()
  })

  it('consumes the one-shot resume marker before rendering at Welcome', async () => {
    let finishRemoval: (() => void) | undefined
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({ step: 'welcome', mode: 'review' }),
    )
    ;(AsyncStorage.removeItem as jest.Mock).mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        finishRemoval = resolve
      }),
    )

    const screen = await render(<OnboardingNavigator onDone={jest.fn()} mode="review" />)

    expect(screen.queryByTestId('onboarding-language-option-en')).toBeNull()
    expect(screen.queryByTestId('step-welcome')).toBeNull()
    expect(finishRemoval).toBeDefined()

    await act(async () => finishRemoval?.())

    expect(await screen.findByTestId('step-welcome')).toBeTruthy()
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('threadbase_onboarding_resume')
  })

  it('leaves a review resume record for AuthGate until review mode is restored', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ step: 'welcome', mode: 'review' }),
    )
    const screen = await render(<OnboardingNavigator onDone={jest.fn()} />)

    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled())
    expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith('threadbase_onboarding_resume')
    expect(screen.queryByTestId('step-welcome')).toBeNull()

    await screen.rerender(<OnboardingNavigator onDone={jest.fn()} mode="review" />)

    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalledTimes(2))
    expect(await screen.findByTestId('step-welcome')).toBeTruthy()
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('threadbase_onboarding_resume')
  })

  it('clears the marker and shows persistence retry guidance when saving fails', async () => {
    const screen = await render(<OnboardingNavigator onDone={jest.fn()} />)
    ;(AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('storage unavailable'))

    await fireEvent.press(screen.getByTestId('shell-next'))

    expect(await screen.findByTestId('onboarding-language-error')).toHaveTextContent(
      'Couldn’t save your language choice. Try again.',
    )
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('threadbase_onboarding_resume')
    expect(mockReloadAppAsync).not.toHaveBeenCalled()
    expect(
      screen.getByTestId('onboarding-language-option-en').props.accessibilityState.disabled,
    ).toBe(false)
  })
})
