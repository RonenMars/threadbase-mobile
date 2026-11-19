/**
 * `/` skills: the composer, useFileMentions and the skills picker together,
 * with only the skills request mocked.
 */
import React, { useState } from 'react'
import { fireEvent, screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ChatComposer, type ChatComposerProps } from '@/components/conversation/ChatComposer'
import { useFileMentions } from '@/hooks/useFileMentions'
import { fetchBrowse } from '@/hooks/useBrowse'
import { createApiForServer, NetworkError } from '@/services/api-client'
import { DirectionRoot } from '@/lib/direction-root'
import { renderWithI18n } from '@/test-utils/render'

jest.mock('react-native-keyboard-controller', () => ({
  useReanimatedKeyboardAnimation: () => ({ height: { value: 0 }, progress: { value: 0 } }),
}))
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: unknown }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('@/services/api-client', () => ({
  ...jest.requireActual('@/services/api-client'),
  createApiForServer: jest.fn(),
}))
jest.mock('@/hooks/useBrowse', () => ({
  ...jest.requireActual('@/hooks/useBrowse'),
  fetchBrowse: jest.fn(),
}))

const mockFetchSkills = jest.fn()
;(createApiForServer as jest.Mock).mockImplementation((serverId: string) => ({
  get: (path: string) => mockFetchSkills(serverId, path),
}))
const mockFetchBrowse = fetchBrowse as jest.MockedFunction<typeof fetchBrowse>
const sent = jest.fn()

