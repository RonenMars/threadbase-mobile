import React from 'react'
import { render } from '@testing-library/react-native'
import i18n from '@/test-utils/i18n-setup'
import { PrimaryButton } from '@/components/onboarding/components/PrimaryButton'

describe('PrimaryButton direction', () => {
  it.each([
    ['en', 'primary-button-arrow-right', 'primary-button-arrow-left'],
    ['he', 'primary-button-arrow-left', 'primary-button-arrow-right'],
  ] as const)('points the forward arrow correctly for %s', async (locale, expected, absent) => {
    await i18n.changeLanguage(locale)

    const { getByTestId, queryByTestId } = await render(
      <PrimaryButton onPress={jest.fn()}>Continue</PrimaryButton>,
    )

    expect(getByTestId(expected)).toBeTruthy()
    expect(queryByTestId(absent)).toBeNull()
  })
})
