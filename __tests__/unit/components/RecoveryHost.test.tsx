import { act, fireEvent } from '@testing-library/react-native'
import { RecoveryHost, RECOVERY_OVERLAY_MAX_MS } from '@/components/alerts/RecoveryHost'
import { useQueryRecoveryStore } from '@/stores/query-recovery'
import { useServersStore } from '@/stores/servers'
import type { ServerConfig } from '@/types/api'
import { renderWithI18n } from '@/test-utils/render'
import { addSafeBreadcrumb, captureSafeMessage } from '@/services/sentry'

jest.mock('@/hooks/useQueryRecoveryAlerts', () => ({ useQueryRecoveryAlerts: jest.fn() }))
jest.mock('@/services/sentry', () => ({ addSafeBreadcrumb: jest.fn(), captureSafeMessage: jest.fn() }))
jest.mock('@/services/query-client', () => ({ describeRecovery: () => ({ sessions_paused: 1, online: true }) }))

function server(id: string): ServerConfig {
  return { id, url: `https://${id}.test`, apiKey: 'k', isConnected: true, serverInfo: null, connectionError: null }
}

const oneServer = { a: server('a') }

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  useQueryRecoveryStore.setState({ recovering: false, nestedRetryCount: 0, lastRequest: null, wsReconnectServerId: null })
  useServersStore.setState({ servers: oneServer })
})

afterEach(() => {
  jest.useRealTimers()
})

describe('RecoveryHost overlay timeout', () => {
  it('shows the overlay while a single-server install is recovering', async () => {
    const { queryByTestId } = await renderWithI18n(<RecoveryHost />)
    await act(async () => useQueryRecoveryStore.setState({ recovering: true }))
    expect(queryByTestId('recovery-overlay')).not.toBeNull()
  })

  it('leaves every touch outside the close button to the screen and shows the scanner', async () => {
    const { getByTestId } = await renderWithI18n(<RecoveryHost />)
    await act(async () => useQueryRecoveryStore.setState({ recovering: true }))
    expect(getByTestId('recovery-overlay').props.pointerEvents).toBe('box-none')
    expect(getByTestId('recovery-scanner')).toBeTruthy()
  })

  it('hands the screen back once the recovery has outlasted the cap', async () => {
    const { queryByTestId } = await renderWithI18n(<RecoveryHost />)
    await act(async () => useQueryRecoveryStore.setState({ recovering: true }))
    await act(async () => jest.advanceTimersByTime(RECOVERY_OVERLAY_MAX_MS - 1))
    expect(queryByTestId('recovery-overlay')).not.toBeNull()
    await act(async () => jest.advanceTimersByTime(1))
    expect(queryByTestId('recovery-overlay')).toBeNull()
  })

  it('gives a later recovery a fresh window after the first one ended', async () => {
    const { queryByTestId } = await renderWithI18n(<RecoveryHost />)
    await act(async () => useQueryRecoveryStore.setState({ recovering: true }))
    await act(async () => jest.advanceTimersByTime(RECOVERY_OVERLAY_MAX_MS))
    await act(async () => useQueryRecoveryStore.setState({ recovering: false }))
    await act(async () => useQueryRecoveryStore.setState({ recovering: true }))
    expect(queryByTestId('recovery-overlay')).not.toBeNull()
  })

  it('hides on close and returns with the next recovery', async () => {
    const { getByTestId, queryByTestId } = await renderWithI18n(<RecoveryHost />)
    await act(async () => useQueryRecoveryStore.setState({ recovering: true }))
    await act(async () => fireEvent.press(getByTestId('recovery-dismiss')))
    expect(queryByTestId('recovery-overlay')).toBeNull()
    await act(async () => useQueryRecoveryStore.setState({ recovering: false }))
    await act(async () => useQueryRecoveryStore.setState({ recovering: true }))
    expect(queryByTestId('recovery-overlay')).not.toBeNull()
  })

  it('shows with more than one server too', async () => {
    useServersStore.setState({ servers: { ...oneServer, b: server('b') } })
    const { queryByTestId } = await renderWithI18n(<RecoveryHost />)
    await act(async () => useQueryRecoveryStore.setState({ recovering: true }))
    expect(queryByTestId('recovery-overlay')).not.toBeNull()
  })

  it('names the server and the route that is retrying', async () => {
    const { getByTestId } = await renderWithI18n(<RecoveryHost />)
    await act(async () =>
      useQueryRecoveryStore.setState({
        recovering: true,
        lastRequest: { serverId: 'a', method: 'GET', path: '/api/sessions/ab12cd?x=1' },
      }),
    )
    expect(getByTestId('recovery-detail').props.children).toBe('a.test:443 · GET /sessions/:id')
  })

  it('shows the server name while the session socket reconnects', async () => {
    const { getByTestId } = await renderWithI18n(<RecoveryHost />)
    await act(async () => useQueryRecoveryStore.setState({ wsReconnectServerId: 'a' }))
    expect(getByTestId('recovery-detail').props.children).toBe('a.test:443')
  })

  it('reports what held the flag once, only when the cap is reached', async () => {
    await renderWithI18n(<RecoveryHost />)
    await act(async () => useQueryRecoveryStore.setState({ recovering: true }))
    await act(async () => jest.advanceTimersByTime(RECOVERY_OVERLAY_MAX_MS - 1))
    expect(captureSafeMessage).not.toHaveBeenCalled()
    await act(async () => jest.advanceTimersByTime(1))
    expect(addSafeBreadcrumb).toHaveBeenCalledWith('recovery_overlay_expired', { sessions_paused: 1, online: true })
    expect(captureSafeMessage).toHaveBeenCalledTimes(1)
    expect(captureSafeMessage).toHaveBeenCalledWith('recovery_overlay_expired')
  })

  it('reports nothing when the recovery ends before the cap', async () => {
    await renderWithI18n(<RecoveryHost />)
    await act(async () => useQueryRecoveryStore.setState({ recovering: true }))
    await act(async () => jest.advanceTimersByTime(RECOVERY_OVERLAY_MAX_MS - 1))
    await act(async () => useQueryRecoveryStore.setState({ recovering: false }))
    await act(async () => jest.advanceTimersByTime(RECOVERY_OVERLAY_MAX_MS))
    expect(captureSafeMessage).not.toHaveBeenCalled()
  })
})
