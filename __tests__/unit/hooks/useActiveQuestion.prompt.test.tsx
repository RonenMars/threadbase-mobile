import { renderHook, act } from '@testing-library/react-native'
import { useActiveQuestionReducer } from '@/hooks/useActiveQuestion'
import type { PermissionWsMessage, Prompt, PromptEventWsMessage, PromptSnapshotWsMessage, QuestionWsMessage } from '@/types/api'

const PROMPT: Prompt = {
  schemaVersion: 1,
  sessionId: 's1',
  promptId: 'prompt-1',
  revision: 1,
  state: 'open',
  intent: 'approval',
  title: 'Approval',
  message: 'Do you want to proceed?',
  detail: 'Bash command\ngit push',
  questions: [
    {
      questionId: 'q-1',
      text: 'Do you want to proceed?',
      header: 'Approval',
      inputMode: 'single',
      options: [
        { optionId: 'opt-yes', label: 'Yes' },
        { optionId: 'opt-no', label: 'No' },
      ],
      allowOther: false,
      secret: 'unknown',
    },
  ],
  answerRequirement: 'unknown',
  expiresAt: null,
  provenance: { source: 'screen', confidence: 'inferred' },
}

const event = (prompt: Prompt, sequence = 1): PromptEventWsMessage => ({ type: 'prompt_event', sessionId: prompt.sessionId, sequence, prompt })
const snapshot = (prompts: Prompt[], sessionId = 's1'): PromptSnapshotWsMessage => ({
  type: 'prompt_snapshot', schemaVersion: 1, sessionId, sequence: prompts.length, prompts,
})
const legacyGate: PermissionWsMessage = {
  type: 'permission', sessionId: 's1', prompt: 'Do you want to proceed?', detail: 'Bash command',
  options: [{ index: 1, label: 'Yes' }, { index: 2, label: 'No' }], contentKey: 'ck', gateId: 'prompt-1',
}
const legacyQuestion: QuestionWsMessage = {
  type: 'question', sessionId: 's1', toolUseId: 't1',
  questions: [{ question: 'Q?', header: 'H', multiSelect: false, options: [{ label: 'A', description: '' }] }],
}

describe('useActiveQuestionReducer — provider-neutral prompts', () => {
  it('opens the card from a prompt_event and keys it on the promptId', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(event(PROMPT)))
    expect(result.current.question?.source).toBe('prompt')
    expect(result.current.questionKey).toBe('prompt-1')
    expect(result.current.phase).toBe('active')
  })

  it('opens the latest actionable prompt from a snapshot and ignores retained terminal ones', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    const resolved: Prompt = { ...PROMPT, promptId: 'prompt-0', state: 'resolved', terminalReason: 'answered' }
    const newer: Prompt = { ...PROMPT, promptId: 'prompt-2', message: 'Second' }
    await act(() => result.current.onMessage(snapshot([resolved, PROMPT, newer])))
    expect(result.current.questionKey).toBe('prompt-2')
  })

  it('keeps a permission prompt focused when a question arrives after it', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    const question: Prompt = { ...PROMPT, promptId: 'question-1', intent: 'question', message: 'Which option?' }
    await act(() => result.current.onMessage(event(PROMPT)))
    await act(() => result.current.onMessage(event(question, 2)))
    expect(result.current.questionKey).toBe('prompt-1')

    await act(() => result.current.onMessage(event({ ...PROMPT, state: 'resolved', terminalReason: 'answered' }, 3)))
    expect(result.current.questionKey).toBe('question-1')
  })

  it('ignores a prompt for another session', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('OTHER'))
    await act(() => result.current.onMessage(event(PROMPT)))
    expect(result.current.question).toBeNull()
  })

  // A revision bump is the same occurrence: same key, so a selection the user
  // has made survives it, exactly as a cursor-only repaint of a gate does.
  it('keeps the key across a revision bump and replaces the block', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(event(PROMPT)))
    await act(() => result.current.onMessage(event({ ...PROMPT, revision: 2, state: 'updated', message: 'Changed' }, 2)))
    expect(result.current.questionKey).toBe('prompt-1')
    expect(result.current.question?.promptRevision).toBe(2)
    expect(result.current.phase).toBe('active')
  })

  it.each(['resolved', 'cancelled', 'expired', 'unavailable', 'something_new'])(
    'takes the card down on a terminal or unknown state (%s)',
    async (state) => {
      const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
      await act(() => result.current.onMessage(event(PROMPT)))
      await act(() => result.current.onMessage(event({ ...PROMPT, revision: 2, state, terminalReason: 'x' }, 2)))
      expect(result.current.question).toBeNull()
    },
  )

  it('leaves the card up when a different prompt ends', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(event(PROMPT)))
    await act(() => result.current.onMessage(event({ ...PROMPT, promptId: 'other', state: 'cancelled', terminalReason: 'x' }, 2)))
    expect(result.current.questionKey).toBe('prompt-1')
  })

  it('keeps an answered prompt down through a repaint, and lets it end', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(event(PROMPT)))
    await act(() => result.current.markPending('prompt-1'))
    expect(result.current.phase).toBe('pending')
    await act(() => result.current.clear())
    await act(() => result.current.onMessage(event(PROMPT, 2)))
    expect(result.current.question).toBeNull()
    await act(() => result.current.onMessage(event({ ...PROMPT, state: 'resolved', terminalReason: 'answered' }, 3)))
    await act(() => result.current.onMessage(event({ ...PROMPT, promptId: 'prompt-3' }, 4)))
    expect(result.current.questionKey).toBe('prompt-3')
  })

  // Negotiation by frame presence. A contract-capable streamer sends the same
  // prompt on both the new and the legacy frame; once a contract frame has been
  // seen the legacy one is noise. Its absence is what "old streamer" looks like.
  it('ignores legacy question and permission frames once a contract frame has been seen', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(snapshot([])))
    await act(() => result.current.onMessage(legacyGate))
    expect(result.current.question).toBeNull()
    await act(() => result.current.onMessage(legacyQuestion))
    expect(result.current.question).toBeNull()
    await act(() => result.current.onMessage(event(PROMPT)))
    expect(result.current.question?.source).toBe('prompt')
  })

  it('still accepts legacy frames when no contract frame has been seen (old streamer)', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(legacyGate))
    expect(result.current.question?.source).toBe('permission')
    await act(() => result.current.onMessage({ type: 'permission_cancelled', sessionId: 's1' }))
    await act(() => result.current.onMessage(legacyQuestion))
    expect(result.current.question?.source).toBe('structured')
  })
})
