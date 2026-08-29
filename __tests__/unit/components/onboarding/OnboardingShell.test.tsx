import React from 'react'
import { StyleSheet, Text } from 'react-native'
import { render } from '@testing-library/react-native'
import i18n from '@/test-utils/i18n-setup'
import { OnboardingShell } from '@/components/onboarding/OnboardingShell'

const renderShell = () => render(
  <OnboardingShell
    index={2}
    total={5}
    onNext={jest.fn()}
    onBack={jest.fn()}
    onSkip={jest.fn()}
    skipLabel="pairLater"
  >
    <Text>Step</Text>
  </OnboardingShell>,
)

function getEnteringAnimation(result: Awaited<ReturnType<typeof renderShell>>) {
  return result.root
    ?.queryAll((view) => view.props.entering !== undefined, { includeSelf: true })
    .at(0)
    ?.props.entering
}

describe('OnboardingShell RTL navigation', () => {
  it('renders the semantic pair-later label', async () => {
    await i18n.changeLanguage('en')
    const { getByText } = await renderShell()

    expect(getByText('Pair later')).toBeTruthy()
  })

  it('keeps Back at the LTR start edge with a left-pointing arrow', async () => {
    await i18n.changeLanguage('en')
    const { getByTestId, queryByTestId } = await renderShell()

    expect(StyleSheet.flatten(getByTestId('onboarding-shell-chrome').props.style)).toEqual(
      expect.objectContaining({ direction: 'ltr', flexDirection: 'row' }),
    )
    expect(getByTestId('onboarding-shell-back-arrow-left')).toBeTruthy()
    expect(queryByTestId('onboarding-shell-back-arrow-right')).toBeNull()
  })

  it('places Back at the RTL start edge, Pair Later at the end, and points Back right', async () => {
    await i18n.changeLanguage('he')
    const { getByTestId, queryByTestId } = await renderShell()

    const chrome = getByTestId('onboarding-shell-chrome')
    expect(StyleSheet.flatten(chrome.props.style)).toEqual(
      expect.objectContaining({ direction: 'rtl', flexDirection: 'row' }),
    )
    expect(chrome.children[0]).toBe(getByTestId('onboarding-shell-back'))
    expect(chrome.children[1]).toBe(getByTestId('onboarding-shell-skip'))
    expect(getByTestId('onboarding-shell-back-arrow-right')).toBeTruthy()
    expect(queryByTestId('onboarding-shell-back-arrow-left')).toBeNull()
  })

  it('does not apply an entering layout animation to onboarding steps', async () => {
    await i18n.changeLanguage('en')
    const screen = await renderShell()
    expect(getEnteringAnimation(screen)).toBeUndefined()
  })
})
