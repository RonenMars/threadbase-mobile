import React from 'react'
import { I18nManager, StyleSheet } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import i18n from '@/test-utils/i18n-setup'
import { LanguageStep } from '@/components/onboarding/steps/LanguageStep'
import languageStepMeta, {
  Default as LanguageStepDefaultStory,
} from '@/components/onboarding/steps/LanguageStep.stories'
import { useSettingsStore } from '@/stores/settings'

describe('LanguageStep', () => {
  beforeEach(async () => {
    useSettingsStore.setState({ locale: 'en' })
    await i18n.changeLanguage('en')
    Object.defineProperty(I18nManager, 'isRTL', { configurable: true, value: false })
  })

  it.each([false, true])(
    'isolates LTR and RTL autonym direction when the app RTL state is %s',
    async (isRTL) => {
      Object.defineProperty(I18nManager, 'isRTL', { configurable: true, value: isRTL })
      const { getByTestId, getByText } = await render(<LanguageStep onContinue={jest.fn()} />)

      expect(StyleSheet.flatten(getByText('English').props.style)).toEqual(
        expect.objectContaining({ writingDirection: 'ltr', textAlign: 'auto' }),
      )
      expect(StyleSheet.flatten(getByText('עברית').props.style)).toEqual(
        expect.objectContaining({ writingDirection: 'rtl', textAlign: 'auto' }),
      )
      expect(StyleSheet.flatten(getByText('العربية').props.style)).toEqual(
        expect.objectContaining({ writingDirection: 'rtl', textAlign: 'auto' }),
      )
      expect(StyleSheet.flatten(getByText('Русский').props.style)).toEqual(
        expect.objectContaining({ writingDirection: 'ltr', textAlign: 'auto' }),
      )
      expect(StyleSheet.flatten(getByTestId('onboarding-language-option-en').props.style)).toEqual(
        expect.objectContaining({ direction: 'ltr', flexDirection: 'row' }),
      )
      expect(StyleSheet.flatten(getByTestId('onboarding-language-option-he').props.style)).toEqual(
        expect.objectContaining({ direction: 'rtl', flexDirection: 'row' }),
      )
      expect(StyleSheet.flatten(getByTestId('onboarding-language-option-ar').props.style)).toEqual(
        expect.objectContaining({ direction: 'rtl', flexDirection: 'row' }),
      )
      expect(StyleSheet.flatten(getByTestId('onboarding-language-option-ru').props.style)).toEqual(
        expect.objectContaining({ direction: 'ltr', flexDirection: 'row' }),
      )
    },
  )

  it.each(['en', 'he', 'ar', 'ru'] as const)(
    'keeps each row in its own direction while the app itself runs in %s',
    async (appLocale) => {
      // Per-option direction is a property of the language being offered, so it
      // must not follow the app's own direction — and must not follow the stale
      // native RTL state either.
      Object.defineProperty(I18nManager, 'isRTL', {
        configurable: true,
        value: appLocale === 'ru',
      })
      await i18n.changeLanguage(appLocale)
      useSettingsStore.setState({ locale: appLocale })

      const { getByTestId } = await render(<LanguageStep onContinue={jest.fn()} />)

      for (const [code, direction] of [
        ['en', 'ltr'],
        ['he', 'rtl'],
        ['ar', 'rtl'],
        ['ru', 'ltr'],
      ] as const) {
        expect(
          StyleSheet.flatten(getByTestId(`onboarding-language-option-${code}`).props.style),
        ).toEqual(expect.objectContaining({ direction, flexDirection: 'row' }))
      }
    },
  )

  it.each([
    ['en', 'ltr'],
    ['he', 'rtl'],
    ['ar', 'rtl'],
    ['ru', 'ltr'],
  ] as const)(
    'aligns the language eyebrow, headline, and body for the %s locale',
    async (locale, writingDirection) => {
      useSettingsStore.setState({ locale })

      const { getByText } = await render(<LanguageStep onContinue={jest.fn()} />)
      const headingTexts = [
        getByText('> 01 / LANGUAGE'),
        getByText('Choose your language.'),
        getByText('You can change this later in Settings.'),
      ]

      for (const headingText of headingTexts) {
        expect(StyleSheet.flatten(headingText.props.style)).toEqual(
          expect.objectContaining({
            direction: writingDirection,
            textAlign: 'auto',
            writingDirection,
            width: '100%',
          }),
        )
      }
    },
  )

  it('shows a visible row treatment while keyboard focus is active', async () => {
    const { getByTestId } = await render(<LanguageStep onContinue={jest.fn()} />)
    const hebrew = getByTestId('onboarding-language-option-he')

    fireEvent(hebrew, 'focus')

    await waitFor(() => {
      expect(StyleSheet.flatten(getByTestId('onboarding-language-option-he').props.style)).toEqual(
        expect.objectContaining({ borderWidth: 2, borderColor: '#63b3ff' }),
      )
    })

    fireEvent(getByTestId('onboarding-language-option-he'), 'blur')

    await waitFor(() => {
      expect(StyleSheet.flatten(getByTestId('onboarding-language-option-he').props.style).borderWidth).toBe(1)
    })
  })

  it('renders the four autonyms without country flags and selects a language immediately', async () => {
    const { getAllByRole, getByTestId, getByText, queryByTestId } = await render(
      <LanguageStep onContinue={jest.fn()} />,
    )

    expect(getAllByRole('radio').map((row) => row.props.testID)).toEqual([
      'onboarding-language-option-en',
      'onboarding-language-option-he',
      'onboarding-language-option-ar',
      'onboarding-language-option-ru',
    ])
    expect(getByText('English')).toBeTruthy()
    expect(getByText('עברית')).toBeTruthy()
    expect(getByText('العربية')).toBeTruthy()
    expect(getByText('Русский')).toBeTruthy()
    expect(queryByTestId('onboarding-language-flag-en', { includeHiddenElements: true })).toBeNull()
    expect(queryByTestId('onboarding-language-flag-he', { includeHiddenElements: true })).toBeNull()
    expect(queryByTestId('onboarding-language-flag-ar', { includeHiddenElements: true })).toBeNull()
    expect(queryByTestId('onboarding-language-flag-ru', { includeHiddenElements: true })).toBeNull()
    expect(StyleSheet.flatten(getByText('עברית').props.style)).toEqual(
      expect.objectContaining({ paddingStart: 12 }),
    )
    expect(StyleSheet.flatten(getByText('العربية').props.style)).toEqual(
      expect.objectContaining({ paddingStart: 12 }),
    )
    expect(getByTestId('onboarding-language-option-en').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    )

    fireEvent.press(getByTestId('onboarding-language-option-he'))

    await waitFor(() => {
      expect(useSettingsStore.getState().locale).toBe('he')
      expect(i18n.language).toBe('he')
      expect(getByTestId('onboarding-language-option-he').props.accessibilityState).toEqual(
        expect.objectContaining({ selected: true }),
      )
    })
  })

  it('disables selection and continuation while work is in progress and shows retry guidance', async () => {
    const onContinue = jest.fn()
    const { getByTestId, getByText } = await render(
      <LanguageStep
        onContinue={onContinue}
        busy
        error="Couldn’t save your language. Try again."
      />,
    )

    expect(getByText('Couldn’t save your language. Try again.')).toBeTruthy()
    expect(getByTestId('onboarding-language-option-he').props.accessibilityState).toEqual({
      selected: false,
      disabled: true,
    })
    fireEvent.press(getByTestId('onboarding-language-option-he'))
    fireEvent.press(getByTestId('onboarding-language-cta'))

    expect(useSettingsStore.getState().locale).toBe('en')
    expect(onContinue).not.toHaveBeenCalled()
  })

  it('keeps its default Storybook story renderable', async () => {
    const StoryComponent = languageStepMeta.component
    expect(StoryComponent).toBe(LanguageStep)
    if (!StoryComponent) throw new Error('LanguageStep story is missing its component')

    const { getByTestId } = await render(
      <StoryComponent
        {...LanguageStepDefaultStory.args}
        onContinue={LanguageStepDefaultStory.args?.onContinue ?? jest.fn()}
      />,
    )
    expect(getByTestId('onboarding-language-option-en')).toBeTruthy()
  })
})
