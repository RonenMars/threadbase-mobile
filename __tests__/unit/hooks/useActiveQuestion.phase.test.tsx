import { renderHook, act } from '@testing-library/react-native'
import { useActiveQuestionReducer, GHOST_TTL_MS } from '@/hooks/useActiveQuestion'
import type { PermissionWsMessage, QuestionWsMessage } from '@/types/api'

const gate: PermissionWsMessage = {
  type: 'permission',
  sessionId: 's1',
  prompt: 'Do you want to proceed?',
  detail: 'Bash command',
  options: [{ index: 1, label: 'Yes' }, { index: 2, label: 'No' }],
  cursor: 1,
}

const question: QuestionWsMessage = {
  type: 'question',
  sessionId: 's1',
  toolUseId: 't1',
  questions: [{ question: 'Q?', header: 'H', multiSelect: false, options: [{ label: 'A', description: 'a' }, { label: 'B', description: 'b' }] }],
}

const T0 = new Date('2026-08-21T00:00:00.000Z').getTime()

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(T0)
})
afterEach(() => {
  jest.useRealTimers()
})

describe('useActiveQuestionReducer – phase', () => {
  it('starts a fresh gate in the active phase', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    expect(result.current.phase).toBe('active')
  })

  it('reports no phase when no card is up', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    expect(result.current.phase).toBeNull()
  })

  // The lockout guard: M5 disables send on phase 'active', so a phase that
  // outlives its card would disable send with nothing on screen to clear it.
  it('drops the phase with the card on every exit', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))

    await act(() => result.current.onMessage(gate))
    await act(() => result.current.reset())
    expect(result.current.question).toBeNull()
    expect(result.current.phase).toBeNull()

    await act(() => result.current.onMessage({ ...gate, detail: 'Edit file' }))
    await act(() => result.current.clear())
    expect(result.current.question).toBeNull()
    expect(result.current.phase).toBeNull()
  })

  it('moves to the pending phase on answer, keeping the card on screen', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    await act(() => result.current.markPending())

    expect(result.current.phase).toBe('pending')
    expect(result.current.question?.source).toBe('permission')
  })

  it('ignores an answer when no card is up', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.markPending())
    expect(result.current.question).toBeNull()
    expect(result.current.phase).toBeNull()
  })

  // Answering is what arms #803's suppression: the streamer keeps repainting an
  // open gate until its detector sees the box gone, and those repaints must not
  // drag the card back to active under the user's own answer.
  it('keeps a repaint of the answered gate from reviving it', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    await act(() => result.current.markPending())

    await act(() => result.current.onMessage({ ...gate, cursor: 2 }))
    expect(result.current.phase).toBe('pending')
  })

  it('goes back to active when a different gate arrives while pending', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    await act(() => result.current.markPending())

    await act(() => result.current.onMessage({ ...gate, detail: 'Edit file' }))
    expect(result.current.phase).toBe('active')
    expect(result.current.question?.questions[0].detail).toBe('Edit file')
  })

  // Today's behaviour, and it must not be narrowed to PENDING: a gate closing
  // any other way — answered on a second device, at the host keyboard, /clear,
  // or Claude giving up — has to take an ACTIVE card down too.
  it('clears an active card on permission_cancelled', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    await act(() => result.current.onMessage({ type: 'permission_cancelled', sessionId: 's1' }))
    expect(result.current.question).toBeNull()
    expect(result.current.phase).toBeNull()
  })

  it('clears a pending card on permission_cancelled', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    await act(() => result.current.markPending())
    await act(() => result.current.onMessage({ type: 'permission_cancelled', sessionId: 's1' }))
    expect(result.current.question).toBeNull()
    expect(result.current.phase).toBeNull()
  })

  it('clears an active structured question on question_cancelled', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(question))
    await act(() => result.current.onMessage({ type: 'question_cancelled', sessionId: 's1', toolUseId: 't1' }))
    expect(result.current.phase).toBeNull()
  })

  it('clears a pending structured question on question_cancelled', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(question))
    await act(() => result.current.markPending())
    await act(() => result.current.onMessage({ type: 'question_cancelled', sessionId: 's1', toolUseId: 't1' }))
    expect(result.current.phase).toBeNull()
  })
})

// The stamp is the authority, never a timer. expireIfStale() is idempotent and
// safe to call at any moment, so whatever prompts it — a timer, an AppState
// resume — can only be early or late, never wrong.
describe('useActiveQuestionReducer – ghost expiry', () => {
  it('drops the ghost once it has stood longer than the ttl', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    await act(() => result.current.markPending())

    jest.setSystemTime(T0 + GHOST_TTL_MS)
    await act(() => result.current.expireIfStale())
    expect(result.current.question).toBeNull()
    expect(result.current.phase).toBeNull()
  })

  it('keeps the ghost before the ttl has elapsed', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    await act(() => result.current.markPending())

    jest.setSystemTime(T0 + GHOST_TTL_MS - 1)
    await act(() => result.current.expireIfStale())
    expect(result.current.phase).toBe('pending')
  })

  // A long background/resume is the case a bare setTimeout gets wrong: it fires
  // late, or not at all. Evaluating against the stamp gets the same answer no
  // matter how late the prompt to look arrives.
  it('drops a ghost that was backgrounded well past the ttl', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    await act(() => result.current.markPending())

    jest.setSystemTime(T0 + 20 * 60 * 1000)
    await act(() => result.current.expireIfStale())
    expect(result.current.question).toBeNull()
  })

  it('never expires an active card, however long it stands', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))

    jest.setSystemTime(T0 + 20 * 60 * 1000)
    await act(() => result.current.expireIfStale())
    expect(result.current.phase).toBe('active')
  })

  it('restamps when a new gate is answered, so the clock is per-answer', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    await act(() => result.current.markPending())

    jest.setSystemTime(T0 + GHOST_TTL_MS - 1)
    await act(() => result.current.onMessage({ ...gate, detail: 'Edit file' }))
    await act(() => result.current.markPending())

    jest.setSystemTime(T0 + GHOST_TTL_MS + 1)
    await act(() => result.current.expireIfStale())
    expect(result.current.phase).toBe('pending')
  })

  it('is a no-op when nothing is on screen', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.expireIfStale())
    expect(result.current.question).toBeNull()
  })
})
