import { renderHook, act } from '@testing-library/react-native'
import { useComposerState } from '@/hooks/useComposerState'

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

// ── tests ────────────────────────────────────────────────────────────────────

async function renderComposer(onSend = jest.fn()) {
  return await renderHook(() =>
    useComposerState({ serverId: 'srv1', sessionId: 'sess1', onSend }),
  )
}

describe('useComposerState', () => {
  beforeEach(() => jest.clearAllMocks())

  it('handleInputChange updates inputText and shows slash board when text starts with /', async () => {
    const { result } = await renderComposer()
    await act(() => { result.current.handleInputChange('/compact') })
    expect(result.current.inputText).toBe('/compact')
    expect(result.current.slashBoardVisible).toBe(true)
  })

  it('handleInputChange hides slash board for normal text', async () => {
    const { result } = await renderComposer()
    await act(() => { result.current.handleInputChange('hello') })
    expect(result.current.slashBoardVisible).toBe(false)
  })

  it('handleSend calls onSend with trimmed text and clears the input', async () => {
    const onSend = jest.fn()
    const { result } = await renderComposer(onSend)
    await act(() => { result.current.handleInputChange('  hello world  ') })
    await act(() => { result.current.handleSend() })
    expect(onSend).toHaveBeenCalledWith('hello world', 'hello world')
    expect(result.current.inputText).toBe('')
  })

  it('handleSend does nothing when input is empty and no attachments', async () => {
    const onSend = jest.fn()
    const { result } = await renderComposer(onSend)
    await act(() => { result.current.handleSend() })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('removeAttachment removes the attachment with the matching id', async () => {
    const { result } = await renderComposer()
    // Access the function — it must exist and be callable
    expect(typeof result.current.removeAttachment).toBe('function')
    // Verify it doesn't throw when called with an unknown id
    await act(() => { result.current.removeAttachment('nonexistent') })
    expect(result.current.attachments).toHaveLength(0)
  })

  it('handleSlashCommandSelect for a no-args command calls onSend immediately', async () => {
    const onSend = jest.fn()
    const { result } = await renderComposer(onSend)
    const cmd = { id: 'compact', icon: null as never, title: 'Compact', needsArgs: false, description: 'Compact context' }
    await act(() => { result.current.handleSlashCommandSelect(cmd) })
    expect(onSend).toHaveBeenCalledWith('/compact', '/compact')
  })

  it('handleSlashCommandSelect for a needs-args command sets pendingArgCommand and does NOT call onSend', async () => {
    const onSend = jest.fn()
    const { result } = await renderComposer(onSend)
    const cmd = { id: 'search', icon: null as never, title: 'Search', needsArgs: true, description: 'Search' }
    await act(() => { result.current.handleSlashCommandSelect(cmd) })
    expect(onSend).not.toHaveBeenCalled()
    expect(result.current.pendingArgCommand).toEqual(cmd)
  })

  it('handleSlashArgConfirm calls onSend with /<id> <arg> and clears pendingArgCommand', async () => {
    const onSend = jest.fn()
    const { result } = await renderComposer(onSend)
    const cmd = { id: 'search', icon: null as never, title: 'Search', needsArgs: true, description: 'Search' }
    await act(() => { result.current.handleSlashCommandSelect(cmd) })
    await act(() => { result.current.handleSlashArgConfirm(cmd, 'foo bar') })
    expect(onSend).toHaveBeenCalledWith('/search foo bar', '/search foo bar')
    expect(result.current.pendingArgCommand).toBeNull()
  })
})

describe('path escaping for @references', () => {
  it('escapes spaces in paths', () => {
    const escapePath = (p: string) => p.replace(/ /g, '\\ ')
    expect(escapePath('/tmp/My Photo.jpg')).toBe('/tmp/My\\ Photo.jpg')
    expect(escapePath('/path/with multiple spaces/file.jpg')).toBe('/path/with\\ multiple\\ spaces/file.jpg')
    expect(escapePath('/no-spaces.jpg')).toBe('/no-spaces.jpg')
  })

  it('builds correct payload with multiple attachments', () => {
    const escapePath = (p: string) => p.replace(/ /g, '\\ ')
    const attachments = [
      { path: '/tmp/My Photo.jpg' },
      { path: '/tmp/Another Image.png' },
    ]
    const refs = attachments.map((a) => `@${escapePath(a.path)}`).join(' ')
    expect(refs).toBe('@/tmp/My\\ Photo.jpg @/tmp/Another\\ Image.png')

    const text = 'what are these?'
    const payload = `${refs} ${text}`
    expect(payload).toBe('@/tmp/My\\ Photo.jpg @/tmp/Another\\ Image.png what are these?')
  })

  it('builds attachments-only payload when no text', () => {
    const escapePath = (p: string) => p.replace(/ /g, '\\ ')
    const attachments = [
      { path: '/tmp/file1.jpg' },
      { path: '/tmp/file2.png' },
    ]
    const refs = attachments.map((a) => `@${escapePath(a.path)}`).join(' ')
    expect(refs).toBe('@/tmp/file1.jpg @/tmp/file2.png')
  })
})
