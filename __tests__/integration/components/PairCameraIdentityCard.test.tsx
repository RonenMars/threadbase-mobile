import React from 'react'
import { fireEvent } from '@testing-library/react-native'
import { PairCameraIdentityCard } from '@/components/pair/PairCameraIdentityCard'
import { renderWithI18n } from '@/test-utils/render'

const FINGERPRINT = '3cfe 00ad 6d01 6dd3 782c 8628 4b1d a1d2'

describe('PairCameraIdentityCard', () => {
  it('renders nothing when there is no fingerprint', async () => {
    const { queryByTestId } = await renderWithI18n(
      <PairCameraIdentityCard visible fingerprint={null} onDone={jest.fn()} />,
    )
    expect(queryByTestId('pair-camera-identity-card')).toBeNull()
  })

  it('shows the fingerprint and a single Done that proceeds', async () => {
    const onDone = jest.fn()
    const { getByTestId, queryByTestId } = await renderWithI18n(
      <PairCameraIdentityCard visible fingerprint={FINGERPRINT} onDone={onDone} />,
    )
    expect(getByTestId('pair-camera-identity-card')).toBeTruthy()
    expect(getByTestId('identity-fingerprint')).toBeTruthy()
    expect(getByTestId('identity-camera-hint')).toBeTruthy()
    expect(queryByTestId('pair-confirm-add-btn')).toBeNull()
    expect(queryByTestId('pair-confirm-cancel-btn')).toBeNull()

    fireEvent.press(getByTestId('pair-camera-identity-done'))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
