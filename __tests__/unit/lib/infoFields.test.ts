import '@/test-utils/i18n-setup'
import {
  buildSharedInfoFields,
  conversationInfoSubject,
  sessionInfoSubject,
  type InfoSubject,
} from '@/lib/infoFields'
import type { ConversationDetail, Session } from '@/types/api'

const CLAUDE_UUID = '11111111-2222-3333-4444-555555555555'
const CODEX_UUID = '019a0000-aaaa-bbbb-cccc-dddddddddddd'
const CURSOR_RUN = '0c0c0c0c-1111-2222-3333-444444444444'

function rows(s: InfoSubject) {
  return Object.fromEntries(
    buildSharedInfoFields(s)
      .filter((f) => f.value != null && f.value !== '')
      .map((f) => [f.label, f.value]),
  )
}

describe('buildSharedInfoFields — provider', () => {
  it('renders Unknown, not Claude, when the provider is missing', () => {
    expect(rows({ conversationId: 'c' }).Provider).toBe('Unknown')
  })

  it('renders Unknown for a provider this build does not know', () => {
    expect(rows({ conversationId: 'c', provider: 'gemini' }).Provider).toBe('Unknown')
  })

  it.each([
    ['claude-code', 'Claude'],
    ['codex-cli', 'Codex'],
    ['cursor', 'Cursor'],
    ['cursor-cli', 'Cursor'],
  ])('labels %s as %s', (provider, label) => {
    expect(rows({ conversationId: 'c', provider }).Provider).toBe(label)
  })
})

describe('buildSharedInfoFields — ids', () => {
  it('collapses session, conversation and on-disk id for a Claude session', () => {
    const r = rows({
      sessionId: CLAUDE_UUID,
      conversationId: CLAUDE_UUID,
      provider: 'claude-code',
      filePath: `/home/u/.claude/projects/p/${CLAUDE_UUID}.jsonl`,
    })
    expect(r['Threadbase Session ID / Conversation ID / Provider ID']).toBe(CLAUDE_UUID)
    expect(r['Conversation ID']).toBeUndefined()
  })

  it('keeps the Codex rollout uuid apart from the placeholder session id', () => {
    const r = rows({
      sessionId: 'pty-placeholder',
      conversationId: 'pty-placeholder',
      provider: 'codex-cli',
      boundConversationId: CODEX_UUID,
      filePath: `/home/u/.codex/sessions/2026/09/19/rollout-2026-09-19T10-00-00-${CODEX_UUID}.jsonl`,
    })
    expect(r['Threadbase Session ID / Conversation ID']).toBe('pty-placeholder')
    expect(r['Provider ID']).toBe(CODEX_UUID)
  })

  it('hides the Codex provider id until the rollout is bound', () => {
    const r = rows({ sessionId: 'pty-x', conversationId: 'pty-x', provider: 'codex-cli' })
    expect(r['Provider ID']).toBeUndefined()
    expect(r['Threadbase Session ID / Conversation ID']).toBe('pty-x')
  })

  it('reads the Cursor run id from the agent-transcripts path', () => {
    const r = rows({
      conversationId: CURSOR_RUN,
      provider: 'cursor',
      filePath: `/home/u/.cursor/projects/p/agent-transcripts/${CURSOR_RUN}/${CURSOR_RUN}.jsonl`,
    })
    expect(r['Conversation ID / Provider ID']).toBe(CURSOR_RUN)
  })

  it('always shows the conversation id, even alone', () => {
    expect(rows({ conversationId: 'only' })['Conversation ID']).toBe('only')
  })

  it('shows lineage ids only when present', () => {
    const bare = rows({ conversationId: 'c' })
    expect(bare['Resumed From']).toBeUndefined()
    expect(bare['Forked From']).toBeUndefined()
    expect(bare['Parent Conversation']).toBeUndefined()

    const r = rows({
      conversationId: 'c',
      resumedFromConversationId: 'r1',
      forkedFromConversationId: 'f1',
      parentConversationId: 'p1',
    })
    expect(r['Resumed From']).toBe('r1')
    expect(r['Forked From']).toBe('f1')
    expect(r['Parent Conversation']).toBe('p1')
  })
})

describe('subjects', () => {
  it('maps a session onto the shared names', () => {
    const s = sessionInfoSubject({
      id: 's1',
      conversationId: 'c1',
      provider: 'codex-cli',
      boundConversationId: CODEX_UUID,
      lastActivityAt: '2026-09-19T10:00:00Z',
      messageCount: 4,
      projectName: 'p',
      projectPath: '/p',
    } as Session)
    expect(s).toMatchObject({
      sessionId: 's1',
      conversationId: 'c1',
      boundConversationId: CODEX_UUID,
      lastActivity: '2026-09-19T10:00:00Z',
      messageCount: 4,
    })
  })

  it('takes a conversation fork source from the inherited-history seam', () => {
    const c = conversationInfoSubject({
      id: 'c1',
      messageCount: 2,
      inheritedHistory: { kind: 'divider', beforeMessageIndex: 3, sourceId: 'src' },
    } as ConversationDetail)
    expect(c.forkedFromConversationId).toBe('src')
    expect(c.sessionId).toBeUndefined()
  })
})
