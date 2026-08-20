import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { wsManager } from '@/services/ws-client'
import { mapAskQuestionToBlock } from '@/utils/mapAskQuestionToBlock'
import { mapPermissionToBlock } from '@/utils/mapPermissionToBlock'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'
import type {
  QuestionWsMessage,
  QuestionCancelledWsMessage,
  PermissionWsMessage,
  PermissionCancelledWsMessage,
  Session,
  SessionStatus,
} from '@/types/api'

type SessionUpdateMessage = { type: 'session_update'; session: Session }

type Incoming =
  | QuestionWsMessage
  | QuestionCancelledWsMessage
  | PermissionWsMessage
  | PermissionCancelledWsMessage
  | SessionUpdateMessage

// Content identity of a gate, cursor deliberately excluded. The streamer's own
// dedupe key includes the cursor, so a repaint that only moves it re-broadcasts
// the same gate — which would put a card the user already answered back on
// screen a beat after it went away.
function gateKey(msg: PermissionWsMessage): string {
  const options = msg.options.map(o => `${o.index}.${o.label}`).join(',')
  return `${msg.prompt ?? ''}::${msg.detail ?? ''}::${options}`
}

/**
 * How long a ghost card stands after its answer before it is assumed lost.
 * The gate normally closes long before this — the ttl only covers a close event
 * that never arrives, and the resubscribe on resume is the real backstop.
 */
export const GHOST_TTL_MS = 30_000

/**
 * `active` — the gate is live: the card is tappable and send is disabled.
 * `pending` — the user answered and the server took it, but the gate has not
 * been observed closing yet. The card stands as a non-tappable ghost and
 * blocks nothing.
 */
export type QuestionPhase = 'active' | 'pending'

// One object, so `phase` cannot outlive the card it describes. Two parallel
// pieces of state could disagree, and the dangerous direction is not
// hypothetical: send is disabled on `active`, so a phase left behind by a
// cleared card would disable send with nothing on screen to clear it — the
// lockout this whole design exists to avoid. `question` and `phase` are
// derived from this on the way out, so callers and their tests see two plain
// fields that are incapable of drifting apart.
type CardState =
  | { prompt: QuestionBlock; phase: 'active' }
  | { prompt: QuestionBlock; phase: 'pending'; pendingSince: number }

