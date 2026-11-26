import React from 'react'
import { act, screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BoardSessionCard } from '@/components/sessions/board/BoardSessionCard'
import { SessionRow } from '@/components/sessions/hub/SessionRow'
import { EarlierRow } from '@/components/sessions/now/EarlierRow'
import { NeedsYouCard } from '@/components/sessions/now/NeedsYouCard'
import type { NowEntry } from '@/components/sessions/now/nowEntries'
import { WorkingCard } from '@/components/sessions/now/WorkingCard'
import { NowList } from '@/components/sessions/now/NowList'
import { CantResumeRow } from '@/components/sessions/now/CantResumeRow'
import { SessionDraftMark } from '@/components/sessions/shared/SessionDraftMark'
import { ProjectHubList } from '@/components/sessions/hub/ProjectHubList'
import { DrillRow } from '@/components/sessions/tree/DrillRow'
import { TreeSessionsList } from '@/components/sessions/tree/TreeSessionsList'
import { useDraftsStore } from '@/stores/drafts'
import { renderWithI18n } from '@/test-utils/render'
import type { MultiConversation, MultiSession } from '@/types/api'

jest.mock('@/services/secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
    stopSession: { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false },
    stopWhenIdle: { mutateAsync: jest.fn(), isPending: false },
  }),
}))

jest.mock('use-debounce', () => ({ useDebounce: <T,>(value: T): [T] => [value] }))

jest.mock('@/hooks/useConversations', () => ({
  useConversationSearch: () => ({ data: undefined }),
}))

jest.mock('@/hooks/useProjectConversations', () => ({
  useProjectConversations: () => ({ conversations: [], isLoading: false }),
}))

jest.mock('@/components/sessions/shared/SessionQuestionModal', () => ({ SessionQuestionModal: () => null }))

const session = (o: Partial<MultiSession> = {}): MultiSession => ({
  id: 'sid',
  serverId: 'server-1',
  status: 'idle',
  ptyAttached: false,
  lifecycle: 'attached',
  subStatus: null,
  projectPath: '/home/user/tb-mobile',
  projectName: 'tb-mobile',
  branch: 'main',
  lastOutput: '',
  elapsedMs: 1000,
  promptCount: 0,
  startedAt: new Date().toISOString(),
  ...o,
})

const conv = {
  id: 'cid',
  serverId: 'server-1',
  title: 'Old chat',
  projectPath: '/home/user/tb-mobile',
  messageCount: 2,
  lastActivity: new Date().toISOString(),
} as unknown as MultiConversation

const withQuery = (node: React.ReactElement) => (
  <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>
)

function boardEntry(s: MultiSession): NowEntry {
  return {
    item: { kind: 'session', ms: Date.now(), item: s },
    tier: null,
    title: { title: 'Fix login redirect', rung: 'intent' },
    statusLabel: null,
  } as NowEntry
}

function boardCard(entry: NowEntry) {
  return withQuery(
    <BoardSessionCard
      id={entry.item.item.id}
      entry={entry}
      group={undefined}
      isOpen={false}
      onToggle={() => {}}
      onShowQuestion={() => {}}
      serverIdFor={() => 'server-1'}
      searchQuery=""
    />,
  )
}

const draftOf = (s: MultiSession) => useDraftsStore.setState({ drafts: { [`${s.serverId}::${s.id}`]: 'half a thought' } })
// Decorative marks are hidden from the accessibility tree on purpose, so the query must look past that.
const mark = (id: string) => screen.queryByTestId(`session-draft-mark-${id}`, { includeHiddenElements: true })

beforeEach(() => {
  useDraftsStore.setState({ drafts: {} })
})

