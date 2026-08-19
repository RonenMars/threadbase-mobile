import React from 'react'
import { fireEvent } from '@testing-library/react-native'
import { IdentityFingerprintBlock } from '@/components/pair/IdentityFingerprintBlock'
import { renderWithI18n } from '@/test-utils/render'

const FINGERPRINT = '3cfe 00ad 6d01 6dd3 782c 8628 4b1d a1d2'
const LRI = '\u2066'
const PDI = '\u2069'

describe('IdentityFingerprintBlock', () => {
  it('variant "deep-link": two-sided columns and a collapsed How to check', async () => {
    const { getByTestId, getByText, queryByTestId, findByTestId } = await renderWithI18n(
      <IdentityFingerprintBlock fingerprint={FINGERPRINT} variant="deep-link" />,
    )
    expect(getByTestId('identity-fingerprint')).toHaveTextContent(`${LRI}${FINGERPRINT}${PDI}`, {
      exact: true,
    })
    expect(getByTestId('identity-compare-columns')).toBeTruthy()
    expect(getByText('The code above')).toBeTruthy()
    expect(getByTestId('identity-computer-column')).toBeTruthy()
    expect(queryByTestId('identity-camera-hint')).toBeNull()
    expect(queryByTestId('identity-how-to-check-steps')).toBeNull()

    fireEvent.press(getByTestId('identity-how-to-check'))
    expect(await findByTestId('identity-how-to-check-steps')).toBeTruthy()
    expect(
      getByText("If it doesn't match, tap Cancel. This is not that computer."),
    ).toBeTruthy()
  })

  it('variant "camera": match-the-QR hint, no CLI accordion', async () => {
    const { getByTestId, queryByTestId } = await renderWithI18n(
      <IdentityFingerprintBlock fingerprint={FINGERPRINT} variant="camera" />,
    )
    expect(getByTestId('identity-fingerprint')).toBeTruthy()
    // The exact sentence, not just its presence: it tells the user where on the
    // terminal to look, and the streamer prints the fingerprint *under* the QR
    // (cli/pair-banner.ts). A presence-only assertion stayed green while this
    // said "next to", which is the kind of instruction a user gives up on.
    expect(getByTestId('identity-camera-hint')).toHaveTextContent(
      'This should match the code shown under the QR on that computer.',
    )
    expect(queryByTestId('identity-compare-columns')).toBeNull()
    expect(queryByTestId('identity-how-to-check')).toBeNull()
  })

  it('variant "settings": How to check tells you to forget and re-pair', async () => {
    const { getByTestId, queryByText, queryByTestId, findByText } = await renderWithI18n(
      <IdentityFingerprintBlock fingerprint={FINGERPRINT} variant="settings" />,
    )
    expect(queryByTestId('identity-compare-columns')).toBeNull()
    fireEvent.press(getByTestId('identity-how-to-check'))
    expect(
      await findByText("If it doesn't match, this is not that computer. Forget it and pair again."),
    ).toBeTruthy()
    expect(queryByText("If it doesn't match, tap Cancel. This is not that computer.")).toBeNull()
  })
})
