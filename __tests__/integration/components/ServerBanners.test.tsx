import React from 'react'
import { render } from '@testing-library/react-native'
import { ServerWarmingBanner } from '@/components/sessions/banners/ServerWarmingBanner'
import { ServerUnsupportedBanner } from '@/components/sessions/banners/ServerUnsupportedBanner'

describe('server banners', () => {
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
