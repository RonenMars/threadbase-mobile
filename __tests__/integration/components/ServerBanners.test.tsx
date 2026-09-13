import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { ServerOfflineBanner } from '@/components/sessions/banners/ServerOfflineBanner'
import { ServerWarmingBanner } from '@/components/sessions/banners/ServerWarmingBanner'
import { ServerUnsupportedBanner } from '@/components/sessions/banners/ServerUnsupportedBanner'

describe('server banners', () => {
  it('offline banner renders copy and fires onRetry', async () => {
    const onRetry = jest.fn()
    const { getByText, getByTestId } = await render(
      <ServerOfflineBanner serverLabel="macbook-pro" onRetry={onRetry} />,
    )
    expect(getByText('Server unreachable')).toBeTruthy()
    expect(getByText('macbook-pro')).toBeTruthy()
    fireEvent.press(getByTestId('server-offline-retry'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('warming banner renders copy', async () => {
    const { getByText } = await render(<ServerWarmingBanner serverLabel="macbook-pro" />)
    expect(getByText('Server is warming up')).toBeTruthy()
    expect(getByText('History will appear when indexing finishes.')).toBeTruthy()
  })

  it('unsupported banner interpolates the server label', async () => {
    const { getByText } = await render(<ServerUnsupportedBanner serverLabel="macbook-pro" />)
    expect(getByText('Server needs an update')).toBeTruthy()
    expect(getByText(/^macbook-pro runs a version/)).toBeTruthy()
  })
})
