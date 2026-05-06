import { listProjectChats } from '@/services/project-chats-api'
import { NotFoundError } from '@/services/api-client'

jest.mock('@/stores/servers', () => ({
  useServersStore: {
    getState: jest.fn(() => ({
      getServer: (id: string) =>
        id === 'srv_test'
          ? {
              id: 'srv_test',
              url: 'http://test.local',
              apiKey: 'test-api-key',
              isConnected: true,
              serverInfo: null,
            }
          : undefined,
      servers: {},
      activeServerIds: ['srv_test'],
    })),
  },
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

function ok(body: unknown) {
  return { ok: true, status: 200, json: jest.fn().mockResolvedValue(body) }
}

function notFound() {
  return { ok: false, status: 404, json: jest.fn().mockResolvedValue({}) }
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('listProjectChats', () => {
  it('unwraps the items envelope', async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        items: [
          {
            type: 'session',
            id: 's1',
            projectId: 'p1',
            projectPath: '/foo',
            title: 'Foo',
            latestMessageAt: '2026-05-06T10:00:00Z',
            status: 'active',
            source: 'session-store',
          },
        ],
        lastConversationId: 'c-last',
        refreshed: false,
      }),
    )

    const resp = await listProjectChats({ serverId: 'srv_test' })

    expect(resp.items).toHaveLength(1)
    expect(resp.items[0]).toMatchObject({
      type: 'session',
      id: 's1',
      projectId: 'p1',
      projectPath: '/foo',
      serverId: 'srv_test',
    })
    expect(resp.lastConversationId).toBe('c-last')
    expect(resp.refreshed).toBe(false)
  })

  it('normalises legacy snake_case fields to camelCase', async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        items: [
          {
            type: 'conversation',
            id: 'c1',
            project_id: 'p1',
            project_path: '/foo',
            title: 'Foo',
            latest_message_at: '2026-05-06T09:00:00Z',
            status: 'archived',
          },
        ],
      }),
    )

    const resp = await listProjectChats({ serverId: 'srv_test' })

    expect(resp.items[0]).toMatchObject({
      type: 'conversation',
      projectId: 'p1',
      projectPath: '/foo',
      latestMessageAt: '2026-05-06T09:00:00Z',
      status: 'archived',
    })
  })

  it('uses ?refreshConversations=1 (not refresh=1) when refreshing', async () => {
    mockFetch.mockResolvedValueOnce(ok({ items: [] }))

    await listProjectChats({ serverId: 'srv_test', refreshConversations: true })

    const url = mockFetch.mock.calls[0][0]
    expect(url).toContain('/project-chats?refreshConversations=1')
    expect(url).not.toContain('refresh=1')
  })

  it('drops items missing both projectId and projectPath', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    mockFetch.mockResolvedValueOnce(
      ok({
        items: [
          {
            type: 'session',
            id: 's-bad',
            title: 'Orphan',
            status: 'active',
            source: 'session-store',
          },
          {
            type: 'session',
            id: 's-good',
            projectId: 'p1',
            title: 'OK',
            status: 'active',
            source: 'session-store',
          },
        ],
      }),
    )

    const resp = await listProjectChats({ serverId: 'srv_test' })
    expect(resp.items).toHaveLength(1)
    expect(resp.items[0].id).toBe('s-good')
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('falls back to legacy sessions+conversations on 404', async () => {
    mockFetch
      .mockResolvedValueOnce(notFound()) // /project-chats
      .mockResolvedValueOnce(
        ok({
          sessions: [
            {
              id: 's1',
              status: 'idle',
              ptyAttached: false,
              projectId: 'p1',
              projectPath: '/foo',
              projectName: 'foo',
              lastOutput: '',
              elapsedMs: 0,
              promptCount: 0,
              startedAt: '2026-05-06T08:00:00Z',
            },
          ],
          nextCursor: null,
          total: 1,
        }),
      )
      .mockResolvedValueOnce(
        ok([
          {
            id: 'c1',
            project_id: 'p1',
            project_path: '/foo',
            project_name: 'foo',
            last_updated_at: '2026-05-06T07:00:00Z',
            message_count: 5,
          },
        ]),
      )

    const resp = await listProjectChats({ serverId: 'srv_test' })

    expect(resp.items).toHaveLength(2)
    expect(resp.items.find((i) => i.type === 'session')).toMatchObject({
      type: 'session',
      id: 's1',
      projectId: 'p1',
    })
    expect(resp.items.find((i) => i.type === 'conversation')).toMatchObject({
      type: 'conversation',
      id: 'c1',
      projectId: 'p1',
    })
  })

  it('exposes lastConversationId and refreshed for diagnostics', async () => {
    mockFetch.mockResolvedValueOnce(
      ok({ items: [], last_conversation_id: 'c-99', refreshed: true }),
    )
    const resp = await listProjectChats({ serverId: 'srv_test', refreshConversations: true })
    expect(resp.lastConversationId).toBe('c-99')
    expect(resp.refreshed).toBe(true)
  })

  it('handles a bare-array response shape', async () => {
    mockFetch.mockResolvedValueOnce(
      ok([
        {
          type: 'session',
          id: 's1',
          projectId: 'p1',
          title: 'Bare',
          status: 'active',
          source: 'session-store',
        },
      ]),
    )
    const resp = await listProjectChats({ serverId: 'srv_test' })
    expect(resp.items).toHaveLength(1)
    expect(resp.lastConversationId).toBeUndefined()
  })

  it('rethrows non-404 errors instead of falling back', async () => {
    const err = new Error('boom')
    mockFetch.mockRejectedValueOnce(err)
    await expect(listProjectChats({ serverId: 'srv_test' })).rejects.toBeInstanceOf(Error)
  })
})
