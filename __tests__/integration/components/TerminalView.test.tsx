import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { createWrapper } from '@/test-utils'

// ── native module mocks (must be hoisted) ────────────────────────────────────
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
    getPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
    start: jest.fn(),
    stop: jest.fn(),
  },
  useSpeechRecognitionEvent: jest.fn(),
}))

jest.mock('react-native-keyboard-controller', () => ({
  KeyboardProvider: ({ children }: { children: unknown }) => children,
  KeyboardAwareScrollView: ({ children }: { children: unknown }) => children,
  KeyboardAvoidingView: ({ children }: { children: unknown }) => children,
  useKeyboardState: (selector?: (s: { isVisible: boolean; height: number }) => unknown) => {
    const state = { isVisible: false, height: 0 }
    return selector ? selector(state) : state
  },
}))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
  SafeAreaView: ({ children }: { children: unknown }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

// ── feature mocks ────────────────────────────────────────────────────────────
const mockSendInputMutate = jest.fn()
const mockSendKeysMutate = jest.fn()

let mockSubStatus: string = 'unknown'
jest.mock('@/hooks/useTerminalStream', () => ({
  useTerminalStream: () => ({
    lines: ['line one', 'line two'],
    isStreaming: false,
    subStatus: mockSubStatus,
  }),
}))

jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
    sendInput: { mutate: mockSendInputMutate, isError: false, error: null },
    sendKeys: { mutate: mockSendKeysMutate },
    respondToQuestion: { mutate: jest.fn() },
  }),
}))

jest.mock('@/hooks/useComposerState', () => ({
  useComposerState: ({ onSend }: { onSend: (payload: string, text: string) => void }) => ({
    inputText: 'hello',
    handleInputChange: jest.fn(),
    handleSend: () => onSend('test-payload', 'test-payload'),
    slashBoardVisible: false,
    setSlashBoardVisible: jest.fn(),
    pendingArgCommand: null,
    setPendingArgCommand: jest.fn(),
    handleSlashCommandSelect: jest.fn(),
    handleSlashArgConfirm: jest.fn(),
    attachments: [],
    isUploading: false,
    attachError: null,
    handleAttach: jest.fn(),
    removeAttachment: jest.fn(),
    queueVisible: false,
    setQueueVisible: jest.fn(),
    voice: { listening: false, start: jest.fn(), stop: jest.fn() },
    micGranted: true,
    handleToggleMic: jest.fn(),
  }),
}))

let mockActiveQuestion: unknown = null
jest.mock('@/hooks/useActiveQuestion', () => ({
  useActiveQuestion: () => ({ question: mockActiveQuestion }),
}))

jest.mock('@/services/ws-client', () => ({
  // on() is needed now that TerminalView subscribes via useActiveQuestion.
  wsManager: { getClient: () => ({ status: () => 'connected', send: jest.fn(), on: jest.fn(() => jest.fn()) }) },
}))

jest.mock('@/components/shared/SlashCommandBoard', () => ({
  SlashCommandBoard: () => null,
}))
jest.mock('@/components/shared/SlashCommandArgModal', () => ({
  SlashCommandArgModal: () => null,
}))
jest.mock('@/components/queue/PromptQueueSheet', () => ({
  PromptQueueSheet: () => null,
}))
jest.mock('@/components/queue/PlanPreviewSheet', () => ({
  PlanPreviewSheet: () => null,
}))

// eslint-disable-next-line import/first
import { TerminalView } from '@/components/terminal/TerminalView'

async function renderView(props?: { resumedConversationId?: string }) {
  return await render(
    <TerminalView serverId="srv1" sessionId="sess1" {...props} />,
    { wrapper: createWrapper() },
  )
}

describe('TerminalView', () => {
  beforeEach(() => {
    mockSendInputMutate.mockClear()
    mockSendKeysMutate.mockClear()
    mockPush.mockClear()
    mockSubStatus = 'unknown'
    mockActiveQuestion = null
  })

  it('renders terminal-line-row elements when lines are provided', async () => {
    await renderView()
    const rows = screen.getAllByTestId('terminal-line-row')
    expect(rows.length).toBeGreaterThanOrEqual(2)
  })

  it('renders chat-message-input (the composer is present)', async () => {
    await renderView()
    expect(screen.getByTestId('chat-message-input')).toBeTruthy()
  })

  it('tapping chat-send-button calls sendInput.mutate with the payload', async () => {
    await renderView()
    await fireEvent.press(screen.getByTestId('chat-send-button'))
    expect(mockSendInputMutate).toHaveBeenCalledWith('test-payload', expect.anything())
  })

  it('does not show the resumed scrollback notice for a fresh session', async () => {
    await renderView()
    expect(screen.queryByTestId('terminal-resumed-scrollback-notice')).toBeNull()
  })

  it('shows the resumed scrollback notice and navigates to the conversation', async () => {
    await renderView({ resumedConversationId: 'conv-42' })
    const notice = screen.getByTestId('terminal-resumed-history-view')
    expect(notice).toBeTruthy()
    await fireEvent.press(notice)
    expect(mockPush).toHaveBeenCalledWith(
      '/conversation/conv-42?server=srv1&fromSession=sess1',
    )
  })

  it('navigates to conversation search when the search link is pressed', async () => {
    await renderView({ resumedConversationId: 'conv-42' })
    await fireEvent.press(screen.getByTestId('terminal-resumed-history-search'))
    expect(mockPush).toHaveBeenCalledWith(
      '/conversation/conv-42?server=srv1&fromSession=sess1&openSearch=1',
    )
  })

  it('overlays the agent sub-status while a turn is in flight', async () => {
    mockSubStatus = 'thinking'
    await renderView()
    expect(screen.getByTestId('terminal-sub-status')).toBeTruthy()
  })

  it('shows no sub-status pill when the screen says nothing about the turn', async () => {
    // `unknown` (no status line parsed) and `idle` (turn over) both refine
    // nothing — an empty pill would be worse than no pill.
    await renderView()
    expect(screen.queryByTestId('terminal-sub-status')).toBeNull()

    mockSubStatus = 'idle'
    await renderView()
    expect(screen.queryByTestId('terminal-sub-status')).toBeNull()
  })

  it('hides the sub-status pill while a gate is waiting on the user', async () => {
    // A gate screen paints no status line, so the derivation holds its last
    // value — the pill would claim "Writing" while the agent is blocked.
    mockSubStatus = 'streaming'
    await renderView()
    expect(screen.getByTestId('terminal-sub-status')).toBeTruthy()

    mockActiveQuestion = {
      source: 'permission',
      questions: [
        {
          question: 'Run this command?',
          header: 'Bash',
          multiSelect: false,
          options: [{ label: 'Yes', description: '' }, { label: 'No', description: '' }],
        },
      ],
      permissionIndices: [1, 2],
    }
    await renderView()
    expect(screen.queryByTestId('terminal-sub-status')).toBeNull()
  })

  it('navigates to the conversation when the history tail link is pressed', async () => {
    await renderView({ resumedConversationId: 'conv-42' })
    await fireEvent.press(screen.getByTestId('terminal-resumed-history-tail'))
    expect(mockPush).toHaveBeenCalledWith(
      '/conversation/conv-42?server=srv1&fromSession=sess1',
    )
  })
})
