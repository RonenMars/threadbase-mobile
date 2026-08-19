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

  it('kind "e2ee": shows the check-this-computer screen, fingerprint, two-sided columns, and encrypted line', async () => {
    const { screen } = await renderGate()
    expect(await screen.findByTestId('pair-confirm-screen')).toBeTruthy()
    expect(await screen.findByTestId('pair-confirm-icon-e2ee')).toBeTruthy()
    expect(await screen.findByText('Is this the computer you meant?')).toBeTruthy()
    expect(await screen.findByText('ronen-mbp')).toBeTruthy()
    // Substring match: the mono rows are wrapped in bidi-isolate marks (see the
    // dedicated test below), so an exact match against the bare value would fail.
    expect(await screen.findByTestId('pair-confirm-url')).toHaveTextContent(
      'https://ronen-mbp.local:8765',
      { exact: false },
    )
    expect(await screen.findByTestId('identity-fingerprint')).toHaveTextContent(FINGERPRINT, {
      exact: false,
    })
    expect(await screen.findByTestId('identity-compare-columns')).toBeTruthy()
    expect(await screen.findByText('The code above')).toBeTruthy()
    expect(
      await screen.findByText('Run tb-streamer identity — it must print this same code.'),
    ).toBeTruthy()
    expect(await screen.findByText('Encrypted from this device to this computer.')).toBeTruthy()
    expect(screen.queryByTestId('identity-how-to-check-steps')).toBeNull()
  })

  // Verifies the bidi-isolation markup is present in every locale's render —
  // NOT that it visually renders left-to-right. RNTL has no real text-shaping
  // engine, so whether an RTL (he/ar) device actually keeps the hex groups in
  // typed order can only be confirmed on a real iOS/Android bidi renderer,
  // which this suite cannot reach.
  it('wraps mono values (URL, fingerprint) in left-to-right isolate marks', async () => {
    const LRI = '\u2066'
    const PDI = '\u2069'
    const { screen } = await renderGate()
    expect(await screen.findByTestId('pair-confirm-url')).toHaveTextContent(
      `${LRI}https://ronen-mbp.local:8765${PDI}`,
      { exact: true },
    )
    expect(await screen.findByTestId('identity-fingerprint')).toHaveTextContent(
      `${LRI}${FINGERPRINT}${PDI}`,
      { exact: true },
    )
  })

  it('kind "e2ee": How to check expands to the three CLI steps', async () => {
    const { screen } = await renderGate()
    fireEvent.press(await screen.findByTestId('identity-how-to-check'))
    expect(await screen.findByTestId('identity-how-to-check-steps')).toBeTruthy()
    expect(
      await screen.findByText("On the computer you're pairing with, run tb-streamer identity."),
    ).toBeTruthy()
    expect(await screen.findByText('You should see the same grouped code as above.')).toBeTruthy()
    expect(
      await screen.findByText("If it doesn't match, tap Cancel. This is not that computer."),
    ).toBeTruthy()
    expect(
      screen.queryByText("If it doesn't match, this is not that computer. Forget it and pair again."),
    ).toBeNull()
  })

  it('kind "no-spk": drops the fingerprint and How to check, shows the no-identity warning', async () => {
    const { screen } = await renderGate({ target: NO_SPK_TARGET })
    expect(await screen.findByTestId('pair-confirm-icon-no-spk')).toBeTruthy()
    expect(screen.queryByTestId('identity-fingerprint')).toBeNull()
    expect(screen.queryByTestId('identity-how-to-check')).toBeNull()
    expect(await screen.findByText('No identity to verify')).toBeTruthy()
    expect(
      await screen.findByText(
        "This link doesn't include a fingerprint, so you can't check which computer it belongs to. Anything you send will be readable by anything between this device and the server.",
      ),
    ).toBeTruthy()
  })

  it('kind "api-key": drops the machine row and fingerprint row, shows the unverifiable-key warning', async () => {
    const { screen } = await renderGate({ target: API_KEY_TARGET })
    expect(await screen.findByTestId('pair-confirm-icon-api-key')).toBeTruthy()
    expect(screen.queryByText('Machine')).toBeNull()
    expect(screen.queryByTestId('identity-fingerprint')).toBeNull()
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

  it('uses the app screen header and treats its back control as cancel', async () => {
    const { screen, onConfirm, onCancel } = await renderGate()
    expect(await screen.findByText('Pairing')).toBeTruthy()
    fireEvent.press(await screen.findByTestId('screen-header-back-button'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('does not dismiss on a backdrop tap — there is no backdrop', async () => {
    const { screen, onConfirm, onCancel } = await renderGate()
    expect(screen.queryByTestId('pair-confirm-backdrop')).toBeNull()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })
})
