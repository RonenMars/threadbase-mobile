/**
 * Conversation info modal: provider always shown (Unknown when the detail
 * response omits it, never a Claude default), and the detail meta's
 * file_path / profile_id / session_name reach the modal.
 */
import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'
import ConversationDetailScreen from '@/app/conversation/[id]'
import { useServersStore } from '@/stores/servers'
import { createWrapper } from '@/test-utils'
import '@/test-utils/i18n-setup'

const CLAUDE_UUID = '11111111-2222-3333-4444-555555555555'

function makeDetail(meta: Record<string, unknown>) {
  return {
    meta: {
      id: CLAUDE_UUID,
      project_name: 'Info Test',
      project_path: '/tmp/p',
      last_updated_at: '2026-09-19T10:00:00Z',
      message_count: 1,
      ...meta,
    },
    messages: [
      { message_index: 0, uuid: 'u0', role: 'user', timestamp: '2026-09-19T10:00:00Z', text: 'hi' },
    ],
    message_pagination: { total: 1, before_index: -1, from_index: 0, has_more_older: false, next_before_index: null },
  }
}

const mockDetailRef: { current: unknown } = { current: null }
// null = never fetched; Error instance = throw; object = resolve
const mockSessionRef: { current: unknown } = { current: null }

jest.mock('@/services/api-client', () => {
  const { AuthError, NotFoundError } = jest.requireActual('@/services/api-client')
  return {
    AuthError,
    NotFoundError,
    createApiForServer: () => ({
      get: (path: string) => {
        if (path.includes('/api/sessions/')) {
          const v = mockSessionRef.current
          if (v instanceof Error) return Promise.reject(v)
          return Promise.resolve(v)
        }
        const v = mockDetailRef.current
        if (v instanceof Error) return Promise.reject(v)
        return Promise.resolve(v)
      },
      // useConversation's first page uses getWithMeta (conditional fetch). This
      // gating suite only cares about render timing, so return a plain 200 with
      // no ETag — the same detail payload, wrapped in the meta envelope.
      getWithMeta: (path: string) => {
        if (path.includes('/api/sessions/')) {
          const v = mockSessionRef.current
          if (v instanceof Error) return Promise.reject(v)
          return Promise.resolve({ status: 200, etag: null, body: v })
        }
        const v = mockDetailRef.current
        if (v instanceof Error) return Promise.reject(v)
        return Promise.resolve({ status: 200, etag: null, body: v })
      },
      post: () => Promise.resolve({}),
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

async function openInfo() {
  await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
  await screen.findByText('hi')
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Conversation info'))
  })
}

describe('conversation detail — info modal', () => {
  beforeEach(() => {
    seedServer()
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ id: CLAUDE_UUID, server: 'srv1' })
  })

  it('shows Unknown when the detail meta has no provider', async () => {
    mockDetailRef.current = makeDetail({})
    await openInfo()
    expect(screen.getByText('Provider')).toBeTruthy()
    expect(screen.getByText('Unknown')).toBeTruthy()
    expect(screen.queryByText('claude-code')).toBeNull()
  })

  it('collapses the Claude conversation id with its on-disk id and shows the detail fields', async () => {
    const filePath = `/home/u/.claude/projects/p/${CLAUDE_UUID}.jsonl`
    mockDetailRef.current = makeDetail({
      provider: 'claude-code',
      file_path: filePath,
      profile_id: 'work',
      session_name: 'Fix login',
    })
    await openInfo()
    expect(screen.getByText('Claude')).toBeTruthy()
    expect(screen.getByText('Conversation ID / Provider ID')).toBeTruthy()
    expect(screen.getByText(filePath)).toBeTruthy()
    expect(screen.getByText('work')).toBeTruthy()
    expect(screen.queryByText('Threadbase Session ID')).toBeNull()
  })
})
