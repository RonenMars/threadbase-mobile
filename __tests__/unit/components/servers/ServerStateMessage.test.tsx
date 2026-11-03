import { act, cleanup } from '@testing-library/react-native'
import { ServerStateMessage } from '@/components/servers/ServerStateMessage'
import { wsManager } from '@/services/ws-client'
import { useAlertStore } from '@/stores/alerts'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
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
  useServerFetchStatusStore.getState().reset()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('ServerStateMessage producers', () => {
  it('publishes one error cause per unreachable server', async () => {
    jest.spyOn(wsManager, 'status').mockReturnValue('disconnected')
    const a = server('a', 'alpha.local')
    const b = server('b', 'beta.local')
    useServerFetchStatusStore.setState({
      statuses: {
        [a.id]: { status: 'error', lastCheckedAt: Date.now() },
        [b.id]: { status: 'error', lastCheckedAt: Date.now() },
      },
    })
    await renderWithI18n(
      <ServerStateMessage
        activeServerIds={[a.id, b.id]}
        servers={{ [a.id]: a, [b.id]: b }}
        onRetryFailed={() => {}}
        isRetrying={false}
      />,
    )

    const causes = useAlertStore.getState().alerts.map((alert) => alert.cause)
    expect(causes).toEqual([serverCause('a'), serverCause('b')])
    expect(useAlertStore.getState().alerts.every((alert) => alert.level === 'error')).toBe(true)
  })
})

describe('ServerStateMessage websocket changes', () => {
  it('drops the alert when the socket reconnects', async () => {
    const a = server('a', 'alpha.local')
    useServerFetchStatusStore.setState({ statuses: { [a.id]: { status: 'ok', lastCheckedAt: 1 } } })
    const status = jest.spyOn(wsManager, 'status').mockReturnValue('disconnected')
    let notify = () => {}
    jest.spyOn(wsManager, 'onAnyStatusChange').mockImplementation((cb) => {
      notify = () => cb('a', 'connected')
      return () => {}
    })
    await renderWithI18n(
      <ServerStateMessage
        activeServerIds={[a.id]}
        servers={{ [a.id]: a }}
        onRetryFailed={() => {}}
        isRetrying={false}
      />,
    )
    expect(useAlertStore.getState().alerts).toHaveLength(1)

    status.mockReturnValue('connected')
    await act(async () => notify())

    expect(useAlertStore.getState().alerts).toHaveLength(0)
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
  const onRetryFailed = () => {}

  function Screen({ isRetrying }: { isRetrying: boolean }) {
    useAlertStore((s) => s.alerts)
    return (
      <ServerStateMessage
        activeServerIds={activeServerIds}
        servers={servers}
        onRetryFailed={onRetryFailed}
        isRetrying={isRetrying}
      />
    )
  }

  it('settles instead of exceeding the update depth when they disagree', async () => {
    useServerFetchStatusStore.setState({ statuses: { [a.id]: { status: 'error', lastCheckedAt: 1 } } })
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
