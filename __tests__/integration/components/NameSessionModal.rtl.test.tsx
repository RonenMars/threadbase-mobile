import React from 'react'
import { StyleSheet } from 'react-native'
import { act, cleanup } from '@testing-library/react-native'
import { renderWithI18n } from '@/test-utils/render'
import i18n from '@/test-utils/i18n-setup'
import { NameSessionModal } from '@/components/sessions/NameSessionModal'

describe('NameSessionModal direction', () => {
  afterEach(async () => {
    await cleanup()
    await act(async () => {
      await i18n.changeLanguage('en')
    })
  })

  it('aligns translated copy and the name input to the selected RTL direction', async () => {
    await i18n.changeLanguage('he')
    const { getByText, getByPlaceholderText } = await renderWithI18n(
      <NameSessionModal
        visible
        mode="exit"
        currentName="tmp"
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    )

    const expected = expect.objectContaining({
      direction: 'rtl',
      writingDirection: 'rtl',
      textAlign: 'auto',
    })
    expect(StyleSheet.flatten(getByText('לתת שם לסשן לפני היציאה?').props.style)).toEqual(expected)
    expect(StyleSheet.flatten(getByText('Cancel').props.style)).toEqual(expected)
    expect(StyleSheet.flatten(getByPlaceholderText('למשל, תיקון באג באימות').props.style)).toEqual(expected)
  })
})
