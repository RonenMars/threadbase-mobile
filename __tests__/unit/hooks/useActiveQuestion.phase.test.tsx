import { renderHook, act } from '@testing-library/react-native'
import { useActiveQuestionReducer, GHOST_TTL_MS } from '@/hooks/useActiveQuestion'
import type { PermissionWsMessage, QuestionWsMessage } from '@/types/api'

// Gates are built rather than spread so a fixture cannot contradict itself.
// The server derives contentKey FROM prompt/detail/options, so a hand-written
// key on a spread that changed the detail describes a gate the server could not
// produce — two visibly different gates sharing one identity. That fixture
// makes a correct implementation look broken and a broken one look fine,
// depending which way the reader leans.
//
// Deriving it here keeps the same property the real key has, which is also the
// reason it cannot be the client's identity: it is a function of content, so an
// older server that sends no content key sends no identity either.
const GATE_BASE = {
  type: 'permission' as const,
  sessionId: 's1',
  prompt: 'Do you want to proceed?',
  detail: 'Bash command',
  options: [{ index: 1, label: 'Yes' }, { index: 2, label: 'No' }],
  cursor: 1,
}

function makeGate(over: Partial<PermissionWsMessage> = {}): PermissionWsMessage {
  const merged = { ...GATE_BASE, ...over }
  // An explicit `contentKey` in the override wins — including `undefined`,
  // which is the old-server case and the one test that has to differ.
  if ('contentKey' in over) return merged
  const options = merged.options.map((o) => `${o.index}.${o.label}`).join(',')
  return { ...merged, contentKey: `${merged.prompt}::${merged.detail}::${options}` }
}

const gate = makeGate()

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

