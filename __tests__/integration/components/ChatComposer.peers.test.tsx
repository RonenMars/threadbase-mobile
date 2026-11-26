/**
 * Peer sessions in the `@` picker: the composer, useFileMentions and the
 * picker together, with the browse and peers requests mocked.
 */
import React, { useState } from 'react'
import { Text } from 'react-native'
import { fireEvent, screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ChatComposer, type ChatComposerProps } from '@/components/conversation/ChatComposer'
import { useFileMentions } from '@/hooks/useFileMentions'
import { fetchBrowse } from '@/hooks/useBrowse'
import { DirectionRoot } from '@/lib/direction-root'
import { renderWithI18n } from '@/test-utils/render'
import { NotFoundError } from '@/services/api-client'
import type { BrowseResponse, PeerRow } from '@/types/api'

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

const mockGet = jest.fn()
jest.mock('@/services/api-client', () => ({
  ...jest.requireActual('@/services/api-client'),
  createApiForServer: () => ({ get: mockGet }),
}))

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
    <>
      <Text testID="harness-text">{text}</Text>
      <ChatComposer
        {...baseProps}
        value={text}
        onChangeText={setText}
        mention={mentions.mention}
        selection={mentions.selection}
        onSelectionChange={mentions.onSelectionChange}
        peerMarks={mentions.peerMarks}
      />
    </>
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
  return screen.getByTestId('harness-text').props.children
}

async function type(text: string, cursor = text.length) {
  const input = screen.getByTestId('chat-message-input')
  await fireEvent.changeText(input, text)
  await fireEvent(input, 'selectionChange', { nativeEvent: { selection: { start: cursor, end: cursor } } })
}

function peer(over: Partial<PeerRow> & { id: string }): PeerRow {
  return { name: 'alpha', projectName: 'proj', ...over }
}

describe('ChatComposer @ peer sessions', () => {
  beforeEach(() => {
    mockFetchBrowse.mockReset()
    mockFetchBrowse.mockImplementation(async (_server, path) => TREE[path])
    mockGet.mockReset()
    mockGet.mockResolvedValue({
      peers: [
        peer({ id: 'self-session', peerMention: '@me', peerAddress: 'uds:/tmp/cc-socks/9.sock' }),
        peer({ id: 'aaaaaaaa-1111', peerMention: '@alpha', peerAddress: 'uds:/tmp/cc-socks/1.sock', projectName: 'tb-streamer' }),
        peer({ id: 'bbbbbbbb-2222', peerMention: '@alpha', peerAddress: 'uds:/tmp/cc-socks/2.sock' }),
      ],
    })
  })

  afterEach(() => {
    queryClient?.clear()
    queryClient = null
  })

  // The row lays out its own content: it must not depend on the style the file and skill rows share.
  it('keeps a peer row horizontal, with content that takes no touches', async () => {
    await renderHarness()
    await type('@')
    const row = await screen.findByTestId('peer-mention-row-aaaaaaaa-1111')
    expect(row.children[0]).toHaveProp('pointerEvents', 'none')
    expect(row.children[0]).toHaveStyle({ flexDirection: 'row', alignItems: 'center' })
  })

  it('lists peers above the paths, without the current session', async () => {
    await renderHarness()
    await type('@')
    expect(await screen.findByTestId('peer-mention-row-aaaaaaaa-1111')).toBeTruthy()
    expect(screen.getByTestId('peer-mention-row-bbbbbbbb-2222')).toBeTruthy()
    expect(screen.queryByTestId('peer-mention-row-self-session')).toBeNull()
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

  it('colors the picked peer and drops the color once the name is edited', async () => {
    await renderHarness()
    await type('ask @al')
    await fireEvent.press(await screen.findByTestId('peer-mention-row-bbbbbbbb-2222'))
    expect(screen.getByTestId('peer-mark').props.children).toBe('@alpha uds:/tmp/cc-socks/2.sock')

    await type('ask @alpha uds:/tmp/cc-socks/2.sock x')
    expect(screen.getByTestId('peer-mark')).toBeTruthy()
    await type('ask @alpha uds:/tmp/cc-socks/2.sockx')
    expect(screen.queryByTestId('peer-mark')).toBeNull()
    await type('ask @alpha uds:/tmp/cc-socks/2.soc')
    expect(screen.queryByTestId('peer-mark')).toBeNull()
  })

  it('finds a peer whose name has spaces and inserts the quoted mention', async () => {
    mockGet.mockResolvedValue({
      peers: [peer({ id: 'cccccccc-3333', name: 'picker test to mobile', peerMention: '@"picker test to mobile"', peerAddress: 'uds:/tmp/cc-socks/3.sock' })],
    })
    await renderHarness()
    await type('ask @"picker te')
    await fireEvent.press(await screen.findByTestId('peer-mention-row-cccccccc-3333'))
    expect(inputValue()).toBe('ask @"picker test to mobile" ')
    expect(screen.getByTestId('peer-mark').props.children).toBe('@"picker test to mobile"')
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
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('keeps the path rows when the peers request fails', async () => {
    mockGet.mockRejectedValue(new Error('offline'))
    await renderHarness()
    await type('@')
    expect(await screen.findByTestId('file-mention-row-src')).toBeTruthy()
    expect(screen.queryByTestId('peer-mention-row-aaaaaaaa-1111')).toBeNull()
  })

  it('shows plain paths when the streamer has no peers endpoint (older streamer)', async () => {
    mockGet.mockRejectedValue(new NotFoundError('/api/peers'))
    await renderHarness()
    await type('@')
    expect(await screen.findByTestId('file-mention-row-src')).toBeTruthy()
    expect(screen.queryByText('peer')).toBeNull()
  })

  it('shows plain paths when the response has no peers list', async () => {
    mockGet.mockResolvedValue({ skills: [] })
    await renderHarness()
    await type('@')
    expect(await screen.findByTestId('file-mention-row-src')).toBeTruthy()
    expect(screen.queryByText('peer')).toBeNull()
  })
})
