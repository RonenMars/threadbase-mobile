import { renderHook, act } from '@testing-library/react-native'
import { useActiveQuestionReducer } from '@/hooks/useActiveQuestion'
import type { QuestionWsMessage, QuestionCancelledWsMessage, PermissionWsMessage } from '@/types/api'

const qMsg: QuestionWsMessage = {
  type: 'question', sessionId: 's1', toolUseId: 't1',
  questions: [{ question: 'Q?', header: 'H', multiSelect: false, options: [{ label: 'A', description: 'a' }, { label: 'B', description: 'b' }] }],
}

const gate: PermissionWsMessage = {
  type: 'permission', sessionId: 's1', prompt: 'Do you want to proceed?', detail: 'Bash command',
  options: [{ index: 1, label: 'Yes' }, { index: 2, label: 'No' }], cursor: 1,
}

describe('useActiveQuestionReducer', () => {
  it('sets the active question on a matching question message', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(qMsg))
    expect(result.current.question?.toolUseId).toBe('t1')
    expect(result.current.question?.source).toBe('structured')
  })
  it('ignores a question for another session', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('OTHER'))
    await act(() => result.current.onMessage(qMsg))
    expect(result.current.question).toBeNull()
  })
  it('clears on question_cancelled matching the held toolUseId', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(qMsg))
    const cancel: QuestionCancelledWsMessage = { type: 'question_cancelled', sessionId: 's1', toolUseId: 't1' }
    await act(() => result.current.onMessage(cancel))
    expect(result.current.question).toBeNull()
  })

  // The streamer closes a gate only when its PTY detector sees the box gone —
  // end of turn. Until then it keeps repainting the same gate with a moved
  // cursor, which is a fresh broadcast to it. Without the suppression the card
  // the user just answered comes straight back.
  it('keeps a cleared gate down when the same gate repaints with a moved cursor', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    expect(result.current.question?.source).toBe('permission')

    await act(() => result.current.clear())
    await act(() => result.current.onMessage({ ...gate, cursor: 2 }))
    expect(result.current.question).toBeNull()
  })

  it('shows a different gate that arrives after one was cleared', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    await act(() => result.current.clear())

    await act(() => result.current.onMessage({ ...gate, detail: 'Edit file' }))
    expect(result.current.question?.questions[0].detail).toBe('Edit file')
  })

  it('shows the same gate again once the server has closed it', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    await act(() => result.current.clear())
    await act(() => result.current.onMessage({ type: 'permission_cancelled', sessionId: 's1' }))

    await act(() => result.current.onMessage(gate))
    expect(result.current.question?.source).toBe('permission')
  })
})
