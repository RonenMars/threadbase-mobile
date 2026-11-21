/**
 * Peer sessions in the `@` picker: the composer, useFileMentions and the
 * picker together, with the browse and session-list requests mocked.
 */
import React, { useState } from 'react'
import { fireEvent, screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ChatComposer, type ChatComposerProps } from '@/components/conversation/ChatComposer'
import { useFileMentions } from '@/hooks/useFileMentions'
import { fetchBrowse } from '@/hooks/useBrowse'
import { DirectionRoot } from '@/lib/direction-root'
import { renderWithI18n } from '@/test-utils/render'
import { fetchAllPagesForServer } from '@/hooks/useSession'
import type { BrowseResponse, Session } from '@/types/api'

jest.mock('react-native-keyboard-controller', () => ({
  useReanimatedKeyboardAnimation: () => ({ height: { value: 0 }, progress: { value: 0 } }),
}))
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: unknown }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('@/hooks/useBrowse', () => ({
  ...jest.requireActual('@/hooks/useBrowse'),
  fetchBrowse: jest.fn(),
}))

jest.mock('@/hooks/useSession', () => ({
  ...jest.requireActual('@/hooks/useSession'),
  fetchAllPagesForServer: jest.fn(),
}))

const mockFetchSessions = fetchAllPagesForServer as jest.MockedFunction<typeof fetchAllPagesForServer>
const mockFetchBrowse = fetchBrowse as jest.MockedFunction<typeof fetchBrowse>

const TREE: Record<string, BrowseResponse> = {
  '/home/me/proj': {
    path: '/home/me/proj',
    directories: [{ name: '.git' }, { name: 'src' }],
    files: [{ name: 'README.md' }, { name: 'package.json' }],
  },
  '/home/me/proj/src': {
    path: '/home/me/proj/src',
    directories: [],
    files: [{ name: 'main.ts' }],
  },
}

const baseProps: Omit<ChatComposerProps, 'value' | 'onChangeText'> = {
  onSend: jest.fn(),
  onAttach: jest.fn(),
  attachments: [],
  onRemoveAttachment: jest.fn(),
  isUploading: false,
  attachError: null,
  sendError: null,
  disabled: false,
  voice: { listening: false, start: jest.fn(), stop: jest.fn() },
  micGranted: false,
  onToggleMic: jest.fn(),
}

let queryClient: QueryClient | null = null

function Harness({ projectPath, provider }: { projectPath: string; provider?: string }) {
  const [text, setText] = useState('')
  const mentions = useFileMentions({ serverId: 'srv', projectPath, provider, sessionId: 'self-session', text, onChangeText: setText })
  return (
    <ChatComposer
      {...baseProps}
      value={text}
      onChangeText={setText}
      mention={mentions.mention}
      selection={mentions.selection}
      onSelectionChange={mentions.onSelectionChange}
    />
  )
}

async function renderHarness(props: { projectPath?: string; provider?: string } = {}) {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  await renderWithI18n(
    <QueryClientProvider client={queryClient}>
      <DirectionRoot>
        <Harness projectPath={props.projectPath ?? '/home/me/proj'} provider={props.provider} />
      </DirectionRoot>
    </QueryClientProvider>,
  )
}

// What the platform does on a keystroke: the text changes, then the caret moves.
function inputValue(): string {
  return screen.getByTestId('chat-message-input').props.value
}

async function type(text: string, cursor = text.length) {
  const input = screen.getByTestId('chat-message-input')
  await fireEvent.changeText(input, text)
  await fireEvent(input, 'selectionChange', { nativeEvent: { selection: { start: cursor, end: cursor } } })
}

function row(over: Partial<Session> & { id: string }): Session & { serverId: string } {
  return {
    status: 'idle',
    ptyAttached: false,
    projectPath: '/home/me/proj',
    projectName: 'proj',
    startedAt: '2026-11-21T00:00:00Z',
    serverId: 'srv',
    canMessage: true,
    ...over,
  } as Session & { serverId: string }
}

describe('ChatComposer @ peer sessions', () => {
  beforeEach(() => {
    mockFetchBrowse.mockReset()
    mockFetchBrowse.mockImplementation(async (_server, path) => TREE[path])
    mockFetchSessions.mockReset()
    mockFetchSessions.mockResolvedValue([
      row({ id: 'self-session', peerMention: '@me', peerAddress: 'uds:/tmp/cc-socks/9.sock' }),
      row({ id: 'aaaaaaaa-1111', peerMention: '@alpha', peerAddress: 'uds:/tmp/cc-socks/1.sock', projectName: 'tb-streamer' }),
      row({ id: 'bbbbbbbb-2222', peerMention: '@alpha', peerAddress: 'uds:/tmp/cc-socks/2.sock' }),
      row({ id: 'cccccccc-3333', canMessage: false, peerMention: '@gone', peerAddress: 'uds:/tmp/cc-socks/3.sock' }),
      row({ id: 'dddddddd-4444', canMessage: undefined, peerMention: '@old' }),
    ])
  })

  afterEach(() => {
    queryClient?.clear()
    queryClient = null
  })

  it('lists peers above the paths, without the current session or rows that cannot be messaged', async () => {
    await renderHarness()
    await type('@')
    expect(await screen.findByTestId('peer-mention-row-aaaaaaaa-1111')).toBeTruthy()
    expect(screen.getByTestId('peer-mention-row-bbbbbbbb-2222')).toBeTruthy()
    expect(screen.queryByTestId('peer-mention-row-self-session')).toBeNull()
    expect(screen.queryByTestId('peer-mention-row-cccccccc-3333')).toBeNull()
    expect(screen.queryByTestId('peer-mention-row-dddddddd-4444')).toBeNull()
    expect(await screen.findByTestId('file-mention-row-src')).toBeTruthy()
    expect(screen.getAllByText('peer')).toHaveLength(2)
    expect(screen.getByText('tb-streamer · aaaaaaaa')).toBeTruthy()
  })

  it('inserts the mention plus the address when the name is shared', async () => {
    await renderHarness()
    await type('ask @al')
    await fireEvent.press(await screen.findByTestId('peer-mention-row-bbbbbbbb-2222'))
    expect(inputValue()).toBe('ask @alpha uds:/tmp/cc-socks/2.sock ')
    expect(screen.queryByTestId('file-mention-board')).toBeNull()
  })

  it('offers no peers inside a folder', async () => {
    await renderHarness()
    await type('@src/')
    await screen.findByTestId('file-mention-row-main.ts')
    expect(screen.queryByTestId('peer-mention-row-aaaaaaaa-1111')).toBeNull()
  })

  it('lists no peers for a Codex session', async () => {
    await renderHarness({ provider: 'codex' })
    await type('@')
    expect(screen.queryByTestId('file-mention-board')).toBeNull()
    expect(mockFetchSessions).not.toHaveBeenCalled()
  })

  it('keeps the path rows when the session list fails', async () => {
    mockFetchSessions.mockRejectedValue(new Error('offline'))
    await renderHarness()
    await type('@')
    expect(await screen.findByTestId('file-mention-row-src')).toBeTruthy()
    expect(screen.queryByTestId('peer-mention-row-aaaaaaaa-1111')).toBeNull()
  })

  it('shows plain paths when no row carries canMessage (older streamer)', async () => {
    mockFetchSessions.mockResolvedValue([row({ id: 'x', canMessage: undefined })])
    await renderHarness()
    await type('@')
    expect(await screen.findByTestId('file-mention-row-src')).toBeTruthy()
    expect(screen.queryByText('peer')).toBeNull()
  })
})
