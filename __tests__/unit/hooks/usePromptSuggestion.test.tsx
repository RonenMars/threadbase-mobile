import { renderHook, act, waitFor } from '@testing-library/react-native'
import { usePromptSuggestion } from '@/hooks/usePromptSuggestion'
import { createWrapper } from '@/test-utils'
import type { Session } from '@/types/api'

type WsMsg = { type: string; sessionId?: string; text?: string | null; updatedAt?: string }
type Handler = (msg: WsMsg) => void
type StatusListener = (serverId: string, s: string) => void

jest.mock('@/services/ws-client', () => {
  const handlers = new Map<string, Set<Handler>>()
  const statusListeners = new Set<StatusListener>()
  const fakeClient = {
    on: (type: string, h: Handler) => {
      if (!handlers.has(type)) handlers.set(type, new Set())
      handlers.get(type)!.add(h)
      return () => handlers.get(type)?.delete(h)
    },
  }
  return {
    wsManager: {
      getClient: () => fakeClient,
      onAnyStatusChange: (l: StatusListener) => {
        statusListeners.add(l)
        return () => statusListeners.delete(l)
      },
    },
    __wsTest: {
      emit: (msg: WsMsg) => handlers.get(msg.type)?.forEach((h) => h(msg)),
      reconnect: () => statusListeners.forEach((l) => l('srv-1', 'connected')),
      reset: () => {
        handlers.clear()
        statusListeners.clear()
      },
    },
  }
})

const mockGet = jest.fn()
jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ get: (path: string) => mockGet(path) }),
}))

const { __wsTest } = jest.requireMock('@/services/ws-client') as {
  __wsTest: { emit: (msg: WsMsg) => void; reconnect: () => void; reset: () => void }
}

const GHOST = 'add type hints and a docstring'

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1',
    status: 'waiting_input',
    ptyAttached: true,
    subStatus: null,
    projectPath: '/tmp/p',
    projectName: 'p',
    branch: 'main',
    lastOutput: '',
    elapsedMs: 0,
    promptCount: 1,
    startedAt: '2026-04-18T10:00:00.000Z',
    ...overrides,
  }
}

const frame = (text: string | null): WsMsg => ({
  type: 'prompt_suggestion',
  sessionId: 'sess-1',
  text,
  updatedAt: '2026-04-18T10:00:01.000Z',
})

// react-query hands cache writes to observers on a timer tick, so flush one.
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
const emit = async (msg: WsMsg) => {
  await act(() => __wsTest.emit(msg))
  await flush()
}

async function renderSuggestion(rest: Session) {
  mockGet.mockResolvedValue(rest)
  const hook = await renderHook(() => usePromptSuggestion('srv-1', 'sess-1'), { wrapper: createWrapper() })
  await waitFor(() => expect(mockGet).toHaveBeenCalled())
  await flush()
  return hook
}

beforeEach(() => {
  mockGet.mockReset()
  __wsTest.reset()
})

describe('usePromptSuggestion', () => {
  it('old server: no promptSuggestion field and no frame yields no suggestion', async () => {
    const { result } = await renderSuggestion(session())
    expect(result.current.suggestion).toBeNull()
    expect(result.current.chipSuggestion).toBeNull()
  })

  it('a malformed REST value degrades to none', async () => {
    const { result } = await renderSuggestion(
      session({ promptSuggestion: 42 as unknown as string }),
    )
    expect(result.current.suggestion).toBeNull()
  })

  it('seeds from REST so a reconnecting client sees the current suggestion', async () => {
    const { result } = await renderSuggestion(session({ promptSuggestion: GHOST }))
    expect(result.current.suggestion).toBe(GHOST)
    expect(result.current.chipSuggestion).toBe(GHOST)
  })

  it('a frame sets the suggestion, then a null frame clears it', async () => {
    const { result } = await renderSuggestion(session())
    await emit(frame(GHOST))
    expect(result.current.suggestion).toBe(GHOST)
    await emit(frame(null))
    expect(result.current.suggestion).toBeNull()
  })

  it('ignores frames for another session', async () => {
    const { result } = await renderSuggestion(session())
    await emit({ ...frame(GHOST), sessionId: 'other' })
    expect(result.current.suggestion).toBeNull()
  })

  it('still delivers frames after a reconnect re-subscribe', async () => {
    const { result } = await renderSuggestion(session())
    await act(() => __wsTest.reconnect())
    await emit(frame(GHOST))
    expect(result.current.suggestion).toBe(GHOST)
  })

  it('shows nothing once the session is no longer waiting for input', async () => {
    const { result } = await renderSuggestion(session({ status: 'running', promptSuggestion: GHOST }))
    expect(result.current.suggestion).toBeNull()
  })

  it('dismiss hides the chip but keeps the ghost row hidden until the server clears it', async () => {
    const { result } = await renderSuggestion(session({ promptSuggestion: GHOST }))
    await act(() => result.current.dismiss())
    expect(result.current.chipSuggestion).toBeNull()
    expect(result.current.suggestion).toBe(GHOST)

    await emit(frame(null))
    await emit(frame(GHOST))
    expect(result.current.chipSuggestion).toBe(GHOST)
  })
})
