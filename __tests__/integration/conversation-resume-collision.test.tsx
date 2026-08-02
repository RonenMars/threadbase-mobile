/**
 * Resume-collision confirmation on the conversation detail screen (M/P0.1).
 *
 * The Resume button POSTs /api/sessions/resume. When the server soft-blocks
 * with a 409 CONVERSATION_BUSY (the conversation may still be open in a terminal
 * elsewhere), the screen must:
 *   - surface a confirm dialog naming what was detected, and NOT resume;
 *   - retry with { force: true } only if the user proceeds.
 * A clean 200 resume proceeds straight to the live session, no dialog.
 *
 * Resume bodies here use the server's real shape (`id` + `conversationId`, no
 * `sessionId`). Mocking the shape mobile *declared* instead is what hid the
 * defect in #511: the suite drove a branch no real response ever took.
 */
import React from 'react'
import { Alert, type AlertButton } from 'react-native'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import ConversationDetailScreen from '@/app/conversation/[id]'
import { useServersStore } from '@/stores/servers'
import { ConversationBusyError } from '@/services/api-client'

const CONV_ID = 'conv-resume'

function mockMakeDetail(extra: Record<string, unknown> = {}) {
  const messages = Array.from({ length: 4 }, (_, i) => ({
    message_index: i,
    uuid: `uuid-${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    timestamp: `2026-06-10T10:00:0${i}Z`,
    text: `message ${i}`,
  }))
  return {
    meta: {
      id: CONV_ID,
      project_name: 'Resume Test',
      project_path: '/tmp/p',
      last_updated_at: '2026-06-10T11:00:00Z',
      message_count: 4,
      resumable: true,
      ...extra,
    },
    messages,
    message_pagination: {
      total: 4,
      before_index: -1,
      from_index: 0,
      has_more_older: false,
      next_before_index: null,
    },
  }
}

// The 201/200 body POST /api/sessions/resume actually returns: the streamer's
// SessionResponse. `id` is the live session, `conversationId` the transcript it
// was resumed from — kept distinct here because a codex-cli rollout id differs
// from the requested id.
function mockResumeResponse(sessionId: string) {
  return {
    id: sessionId,
    conversationId: CONV_ID,
    projectId: 'proj-1',
    projectPath: '/tmp/p',
    projectName: 'Resume Test',
    startedAt: '2026-06-10T11:00:00Z',
    status: 'running',
    ptyAttached: true,
  }
}

const mockPost = jest.fn()

jest.mock('@/services/api-client', () => {
  const actual = jest.requireActual('@/services/api-client')
  return {
    ...actual,
    createApiForServer: () => ({
      get: (path: string) => {
        if (path.includes('/api/sessions/')) return Promise.reject(new Error('no session'))
        return Promise.resolve(mockMakeDetail())
      },
      getWithMeta: () => Promise.resolve({ status: 200, etag: null, body: mockMakeDetail() }),
      post: mockPost,
    }),
  }
})

function seedServer() {
  useServersStore.setState({
    servers: {
      srv1: {
        id: 'srv1',
        url: 'http://stub',
        apiKey: 'k',
        label: 'SRV1',
        isConnected: true,
        serverInfo: null,
        connectionError: null,
      },
    },
    activeServerIds: ['srv1'],
    displayedServerIds: ['srv1'],
  } as never)
}

// Held at module scope so a test can assert what the resume seeded into it.
let testQc: QueryClient

function wrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  testQc = qc
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

let mockReplace: jest.Mock

describe('conversation detail — resume collision', () => {
  beforeEach(() => {
    seedServer()
    mockPost.mockReset()
    mockReplace = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      replace: mockReplace,
      back: jest.fn(),
      navigate: jest.fn(),
      canGoBack: jest.fn(() => true),
    })
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ id: CONV_ID, server: 'srv1' })
  })

  async function renderAndFindResume() {
    const root = await render(<ConversationDetailScreen />, { wrapper: wrapper() })
    const btn = await waitFor(() => root.getByTestId('resume-button'))
    return { root, btn }
  }

  it('a 409 shows the confirm dialog and does NOT resume', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mockPost.mockRejectedValue(
      new ConversationBusyError('busy', { detectedBy: ['jsonl_mtime'], likelyOwner: 'external' }),
    )

    const { btn } = await renderAndFindResume()
    await act(async () => {
      fireEvent.press(btn)
    })

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1))
    // One preflight POST, no force on it.
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost.mock.calls[0][1]).toEqual({ sessionId: CONV_ID })
    // Did NOT proceed to the live session.
    expect(mockReplace).not.toHaveBeenCalled()

    alertSpy.mockRestore()
  })

  it('confirming the dialog retries with force: true and proceeds', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mockPost
      .mockRejectedValueOnce(
        new ConversationBusyError('busy', { detectedBy: ['process_argv'], likelyOwner: 'external' }),
      )
      .mockResolvedValueOnce(mockResumeResponse('sess-forced'))

    const { btn } = await renderAndFindResume()
    await act(async () => {
      fireEvent.press(btn)
    })
    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1))

    // Invoke the confirm button specifically — the dialog can also carry a
    // destructive "Take over" option, so match on the absence of a style rather
    // than "not cancel".
    const buttons = (alertSpy.mock.calls[0][2] ?? []) as AlertButton[]
    const confirm = buttons.find((b) => b.style === undefined)
    await act(async () => {
      confirm?.onPress?.()
    })

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2))
    expect(mockPost.mock.calls[1][1]).toEqual({ sessionId: CONV_ID, force: true })
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1))
    const target = mockReplace.mock.calls[0][0] as string
    expect(target).toContain('/session/sess-forced')
    expect(target).toContain('resumedFromConversationId=' + CONV_ID)

    alertSpy.mockRestore()
  })

  it('a normal 200 resume proceeds with no dialog', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mockPost.mockResolvedValue(mockResumeResponse('sess-clean'))

    const { btn } = await renderAndFindResume()
    await act(async () => {
      fireEvent.press(btn)
    })

    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1))
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost.mock.calls[0][1]).toEqual({ sessionId: CONV_ID })
    const target = mockReplace.mock.calls[0][0] as string
    expect(target).toContain('/session/sess-clean')
    expect(alertSpy).not.toHaveBeenCalled()

    alertSpy.mockRestore()
  })

  // #511: the session id lives on `id`, and the seed is what lets /session/:id
  // render without a GET. Both were dead before — the read keyed on a
  // `sessionId` the server never sends, so the snapshot was always null and
  // projectId never reached the route.
  it('reads the session id from `id` and seeds the session cache', async () => {
    mockPost.mockResolvedValue(mockResumeResponse('sess-real'))

    const { btn } = await renderAndFindResume()
    await act(async () => {
      fireEvent.press(btn)
    })

    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1))
    expect(testQc.getQueryData(['session', 'srv1', 'sess-real'])).toMatchObject({
      id: 'sess-real',
      projectName: 'Resume Test',
      startedAt: '2026-06-10T11:00:00Z',
    })

    const target = mockReplace.mock.calls[0][0] as string
    expect(target).toContain('/session/sess-real')
    expect(target).toContain('projectId=proj-1')
    expect(target).toContain('resumedFromConversationId=' + CONV_ID)
  })

  // A server old enough to answer with a bare { id } still navigates; it just
  // pays the round-trip because there is no snapshot to seed.
  it('still navigates on the legacy { id } body, with no seed', async () => {
    mockPost.mockResolvedValue({ id: 'sess-legacy' })

    const { btn } = await renderAndFindResume()
    await act(async () => {
      fireEvent.press(btn)
    })

    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1))
    expect(testQc.getQueryData(['session', 'srv1', 'sess-legacy'])).toBeUndefined()
    const target = mockReplace.mock.calls[0][0] as string
    expect(target).toContain('/session/sess-legacy')
    // Falls back to the requested conversation id when the body omits one.
    expect(target).toContain('resumedFromConversationId=' + CONV_ID)
  })

  // Take-over is the SAFE destructive path (server stops the old process and
  // waits before spawning), offered at the moment of conflict instead of being
  // the primary button on a screen the user lands on by tapping a session.
  it('offers "Take over" only when a real process was matched (likelyOwner external)', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mockPost.mockRejectedValue(
      new ConversationBusyError('busy', { detectedBy: ['process_argv'], likelyOwner: 'external' }),
    )

    const { btn } = await renderAndFindResume()
    await act(async () => {
      fireEvent.press(btn)
    })

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1))
    const buttons = (alertSpy.mock.calls[0][2] ?? []) as AlertButton[]
    expect(buttons.some((b) => b.style === 'destructive')).toBe(true)

    alertSpy.mockRestore()
  })

  it('omits "Take over" when only an mtime hit was seen (nothing to adopt)', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mockPost.mockRejectedValue(
      new ConversationBusyError('busy', { detectedBy: ['jsonl_mtime'], likelyOwner: 'unknown' }),
    )

    const { btn } = await renderAndFindResume()
    await act(async () => {
      fireEvent.press(btn)
    })

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1))
    const buttons = (alertSpy.mock.calls[0][2] ?? []) as AlertButton[]
    expect(buttons.some((b) => b.style === 'destructive')).toBe(false)
    // Cancel + "Resume anyway" only.
    expect(buttons).toHaveLength(2)

    alertSpy.mockRestore()
  })

  it('pressing "Take over" adopts the session instead of force-resuming', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mockPost
      .mockRejectedValueOnce(
        new ConversationBusyError('busy', { detectedBy: ['process_argv'], likelyOwner: 'external' }),
      )
      .mockResolvedValueOnce({ sessionId: 'sess-adopted' })

    const { btn } = await renderAndFindResume()
    await act(async () => {
      fireEvent.press(btn)
    })
    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1))

    const buttons = (alertSpy.mock.calls[0][2] ?? []) as AlertButton[]
    const takeOver = buttons.find((b) => b.style === 'destructive')
    await act(async () => {
      takeOver?.onPress?.()
    })

    // Hits the adopt endpoint — never a forced resume (which would leave two
    // agents writing one transcript).
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2))
    expect(mockPost.mock.calls[1][0]).toBe(`/api/sessions/${CONV_ID}/adopt`)
    expect(mockPost.mock.calls.some(([, body]) => (body as { force?: boolean })?.force)).toBe(false)

    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1))
    expect(mockReplace.mock.calls[0][0] as string).toContain('/session/sess-adopted')

    alertSpy.mockRestore()
  })
})
