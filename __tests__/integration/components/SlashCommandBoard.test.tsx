/**
 * SlashCommandBoard — the command list that opens when the composer text starts
 * with "/".
 *
 * The composer keeps focus while the board is up (that is what lets the user
 * keep typing to filter), so the keyboard stays over this modal. A sheet
 * anchored to the screen's bottom edge would sit behind it.
 */
import React from 'react'
import { StyleSheet } from 'react-native'
import { screen } from '@testing-library/react-native'
import { SlashCommandBoard } from '@/components/shared/SlashCommandBoard'
import { renderWithI18n } from '@/test-utils/render'

const mockKeyboardHeight = { value: 0 }
jest.mock('react-native-keyboard-controller', () => ({
  useReanimatedKeyboardAnimation: () => ({ height: mockKeyboardHeight, progress: { value: 0 } }),
}))

afterEach(() => {
  mockKeyboardHeight.value = 0
})

const renderBoard = () =>
  renderWithI18n(
    <SlashCommandBoard visible query="" onSelect={() => {}} onDismiss={() => {}} />,
  )

describe('SlashCommandBoard', () => {
  it('sits above the keyboard while it is open', async () => {
    mockKeyboardHeight.value = -300
    await renderBoard()
    const sheet = screen.getByTestId('slash-command-sheet')
    expect(StyleSheet.flatten(sheet.props.style).paddingBottom).toBe(300)
  })

  it('sits on the bottom edge when the keyboard is away', async () => {
    await renderBoard()
    const sheet = screen.getByTestId('slash-command-sheet')
    // -0 in practice: the hook negates the keyboard height.
    expect(StyleSheet.flatten(sheet.props.style).paddingBottom).toBeCloseTo(0)
  })
})
