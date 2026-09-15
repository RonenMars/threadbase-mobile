import { cleanup } from '@testing-library/react-native'
import { ServerStateMessage } from '@/components/servers/ServerStateMessage'
import { wsManager } from '@/services/ws-client'
import { useAlertStore } from '@/stores/alerts'
import { renderWithI18n } from '@/test-utils/render'
import { serverCause } from '@/types/alerts'
import type { ServerConfig } from '@/types/api'

function server(id: string, host: string): ServerConfig {
  return {
    id,
    url: `http://${host}:7071`,
    apiKey: 'test',
    isConnected: false,
    serverInfo: null,
    connectionError: null,
  }
}

beforeEach(() => {
  cleanup()
  useAlertStore.getState().reset()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('ServerStateMessage producers', () => {
  it('publishes one error cause per unreachable server', async () => {
    jest.spyOn(wsManager, 'status').mockReturnValue('disconnected')
    const a = server('a', 'alpha.local')
    const b = server('b', 'beta.local')
    await renderWithI18n(
      <ServerStateMessage
        activeServerIds={[a.id, b.id]}
        servers={{ [a.id]: a, [b.id]: b }}
        fetchStatuses={{
          [a.id]: { status: 'error', lastCheckedAt: Date.now() },
          [b.id]: { status: 'error', lastCheckedAt: Date.now() },
        }}
        wsConnectedCount={0}
        onRetryFailed={() => {}}
        isRetrying={false}
      />,
    )

    const causes = useAlertStore.getState().alerts.map((alert) => alert.cause)
    expect(causes).toEqual([serverCause('a'), serverCause('b')])
    expect(useAlertStore.getState().alerts.every((alert) => alert.level === 'error')).toBe(true)
  })
})
