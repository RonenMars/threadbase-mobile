import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { ServerEditModal } from '@/components/servers/ServerEditModal'

/**
 * A scan of a pinned server opens PairCameraIdentityCard, another RN Modal.
 * iOS presents one modal per window, so the form's modal must yield while the
 * card is up — the same rule the confirm gate and the scanner already follow.
 * With both visible, iOS drops one and the app is left behind an invisible
 * modal that swallows every tap until it is force-closed.
 */

const mockCardVisible = jest.fn()
let mockCardDone: (() => void) | undefined
let mockCardReject: (() => void) | undefined

jest.mock('@/components/pair/PairCameraIdentityCard', () => ({
  PairCameraIdentityCard: (props: { visible: boolean; onDone: () => void; onReject: () => void }) => {
    mockCardVisible(props.visible)
    mockCardDone = props.onDone
    mockCardReject = props.onReject
    return null
  },
}))

jest.mock('@/components/pair/PairScannerModal', () => ({
  PairScannerModal: (props: { visible: boolean; onSuccess: (r: unknown) => void }) => {
    const { Pressable } = require('react-native')
    return props.visible ? (
      <Pressable
        testID="fake-scan"
        onPress={() =>
          props.onSuccess({
            url: 'https://tb-pc.example.test',
            apiKey: 'scanned-key',
            machineName: 'DESKTOP',
            serverPublicKey: 'a'.repeat(64),
            e2eeRequired: true,
          })
        }
      />
    ) : null
  },
}))

jest.mock('@/services/ws-client', () => ({
  wsManager: { connect: jest.fn() },
}))

describe('ServerEditModal — yielding the window to the identity card', () => {
  beforeEach(() => {
    mockCardVisible.mockReset()
    mockCardDone = undefined
    mockCardReject = undefined
  })

  it('hides the form while the identity card is up and restores it on Done', async () => {
    const screen = await render(<ServerEditModal visible serverId={null} onClose={jest.fn()} />)

    await fireEvent.press(screen.getByLabelText('Scan QR code'))
    await fireEvent.press(await screen.findByTestId('fake-scan'))

    await waitFor(() => expect(mockCardVisible).toHaveBeenLastCalledWith(true))
    expect(screen.queryByTestId('server-edit-url-input')).toBeNull()

    await act(async () => mockCardDone?.())

    await waitFor(() => expect(mockCardVisible).toHaveBeenLastCalledWith(false))
    expect(screen.getByTestId('server-edit-url-input')).toBeTruthy()
  })

  it('closes the form without adding anything when the code does not match', async () => {
    const onClose = jest.fn()
    const screen = await render(<ServerEditModal visible serverId={null} onClose={onClose} />)

    await fireEvent.press(screen.getByLabelText('Scan QR code'))
    await fireEvent.press(await screen.findByTestId('fake-scan'))
    await waitFor(() => expect(mockCardVisible).toHaveBeenLastCalledWith(true))

    await act(async () => mockCardReject?.())

    expect(onClose).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(mockCardVisible).toHaveBeenLastCalledWith(false))
  })
})