// A positive control on the builder itself. Without this, a builder that
// silently reused one key would leave every "different gate" test asserting
// against two fixtures the server could never have produced, and they would
// still be green.
describe('gate fixtures', () => {
  it('gives a gate with different content a different key', () => {
    expect(makeGate({ detail: 'Edit file' }).contentKey).not.toBe(gate.contentKey)
  })

  it('gives a repaint of the same gate the same key', () => {
    expect(makeGate({ cursor: 2 }).contentKey).toBe(gate.contentKey)
  })

  it('leaves the key off when asked, for the old-server case', () => {
    expect(makeGate({ contentKey: undefined }).contentKey).toBeUndefined()
  })
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

    await act(() => result.current.onMessage(makeGate({ detail: 'Edit file' })))
    await act(() => result.current.clear())
    expect(result.current.question).toBeNull()
    expect(result.current.phase).toBeNull()
  })

  it('moves to the pending phase on answer, keeping the card on screen', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    await act(() => result.current.markPending(result.current.questionKey))

    expect(result.current.phase).toBe('pending')
    expect(result.current.question?.source).toBe('permission')
  })

  it('ignores an answer when no card is up', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.markPending(result.current.questionKey))
    expect(result.current.question).toBeNull()
    expect(result.current.phase).toBeNull()
  })

  // Answering is what arms #803's suppression: the streamer keeps repainting an
  // open gate until its detector sees the box gone, and those repaints must not
  // drag the card back to active under the user's own answer.
  it('keeps a repaint of the answered gate from reviving it', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    await act(() => result.current.markPending(result.current.questionKey))

    await act(() => result.current.onMessage(makeGate({ cursor: 2 })))
    expect(result.current.phase).toBe('pending')
  })

  // The client-side shape of the defect contentKey exists to close on the
  // server: an answer has to be bound to the gate it was given for. The POST is
  // not instant — the server re-scrapes the screen before accepting — so a
  // second gate can land while the first answer is in flight, and confirming
  // "whatever is active now" would ghost a gate the user never answered and
  // suppress the repaints of the one they are actually looking at.
  it('ignores a confirmation for a gate that has already been replaced', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    const answered = result.current.questionKey

    await act(() => result.current.onMessage(makeGate({ detail: 'Edit file' })))
    await act(() => result.current.markPending(answered))

    expect(result.current.phase).toBe('active')
    expect(result.current.question?.questions[0].detail).toBe('Edit file')

    // And the replacement is not suppressed either: its own repaints still land.
    await act(() => result.current.onMessage(makeGate({ detail: 'Edit file', cursor: 2 })))
    expect(result.current.phase).toBe('active')
  })

  it('ignores a confirmation for a gate that has already been torn down', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    const answered = result.current.questionKey

    await act(() => result.current.reset())
    await act(() => result.current.markPending(answered))

    expect(result.current.question).toBeNull()
    expect(result.current.phase).toBeNull()

    // Nothing was armed on the way past, so the gate can still come back.
    await act(() => result.current.onMessage(gate))
    expect(result.current.phase).toBe('active')
  })

  it('goes back to active when a different gate arrives while pending', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    await act(() => result.current.markPending(result.current.questionKey))

    await act(() => result.current.onMessage(makeGate({ detail: 'Edit file' })))
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
    await act(() => result.current.markPending(result.current.questionKey))
    await act(() => result.current.onMessage({ type: 'permission_cancelled', sessionId: 's1' }))
    expect(result.current.question).toBeNull()
    expect(result.current.phase).toBeNull()
  })

  // A cancellation names what it cancels. Clearing on any cancellation would
  // take down a card that is still live — and these arrive with nothing on
  // screen to tap, so the user's only signal would be the card vanishing.
  it('ignores a question_cancelled naming a different question', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(question))
    await act(() => result.current.onMessage({ type: 'question_cancelled', sessionId: 's1', toolUseId: 'OTHER' }))
    expect(result.current.phase).toBe('active')
  })

  it('leaves a structured question up when a permission gate is cancelled', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(question))
    await act(() => result.current.onMessage({ type: 'permission_cancelled', sessionId: 's1' }))
    expect(result.current.phase).toBe('active')
  })

  it('leaves a permission gate up when a structured question is cancelled', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    await act(() => result.current.onMessage({ type: 'question_cancelled', sessionId: 's1', toolUseId: 't1' }))
    expect(result.current.phase).toBe('active')
    expect(result.current.question?.source).toBe('permission')
  })

  it('ignores a cancellation for another session', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    await act(() => result.current.onMessage({ type: 'permission_cancelled', sessionId: 'OTHER' }))
    expect(result.current.phase).toBe('active')
  })

  it('survives a cancellation arriving with nothing on screen', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage({ type: 'permission_cancelled', sessionId: 's1' }))
    await act(() => result.current.onMessage({ type: 'question_cancelled', sessionId: 's1', toolUseId: 't1' }))
    expect(result.current.question).toBeNull()

    await act(() => result.current.onMessage(gate))
    expect(result.current.phase).toBe('active')
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
    await act(() => result.current.markPending(result.current.questionKey))
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
    await act(() => result.current.markPending(result.current.questionKey))

    jest.setSystemTime(T0 + GHOST_TTL_MS)
    await act(() => result.current.expireIfStale())
    expect(result.current.question).toBeNull()
    expect(result.current.phase).toBeNull()
  })

  it('keeps the ghost before the ttl has elapsed', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    await act(() => result.current.markPending(result.current.questionKey))

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
    await act(() => result.current.markPending(result.current.questionKey))

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
    await act(() => result.current.markPending(result.current.questionKey))

    jest.setSystemTime(T0 + GHOST_TTL_MS - 1)
    await act(() => result.current.onMessage(makeGate({ detail: 'Edit file' })))
    await act(() => result.current.markPending(result.current.questionKey))

    jest.setSystemTime(T0 + GHOST_TTL_MS + 1)
    await act(() => result.current.expireIfStale())
    expect(result.current.phase).toBe('pending')
  })

  // The failure this exists for: the answer was written but the gate did not
  // recognise it, so it stays open, nothing closes it, and no cancellation ever
  // arrives. Expiry has to hand the gate back rather than take the last trace
  // of it away — thirty seconds of silence is the server failing to confirm,
  // which is the reason for suppression expiring, not being upheld.
  it('stops suppressing a gate that is still repainting after the ghost expires', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    await act(() => result.current.markPending(result.current.questionKey))

    jest.setSystemTime(T0 + GHOST_TTL_MS)
    await act(() => result.current.expireIfStale())
    await act(() => result.current.onMessage(makeGate({ cursor: 2 })))

    expect(result.current.phase).toBe('active')
  })

  it('keeps suppressing while the ghost is still within its ttl', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    await act(() => result.current.markPending(result.current.questionKey))

    jest.setSystemTime(T0 + GHOST_TTL_MS - 1)
    await act(() => result.current.expireIfStale())
    await act(() => result.current.onMessage(makeGate({ cursor: 2 })))

    expect(result.current.phase).toBe('pending')
  })

  it('is a no-op when nothing is on screen', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.expireIfStale())
    expect(result.current.question).toBeNull()
  })
})