const baseProps: Omit<ChatComposerProps, 'value' | 'onChangeText' | 'onSend'> = {
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

// Sends the way LiveConversationView and TerminalView do: handleSend(skillPayload ?? inputText).
function Harness({ provider }: { provider?: string }) {
  const [text, setText] = useState('')
  const mentions = useFileMentions({
    serverId: 'srv',
    projectPath: '/home/me/proj',
    provider,
    sessionId: 'sess-1',
    text,
    onChangeText: setText,
  })
  return (
    <ChatComposer
      {...baseProps}
      value={text}
      onChangeText={setText}
      onSend={() => sent(mentions.skillPayload ?? text)}
      mention={mentions.mention}
      selection={mentions.selection}
      onSelectionChange={mentions.onSelectionChange}
      slash={mentions.slash}
      skill={mentions.skill}
      onClearSkill={mentions.clearSkill}
    />
  )
}

async function renderHarness(provider?: string) {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  await renderWithI18n(
    <QueryClientProvider client={queryClient}>
      <DirectionRoot>
        <Harness provider={provider} />
      </DirectionRoot>
    </QueryClientProvider>,
  )
}

async function type(text: string, cursor = text.length) {
  const input = screen.getByTestId('chat-message-input')
  await fireEvent.changeText(input, text)
  await fireEvent(input, 'selectionChange', { nativeEvent: { selection: { start: cursor, end: cursor } } })
}

/** The input shows either a plain value or, with a marked skill, styled children. */
function shown(): string {
  const input = screen.getByTestId('chat-message-input')
  if (input.props.value !== undefined) return input.props.value
  const name = screen.getByTestId('skill-chip-name').props.children as string
  const rest = React.Children.toArray(input.props.children.props.children)[1] as React.ReactElement<{ children: string }>
  return name + rest.props.children
}

describe('ChatComposer / skills', () => {
  beforeEach(() => {
    sent.mockReset()
    mockFetchSkills.mockReset()
    mockFetchSkills.mockResolvedValue({
      skills: [
        { name: 'review', description: 'Review the diff', source: 'user' },
        { name: 'tdd', description: 'Test first', source: 'user' },
      ],
    })
    mockFetchBrowse.mockReset()
    mockFetchBrowse.mockResolvedValue({ path: '/home/me/proj', directories: [], files: [{ name: 'README.md' }] })
  })

  afterEach(() => {
    queryClient?.clear()
    queryClient = null
  })

  it("lists the session's skills with descriptions on a leading /", async () => {
    await renderHarness()
    await type('/')
    expect(await screen.findByTestId('skill-mention-row-tdd')).toBeTruthy()
    expect(screen.getByText('Review the diff')).toBeTruthy()
    expect(mockFetchSkills).toHaveBeenCalledWith('srv', '/api/sessions/sess-1/skills')
  })

  it('filters by the typed query and stays closed off the start of the prompt', async () => {
    await renderHarness()
    await type('/td')
    await screen.findByTestId('skill-mention-row-tdd')
    expect(screen.queryByTestId('skill-mention-row-review')).toBeNull()

    await type('fix /td')
    expect(screen.queryByTestId('skill-mention-board')).toBeNull()
  })

  it('inserts the picked name without the slash, colored, with an X, and sends it as a slash command', async () => {
    await renderHarness()
    await type('/td')
    await fireEvent.press(await screen.findByTestId('skill-mention-row-tdd'))

    expect(screen.queryByTestId('skill-mention-board')).toBeNull()
    expect(screen.getByTestId('skill-chip-name').props.children).toBe('tdd')
    expect(screen.getByTestId('skill-chip-clear')).toBeTruthy()
    expect(shown()).toBe('tdd ')

    await type('tdd add tests')
    expect(shown()).toBe('tdd add tests')
    await fireEvent.press(screen.getByTestId('chat-send-button'))
    expect(sent).toHaveBeenCalledWith('/tdd add tests')
  })

  it('drops the mark when a character of the name is deleted, keeping the rest as plain text', async () => {
    await renderHarness()
    await type('/')
    await fireEvent.press(await screen.findByTestId('skill-mention-row-tdd'))
    await type('td ', 2)

    expect(screen.queryByTestId('skill-chip-name')).toBeNull()
    expect(screen.queryByTestId('skill-chip-clear')).toBeNull()
    expect(shown()).toBe('td ')
    await fireEvent.press(screen.getByTestId('chat-send-button'))
    expect(sent).toHaveBeenCalledWith('td ')
  })

  it('removes the skill name when its X is tapped', async () => {
    await renderHarness()
    await type('/')
    await fireEvent.press(await screen.findByTestId('skill-mention-row-tdd'))
    await type('tdd add tests')

    await fireEvent.press(screen.getByTestId('skill-chip-clear'))
    expect(screen.queryByTestId('skill-chip-name')).toBeNull()
    expect(shown()).toBe('add tests')
  })

  it('closes on its X until the slash token is left', async () => {
    await renderHarness()
    await type('/t')
    await screen.findByTestId('skill-mention-board')
    await fireEvent.press(screen.getByTestId('skill-mention-close'))
    expect(screen.queryByTestId('skill-mention-board')).toBeNull()

    await type('/td')
    expect(screen.queryByTestId('skill-mention-board')).toBeNull()
    await type('')
    await type('/')
    expect(await screen.findByTestId('skill-mention-board')).toBeTruthy()
  })

  it('reports a server that cannot list skills', async () => {
    mockFetchSkills.mockRejectedValue(new NetworkError('nope', 'UNSUPPORTED_PROVIDER', undefined, 501))
    await renderHarness()
    await type('/')
    expect(await screen.findByText("Skills aren't available for this session.")).toBeTruthy()
  })

  it('still opens the @ picker', async () => {
    await renderHarness()
    await type('/tdd @')
    expect(await screen.findByTestId('file-mention-row-README.md')).toBeTruthy()
    expect(screen.queryByTestId('skill-mention-board')).toBeNull()
  })

  it('shows no skills picker for a Codex session', async () => {
    await renderHarness('codex-cli')
    await type('/')
    expect(screen.queryByTestId('skill-mention-board')).toBeNull()
    expect(mockFetchSkills).not.toHaveBeenCalled()
  })
})
