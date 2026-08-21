import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { ServerEditModal } from '@/components/servers/ServerEditModal'

/**
 * ServerEditModal wraps its form in an RN Modal, and PairConfirmGate renders its
 * own. iOS presents one modal per window, so asking the gate to appear while the
 * form's modal is still up drops it silently. That is what made Save look dead:
 * handleSave stores the pending add, sets confirmTarget and returns *before*
 * saving, so with no gate the form just sat there — no server added, no error,
 * and the tap itself still reported success.
 *
 * The form's modal must therefore yield the window whenever the gate wants it.
 * A real RN Modal renders nothing while hidden, so the form's own fields
 * disappearing is the observable proof that it yielded.
 */

const mockGateVisible = jest.fn()

jest.mock('@/components/pair/PairConfirmGate', () => ({
  PairConfirmGate: (props: { visible: boolean }) => {
    mockGateVisible(props.visible)
    return null
  },
}))

jest.mock('@/components/pair/PairScannerModal', () => ({
  PairScannerModal: () => null,
}))

jest.mock('@/services/ws-client', () => ({
  wsManager: { connect: jest.fn() },
}))

describe('ServerEditModal — yielding the window to the confirm gate', () => {
  beforeEach(() => {
    mockGateVisible.mockReset()
  })

  it('shows the form and keeps the gate hidden before Save', async () => {
    const screen = await render(<ServerEditModal visible serverId={null} onClose={jest.fn()} />)

    expect(screen.getByTestId('server-edit-url-input')).toBeTruthy()
    expect(mockGateVisible).toHaveBeenLastCalledWith(false)
  })

  it('hands the window to the gate when Save is pressed', async () => {
    const screen = await render(<ServerEditModal visible serverId={null} onClose={jest.fn()} />)

    await fireEvent.changeText(screen.getByTestId('server-edit-url-input'), 'localhost:7072')
    await fireEvent.changeText(screen.getByTestId('server-edit-key-input'), 'mock-key-123')

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeEnabled()
    })
    await fireEvent.press(screen.getByText('Save'))

    await waitFor(() => {
      expect(mockGateVisible).toHaveBeenLastCalledWith(true)
    })

    // The form's modal is hidden, so its own fields are gone and the window is
    // free. Before the fix both modals claimed it and the gate lost silently.
    expect(screen.queryByTestId('server-edit-url-input')).toBeNull()
  })
})
