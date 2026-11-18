import { act } from '@testing-library/react-native'
import { RecoveryHost, RECOVERY_OVERLAY_MAX_MS } from '@/components/alerts/RecoveryHost'
import { useQueryRecoveryStore } from '@/stores/query-recovery'
import { useServersStore } from '@/stores/servers'
import type { ServerConfig } from '@/types/api'
import { renderWithI18n } from '@/test-utils/render'

jest.mock('@/hooks/useQueryRecoveryAlerts', () => ({ useQueryRecoveryAlerts: jest.fn() }))

function server(id: string): ServerConfig {
  return { id, url: `https://${id}.test`, apiKey: 'k', isConnected: true, serverInfo: null, connectionError: null }
}

const oneServer = { a: server('a') }

beforeEach(() => {
  jest.useFakeTimers()
  useQueryRecoveryStore.setState({ recovering: false, nestedRetryCount: 0 })
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

  it('never shows with more than one server', async () => {
    useServersStore.setState({ servers: { ...oneServer, b: server('b') } })
    const { queryByTestId } = await renderWithI18n(<RecoveryHost />)
    await act(async () => useQueryRecoveryStore.setState({ recovering: true }))
    expect(queryByTestId('recovery-overlay')).toBeNull()
  })
})