// The streamer's broadcast dedupe key includes the cursor; gateKey deliberately
// does not. So a repaint that only moves the cursor is a fresh broadcast of the
// SAME gate, accept() runs, and the block object is replaced — while the gate
// the user tapped is still the gate that is open.
//
// A confirmation must survive that. Rejecting it strands the card in ACTIVE,
// and the ghost ttl only arms a timer for a PENDING card, so the one exit that
// covers a missed close event is not scheduled at all: send stays disabled with
// nothing left to clear it.
describe('useActiveQuestionReducer – confirmation survives a repaint', () => {
  it('accepts the confirmation after a cursor-moved repaint of the same gate', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    const answered = result.current.questionKey

    await act(() => result.current.onMessage(makeGate({ cursor: 2 })))
    await act(() => result.current.markPending(answered))

    expect(result.current.phase).toBe('pending')
  })

  // The field condition. Every server deployed today predates contentKey, so a
  // fix that leans on it is a fix that works only where it is not needed.
  it('accepts it for a gate carrying no contentKey', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    const noKey = makeGate({ contentKey: undefined })
    await act(() => result.current.onMessage(noKey))
    const answered = result.current.questionKey

    await act(() => result.current.onMessage(makeGate({ contentKey: undefined, cursor: 2 })))
    await act(() => result.current.markPending(answered))

    expect(result.current.phase).toBe('pending')
  })

  it('accepts it for a structured question re-broadcast', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(question))
    const answered = result.current.questionKey

    await act(() => result.current.onMessage({ ...question }))
    await act(() => result.current.markPending(answered))

    expect(result.current.phase).toBe('pending')
  })

  // The half that must keep working: a genuinely different gate is not the one
  // that was answered, whatever its object identity.
  it('still rejects a confirmation once a different gate has replaced it', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))
    await act(() => result.current.onMessage(gate))
    const answered = result.current.questionKey

    await act(() => result.current.onMessage(makeGate({ detail: 'Edit file' })))
    await act(() => result.current.markPending(answered))

    expect(result.current.phase).toBe('active')
    expect(result.current.question?.questions[0].detail).toBe('Edit file')
  })
})

// The gate's *instance* identity, once the streamer sends one. Everything above
// this block keys on content, because GATE_BASE carries no gateId — which is
// also the proof that the fallback is untouched: none of those tests changed.
//
// The literal below is the content key spelled out rather than derived. Derived
// from GATE_BASE it would agree with any formula, including a changed one, and
// the one thing this control exists to prove is that the old-streamer key is
// still byte-for-byte what it was.
const CONTENT_KEY = 'Do you want to proceed?::Bash command::1.Yes,2.No'

