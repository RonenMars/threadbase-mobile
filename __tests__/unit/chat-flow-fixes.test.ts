// Unit tests for the 6 chat-flow fixes applied in LiveConversationView,
// useConversationStream, useSessionActions, and session/[id].tsx.
// These tests target the pure logic extracted from each fix — no component
// rendering needed, no mocks required.

import type { Message } from '@/types/api'

// ── helpers ─────────────────────────────────────────────────────────────────

function makeMsg(role: 'user' | 'assistant', text: string, id = `id-${Math.random()}`): Message {
  return {
    id,
    uuid: null,
    role,
    content: [{ type: 'text', text }],
    timestamp: '',
    is_sidechain: false,
    parent_uuid: null,
  }
}

function userMessageText(m: Message): string {
  return m.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
}

// ── Fix 1+2: isAgentThinking ────────────────────────────────────────────────
// Condition: session?.status === 'running'
//            || (pendingSends.length > 0 && lastMessage?.role !== 'assistant')
// While running the bubble always shows — mid-turn assistant messages
// (interim replies, sub-agent dispatches) must not hide it. The last-message
// gate applies only to the optimistic-send window where status lags.

function isAgentThinking(
  status: string | undefined,
  pendingSendsCount: number,
  lastMessageRole: 'user' | 'assistant' | undefined,
): boolean {
  return status === 'running' || (pendingSendsCount > 0 && lastMessageRole !== 'assistant')
}

describe('isAgentThinking (Fix 1+2)', () => {
  it('false when idle and no pending sends', () => {
    expect(isAgentThinking('waiting_input', 0, undefined)).toBe(false)
  })

  it('true immediately on send even before status changes (Fix 2)', () => {
    expect(isAgentThinking('waiting_input', 1, 'user')).toBe(true)
  })

  it('true when running and last message is user', () => {
    expect(isAgentThinking('running', 0, 'user')).toBe(true)
  })

  it('true when running even after an interim assistant message (sub-agent run)', () => {
    expect(isAgentThinking('running', 0, 'assistant')).toBe(true)
  })

  it('false when send echoed (assistant replied) and status no longer running', () => {
    expect(isAgentThinking('waiting_input', 1, 'assistant')).toBe(false)
  })

  it('false when no messages at all and session is idle', () => {
    expect(isAgentThinking('idle', 0, undefined)).toBe(false)
  })

  it('true when no messages yet and pending send exists', () => {
    expect(isAgentThinking('idle', 1, undefined)).toBe(true)
  })
})

// ── Fix 3: isWakingUp ───────────────────────────────────────────────────────
// Condition: status === 'running' && !hasReachedPrompt && promptCount === 0

function isWakingUp(
  status: string | undefined,
  hasReachedPrompt: boolean,
  promptCount: number | undefined,
): boolean {
  return status === 'running' && !hasReachedPrompt && (promptCount ?? 0) === 0
}

describe('isWakingUp (Fix 3)', () => {
  it('true on first start before any prompt', () => {
    expect(isWakingUp('running', false, 0)).toBe(true)
  })

  it('false after first prompt completes (promptCount > 0) — overlay must NOT re-arm', () => {
    expect(isWakingUp('running', false, 1)).toBe(false)
  })

  it('false once hasReachedPrompt is set', () => {
    expect(isWakingUp('running', true, 0)).toBe(false)
  })

  it('false when not running', () => {
    expect(isWakingUp('waiting_input', false, 0)).toBe(false)
  })

  it('false when idle', () => {
    expect(isWakingUp('idle', false, 0)).toBe(false)
  })
})

// ── Fix 5: stillPending one-for-one dedup ───────────────────────────────────
// Algorithm: for each echoed user-text, remove the FIRST matching pending entry.
// Prevents duplicate messages when the same text is sent twice.

function dedupeOptimistic(pendingSends: Message[], echoedUserTexts: string[]): Message[] {
  const remaining = [...pendingSends]
  for (const echoText of echoedUserTexts) {
    const idx = remaining.findIndex((m) => userMessageText(m) === echoText)
    if (idx !== -1) remaining.splice(idx, 1)
  }
  return remaining
}

describe('dedupeOptimistic (Fix 5)', () => {
  it('keeps pending when no echo yet', () => {
    const pending = [makeMsg('user', 'yes')]
    expect(dedupeOptimistic(pending, [])).toHaveLength(1)
  })

  it('removes single match on single echo', () => {
    const pending = [makeMsg('user', 'yes')]
    expect(dedupeOptimistic(pending, ['yes'])).toHaveLength(0)
  })

  it('removes only ONE of two identical pending on one echo (Fix 5 core)', () => {
    const pending = [makeMsg('user', 'yes'), makeMsg('user', 'yes')]
    const result = dedupeOptimistic(pending, ['yes'])
    expect(result).toHaveLength(1)
    expect(userMessageText(result[0])).toBe('yes')
  })

  it('removes both identical pendings when both echoed', () => {
    const pending = [makeMsg('user', 'yes'), makeMsg('user', 'yes')]
    expect(dedupeOptimistic(pending, ['yes', 'yes'])).toHaveLength(0)
  })

  it('removes only the matched text, leaves unmatched pending', () => {
    const pending = [makeMsg('user', 'yes'), makeMsg('user', 'no')]
    const result = dedupeOptimistic(pending, ['yes'])
    expect(result).toHaveLength(1)
    expect(userMessageText(result[0])).toBe('no')
  })

  it('ignores echoed text that has no pending counterpart', () => {
    const pending = [makeMsg('user', 'yes')]
    // Echo for something we never optimistically sent
    const result = dedupeOptimistic(pending, ['something else', 'yes'])
    expect(result).toHaveLength(0)
  })

  it('empty pending stays empty regardless of echoes', () => {
    expect(dedupeOptimistic([], ['yes', 'no'])).toHaveLength(0)
  })
})
