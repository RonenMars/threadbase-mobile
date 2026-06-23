import { renderHook, act } from '@testing-library/react-native'
import { useActiveQuestionReducer } from '@/hooks/useActiveQuestion'
import type {
  QuestionWsMessage,
  QuestionCancelledWsMessage,
  PermissionWsMessage,
  PermissionCancelledWsMessage,
} from '@/types/api'

const qMsg: QuestionWsMessage = {
  type: 'question', sessionId: 's1', toolUseId: 't1',
  questions: [{ question: 'Q?', header: 'H', multiSelect: false, options: [{ label: 'A', description: 'a' }, { label: 'B', description: 'b' }] }],
}

describe('useActiveQuestionReducer', () => {
  it('sets the active question on a matching question message', () => {
    const { result } = renderHook(() => useActiveQuestionReducer('s1'))
    act(() => result.current.onMessage(qMsg))
    expect(result.current.question?.toolUseId).toBe('t1')
    expect(result.current.question?.source).toBe('structured')
  })
  it('ignores a question for another session', () => {
    const { result } = renderHook(() => useActiveQuestionReducer('OTHER'))
    act(() => result.current.onMessage(qMsg))
    expect(result.current.question).toBeNull()
  })
  it('clears on question_cancelled matching the held toolUseId', () => {
    const { result } = renderHook(() => useActiveQuestionReducer('s1'))
    act(() => result.current.onMessage(qMsg))
    const cancel: QuestionCancelledWsMessage = { type: 'question_cancelled', sessionId: 's1', toolUseId: 't1' }
    act(() => result.current.onMessage(cancel))
    expect(result.current.question).toBeNull()
  })

  it('folds an unstructured shell prompt (permission event w/ answerKeys) into a renderable block', () => {
    const { result } = renderHook(() => useActiveQuestionReducer('s1'))
    const shellPrompt: PermissionWsMessage = {
      type: 'permission',
      sessionId: 's1',
      prompt: 'Continue? [y/N]',
      options: [
        { index: 1, label: 'Yes', answerKeys: 'y\r' },
        { index: 2, label: 'No', answerKeys: 'n\r' },
      ],
    }
    act(() => result.current.onMessage(shellPrompt))
    const q = result.current.question
    expect(q?.source).toBe('permission')
    expect(q?.questions[0].question).toBe('Continue? [y/N]')
    expect(q?.questions[0].options.map(o => o.label)).toEqual(['Yes', 'No'])
    // Tapping option 0 must answer with the literal "y\r", not "1\r".
    expect(q?.permissionAnswerKeys?.[0]).toBe('y\r')
  })

  it('clears the shell-prompt card on permission_cancelled', () => {
    const { result } = renderHook(() => useActiveQuestionReducer('s1'))
    act(() =>
      result.current.onMessage({
        type: 'permission',
        sessionId: 's1',
        prompt: 'Continue? [y/N]',
        options: [{ index: 1, label: 'Yes', answerKeys: 'y\r' }],
      } as PermissionWsMessage)
    )
    const cancel: PermissionCancelledWsMessage = { type: 'permission_cancelled', sessionId: 's1' }
    act(() => result.current.onMessage(cancel))
    expect(result.current.question).toBeNull()
  })
})
