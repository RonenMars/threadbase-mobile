import React from 'react'
import { StyleSheet } from 'react-native'
import { render, fireEvent, screen } from '@testing-library/react-native'
import { LeaveSessionModal } from '@/components/sessions/LeaveSessionModal'
import i18n from '@/test-utils/i18n-setup'

type ModalProps = React.ComponentProps<typeof LeaveSessionModal>

function modal(overrides: Partial<ModalProps> = {}) {
  return (
    <LeaveSessionModal
      visible
      phase="idle"
      agent="Claude"
      server="MacBook Pro"
      offerWhenDone
      onCancel={jest.fn()}
      onConfirm={jest.fn()}
      onDismissError={jest.fn()}
      onModalDismiss={jest.fn()}
      {...overrides}
    />
  )
}

describe('LeaveSessionModal', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('names the agent and server and acts on a single tap', async () => {
    const onConfirm = jest.fn()
    const onCancel = jest.fn()
    await render(modal({ onConfirm, onCancel }))

    expect(screen.getByTestId('leave-session-modal')).toBeTruthy()
    expect(screen.getByText("Leave while it's working?")).toBeTruthy()
    expect(screen.getByText('Claude keeps going on MacBook Pro unless you end it.')).toBeTruthy()
    expect(screen.queryByTestId('leave-session-confirm')).toBeNull()

    await fireEvent.press(screen.getByTestId('leave-session-option-leave'))
    expect(onConfirm).toHaveBeenCalledWith('leave', false)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('labels the three choices with the end-session vocabulary', async () => {
    await render(modal())
    expect(screen.getByText('Keep running')).toBeTruthy()
    expect(screen.getByText('Terminate when done')).toBeTruthy()
    expect(screen.getByText('Terminate')).toBeTruthy()
    expect(screen.getByText('Stay here')).toBeTruthy()
    expect(screen.queryByText(/kill/i)).toBeNull()
  })

  it('offers Terminate when done only while a turn is running', async () => {
    const onConfirm = jest.fn()
    const { rerender } = await render(modal({ onConfirm }))
    await fireEvent.press(screen.getByTestId('leave-session-option-kill_on_idle'))
    expect(onConfirm).toHaveBeenCalledWith('kill_on_idle', false)

    await rerender(modal({ onConfirm, offerWhenDone: false }))
    expect(screen.queryByTestId('leave-session-option-kill_on_idle')).toBeNull()
  })

  it('asks differently while the agent waits for the user', async () => {
    await render(modal({ waiting: true, offerWhenDone: false }))
    expect(screen.getByText("Leave while it's waiting for you?")).toBeTruthy()
  })

  it('Stay here does not confirm', async () => {
    const onConfirm = jest.fn()
    const onCancel = jest.fn()
    await render(modal({ onConfirm, onCancel }))
    await fireEvent.press(screen.getByTestId('leave-session-cancel'))
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('can Terminate and remember', async () => {
    const onConfirm = jest.fn()
    await render(modal({ onConfirm }))
    await fireEvent.press(screen.getByTestId('leave-session-remember'))
    await fireEvent.press(screen.getByTestId('leave-session-option-kill'))
    expect(onConfirm).toHaveBeenCalledWith('kill', true)
  })

  it('resets Remember when reopened', async () => {
    const onConfirm = jest.fn()
    const { rerender } = await render(modal({ onConfirm }))
    await fireEvent.press(screen.getByTestId('leave-session-remember'))
    await rerender(modal({ onConfirm, visible: false }))
    await rerender(modal({ onConfirm }))
    await fireEvent.press(screen.getByTestId('leave-session-option-leave'))
    expect(onConfirm).toHaveBeenCalledWith('leave', false)
  })

  it('aligns translated copy to the locale writing direction', async () => {
    await i18n.changeLanguage('he')
    await render(modal())

    expect(StyleSheet.flatten(screen.getByText("Leave while it's working?").props.style)).toEqual(
      expect.objectContaining({
        direction: 'rtl',
        writingDirection: 'rtl',
        textAlign: 'auto',
        width: '100%',
      }),
    )
    expect(StyleSheet.flatten(screen.getByText('Keep running').props.style)).toEqual(
      expect.objectContaining({ direction: 'rtl', writingDirection: 'rtl', textAlign: 'auto' }),
    )
  })

  it('shows a loader instead of the options while pending, and swallows options taps', async () => {
    await render(modal({ visible: false, phase: 'pending' }))
    expect(screen.getByTestId('leave-session-pending')).toBeTruthy()
    expect(screen.queryByTestId('leave-session-option-kill')).toBeNull()
  })

  it('shows an error with a dismiss button, which does not itself navigate', async () => {
    const onDismissError = jest.fn()
    await render(modal({ visible: false, phase: 'error', onDismissError }))
    expect(screen.getByTestId('leave-session-error')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('leave-session-error-ok'))
    expect(onDismissError).toHaveBeenCalled()
  })
})
