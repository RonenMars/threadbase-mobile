import React from 'react'
import { StyleSheet } from 'react-native'
import { render, fireEvent, screen } from '@testing-library/react-native'
import { LeaveSessionModal } from '@/components/sessions/LeaveSessionModal'
import i18n from '@/test-utils/i18n-setup'

describe('LeaveSessionModal', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })
  it('shows three radios without a dropdown and defaults to Leave it', async () => {
    const onConfirm = jest.fn()
    const onCancel = jest.fn()
    await render(
      <LeaveSessionModal visible onCancel={onCancel} onConfirm={onConfirm} />,
    )

    expect(screen.getByTestId('leave-session-modal')).toBeTruthy()
    expect(screen.getByTestId('leave-session-option-kill')).toBeTruthy()
    expect(screen.getByTestId('leave-session-option-leave')).toBeTruthy()
    expect(screen.getByTestId('leave-session-option-kill_on_idle')).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()

    await fireEvent.press(screen.getByTestId('leave-session-confirm'))
    expect(onConfirm).toHaveBeenCalledWith('leave', false)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('Cancel does not confirm', async () => {
    const onConfirm = jest.fn()
    const onCancel = jest.fn()
    await render(
      <LeaveSessionModal visible onCancel={onCancel} onConfirm={onConfirm} />,
    )
    await fireEvent.press(screen.getByTestId('leave-session-cancel'))
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('can select Kill it and remember', async () => {
    const onConfirm = jest.fn()
    await render(
      <LeaveSessionModal visible onCancel={jest.fn()} onConfirm={onConfirm} />,
    )
    await fireEvent.press(screen.getByTestId('leave-session-option-kill'))
    await fireEvent.press(screen.getByTestId('leave-session-remember'))
    await fireEvent.press(screen.getByTestId('leave-session-confirm'))
    expect(onConfirm).toHaveBeenCalledWith('kill', true)
  })

  it('resets choice when reopened', async () => {
    const onConfirm = jest.fn()
    const { rerender } = await render(
      <LeaveSessionModal visible onCancel={jest.fn()} onConfirm={onConfirm} />,
    )
    await fireEvent.press(screen.getByTestId('leave-session-option-kill'))
    await rerender(<LeaveSessionModal visible={false} onCancel={jest.fn()} onConfirm={onConfirm} />)
    await rerender(<LeaveSessionModal visible onCancel={jest.fn()} onConfirm={onConfirm} />)
    await fireEvent.press(screen.getByTestId('leave-session-confirm'))
    expect(onConfirm).toHaveBeenCalledWith('leave', false)
  })

  it('aligns translated copy to the locale writing direction', async () => {
    await i18n.changeLanguage('he')
    await render(
      <LeaveSessionModal visible onCancel={jest.fn()} onConfirm={jest.fn()} />,
    )

    expect(StyleSheet.flatten(screen.getByText('Leave this session?').props.style)).toEqual(
      expect.objectContaining({
        direction: 'rtl',
        writingDirection: 'rtl',
        textAlign: 'auto',
        width: '100%',
      }),
    )
    expect(StyleSheet.flatten(screen.getByText('Leave it').props.style)).toEqual(
      expect.objectContaining({ direction: 'rtl', writingDirection: 'rtl', textAlign: 'auto' }),
    )
  })
})
