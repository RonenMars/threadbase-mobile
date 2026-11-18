import React from 'react'
import { fireEvent } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { dark } from '@/constants/theme'
import { PairCameraIdentityCard } from '@/components/pair/PairCameraIdentityCard'
import { renderWithI18n } from '@/test-utils/render'

const FINGERPRINT = '3cfe 00ad 6d01 6dd3 782c 8628 4b1d a1d2'

describe('PairCameraIdentityCard', () => {
  it('renders nothing when there is no fingerprint', async () => {
    const { queryByTestId } = await renderWithI18n(
      <PairCameraIdentityCard visible fingerprint={null} onDone={jest.fn()} onReject={jest.fn()} />,
    )
    expect(queryByTestId('pair-camera-identity-card')).toBeNull()
  })

  it('shows the fingerprint with "It matches" proceeding and "Doesn\'t match" rejecting', async () => {
    const onDone = jest.fn()
    const onReject = jest.fn()
    const { getByTestId, getByText, queryByTestId } = await renderWithI18n(
      <PairCameraIdentityCard visible fingerprint={FINGERPRINT} onDone={onDone} onReject={onReject} />,
    )
    expect(getByTestId('pair-camera-identity-card')).toBeTruthy()
    expect(getByTestId('identity-fingerprint')).toBeTruthy()
    expect(getByTestId('identity-camera-hint')).toBeTruthy()
    expect(queryByTestId('pair-confirm-add-btn')).toBeNull()
    expect(queryByTestId('pair-confirm-cancel-btn')).toBeNull()

    expect(getByText('It matches')).toBeTruthy()
    expect(getByText("Doesn't match")).toBeTruthy()

    fireEvent.press(getByTestId('pair-camera-identity-done'))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onReject).not.toHaveBeenCalled()
  })

  it('rejects without proceeding when the code does not match', async () => {
    const onDone = jest.fn()
    const onReject = jest.fn()
    const { getByTestId } = await renderWithI18n(
      <PairCameraIdentityCard visible fingerprint={FINGERPRINT} onDone={onDone} onReject={onReject} />,
    )

    fireEvent.press(getByTestId('pair-camera-identity-reject'))
    expect(onReject).toHaveBeenCalledTimes(1)
    expect(onDone).not.toHaveBeenCalled()
  })

  it('keeps the identity sheet opaque in the Glass theme', async () => {
    const { getByTestId } = await renderWithI18n(
      <PairCameraIdentityCard visible fingerprint={FINGERPRINT} onDone={jest.fn()} onReject={jest.fn()} />,
    )

    expect(StyleSheet.flatten(getByTestId('pair-camera-identity-sheet').props.style)).toMatchObject({
      backgroundColor: dark.bg.secondary,
    })
  })
})
