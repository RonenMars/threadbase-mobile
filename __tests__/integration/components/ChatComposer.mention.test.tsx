/**
 * `@` file mentions: the composer, useFileMentions and the picker together,
 * with only the browse request mocked.
 */
import React, { useState } from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ChatComposer, type ChatComposerProps } from '@/components/conversation/ChatComposer'
import { useFileMentions } from '@/hooks/useFileMentions'
import { fetchBrowse } from '@/hooks/useBrowse'
import { NetworkError } from '@/services/api-client'
import { DirectionRoot } from '@/lib/direction-root'
import { renderWithI18n } from '@/test-utils/render'
import type { BrowseResponse } from '@/types/api'

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
  const mentions = useFileMentions({ serverId: 'srv', projectPath, provider, text, onChangeText: setText })
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

describe('ChatComposer @ file mentions', () => {
  const previousFlag = process.env.EXPO_PUBLIC_FILE_MENTIONS

  beforeEach(() => {
    process.env.EXPO_PUBLIC_FILE_MENTIONS = '1'
    mockFetchBrowse.mockReset()
    mockFetchBrowse.mockImplementation(async (_server, path) => {
      const listing = TREE[path]
      if (!listing) throw new Error(`unexpected path ${path}`)
      return listing
    })
  })

  afterEach(() => {
    queryClient?.clear()
    queryClient = null
    if (previousFlag === undefined) delete process.env.EXPO_PUBLIC_FILE_MENTIONS
    else process.env.EXPO_PUBLIC_FILE_MENTIONS = previousFlag
  })

  it('lists the session folder when @ is typed, hiding dotfiles', async () => {
    await renderHarness()
    await type('@')
    expect(await screen.findByTestId('file-mention-row-src')).toBeTruthy()
    expect(screen.getByTestId('file-mention-row-README.md')).toBeTruthy()
    expect(screen.queryByTestId('file-mention-row-.git')).toBeNull()
    expect(mockFetchBrowse).toHaveBeenCalledWith('srv', '/home/me/proj')
  })

  it('filters as the user types and inserts the chosen file at the cursor', async () => {
    await renderHarness()
    await type('fix @REA')
    await screen.findByTestId('file-mention-row-README.md')
    expect(screen.queryByTestId('file-mention-row-package.json')).toBeNull()

    await fireEvent.press(screen.getByTestId('file-mention-row-README.md'))
    expect(inputValue()).toBe('fix @README.md ')
    expect(screen.queryByTestId('file-mention-board')).toBeNull()
  })

  it('drills into a directory and keeps the picker open', async () => {
    await renderHarness()
    await type('@')
    await fireEvent.press(await screen.findByTestId('file-mention-row-src'))
    expect(inputValue()).toBe('@src/')

    await fireEvent(screen.getByTestId('chat-message-input'), 'selectionChange', {
      nativeEvent: { selection: { start: 5, end: 5 } },
    })
    await fireEvent.press(await screen.findByTestId('file-mention-row-main.ts'))
    expect(mockFetchBrowse).toHaveBeenCalledWith('srv', '/home/me/proj/src')
    expect(inputValue()).toBe('@src/main.ts ')
  })

  it('stays closed after dismissal until a new @ is typed', async () => {
    await renderHarness()
    await type('@')
    await screen.findByTestId('file-mention-row-src')
    await fireEvent.press(screen.getByTestId('file-mention-close'))
    expect(screen.queryByTestId('file-mention-board')).toBeNull()

    await type('@s')
    expect(screen.queryByTestId('file-mention-board')).toBeNull()

    await type('@s @')
    expect(await screen.findByTestId('file-mention-board')).toBeTruthy()
  })

  it('does not open for an email address', async () => {
    await renderHarness()
    await type('mail me@example.com')
    expect(screen.queryByTestId('file-mention-board')).toBeNull()
  })

  it('says the folder is unsupported when the server refuses to list it', async () => {
    mockFetchBrowse.mockRejectedValue(new NetworkError('Path outside browse root', undefined, undefined, 400))
    await renderHarness()
    await type('@')
    expect(await screen.findByText("File suggestions aren't available for this session's folder.")).toBeTruthy()
  })

  it('does not query a Windows session path at all', async () => {
    await renderHarness({ projectPath: 'C:\\Users\\me\\proj' })
    await type('@')
    expect(await screen.findByText("File suggestions aren't available for this session's folder.")).toBeTruthy()
    expect(mockFetchBrowse).not.toHaveBeenCalled()
  })

  it('stays off for providers that are not verified yet', async () => {
    await renderHarness({ provider: 'codex-cli' })
    await type('@')
    expect(screen.queryByTestId('file-mention-board')).toBeNull()
  })

  it('stays off without the feature flag', async () => {
    delete process.env.EXPO_PUBLIC_FILE_MENTIONS
    await renderHarness()
    await type('@')
    expect(screen.queryByTestId('file-mention-board')).toBeNull()
    await waitFor(() => expect(mockFetchBrowse).not.toHaveBeenCalled())
  })
})
