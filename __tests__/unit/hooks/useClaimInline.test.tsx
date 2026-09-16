import React from 'react'
import { act, render } from '@testing-library/react-native'
import { useClaimInline } from '@/hooks/useClaimInline'
import { HomeStatusPill } from '@/components/alerts/StatusPill'
import { useAlertStore } from '@/stores/alerts'
import { renderWithI18n } from '@/test-utils/render'
import { serverCause } from '@/types/alerts'

function Probe({ causes }: { causes: ReturnType<typeof serverCause>[] }) {
  useClaimInline(causes)
  return null
}

beforeEach(() => {
  useAlertStore.getState().reset()
})

describe('useClaimInline', () => {
  it('claims on mount and releases on unmount', async () => {
    const cause = serverCause('one')
    const view = await render(<Probe causes={[cause]} />)
    expect(useAlertStore.getState().inlineClaims[cause]).toBe(1)
    view.unmount()
    await act(async () => {})
    expect(useAlertStore.getState().inlineClaims[cause]).toBeUndefined()
  })

  it('hides a claimed server error from the home status pill', async () => {
    const cause = serverCause('one')
    useAlertStore.getState().upsert({
      id: 'one',
      cause,
      level: 'error',
      title: 'studio-linux',
      message: 'down',
      timeout: null,
    })
    const claimed = await renderWithI18n(
      <>
        <Probe causes={[cause]} />
        <HomeStatusPill onPress={() => {}} />
      </>,
    )
    expect(claimed.queryByTestId('status-pill')).toBeNull()

    claimed.unmount()
    await act(async () => {})
    expect(useAlertStore.getState().inlineClaims[cause]).toBeUndefined()
  })
})