const surfaces: [string, (s: MultiSession) => React.ReactElement, Partial<MultiSession>][] = [
  ['NeedsYouCard', (s) => withQuery(<NeedsYouCard session={s} title="Fix login redirect" onPromptsChanged={jest.fn()} />), { status: 'waiting_input', ptyAttached: true }],
  ['WorkingCard', (s) => withQuery(<WorkingCard session={s} title="Fix login redirect" />), { status: 'running', ptyAttached: true }],
  ['EarlierRow', (s) => withQuery(<EarlierRow item={{ kind: 'session', ms: Date.now(), item: s }} title="Fix login redirect" />), {}],
  ['hub SessionRow', (s) => withQuery(<SessionRow session={s} />), {}],
  ['DrillRow', (s) => withQuery(<DrillRow item={{ key: `session:${s.serverId}::${s.id}`, label: 'Fix login redirect', timestamp: null, serverId: s.serverId, onPress: jest.fn(), session: s }} />), {}],
  ['BoardSessionCard', (s) => boardCard(boardEntry(s)), {}],
  ['NowList cannot-resume session', (s) => withQuery(<NowList items={[{ kind: 'session', ms: Date.now(), item: s }]} order="state" refreshing={false} onRefresh={() => {}} searchQuery="" conversationsFromServer={false} onPromptsChanged={() => {}} />), { lifecycle: 'failed', failureReason: 'spawn failed' }],
  ['CantResumeRow', (s) => <CantResumeRow title="Gone" mark={<SessionDraftMark serverId={s.serverId} sessionId={s.id} />} />, {}],
  ['ProjectHubList search', (s) => withQuery(<ProjectHubList sessions={[s]} summaries={[]} sortBy="lastActivity" sortOrder="desc" refreshing={false} onRefresh={() => {}} searchOpen searchQuery="tb-mobile" />), {}],
  ['TreeSessionsList search', (s) => withQuery(<TreeSessionsList sessions={[s]} summaries={[]} refreshing={false} onRefresh={() => {}} searchOpen searchQuery="tb-mobile" />), {}],
  ['TreeSessionsList live list', (s) => withQuery(<TreeSessionsList sessions={[s]} summaries={[]} refreshing={false} onRefresh={() => {}} searchOpen={false} searchQuery="" />), {}],
]

describe.each(surfaces)('draft mark on %s', (_name, build, overrides) => {
  it('shows the mark for a session with a draft', async () => {
    const s = session(overrides)
    draftOf(s)
    await renderWithI18n(build(s))
    expect(mark(s.id)).toBeTruthy()
  })

  it('shows no mark without a draft', async () => {
    const s = session(overrides)
    await renderWithI18n(build(s))
    expect(mark(s.id)).toBeNull()
  })

  it("ignores the same session id on another server", async () => {
    const s = session(overrides)
    useDraftsStore.setState({ drafts: { [`other-server::${s.id}`]: 'hello' } })
    await renderWithI18n(build(s))
    expect(mark(s.id)).toBeNull()
  })

  it('appears while mounted when a draft is saved', async () => {
    const s = session(overrides)
    await renderWithI18n(build(s))
    expect(mark(s.id)).toBeNull()
    await act(async () => draftOf(s))
    expect(mark(s.id)).toBeTruthy()
  })
})

describe('draft mark on conversation rows', () => {
  it('leaves a history conversation row unmarked', async () => {
    useDraftsStore.setState({ drafts: { 'server-1::cid': 'hello' } })
    await renderWithI18n(withQuery(<EarlierRow item={{ kind: 'conversation', ms: Date.now(), item: conv }} title="Old chat" />))
    expect(mark('cid')).toBeNull()
  })
})

describe('draft mark accessibility', () => {
  it('announces the draft once, on the card, not as a second focus stop', async () => {
    const s = session({ status: 'running', ptyAttached: true })
    draftOf(s)
    await renderWithI18n(withQuery(<WorkingCard session={s} title="Fix login redirect" />))
    expect(screen.getByTestId(`session-row-${s.id}`).props.accessibilityLabel).toBe('Fix login redirect, Working, Unsent draft')
    expect(mark(s.id)?.props.accessible).toBe(false)
  })

  it('announces the draft on the board card open button', async () => {
    const s = session()
    draftOf(s)
    await renderWithI18n(boardCard(boardEntry(s)))
    expect(screen.getByTestId(`board-open-${s.id}`).props.accessibilityLabel).toMatch(/Unsent draft$/)
  })
})
