import { renderHook, act } from '@testing-library/react-native'
import { useActiveQuestionReducer } from '@/hooks/useActiveQuestion'
import type { QuestionWsMessage, QuestionCancelledWsMessage } from '@/types/api'

const qMsg: QuestionWsMessage = {
  type: 'question', sessionId: 's1', toolUseId: 't1',
  questions: [{ question: 'Q?', header: 'H', multiSelect: false, options: [{ label: 'A', description: 'a' }, { label: 'B', description: 'b' }] }],
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
})
