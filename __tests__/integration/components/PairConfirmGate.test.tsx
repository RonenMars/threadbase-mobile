import React from 'react'
import { fireEvent } from '@testing-library/react-native'
import { PairConfirmGate, type PendingPairTarget } from '@/components/pair/PairConfirmGate'
import { renderWithI18n } from '@/test-utils/render'

const FINGERPRINT = '3cfe 00ad 6d01 6dd3 782c 8628 4b1d a1d2'

const E2EE_TARGET: PendingPairTarget = {
  kind: 'e2ee',
  machineName: 'ronen-mbp',
  url: 'https://ronen-mbp.local:8765',
  fingerprint: FINGERPRINT,
}

const NO_SPK_TARGET: PendingPairTarget = {
  kind: 'no-spk',
  machineName: 'old-server',
  url: 'http://192.168.1.42:8765',
  fingerprint: null,
}

const API_KEY_TARGET: PendingPairTarget = {
  kind: 'api-key',
  machineName: null,
  url: 'https://example.com',
  fingerprint: null,
}

async function renderGate(props: Partial<React.ComponentProps<typeof PairConfirmGate>> = {}) {
  const onConfirm = jest.fn()
  const onCancel = jest.fn()
  const screen = await renderWithI18n(
    <PairConfirmGate
      visible
      target={E2EE_TARGET}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  )
  return { screen, onConfirm, onCancel }
}

describe('PairConfirmGate', () => {
  it('renders nothing when there is no pending target', async () => {
    const { queryByTestId } = await renderWithI18n(
      <PairConfirmGate visible target={null} onConfirm={jest.fn()} onCancel={jest.fn()} />,
    )
    expect(queryByTestId('pair-confirm-add-btn')).toBeNull()
  })

  it('kind "e2ee": shows the machine, address, fingerprint, encrypted line, and compare hint', async () => {
    const { screen } = await renderGate()
    expect(await screen.findByTestId('pair-confirm-icon-e2ee')).toBeTruthy()
    expect(await screen.findByText('ronen-mbp')).toBeTruthy()
    // Substring match: the mono rows are wrapped in bidi-isolate marks (see the
    // dedicated test below), so an exact match against the bare value would fail.
    expect(await screen.findByTestId('pair-confirm-url')).toHaveTextContent(
      'https://ronen-mbp.local:8765',
      { exact: false },
    )
    expect(await screen.findByTestId('pair-confirm-fingerprint')).toHaveTextContent(FINGERPRINT, {
      exact: false,
    })
    expect(await screen.findByText('Encrypted from this device to this computer.')).toBeTruthy()
    expect(
      await screen.findByText(
        "Run tb-streamer identity on the computer you're pairing with and compare it to the fingerprint above.",
      ),
    ).toBeTruthy()
  })

  // Verifies the bidi-isolation markup is present in every locale's render —
  // NOT that it visually renders left-to-right. RNTL has no real text-shaping
  // engine, so whether an RTL (he/ar) device actually keeps the hex groups in
  // typed order can only be confirmed on a real iOS/Android bidi renderer,
  // which this suite cannot reach.
  it('wraps mono values (URL, fingerprint) in left-to-right isolate marks', async () => {
    const LRI = '⁦'
    const PDI = '⁩'
    const { screen } = await renderGate()
    expect(await screen.findByTestId('pair-confirm-url')).toHaveTextContent(
      `${LRI}https://ronen-mbp.local:8765${PDI}`,
      { exact: true },
    )
    expect(await screen.findByTestId('pair-confirm-fingerprint')).toHaveTextContent(
      `${LRI}${FINGERPRINT}${PDI}`,
      { exact: true },
    )
  })

  it('kind "no-spk": drops the fingerprint row and the compare hint, shows the no-identity warning', async () => {
    const { screen } = await renderGate({ target: NO_SPK_TARGET })
    expect(await screen.findByTestId('pair-confirm-icon-no-spk')).toBeTruthy()
    expect(screen.queryByTestId('pair-confirm-fingerprint')).toBeNull()
    expect(
      screen.queryByText(
        "Run tb-streamer identity on the computer you're pairing with and compare it to the fingerprint above.",
      ),
    ).toBeNull()
    expect(await screen.findByText('No identity to verify')).toBeTruthy()
  })

  it('kind "api-key": drops the machine row and fingerprint row, shows the unverifiable-key warning', async () => {
    const { screen } = await renderGate({ target: API_KEY_TARGET })
    expect(await screen.findByTestId('pair-confirm-icon-api-key')).toBeTruthy()
    expect(screen.queryByText('Machine')).toBeNull()
    expect(screen.queryByTestId('pair-confirm-fingerprint')).toBeNull()
    expect(await screen.findByText('Add server with a pasted key?')).toBeTruthy()
  })

  it('falls back to a labelled placeholder when the server never sent a machine name', async () => {
    const { screen } = await renderGate({ target: { ...E2EE_TARGET, machineName: null } })
    expect(await screen.findByText('Unnamed machine')).toBeTruthy()
  })

  // Positive control for the two press tests below: confirm/cancel are wired
  // to their buttons specifically, not fired by mounting the gate at all.
  it('does not call onConfirm or onCancel just from rendering', async () => {
    const { onConfirm, onCancel } = await renderGate()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('calls onConfirm when "Add server" is pressed', async () => {
    const { screen, onConfirm, onCancel } = await renderGate()
    fireEvent.press(await screen.findByTestId('pair-confirm-add-btn'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('calls onCancel when "Cancel" is pressed', async () => {
    const { screen, onConfirm, onCancel } = await renderGate()
    fireEvent.press(await screen.findByTestId('pair-confirm-cancel-btn'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls onCancel when the backdrop is pressed', async () => {
    const { screen, onConfirm, onCancel } = await renderGate()
    fireEvent.press(await screen.findByTestId('pair-confirm-backdrop'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