export function useActiveQuestionReducer(sessionId: string) {
  const [card, setCard] = useState<CardState | null>(null)
  // Mirrors `card` so the transitions below can read what is on screen *now*
  // rather than what was on screen when their caller's closure was built. An
  // answer POST is not instant — the server re-scrapes before accepting — so a
  // handler created at tap time can resolve into a render where a different
  // gate has arrived, and a stale read is what turns "confirm this answer" into
  // "confirm whatever is showing".
  const cardRef = useRef<CardState | null>(null)
  // The only permitted writer of `card`. A mirror is worth exactly as much as
  // the discipline that nothing bypasses it: one setCard() elsewhere and the
  // ref goes stale in precisely the case markPending's guard depends on, which
  // would reintroduce the confirm-the-wrong-gate bug with a guard now hiding it.
  //
  // That guard also relies on accept() building a fresh QuestionBlock per
  // broadcast, since it compares by object identity. Reusing a block for two
  // gates would make them indistinguishable to it.
  const commit = useCallback((next: CardState | null) => {
    cardRef.current = next
    setCard(next)
  }, [])
  // Identity of whatever `question` currently holds, and of the last thing
  // `clear()` took down.
  //
  // The rule, one rule with three sites: suppression is justified only while
  // there is reason to believe the answer landed. markPending() arms it,
  // because a 200 is that reason. A disconnect drops it, because we no longer
  // know. A ghost aging past its ttl drops it, because the server was supposed
  // to confirm and did not. Dropping it asserts nothing — a gate that really
  // closed does not repaint, so the card returns only when one is genuinely
  // still open.
  // The server closes a gate only when its PTY detector
  // sees the box gone — end of turn, tens of seconds after the tap — so a card
  // cleared on answer has to defend itself against repaints in the meantime.
  // ponytail: dropped on the next cancellation or different gate; an identical
  // gate that reopens with neither in between stays hidden.
  const currentKey = useRef<string | null>(null)
  const dismissedKey = useRef<string | null>(null)
  // Last status this session was seen in. The teardown below is edge-triggered
  // off it: the gate broadcast and the status flip to `waiting_input` are two
  // separate messages with no ordering guarantee, so "status isn't
  // waiting_input" on its own would tear down a card a beat after it arrived.
  // What that costs: the status exit is inert until a `waiting_input` update
  // has actually been observed, so it never fires for a card that arrived by
  // subscribe replay into an already-waiting session. `*_cancelled` is the exit
  // that covers that window.
  const lastStatus = useRef<SessionStatus | null>(null)

  const accept = useCallback((key: string | null, block: QuestionBlock) => {
    currentKey.current = key
    dismissedKey.current = null
    commit({ prompt: block, phase: 'active' })
  }, [commit])

  // The user answered and the server took it. The card stays up as a ghost —
  // it blocks nothing, so an answer the server never confirms costs nothing —
  // and arms the same suppression clear() does, because the streamer keeps
  // repainting an open gate until its detector sees the box gone and those
  // repaints must not drag the card back to active under the user's answer.
  // `answered` is the prompt the user actually tapped, captured at tap time.
  // Confirming without it would transition whatever card is active when the 200
  // lands and arm suppression against whatever key is current then — so an
  // answer to gate A arriving after gate B had replaced it would ghost B, which
  // the user never answered, and suppress B's repaints. That is the client-side
  // shape of exactly what contentKey closes on the server: an answer has to be
  // bound to the gate it was given for. A confirmation for a gate that is gone
  // does nothing, which is right — the decision it was about is gone with it.
  const markPending = useCallback((answered: QuestionBlock) => {
    const live = cardRef.current
    if (live?.phase !== 'active' || live.prompt !== answered) return
    dismissedKey.current = currentKey.current
    commit({ prompt: live.prompt, phase: 'pending', pendingSince: Date.now() })
  }, [commit])

  // Evaluated against the stamp, never against a timer's own reckoning. A
  // timer or an AppState resume only decides *when* to look; this decides what
  // is true. So a prompt to look can be early or late — twenty minutes late
  // after a background — without ever being wrong, and calling it is idempotent.
  //
  // Expiring drops the suppression as well, per the rule above. The failure it
  // exists for is the one where that matters: an answer the server wrote but
  // the gate did not recognise leaves the gate open, so nothing ever closes it
  // and no cancellation arrives. Keeping the key armed would make expiry delete
  // the last trace of a decision the agent is still blocked on.
  const expireIfStale = useCallback(() => {
    const live = cardRef.current
    if (live?.phase !== 'pending' || Date.now() - live.pendingSince < GHOST_TTL_MS) return
    dismissedKey.current = null
    commit(null)
  }, [commit])

  // The card's premise died — the session stopped waiting for input — so it
  // comes down without the user having dismissed anything. Deliberately NOT
  // clear(): clear() arms dismissedKey so a repaint of the gate the user just
  // answered stays down, and the gate replayed on resubscribe is byte-identical
  // to the one this took away. Arming it here would swallow that replay and
  // turn a stuck card into a card that can never come back. Leaving
  // dismissedKey untouched keeps both halves right: an unanswered gate returns
  // on replay, an answered one stays suppressed.
  const reset = useCallback(() => {
    currentKey.current = null
    commit(null)
  }, [commit])

  // Same teardown, plus dropping the suppression, for the case where the reason
  // to suppress has expired rather than the card's premise having died. See the
  // rule on dismissedKey above: a disconnect means we no longer know whether the
  // answer landed, and what arrives after the reconnect is the server's fresh
  // account of what is open rather than a stale repaint of something we already
  // acted on. If the answer did land, the gate is closed and nothing replays —
  // so this cannot resurrect a card that should stay down.
  const resetAndUnsuppress = useCallback(() => {
    dismissedKey.current = null
    reset()
  }, [reset])

  const onMessage = useCallback((msg: Incoming) => {
    if (msg.type === 'session_update') {
      if (msg.session.id !== sessionId) return
      const left = lastStatus.current === 'waiting_input' && msg.session.status !== 'waiting_input'
      lastStatus.current = msg.session.status
      if (left) reset()
      return
    }
    if (msg.sessionId !== sessionId) return
    if (msg.type === 'question') {
      if (dismissedKey.current === msg.toolUseId) return
      accept(msg.toolUseId, mapAskQuestionToBlock(msg.toolUseId, msg.questions))
    } else if (msg.type === 'question_cancelled') {
      dismissedKey.current = null
      if (cardRef.current?.prompt.toolUseId === msg.toolUseId) commit(null)
    } else if (msg.type === 'permission') {
      const key = gateKey(msg)
      if (dismissedKey.current === key) return
      accept(key, mapPermissionToBlock(msg.prompt, msg.options, msg.cursor, msg.detail, msg.contentKey))
    } else if (msg.type === 'permission_cancelled') {
      dismissedKey.current = null
      if (cardRef.current?.prompt.source === 'permission') commit(null)
    }
  }, [accept, commit, reset, sessionId])

  const clear = useCallback(() => {
    dismissedKey.current = currentKey.current
    commit(null)
  }, [commit])

  return {
    question: card?.prompt ?? null,
    phase: card?.phase ?? null,
    onMessage,
    clear,
    reset,
    resetAndUnsuppress,
    markPending,
    expireIfStale,
  }
}

