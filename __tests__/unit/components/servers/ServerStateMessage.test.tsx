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

describe('ServerStateMessage with two mounted screens', () => {
  // Stands in for app/index.tsx: it subscribes to the alert store (through
  // useOpenStatusSurface). A second home screen on the stack disagreeing on
  // isRetrying used to loop forever. Props are hoisted because index.tsx reads
  // them from stores or memoizes them, so their references are stable.
  const a = server('a', 'alpha.local')
  const activeServerIds = [a.id]
  const servers = { [a.id]: a }
  const fetchStatuses = { [a.id]: { status: 'error' as const, lastCheckedAt: 1 } }
  const onRetryFailed = () => {}

  function Screen({ isRetrying }: { isRetrying: boolean }) {
    useAlertStore((s) => s.alerts)
    return (
      <ServerStateMessage
        activeServerIds={activeServerIds}
        servers={servers}
        fetchStatuses={fetchStatuses}
        wsConnectedCount={0}
        onRetryFailed={onRetryFailed}
        isRetrying={isRetrying}
      />
    )
  }

  it('settles instead of exceeding the update depth when they disagree', async () => {
    jest.spyOn(wsManager, 'status').mockReturnValue('disconnected')
    await renderWithI18n(
      <>
        <Screen isRetrying={false} />
        <Screen isRetrying />
      </>,
    )

    expect(useAlertStore.getState().alerts.map((alert) => alert.id)).toEqual(['server-state:a'])
  })
})
