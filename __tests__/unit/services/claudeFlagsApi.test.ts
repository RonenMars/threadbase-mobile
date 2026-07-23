/**
 * getClaudeFlags / updateClaudeFlags — the backward-compatibility contract.
 *
 * A streamer that predates this feature has no /api/config/claude-flags and
 * answers 404. That must surface as `null` ("feature absent", hide the UI), not
 * as an error, or every user on an older server sees a broken settings screen.
 * Driven through a mocked fetch so the real request() path runs.
 */
import { getClaudeFlags, updateClaudeFlags } from '@/services/api-client'
import { useServersStore } from '@/stores/servers'

const SERVER = {
  id: 'srv1',
  url: 'http://localhost:8766',
  apiKey: 'tb_test',
  isConnected: true,
  serverInfo: null,
  connectionError: null,
}

function respond(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response)
}

beforeEach(() => {
  useServersStore.setState({
    servers: { srv1: SERVER as never },
    activeServerIds: ['srv1'],
    displayedServerIds: ['srv1'],
    isLoading: false,
  })
  global.fetch = jest.fn()
})

describe('getClaudeFlags', () => {
  it('returns the config on 200', async () => {
    const config = { registry: [], values: {}, extraArgs: null, persisted: true }
    ;(global.fetch as jest.Mock).mockReturnValue(respond(200, config))

    await expect(getClaudeFlags('srv1')).resolves.toEqual(config)
  })

  it('maps a 404 to null so older servers degrade quietly', async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(respond(404, { error: 'not found' }))

    await expect(getClaudeFlags('srv1')).resolves.toBeNull()
  })

  // A 403 is the localNoAuth guard — a real, actionable error, not "absent".
  it('does not swallow a 403', async () => {
    ;(global.fetch as jest.Mock).mockReturnValue(respond(403, { error: 'disabled' }))

    await expect(getClaudeFlags('srv1')).rejects.toBeDefined()
  })
})

describe('updateClaudeFlags', () => {
  it('PUTs values and omits extraArgs when absent', async () => {
    const config = { registry: [], values: {}, extraArgs: null, persisted: true }
    ;(global.fetch as jest.Mock).mockReturnValue(respond(200, config))

    await updateClaudeFlags('srv1', { maxBudgetUsd: '5' })

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toContain('/api/config/claude-flags')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({ values: { maxBudgetUsd: '5' } })
  })

  it('includes extraArgs when provided', async () => {
    const config = { registry: [], values: {}, extraArgs: '--bare', persisted: true }
    ;(global.fetch as jest.Mock).mockReturnValue(respond(200, config))

    await updateClaudeFlags('srv1', {}, '--bare')

    const [, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ values: {}, extraArgs: '--bare' })
  })
})