// Public hook: subscribe to the session WS and feed messages into the reducer.
// Mirrors the subscription pattern in hooks/useConversationStream.ts (same socket source).
export function useActiveQuestion(serverId: string, sessionId: string) {
  const { question, phase, onMessage, clear, reset, resetAndUnsuppress, markPending, expireIfStale } =
    useActiveQuestionReducer(sessionId)

  useEffect(() => {
    if (!serverId || !sessionId) return
    const client = wsManager.getClient(serverId)
    const unsubQuestion = client?.on('question', (msg) => {
      if (msg.type === 'question') onMessage(msg)
    })
    const unsubCancelled = client?.on('question_cancelled', (msg) => {
      if (msg.type === 'question_cancelled') onMessage(msg)
    })
    const unsubPermission = client?.on('permission', (msg) => {
      if (msg.type === 'permission') onMessage(msg)
    })
    const unsubPermissionCancelled = client?.on('permission_cancelled', (msg) => {
      if (msg.type === 'permission_cancelled') onMessage(msg)
    })
    const unsubSessionUpdate = client?.on('session_update', (msg) => {
      if (msg.type === 'session_update') onMessage(msg)
    })
    // onAnyStatusChange, not onStatusChange: a reconnect replaces the WSClient
    // instance, and a listener bound to the old one stops firing.
    const unsubStatus = wsManager.onAnyStatusChange((id, status) => {
      if (id === serverId && status === 'disconnected') resetAndUnsuppress()
    })
    return () => {
      unsubQuestion?.()
      unsubCancelled?.()
      unsubPermission?.()
      unsubPermissionCancelled?.()
      unsubSessionUpdate?.()
      unsubStatus()
    }
  }, [serverId, sessionId, onMessage, resetAndUnsuppress])

  // A ghost only ever leaves by re-evaluation, never by a timer's own reckoning.
  // Both of these are prompts to *look*: the timeout for a session that has gone
  // quiet with nothing arriving, the resume for the case a backgrounded timer
  // fires late or not at all. expireIfStale() decides against the stamp, so
  // either prompt can be early or late without being wrong.
  //
  // This matters more than it looks. The failure it covers is an answer the
  // server wrote but the gate did not recognise: the gate stays open, so nothing
  // closes it and no cancellation arrives — and the resubscribe replays a gate
  // that is genuinely still open, so it is no backstop there either. In that
  // case this is the only thing that hands the card back.
  useEffect(() => {
    if (phase !== 'pending') return
    const timer = setTimeout(expireIfStale, GHOST_TTL_MS)
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') expireIfStale()
    })
    return () => {
      clearTimeout(timer)
      sub.remove()
    }
  }, [phase, expireIfStale])

  return { question, phase, onMessage, clear, reset, markPending, expireIfStale }
}
