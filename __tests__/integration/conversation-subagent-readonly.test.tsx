// @ts-nocheck - mirrors conversation-detail-gating.test.tsx's mocked-screen setup
/**
 * A sub-agent transcript opens through the ordinary conversation route but is
 * read-only: no Resume footer and no nested sub-agent section. A top-level
 * conversation keeps both.
 */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'
import ConversationDetailScreen from '@/app/conversation/[id]'
import { useServersStore } from '@/stores/servers'
import { createWrapper } from '@/test-utils'
import '@/test-utils/i18n-setup'

const { __scrollToEndMock: scrollToEndMock } = jest.requireMock('@shopify/flash-list') as { __scrollToEndMock: jest.Mock }

const mockMetaRef: { current: Record<string, unknown> } = { current: {} }

function mockDetail() {
  return {
    meta: {
      id: 'conv-1',
      project_name: 'Proj',
      project_path: '/tmp/p',
      last_updated_at: '2026-10-24T11:00:00Z',
      message_count: 1,
      ...mockMetaRef.current,
    },
    messages: [
      { message_index: 0, uuid: 'u0', role: 'user', timestamp: '2026-10-24T10:00:00Z', text: 'hello' },
    ],
    message_pagination: { total: 1, before_index: -1, from_index: 0, has_more_older: false, next_before_index: null },
  }
}

jest.mock('@/services/api-client', () => {
  const actual = jest.requireActual('@/services/api-client')
  return {
    AuthError: actual.AuthError,
    NotFoundError: actual.NotFoundError,
    createApiForServer: () => ({
      get: (path: string) =>
        path.includes('/api/sessions/') ? Promise.resolve(null) : Promise.resolve(mockDetail()),
      getWithMeta: (path: string) =>
        Promise.resolve({ status: 200, etag: null, body: path.includes('/api/sessions/') ? null : mockDetail() }),
      post: () => Promise.resolve({}),
    }),
  }
})

beforeEach(() => {
  useServersStore.setState({
    servers: { srv1: { id: 'srv1', url: 'http://stub', apiKey: 'k', label: 'SRV1', isConnected: true, serverInfo: null, connectionError: null } },
    activeServerIds: ['srv1'],
    displayedServerIds: ['srv1'],
  } as never)
  ;(useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'conv-1', server: 'srv1' })
})

describe('conversation detail — sub-agent transcript', () => {
  it('hides Resume and the sub-agent section', async () => {
    mockMetaRef.current = { parentConversationId: 'parent-1' }
    const r = await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    await waitFor(() => expect(r.getByTestId('conversation-search-btn')).toBeTruthy())
    expect(r.queryByTestId('resume-button')).toBeNull()
    expect(r.queryByTestId('conversation-bottom-bar')).toBeNull()
    expect(r.queryByTestId('subagent-section')).toBeNull()
    expect(r.getByTestId('conversation-history-list').props.maintainVisibleContentPosition).toMatchObject({
      disabled: true,
    })
    scrollToEndMock.mockClear()
    await act(async () => r.getByTestId('conversation-history-list').props.onContentSizeChange(0, 5000))
    expect(scrollToEndMock).toHaveBeenCalledWith({ animated: false })
  })

  it('keeps Resume and shows the collapsed sub-agent section on a top-level conversation', async () => {
    mockMetaRef.current = {}
    const r = await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    await waitFor(() => expect(r.getByTestId('resume-button')).toBeTruthy())
    expect(r.getByTestId('subagent-section')).toBeTruthy()
    expect(r.getByTestId('conversation-history-list').props.maintainVisibleContentPosition).toMatchObject({
      startRenderingFromBottom: true,
    })
  })
})
