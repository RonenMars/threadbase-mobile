import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { wsManager } from '@/services/ws-client'
import { mapAskQuestionToBlock } from '@/utils/mapAskQuestionToBlock'
import { mapPermissionToBlock } from '@/utils/mapPermissionToBlock'
import { mapPromptToBlock } from '@/utils/mapPromptToBlock'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'
import type {
  Prompt,
  PromptEventWsMessage,
  PromptSnapshotWsMessage,
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
  | PromptEventWsMessage
  | PromptSnapshotWsMessage
  | SessionUpdateMessage

// Narrowed on read, never trusted from the type: a state this build has not
// heard of is not actionable (tb-mobile CLAUDE.md, "degrade, don't break").
function isActionablePrompt(prompt: Prompt): boolean {
  return prompt.state === 'open' || prompt.state === 'updated'
}

// Identity of a gate *instance*. The server owns it wherever it sends a gateId;
// a streamer too old to send one falls back to the gate's content, cursor
// deliberately excluded — the streamer's own dedupe key includes the cursor, so
// a repaint that only moves it re-broadcasts the same gate, which would put a
// card the user already answered back on screen a beat after it went away. The
// gateId is stable across those repaints too: the streamer carries the prior
// instance's id forward rather than minting a new one.
//
// The two namespaces are disjoint by construction, not by probability. Every
// content key contains the two literal `::` separators, so a gateId admitted as
// a key can never equal one, for any string the server might send. A gateId
// that itself contains `::` is refused and the gate keys on its content — the
// old-streamer behaviour, which is the safe direction to degrade in.
function gateKey(msg: PermissionWsMessage): string {
  const options = msg.options.map(o => `${o.index}.${o.label}`).join(',')
  const content = `${msg.prompt ?? ''}::${msg.detail ?? ''}::${options}`
  return msg.gateId && !msg.gateId.includes('::') ? msg.gateId : content
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
  | { prompt: QuestionBlock; key: string; phase: 'active' }
  | { prompt: QuestionBlock; key: string; phase: 'pending'; pendingSince: number }

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
  const commit = useCallback((next: CardState | null) => {
    cardRef.current = next
    setCard(next)
  }, [])
  // Identity of the last thing `clear()` took down.
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
  // ponytail: dropped on the next cancellation or different gate. Wherever the
  // streamer sends a gateId a reopen *is* a different gate, so it comes back;
  // on one that sends none, an identical gate that reopens with neither in
  // between still stays hidden.
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
  // Set by the first prompt_snapshot / prompt_event for this session. A
  // contract-capable streamer emits the same prompt on BOTH the new and the
  // legacy frames, so once one contract frame has been seen the legacy frames
  // are ignored — otherwise every gate would open twice and flap. The snapshot
  // goes out on subscribe before any legacy frame, so this cannot race; a
  // streamer that predates the contract never sets it and nothing changes.
  const promptContractSeen = useRef(false)
  // Keep every normalized prompt so approval gates take focus over retained
  // questions, matching the streamer's permission-first arbitration.
  const openPrompts = useRef(new Map<string, Prompt>())

  // Both callers pass a definite key (toolUseId, or gateKey's template literal) —
  // a null here would mean a card whose identity matches every other null-keyed card.
  const accept = useCallback((key: string, block: QuestionBlock) => {
    dismissedKey.current = null
    commit({ prompt: block, key, phase: 'active' })
  }, [commit])

  // The user answered and the server took it. The card stays up as a ghost —
  // it blocks nothing, so an answer the server never confirms costs nothing —
  // and arms the same suppression clear() does, because the streamer keeps
  // repainting an open gate until its detector sees the box gone and those
  // repaints must not drag the card back to active under the user's answer.
  // `answeredKey` is the identity of the gate the user tapped, captured at tap
  // time. Confirming without it would transition whatever card is active when
  // the 200 lands and arm suppression against whatever key is current then — so
  // an answer to gate A arriving after gate B had replaced it would ghost B,
  // which the user never answered, and suppress B's repaints. That is the
  // client-side shape of what contentKey closes on the server: an answer has to
  // be bound to the gate it was given for.
  //
  // Identity is the KEY, never the block object. The streamer's broadcast
  // dedupe includes the cursor and gateKey deliberately does not, so a repaint
  // that only moves the cursor is a fresh broadcast of the same gate: accept()
  // runs and replaces the block. Comparing objects would reject a legitimate
  // confirmation whenever a repaint landed between the tap and the reply, which
  // strands the card in `active` — and since the ghost ttl only arms a timer
  // for a `pending` card, that path has no expiry backstop and send stays
  // disabled with nothing left to clear it.
  //
  // The card's key is the right identity for both sources and for every
  // server: gateKey for a permission gate, toolUseId for a structured question.
  // gateKey prefers the server's gateId and falls back to the gate's content,
  // so it is defined on every streamer, one that sends the field and one that
  // does not.
  //
  // Do not "simplify" gateKey's fallback to permissionContentKey, or to
  // anything else derived from a field the old wire format does not carry. It
  // looks more principled — it is the server's own identity for the gate — and
  // it is absent on every streamer that predates the validated route, which is
  // the only place the fallback has to work. Absent, it carries no information:
  // a bare comparison makes every gate match, and a guarded one falls back to
  // the object identity this replaced. Both are wrong on exactly the servers
  // deployed today.
  //
  // gateId sits *above* that fallback rather than replacing it, for the same
  // reason: it is additive, so it is present on new streamers and absent on
  // old ones, and preferring it where it exists costs the old path nothing.
  //
  // The asymmetry with CardState.key is deliberate, not an oversight to tidy
  // away: a card always has a key, but a tap might not have one — the view
  // passes questionKey, which is null when no card is up.
  const markPending = useCallback((answeredKey: string | null) => {
    const live = cardRef.current
    if (live?.phase !== 'active' || live.key !== answeredKey) return
    dismissedKey.current = live.key
    commit({ prompt: live.prompt, key: live.key, phase: 'pending', pendingSince: Date.now() })
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
    openPrompts.current.clear()
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

  const focusPrompt = useCallback(() => {
    const prompts = [...openPrompts.current.values()].filter(
      (candidate) => dismissedKey.current !== candidate.promptId,
    )
    const focused = prompts.filter((candidate) => candidate.intent === 'approval').at(-1)
      ?? prompts.filter((candidate) => candidate.intent !== 'approval').at(-1)
    if (!focused) {
      commit(null)
      return
    }
    accept(focused.promptId, mapPromptToBlock(focused))
  }, [accept, commit])

  // A permission gate has the PTY focus whenever it coexists with a question.
  // Within either type, the latest normalized event wins.
  const applyPrompt = useCallback((prompt: Prompt) => {
    if (isActionablePrompt(prompt)) {
      openPrompts.current.delete(prompt.promptId)
      openPrompts.current.set(prompt.promptId, prompt)
      focusPrompt()
      return
    }
    openPrompts.current.delete(prompt.promptId)
    if (dismissedKey.current === prompt.promptId) dismissedKey.current = null
    focusPrompt()
  }, [focusPrompt])

  const onMessage = useCallback((msg: Incoming) => {
    if (msg.type === 'session_update') {
      if (msg.session.id !== sessionId) return
      const left = lastStatus.current === 'waiting_input' && msg.session.status !== 'waiting_input'
      lastStatus.current = msg.session.status
      if (left) reset()
      return
    }
    if (msg.sessionId !== sessionId) return
    if (msg.type === 'prompt_snapshot' || msg.type === 'prompt_event') {
      promptContractSeen.current = true
      const prompts = msg.type === 'prompt_snapshot' ? msg.prompts : [msg.prompt]
      for (const prompt of prompts) applyPrompt(prompt)
      return
    }
    if (promptContractSeen.current) return
    if (msg.type === 'question') {
      if (dismissedKey.current === msg.toolUseId) return
      accept(msg.toolUseId, mapAskQuestionToBlock(msg.toolUseId, msg.questions))
    } else if (msg.type === 'question_cancelled') {
      dismissedKey.current = null
      if (cardRef.current?.prompt.toolUseId === msg.toolUseId) commit(null)
    } else if (msg.type === 'permission') {
      const key = gateKey(msg)
      if (dismissedKey.current === key) return
      accept(key, mapPermissionToBlock(msg.prompt, msg.options, msg.cursor, msg.detail, msg.contentKey, msg.gateId))
    } else if (msg.type === 'permission_cancelled') {
      dismissedKey.current = null
      if (cardRef.current?.prompt.source === 'permission') commit(null)
    }
  }, [accept, applyPrompt, commit, reset, sessionId])

  const clear = useCallback(() => {
    dismissedKey.current = cardRef.current?.key ?? null
    commit(null)
  }, [commit])

  return {
    question: card?.prompt ?? null,
    // Identity of the card on screen, for a caller to capture at tap time and
    // hand back to markPending. It lives on the card rather than beside it for
    // the same reason `phase` does: a key tracked in parallel can describe a
    // card that is no longer there.
    questionKey: card?.key ?? null,
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
  const { question, questionKey, phase, onMessage, clear, reset, resetAndUnsuppress, markPending, expireIfStale } =
    useActiveQuestionReducer(sessionId)

  useEffect(() => {
    if (!serverId || !sessionId) return
    let unsubs: (() => void)[] = []

    // The client is resolved on every bind, never once. On a cold start React
    // runs this child effect before _layout.tsx's wsManager.connect() has made
    // a client, so getClient() returns undefined and every listener below is a
    // no-op — and nothing in this effect's deps changes when the socket later
    // connects, so the mount stayed deaf for its whole life.
    //
    // That is not a cosmetic gap. `subscribe_session` makes the streamer
    // unicast any gate that opened before the client subscribed
    // (server-wiring's ws.replay_permission) — so the card was arriving
    // correctly and being dropped on the floor here. useTerminalStream carries
    // the same rebind for the same ordering.
    const bind = () => {
      unsubs.forEach((u) => u())
      unsubs = []
      const client = wsManager.getClient(serverId)
      if (!client) return
      unsubs.push(
        client.on('question', (msg) => {
          if (msg.type === 'question') onMessage(msg)
        }),
        client.on('question_cancelled', (msg) => {
          if (msg.type === 'question_cancelled') onMessage(msg)
        }),
        client.on('permission', (msg) => {
          if (msg.type === 'permission') onMessage(msg)
        }),
        client.on('permission_cancelled', (msg) => {
          if (msg.type === 'permission_cancelled') onMessage(msg)
        }),
        client.on('prompt_event', (msg) => {
          if (msg.type === 'prompt_event') onMessage(msg)
        }),
        client.on('prompt_snapshot', (msg) => {
          if (msg.type === 'prompt_snapshot') onMessage(msg)
        }),
        client.on('session_update', (msg) => {
          if (msg.type === 'session_update') onMessage(msg)
        }),
      )
    }

    bind()
    // onAnyStatusChange, not onStatusChange: it also reaches clients created
    // after this call, which is the whole point when the client may not exist
    // yet. 'connected' covers both the first dial and the new instance that
    // disconnect()/retain() forces — connect() itself reuses the client.
    const unsubStatus = wsManager.onAnyStatusChange((id, status) => {
      if (id !== serverId) return
      if (status === 'connected') bind()
      if (status === 'disconnected') resetAndUnsuppress()
    })
    return () => {
      unsubs.forEach((u) => u())
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

  return { question, questionKey, phase, onMessage, clear, reset, markPending, expireIfStale }
}