describe('useActiveQuestionReducer – gate instance identity', () => {
  // The bug. The streamer reopens a gate the user already answered — a second
  // run of the same command, identical down to the byte — and the content key
  // cannot tell the two instances apart, so the suppression armed against the
  // first one swallows the second and the user is left with no card to answer.
  it('shows a fresh card when an identical gate reopens under a new gateId', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))

    await act(() => result.current.onMessage(makeGate({ gateId: 'g1' })))
    expect(result.current.questionKey).toBe('g1')
    await act(() => result.current.markPending('g1'))
    expect(result.current.phase).toBe('pending')

    await act(() => result.current.onMessage(makeGate({ gateId: 'g2' })))

    expect(result.current.phase).toBe('active')
    expect(result.current.questionKey).toBe('g2')
  })

  // The negative control, and the reason the fix is not "stop suppressing".
  // Any key that varied per frame — a counter, a random id — would pass the
  // test above and fail this one: the repaints an open gate emits between the
  // tap and the server's close must still be swallowed.
  it('keeps suppressing a repaint of the same gateId after the answer', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))

    await act(() => result.current.onMessage(makeGate({ gateId: 'g1' })))
    await act(() => result.current.markPending('g1'))

    await act(() => result.current.onMessage(makeGate({ gateId: 'g1', cursor: 2 })))

    expect(result.current.phase).toBe('pending')
    expect(result.current.questionKey).toBe('g1')
  })

  // The field condition, asserted on the value and not just the behaviour.
  // Every streamer deployed today predates gateId, so a change that alters the
  // key they produce is a change that breaks the only servers this runs against.
  it('keys a gate carrying no gateId exactly as before', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))

    await act(() => result.current.onMessage(makeGate({ gateId: undefined })))
    expect(result.current.questionKey).toBe(CONTENT_KEY)

    await act(() => result.current.markPending(CONTENT_KEY))
    await act(() => result.current.onMessage(makeGate({ gateId: undefined, cursor: 2 })))
    expect(result.current.phase).toBe('pending')
  })

  // Its twin: the same content, one field added, keys somewhere else entirely.
  // Together with the test above this pins both halves of the branch.
  it('keys the same gate on the gateId once the streamer sends one', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))

    await act(() => result.current.onMessage(makeGate({ gateId: 'g1' })))

    expect(result.current.questionKey).toBe('g1')
    expect(result.current.questionKey).not.toBe(CONTENT_KEY)
  })

  // A reconnect can land on a streamer that answers differently from the one
  // that armed the suppression, in either direction. Neither may collide: the
  // key changes, so the card comes back. That is the honest direction to fail —
  // we no longer know the answered instance is the one on the wire, and a card
  // wrongly shown is answerable while a card wrongly hidden is a dead session.
  it('hands the card back when an answered gateId gate returns without one', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))

    await act(() => result.current.onMessage(makeGate({ gateId: 'g1' })))
    await act(() => result.current.markPending('g1'))
    // Load-bearing, not scene-setting: the suppression has to be genuinely
    // armed for the next frame to be a test of anything. Without this line a
    // key that never matched would no-op markPending, leave the card `active`
    // for the wrong reason, and satisfy both assertions below.
    expect(result.current.phase).toBe('pending')

    await act(() => result.current.onMessage(makeGate({ gateId: undefined })))

    expect(result.current.phase).toBe('active')
    expect(result.current.questionKey).toBe(CONTENT_KEY)
  })

  it('hands the card back when an answered gateId-less gate returns with one', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))

    await act(() => result.current.onMessage(makeGate({ gateId: undefined })))
    await act(() => result.current.markPending(CONTENT_KEY))

    await act(() => result.current.onMessage(makeGate({ gateId: 'g2' })))

    expect(result.current.phase).toBe('active')
    expect(result.current.questionKey).toBe('g2')
  })

  // What makes the two namespaces disjoint by construction rather than by luck.
  // The wire schema is `z.string().trim().min(1).max(200)`, so `::` is a legal
  // gateId; one that carries it is refused and the gate keys on its content,
  // which is exactly what an old streamer would have produced.
  it('ignores a gateId that could collide with a content key', async () => {
    const { result } = await renderHook(() => useActiveQuestionReducer('s1'))

    await act(() => result.current.onMessage(makeGate({ gateId: 'a::b::c' })))

    expect(result.current.questionKey).toBe(CONTENT_KEY)
  })
})
