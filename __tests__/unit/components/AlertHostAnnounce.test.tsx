import { AccessibilityInfo } from 'react-native'
import { act, cleanup, waitFor } from '@testing-library/react-native'
import { AlertHost } from '@/components/alerts/AlertHost'
import { useAlertStore } from '@/stores/alerts'
import { useErrorSheetStore } from '@/stores/errorSheet'
import { useLoadingStateStore } from '@/stores/loading-state'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { useServersStore } from '@/stores/servers'
import { renderWithI18n } from '@/test-utils/render'
import { serverCause } from '@/types/alerts'

let announce: jest.SpyInstance

beforeEach(() => {
  cleanup()
  useAlertStore.getState().reset()
  useErrorSheetStore.setState({ open: false })
  useLoadingStateStore.setState({ errors: [], dismissed: [] })
  useServerFetchStatusStore.setState({ statuses: {} })
  useServersStore.setState({ servers: {} })
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
})

async function upsertError(id: string, title: string) {
  await act(async () => {
    useAlertStore.getState().upsert({
      id,
      cause: serverCause(id),
      level: 'error',
      title,
      message: 'body',
      timeout: null,
    })
  })
}

describe('AlertHost announcements', () => {
  it('announces an error once per cause even when it is upserted twice', async () => {
    await renderWithI18n(<AlertHost />)
    announce.mockClear()
    await upsertError('s0', "Can't reach Studio Mac")
    await upsertError('s0', "Can't reach Studio Mac")

    expect(announce).toHaveBeenCalledTimes(1)
    expect(announce).toHaveBeenCalledWith("Error. Can't reach Studio Mac")
  })

  it('does not announce a warning', async () => {
    await renderWithI18n(<AlertHost />)
    announce.mockClear()
    await act(async () => {
      useAlertStore.getState().upsert({
        id: 'hp',
        cause: 'host-pressure:s0',
        level: 'warning',
        title: 'Host under load',
        message: 'body',
        timeout: null,
      })
    })

    expect(useAlertStore.getState().alerts).toHaveLength(1)
    expect(announce).not.toHaveBeenCalled()
  })

  it('announces again when the same cause is re-raised after it cleared', async () => {
    await renderWithI18n(<AlertHost />)
    announce.mockClear()
    await upsertError('s0', "Can't reach Studio Mac")
    expect(announce).toHaveBeenCalledTimes(1)

    await act(async () => {
      useAlertStore.getState().dismiss('s0')
    })
    expect(useAlertStore.getState().alerts).toHaveLength(0)

    await upsertError('s0', "Can't reach Studio Mac")
    expect(announce).toHaveBeenCalledTimes(2)
  })

  it('announces a seeded request failure once through the store, not the sheet', async () => {
    await renderWithI18n(<AlertHost />)
    announce.mockClear()
    await act(async () => {
      useLoadingStateStore.setState({
        errors: [{ id: 'messages', category: 'messages', status: 503, message: 'busy' }],
      })
    })

    await waitFor(() => {
      expect(announce).toHaveBeenCalledTimes(1)
    })
    expect(announce).toHaveBeenCalledWith("Error. Messages didn't load.")
  })

  it('announces a blocking auth failure as critical', async () => {
    await renderWithI18n(<AlertHost />)
    announce.mockClear()
    await act(async () => {
      useLoadingStateStore.setState({
        errors: [{ id: 'sessions', category: 'sessions', status: 401, message: 'expired' }],
      })
    })

    await waitFor(() => {
      expect(announce).toHaveBeenCalledWith('Critical. Your session has expired')
    })
  })
})
