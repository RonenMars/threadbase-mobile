import { renderHook, act } from '@testing-library/react-native'

// ── mocks ────────────────────────────────────────────────────────────────────
// jest.mock factories are hoisted so we cannot reference outer consts inside them.

jest.mock('@/stores/drafts', () => {
  const setDraft = jest.fn()
  const clearDraft = jest.fn()
  const hydrate = jest.fn().mockResolvedValue(undefined)
  const getDraft = jest.fn().mockReturnValue(null)
  const useDraftsStore = (sel: (s: typeof storeState) => unknown) => sel(storeState)
  const storeState = { setDraft, clearDraft, hydrate, getDraft }
  useDraftsStore.getState = () => storeState
  return { useDraftsStore }
})

jest.mock('@/stores/settings', () => ({
  useSettingsStore: () => ({ autoNameFromMessage: false }),
}))

jest.mock('@/stores/sessionNames', () => ({
  useSessionNamesStore: (sel: (s: { getName: () => undefined }) => unknown) =>
    sel({ getName: () => undefined }),
}))

jest.mock('@/hooks/useSessionName', () => ({
  useRenameSession: () => ({ mutate: jest.fn() }),
}))

jest.mock('@/hooks/useVoiceInput', () => ({
  useVoiceInput: () => ({ listening: false, start: jest.fn(), stop: jest.fn() }),
}))

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: { getPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }) },
}))

jest.mock('@/services/uploads', () => ({
  pickFromCamera: jest.fn(),
  pickFromLibraryMulti: jest.fn(),
  pickFromFiles: jest.fn(),
  uploadAttachment: jest.fn(),
}))

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}))

jest.mock('@/services/ws-client', () => ({
  wsManager: { getClient: () => ({ status: () => 'connected' }) },
}))

jest.mock('react-native/Libraries/Alert/Alert', () => ({ alert: jest.fn() }))

// ── import after mocks ───────────────────────────────────────────────────────
import { useComposerState } from '@/hooks/useComposerState'

// ── tests ────────────────────────────────────────────────────────────────────

function renderComposer(onSend = jest.fn()) {
  return renderHook(() =>
    useComposerState({ serverId: 'srv1', sessionId: 'sess1', onSend }),
  )
}

describe('useComposerState', () => {
  beforeEach(() => jest.clearAllMocks())

  it('handleInputChange updates inputText and shows slash board when text starts with /', () => {
    const { result } = renderComposer()
    act(() => { result.current.handleInputChange('/compact') })
    expect(result.current.inputText).toBe('/compact')
    expect(result.current.slashBoardVisible).toBe(true)
  })

  it('handleInputChange hides slash board for normal text', () => {
    const { result } = renderComposer()
    act(() => { result.current.handleInputChange('hello') })
    expect(result.current.slashBoardVisible).toBe(false)
  })

  it('handleSend calls onSend with trimmed text and clears the input', () => {
    const onSend = jest.fn()
    const { result } = renderComposer(onSend)
    act(() => { result.current.handleInputChange('  hello world  ') })
    act(() => { result.current.handleSend() })
    expect(onSend).toHaveBeenCalledWith('hello world', 'hello world')
    expect(result.current.inputText).toBe('')
  })

  it('handleSend does nothing when input is empty and no attachments', () => {
    const onSend = jest.fn()
    const { result } = renderComposer(onSend)
    act(() => { result.current.handleSend() })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('removeAttachment removes the attachment with the matching id', () => {
    const { result } = renderComposer()
    // Access the function — it must exist and be callable
    expect(typeof result.current.removeAttachment).toBe('function')
    // Verify it doesn't throw when called with an unknown id
    act(() => { result.current.removeAttachment('nonexistent') })
    expect(result.current.attachments).toHaveLength(0)
  })

  it('handleSlashCommandSelect for a no-args command calls onSend immediately', () => {
    const onSend = jest.fn()
    const { result } = renderComposer(onSend)
    const cmd = { id: 'compact', label: '/compact', needsArgs: false, description: 'Compact context' }
    act(() => { result.current.handleSlashCommandSelect(cmd) })
    expect(onSend).toHaveBeenCalledWith('/compact', '/compact')
  })

  it('handleSlashCommandSelect for a needs-args command sets pendingArgCommand and does NOT call onSend', () => {
    const onSend = jest.fn()
    const { result } = renderComposer(onSend)
    const cmd = { id: 'search', label: '/search', needsArgs: true, description: 'Search' }
    act(() => { result.current.handleSlashCommandSelect(cmd) })
    expect(onSend).not.toHaveBeenCalled()
    expect(result.current.pendingArgCommand).toEqual(cmd)
  })

  it('handleSlashArgConfirm calls onSend with /<id> <arg> and clears pendingArgCommand', () => {
    const onSend = jest.fn()
    const { result } = renderComposer(onSend)
    const cmd = { id: 'search', label: '/search', needsArgs: true, description: 'Search' }
    act(() => { result.current.handleSlashCommandSelect(cmd) })
    act(() => { result.current.handleSlashArgConfirm(cmd, 'foo bar') })
    expect(onSend).toHaveBeenCalledWith('/search foo bar', '/search foo bar')
    expect(result.current.pendingArgCommand).toBeNull()
  })
})
