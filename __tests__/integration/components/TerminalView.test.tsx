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

// ── feature mocks ────────────────────────────────────────────────────────────
const mockSendInputMutate = jest.fn()
const mockSendKeysMutate = jest.fn()

jest.mock('@/hooks/useTerminalStream', () => ({
  useTerminalStream: () => ({
    lines: ['line one', 'line two'],
    isStreaming: false,
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

async function renderView() {
  return await render(
    <TerminalView serverId="srv1" sessionId="sess1" />,
    { wrapper: createWrapper() },
  )
}

describe('TerminalView', () => {
  beforeEach(() => {
    mockSendInputMutate.mockClear()
    mockSendKeysMutate.mockClear()
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
})
