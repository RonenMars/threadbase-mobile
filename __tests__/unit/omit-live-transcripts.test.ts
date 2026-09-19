/**
 * A live session and its JSONL transcript are two wire records of one fact.
 * The Now list concatenates /api/sessions and /api/conversations, so without
 * this filter the same work appears under Needs you and again under Earlier.
 */
import { omitConversationsCoveredByLiveSessions, type MergedItem } from '@/components/sessions/now/mergedItems'
import type { MultiConversation, MultiSession } from '@/types/api'

const conversation = (over: Partial<MultiConversation>): MergedItem => ({
  kind: 'conversation',
  ms: 0,
  item: {
    id: 'conv-1',
    title: 'Check do we have an endpoint to kill a session',
    projectPath: '/tmp/p',
    messageCount: 12,
    lastActivity: '2026-09-18T06:40:49.539Z',
    serverId: 'srv-1',
    ...over,
  },
})

const session = (over: Partial<MultiSession>): MergedItem => ({
  kind: 'session',
  ms: 0,
  item: {
    id: 'sess-1',
    status: 'waiting_input',
    ptyAttached: true,
    lifecycle: 'attached',
    subStatus: null,
    projectPath: '/tmp/p',
    projectName: 'tb-streamer',
    lastOutput: '',
    elapsedMs: 1000,
    promptCount: 2,
    startedAt: '2026-09-18T06:00:00Z',
    serverId: 'srv-1',
    ...over,
  },
})

describe('omitConversationsCoveredByLiveSessions', () => {
  it('drops the conversation that is the same id as a live waiting session', () => {
    const live = session({
      id: 'f67ed637-2e11-4591-ba72-3ad6331e85f0',
      conversationId: 'f67ed637-2e11-4591-ba72-3ad6331e85f0',
      sessionName: 'Check do we have an endpoint to kill a session',
    })
    const transcript = conversation({ id: 'f67ed637-2e11-4591-ba72-3ad6331e85f0' })
    const other = conversation({ id: 'other', title: 'git pull' })

    const out = omitConversationsCoveredByLiveSessions([live, transcript, other])
    expect(out.map((item) => item.item.id)).toEqual([live.item.id, other.item.id])
  })

  it('drops a Codex conversation keyed by boundConversationId, not the PTY id', () => {
    const live = session({
      id: 'pty-placeholder',
      conversationId: 'pty-placeholder',
      boundConversationId: 'rollout-uuid',
    })
    const transcript = conversation({ id: 'rollout-uuid', title: 'Hi' })

    const out = omitConversationsCoveredByLiveSessions([live, transcript])
    expect(out).toEqual([live])
  })

  it('keeps a conversation when the matching session is held, not live', () => {
    const held = session({
      id: 'held',
      conversationId: 'held',
      status: 'idle',
      ptyAttached: false,
      lifecycle: 'resumable',
    })
    const transcript = conversation({ id: 'held' })

    const out = omitConversationsCoveredByLiveSessions([held, transcript])
    expect(out).toEqual([held, transcript])
  })
})
