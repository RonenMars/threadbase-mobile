import React from 'react'
import { act } from '@testing-library/react-native'
import { AlertHost } from '@/components/alerts/AlertHost'
import { HomeStatusPill } from '@/components/alerts/StatusPill'
import { useOpenStatusSurface } from '@/hooks/useOpenStatusSurface'
import { useAlertStore } from '@/stores/alerts'
import { useErrorSheetStore } from '@/stores/errorSheet'
import { useLoadingStateStore } from '@/stores/loading-state'
import { renderWithI18n } from '@/test-utils/render'

function Harness() {
  const open = useOpenStatusSurface()
  return (
    <>
      <AlertHost />
      <HomeStatusPill onPress={open} />
    </>
  )
}

const emptySlowCounts = {
  sessions: 0,
  conversations: 0,
  messages: 0,
  'session-detail': 0,
  browse: 0,
  other: 0,
}

beforeEach(() => {
  useAlertStore.getState().reset()
  useErrorSheetStore.setState({ open: false })
  useLoadingStateStore.setState({
    errors: [],
    dismissed: [],
    slowCounts: { ...emptySlowCounts },
  })
})

afterEach(() => {
  useAlertStore.getState().reset()
  useLoadingStateStore.setState({
    errors: [],
    dismissed: [],
    slowCounts: { ...emptySlowCounts },
  })
})

describe('SlowQueryBanner', () => {
  it('raises a warning on the status pill while sessions fetch is slow', async () => {
    useLoadingStateStore.getState().incrementSlow('sessions')
    const { getByTestId } = await renderWithI18n(<Harness />)
    expect(getByTestId('status-pill')).toBeTruthy()
    expect(useAlertStore.getState().alerts[0].title).toBe(
      'Sessions are taking longer than expected.',
    )
    expect(useAlertStore.getState().alerts[0].level).toBe('warning')
  })

  it('clears when the slow count drops', async () => {
    useLoadingStateStore.getState().incrementSlow('sessions')
    const { getByTestId, queryByTestId } = await renderWithI18n(<Harness />)
    expect(getByTestId('status-pill')).toBeTruthy()
    await act(async () => {
      useLoadingStateStore.getState().decrementSlow('sessions')
    })
    expect(queryByTestId('status-pill')).toBeNull()
  })
})
