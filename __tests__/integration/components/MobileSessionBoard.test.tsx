import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { SessionBoard } from '@/components/sessions/board/SessionBoard'
import type { MergedItem } from '@/components/sessions/now/mergedItems'
import type { BoardColumnId } from '@/lib/boardColumns'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { createWrapper } from '@/test-utils'
import '@/test-utils/i18n-setup'
import type { Conversation, ConversationPage, MultiConversation, MultiSession, Prompt } from '@/types/api'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

const mockAnswer = jest.fn<Promise<void>, [Record<string, string | number | object>]>()
jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
    stopSession: { mutate: jest.fn(), isPending: false },
    stopWhenIdle: { mutateAsync: jest.fn(), isPending: false },
    sendInput: { mutate: jest.fn(), isPending: false },
    answerPrompt: { mutateAsync: (v: Record<string, string | number | object>) => mockAnswer(v), isPending: false },
  }),
}))

const mockGet = jest.fn<Promise<ConversationPage>, []>()
jest.mock('@/services/api-client', () => ({
  ...jest.requireActual('@/services/api-client'),
  createApiForServer: () => ({ get: () => mockGet() }),
}))

type MockPagerProps = { children: React.ReactNode; testID: string; onPageSelected: (e: { nativeEvent: { position: number } }) => void }
let mockWindowWidth = 390
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWindowWidth, height: 768, scale: 2, fontScale: 1 }),
}))

const mockSetPage = jest.fn()
const mockSnapPage = jest.fn()
const mockPager: { select?: (position: number) => void } = {}
jest.mock('react-native-pager-view', () => {
  const R = jest.requireActual<typeof import('react')>('react')
  const { View } = jest.requireActual<typeof import('react-native')>('react-native')
  return {
    __esModule: true,
    default: R.forwardRef(function MockPager({ children, testID, onPageSelected }: MockPagerProps, ref: React.Ref<{ setPage: (n: number) => void }>) {
      R.useImperativeHandle(ref, () => ({ setPage: mockSetPage, setPageWithoutAnimation: mockSnapPage }))
      mockPager.select = (position) => onPageSelected({ nativeEvent: { position } })
      return R.createElement(View, { testID }, children)
    }),
  }
})

const NOW = Date.now()
beforeAll(() => jest.spyOn(Date, 'now').mockReturnValue(NOW))
afterAll(() => jest.restoreAllMocks())

const session = (overrides: Partial<MultiSession>): MultiSession => ({
  id: 'sid',
  serverId: 'server-1',
  status: 'idle',
  ptyAttached: false,
  subStatus: null,
  projectPath: '/home/user/tb-mobile',
  projectName: 'tb-mobile',
  branch: 'main',
  lastOutput: '',
  elapsedMs: 1000,
  promptCount: 1,
  startedAt: new Date(NOW - 60_000).toISOString(),
  ...overrides,
})

const conversation = (overrides: Partial<MultiConversation>): MultiConversation => ({
  id: 'cid',
  serverId: 'server-1',
  title: 'tb-mobile',
  projectPath: '/home/user/tb-mobile',
  messageCount: 5,
  lastActivity: new Date(NOW - 120_000).toISOString(),
  ...overrides,
})

const sub = (id: string, parent: string, active: boolean): Conversation => ({
  id,
  title: `title-${id}`,
  projectPath: '/p',
  messageCount: 2,
  lastActivity: new Date(NOW - 30_000).toISOString(),
  isSubagent: true,
  parentConversationId: parent,
  subagentDescription: `Sub ${id}`,
  subagentActive: active,
})

const question = (id: string, text: string) => ({
  questionId: id,
  text,
  inputMode: 'single' as const,
  options: [{ optionId: 'yes', label: 'Yes' }, { optionId: 'no', label: 'No', description: 'Stop here' }],
  allowOther: false,
  secret: false,
})

const prompt = (overrides: Partial<Prompt> = {}): Prompt => ({
  promptId: 'p1',
  revision: 3,
  state: 'open',
  questions: [question('q1', 'Run the migration?')],
  ...overrides,
} as Prompt)

const waiting = (overrides: Partial<MultiSession> = {}) =>
  session({ id: 'w', status: 'waiting_input', ptyAttached: true, lifecycle: 'attached', sessionName: 'Fix the hub', hasOpenPrompt: true, pendingPrompts: [prompt()], ...overrides })

const running = session({ id: 'r', status: 'running', ptyAttached: true, lifecycle: 'attached', sessionName: 'Scan the worktrees' })
const history = conversation({ id: 'h', title: 'Old chat' })
const items: MergedItem[] = [
  { kind: 'session', ms: NOW - 1000, item: running },
  { kind: 'conversation', ms: NOW - 120_000, item: history },
]
const row = (item: MultiSession): MergedItem => ({ kind: 'session', ms: NOW - 1000, item })

const board = (list: MergedItem[], onPromptsChanged: () => void = jest.fn(), searchQuery = '', conversationsFromServer = false) => (
  <SessionBoard items={list} searchQuery={searchQuery} conversationsFromServer={conversationsFromServer} order="state" direction="desc" refreshing={false} onRefresh={jest.fn()} onPromptsChanged={onPromptsChanged} />
)
const renderBoard = (list: MergedItem[] = items, onPromptsChanged?: () => void, searchQuery?: string, conversationsFromServer?: boolean) =>
  render(board(list, onPromptsChanged, searchQuery, conversationsFromServer), { wrapper: createWrapper() })

type Rendered = Awaited<ReturnType<typeof renderBoard>>
const selected = (r: Rendered, id: BoardColumnId) => r.getByTestId(`board-column-${id}`).props.accessibilityState.selected
// The board holds every column until its sub-agent query lands, then drops the empty ones.
type Node = { props: { entering?: object }; children: (Node | string)[] | null }
const countAnimated = (node: Node | string | null): number =>
  node == null || typeof node === 'string' ? 0 : (node.props.entering ? 1 : 0) + (node.children ?? []).reduce((n, c) => n + countAnimated(c), 0)
const animated = (r: Rendered) => {
  const tree = r.toJSON() as Node | Node[] | null
  return Array.isArray(tree) ? tree.reduce((n, c) => n + countAnimated(c), 0) : countAnimated(tree)
}
// Animations start a frame after the board settles, so a test that moves cards waits for both.
const settle = async (r: Rendered, hidden: BoardColumnId) => {
  await waitFor(() => expect(r.queryByTestId(`board-column-${hidden}`)).toBeNull())
  await waitFor(() => expect(animated(r)).toBeGreaterThan(0))
}

beforeEach(() => {
  useServersStore.setState({ activeServerIds: ['server-1'] })
  useSettingsStore.setState({ boardColumn: null })
  mockGet.mockReset()
  mockGet.mockResolvedValue({ conversations: [], hasMore: false, offset: 0, total: 0 })
  mockSetPage.mockClear()
  mockSnapPage.mockClear()
  mockPush.mockClear()
  mockAnswer.mockReset()
  mockAnswer.mockResolvedValue()
})

describe('SessionBoard columns', () => {
  it('starts on the first column with sessions, counts each column in cards, and hides the empty ones', async () => {
    const r = await renderBoard()
    await settle(r, 'external')
    expect(selected(r, 'working')).toBe(true)
    expect(r.getByTestId('board-column-working')).toHaveTextContent('Working1')
    expect(r.getByTestId('board-column-earlier')).toHaveTextContent('Earlier1')
    expect(r.queryByTestId('board-column-needsYou')).toBeNull()
  })

  it('starts on Needs you when something waits, whatever was remembered', async () => {
    useSettingsStore.setState({ boardColumn: 'earlier' })
    const r = await renderBoard([...items, row(waiting())])
    expect(selected(r, 'needsYou')).toBe(true)
  })

  it('starts on the remembered column when nothing waits, and leaves it once it turns out empty', async () => {
    useSettingsStore.setState({ boardColumn: 'external' })
    const r = await renderBoard()
    expect(selected(r, 'external')).toBe(true)
    await settle(r, 'external')
    expect(selected(r, 'working')).toBe(true)
    expect(r.getByTestId('board-pager')).toBeTruthy()
  })

  it('turns the pager from a chip, and a swipe moves the selected chip and is remembered', async () => {
    const r = await renderBoard()
    await settle(r, 'external')
    await fireEvent.press(r.getByTestId('board-column-earlier'))
    expect(mockSetPage).toHaveBeenCalledWith(1)
    expect(useSettingsStore.getState().boardColumn).toBe('earlier')
    await act(async () => mockPager.select?.(0))
    expect(selected(r, 'working')).toBe(true)
    expect(useSettingsStore.getState().boardColumn).toBe('working')
    expect(mockSetPage).toHaveBeenCalledTimes(1)
  })

  it('keeps Earlier, with its hint, when the board is empty', async () => {
    const r = await renderBoard([])
    await settle(r, 'working')
    expect(r.getByTestId('board-column-earlier')).toHaveTextContent('Earlier0')
    expect(r.getByText('Finished sessions show in this column.')).toBeTruthy()
  })

  it('paints the first load in place, with nothing animated', async () => {
    const r = await renderBoard()
    expect(animated(r)).toBe(0)
    await settle(r, 'external')
    expect(mockSetPage).not.toHaveBeenCalled()
    expect(mockSnapPage).toHaveBeenCalledWith(0)
  })

  it('shows a column when a card lands in it, without moving the user off the one on screen', async () => {
    const r = await renderBoard()
    await settle(r, 'external')
    await r.rerender(board([...items, row(waiting())]))
    expect(r.getByTestId('board-column-needsYou')).toHaveTextContent('Needs you1')
    expect(selected(r, 'working')).toBe(true)
    await fireEvent.press(r.getByTestId('board-column-earlier'))
    expect(mockSetPage).toHaveBeenLastCalledWith(2)
    const terminal = session({ id: 'e', status: 'running', ownership: 'external', processLiveness: 'alive' })
    await r.rerender(board([...items, row(waiting()), row(terminal)]))
    expect(r.getByTestId('board-column-external')).toHaveTextContent('External1')
    expect(selected(r, 'earlier')).toBe(true)
    // A page appeared before the one on screen, so the pager snaps to keep it, and slides only when the user asked.
    expect(mockSnapPage).toHaveBeenLastCalledWith(3)
    expect(mockSetPage).toHaveBeenCalledTimes(1)
  })

  it('hides a column the move emptied and slides to where its card went', async () => {
    const r = await renderBoard([row(running), items[1]])
    await settle(r, 'external')
    expect(selected(r, 'working')).toBe(true)
    await r.rerender(board([row({ ...running, status: 'waiting_input', hasOpenPrompt: true, pendingPrompts: [prompt()] }), items[1]]))
    expect(selected(r, 'needsYou')).toBe(true)
    // Needs you landed before the page on screen: snap to keep Working in view, then slide on the next frame.
    expect(mockSnapPage).toHaveBeenLastCalledWith(1)
    await waitFor(() => expect(mockSetPage).toHaveBeenLastCalledWith(0))
    await waitFor(() => expect(r.queryByTestId('board-column-working')).toBeNull())
    expect(r.getByTestId('board-column-needsYou')).toHaveTextContent('Needs you1')
  })

  it('refetches when the set of open prompts changes, not on first paint', async () => {
    const changed = jest.fn()
    const r = await renderBoard([row(running)], changed)
    expect(changed).not.toHaveBeenCalled()
    await r.rerender(board([row({ ...running, hasOpenPrompt: true })], changed))
    expect(changed).toHaveBeenCalledTimes(1)
  })
})

describe('SessionBoard cards', () => {
  it('opens the session from the whole card when it has no sub-agents', async () => {
    const r = await renderBoard()
    expect(r.queryByTestId('board-toggle-h')).toBeNull()
    await fireEvent.press(r.getByTestId('board-open-h'))
    expect(mockPush).toHaveBeenCalledTimes(1)
  })

  it('folds sub-agents behind a counter, closed at first, with only sub-agents counted', async () => {
    mockGet.mockResolvedValue({ conversations: [sub('a1', 'w', true), sub('a2', 'w', false)], hasMore: false, offset: 0, total: 2 })
    const r = await renderBoard([row(waiting())])
    await waitFor(() => expect(r.getByTestId('board-toggle-w')).toHaveTextContent('2'))
    expect(r.queryByTestId('conversation-row-a1')).toBeNull()
    expect(r.queryByText('Sub-agents of other sessions')).toBeNull()
    expect(r.getByTestId('board-column-needsYou')).toHaveTextContent('Needs you1')
    await fireEvent.press(r.getByTestId('board-toggle-w'))
    expect(r.getByTestId('conversation-row-a1')).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('files orphan sub-agents under their heading in the column of their state', async () => {
    mockGet.mockResolvedValue({ conversations: [sub('x', 'elsewhere', true), sub('y', 'gone', false)], hasMore: false, offset: 0, total: 2 })
    const r = await renderBoard([row(running)])
    await waitFor(() => expect(r.getByTestId('board-column-working')).toHaveTextContent('Working2'))
    expect(r.getByTestId('board-column-earlier')).toHaveTextContent('Earlier1')
    expect(r.getAllByText('Sub-agents of other sessions')).toHaveLength(2)
  })

  const terminal = session({ id: 'e', status: 'running', ownership: 'external', processLiveness: 'alive', sessionName: 'From the terminal' })

  it('moves an external session to Working while one of its sub-agents runs', async () => {
    mockGet.mockResolvedValue({ conversations: [sub('a1', 'e', true), sub('a2', 'e', false)], hasMore: false, offset: 0, total: 2 })
    const r = await renderBoard([row(terminal)])
    await waitFor(() => expect(r.getByTestId('board-column-working')).toHaveTextContent('Working1'))
    await settle(r, 'external')
    expect(r.queryByText('Sub-agents of other sessions')).toBeNull()
  })

  it('keeps an external session in External when none of its sub-agents runs', async () => {
    mockGet.mockResolvedValue({ conversations: [sub('a1', 'e', false)], hasMore: false, offset: 0, total: 1 })
    const r = await renderBoard([row(terminal)])
    await waitFor(() => expect(r.getByTestId('board-toggle-e')).toHaveTextContent('1'))
    expect(r.getByTestId('board-column-external')).toHaveTextContent('External1')
    await settle(r, 'working')
  })

  it('keeps a waiting session in Needs you while its sub-agents run', async () => {
    mockGet.mockResolvedValue({ conversations: [sub('a1', 'w', true)], hasMore: false, offset: 0, total: 1 })
    const r = await renderBoard([row(waiting())])
    await waitFor(() => expect(r.getByTestId('board-toggle-w')).toHaveTextContent('1'))
    expect(r.getByTestId('board-column-needsYou')).toHaveTextContent('Needs you1')
    await settle(r, 'working')
  })

  it('searches orphan sub-agents by their label', async () => {
    mockGet.mockResolvedValue({ conversations: [sub('x', 'elsewhere', true), sub('y', 'gone', true)], hasMore: false, offset: 0, total: 2 })
    const r = await renderBoard([], undefined, 'sub y')
    await waitFor(() => expect(r.getByTestId('board-column-working')).toHaveTextContent('Working1'))
    expect(r.getAllByText('Sub-agents of other sessions')).toHaveLength(1)
  })

  it('gives every sub-agent its own card, sorted by its own state, when only sub-agents show', async () => {
    mockGet.mockResolvedValue({ conversations: [{ ...sub('a1', 'p', true), preview: 'Audit lockfile drift' }, sub('a2', 'p', true), sub('a3', 'p', false)], hasMore: false, offset: 0, total: 3 })
    const r = await render(
      <SessionBoard items={[row(running)]} searchQuery="" conversationsFromServer={false} order="state" direction="desc" refreshing={false} onRefresh={jest.fn()} onPromptsChanged={jest.fn()} subagentsOnly />,
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(r.getByTestId('board-column-working')).toHaveTextContent('Working2'))
    expect(r.getByTestId('board-column-earlier')).toHaveTextContent('Earlier1')
    expect(r.queryByText('Scan the worktrees')).toBeNull()
    // One sub-agent per card: no count badge or expandable body, the card carries the row's extras.
    expect(r.queryByTestId('conversation-row-a1')).toBeNull()
    expect(r.getByTestId('subagent-board-active-a1')).toBeTruthy()
    expect(r.queryByTestId('subagent-board-active-a3')).toBeNull()
    expect(r.getAllByText(/2 messages/)).toHaveLength(3)
    expect(r.getByText('Audit lockfile drift')).toBeTruthy()
    expect(r.getAllByText('Session p')).toHaveLength(3)
    expect(r.queryByText('Open parent session')).toBeNull()
    expect(mockPush).not.toHaveBeenCalled()
    await fireEvent.press(r.getByTestId('subagent-group-toggle-orphan:p:a1'))
    expect(mockPush).toHaveBeenLastCalledWith('/conversation/a1?server=server-1')
    await fireEvent(r.getByTestId('subagent-group-toggle-orphan:p:a1'), 'longPress')
    expect(mockPush).toHaveBeenCalledTimes(2)
  })

  it('moves off an empty remembered column when only finished sub-agents show', async () => {
    useSettingsStore.setState({ boardColumn: 'working' })
    mockGet.mockResolvedValue({ conversations: [sub('a1', 'p', false)], hasMore: false, offset: 0, total: 1 })
    const r = await render(
      <SessionBoard items={[row(running)]} searchQuery="" conversationsFromServer={false} order="state" direction="desc" refreshing={false} onRefresh={jest.fn()} onPromptsChanged={jest.fn()} subagentsOnly />,
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(r.getByTestId('board-column-earlier')).toHaveTextContent('Earlier1'))
    expect(selected(r, 'earlier')).toBe(true)
  })

  it('shows one line when sub-agents fail to load and keeps the rest of the board', async () => {
    mockGet.mockRejectedValue(new Error('down'))
    const r = await renderBoard()
    await waitFor(() => expect(r.getAllByText("Couldn't load sub-agents.")).toHaveLength(2))
    expect(r.getByText('Scan the worktrees')).toBeTruthy()
  })
})

describe('SessionBoard search', () => {
  const bodyOnly = conversation({ id: 'body', title: 'Quarterly planning', preview: 'agenda and budget' })
  const bodyRows: MergedItem[] = [{ kind: 'conversation', ms: NOW - 120_000, item: bodyOnly }]

  it('shows a conversation that matches only on its message body when the rows came from the server', async () => {
    const r = await renderBoard(bodyRows, undefined, 'wombat', true)
    expect(r.getByTestId('board-column-earlier')).toHaveTextContent('Earlier1')
    expect(r.getByTestId('board-open-body')).toBeTruthy()
  })

  it('hides that same conversation when the rows came from the paged history', async () => {
    const r = await renderBoard(bodyRows, undefined, 'wombat', false)
    expect(r.getByTestId('board-column-earlier')).toHaveTextContent('Earlier0')
    expect(r.queryByTestId('board-open-body')).toBeNull()
  })

  it('still matches a paged conversation on its title', async () => {
    const r = await renderBoard(bodyRows, undefined, 'planning', false)
    expect(r.getByTestId('board-open-body')).toBeTruthy()
  })
})

describe('SessionBoard questions', () => {
  it('puts the question in place of the activity line', async () => {
    const r = await renderBoard([row(waiting())])
    expect(r.getByText('Run the migration?')).toBeTruthy()
    expect(r.queryByTestId('session-question-modal')).toBeNull()
  })

  it('sends on tap for a single question, with the revision the row carried', async () => {
    const changed = jest.fn()
    const r = await renderBoard([row(waiting())], changed)
    await fireEvent.press(r.getByTestId('question-bar-w'))
    await fireEvent.press(r.getByTestId('session-option-q1-no'))
    await waitFor(() => expect(mockAnswer).toHaveBeenCalledTimes(1))
    expect(mockAnswer.mock.calls[0][0]).toMatchObject({ promptId: 'p1', revision: 3, responses: [{ questionId: 'q1', optionIds: ['no'] }] })
    await waitFor(() => expect(r.queryByTestId('session-question-modal')).toBeNull())
    expect(changed).toHaveBeenCalled()
  })

  it('closes without answering, and the session stays in Needs you', async () => {
    const r = await renderBoard([row(waiting())])
    await fireEvent.press(r.getByTestId('question-bar-w'))
    await fireEvent.press(r.getByTestId('session-question-close'))
    expect(r.queryByTestId('session-question-modal')).toBeNull()
    expect(mockAnswer).not.toHaveBeenCalled()
    expect(r.getByTestId('board-column-needsYou')).toHaveTextContent('Needs you1')
  })

  it('holds a two-question prompt until both have a reply, then sends them in one post', async () => {
    const two = prompt({ questions: [question('q1', 'First?'), question('q2', 'Second?')] })
    const r = await renderBoard([row(waiting({ pendingPrompts: [two] }))])
    await fireEvent.press(r.getByTestId('question-bar-w'))
    expect(r.getByText('Question 1 of 2')).toBeTruthy()
    expect(r.getByText('Question 2 of 2')).toBeTruthy()
    await fireEvent.press(r.getByTestId('session-option-q1-yes'))
    expect(mockAnswer).not.toHaveBeenCalled()
    await fireEvent.press(r.getByTestId('session-option-q2-no'))
    await waitFor(() => expect(mockAnswer).toHaveBeenCalledTimes(1))
    expect(mockAnswer.mock.calls[0][0]).toMatchObject({
      responses: [{ questionId: 'q1', optionIds: ['yes'] }, { questionId: 'q2', optionIds: ['no'] }],
    })
  })

  it('shows a question it cannot answer without reply buttons', async () => {
    const secret = prompt({ questions: [{ ...question('q1', 'Password?'), secret: true }] })
    const r = await renderBoard([row(waiting({ pendingPrompts: [secret] }))])
    await fireEvent.press(r.getByTestId('question-bar-w'))
    expect(r.queryByTestId('session-option-q1-yes')).toBeNull()
    expect(r.getByTestId('session-question-unsupported')).toBeTruthy()
  })

  it('keeps the modal open and says so when the send fails', async () => {
    mockAnswer.mockRejectedValue(new Error('offline'))
    const r = await renderBoard([row(waiting())])
    await fireEvent.press(r.getByTestId('question-bar-w'))
    await fireEvent.press(r.getByTestId('session-option-q1-yes'))
    await waitFor(() => expect(r.getByTestId('session-question-notice')).toHaveTextContent("Couldn't send your answer. Check your connection and try again."))
    expect(r.getByTestId('session-question-modal')).toBeTruthy()
  })

  it('falls back to the terminal tail, without an eye, while a prompt is open but its text has not arrived', async () => {
    const r = await renderBoard([row(waiting({ hasOpenPrompt: true, pendingPrompts: undefined, lastOutput: 'Allow edit?\n' }))])
    expect(r.queryByTestId('question-bar-w')).toBeNull()
    expect(r.getByText('Allow edit?')).toBeTruthy()
    await fireEvent.press(r.getByTestId('tail-bar-w'))
    expect(r.queryByTestId('session-question-modal')).toBeNull()
  })
  it('renders no line, and no tap target, when the streamer says no question is open', async () => {
    const r = await renderBoard([row(waiting({ hasOpenPrompt: false, pendingPrompts: undefined, lastOutput: '\x1b[?25l\rnew task? /clear to save 165.2k tokens ·\x1b[?25h' }))])
    expect(r.queryByTestId('tail-bar-w')).toBeNull()
    expect(r.queryByTestId('question-bar-w')).toBeNull()
    expect(r.queryByText(/clear to save/)).toBeNull()
  })

  it('renders no line for the last assistant reply of a finished turn', async () => {
    const r = await renderBoard([row(waiting({ hasOpenPrompt: false, pendingPrompts: undefined, lastMessageText: 'Pushed the fix.', lastMessageRole: 'assistant' }))])
    expect(r.queryByText('Pushed the fix.')).toBeNull()
    expect(r.queryByTestId('tail-bar-w')).toBeNull()
    expect(r.queryByTestId('question-bar-w')).toBeNull()
  })
})

describe('SessionBoard from 768 up', () => {
  beforeEach(() => {
    mockWindowWidth = 1024
  })
  afterEach(() => {
    mockWindowWidth = 390
  })

  it('lays columns out side by side, hides an empty one, and shows it when a session lands', async () => {
    const r = await renderBoard()
    expect(r.queryByTestId('board-pager')).toBeNull()
    expect(r.getByTestId('board-pane-working')).toBeTruthy()
    await waitFor(() => expect(r.queryByTestId('board-pane-needsYou')).toBeNull())
    await r.rerender(board([...items, row(waiting())]))
    expect(r.getByTestId('board-pane-needsYou')).toBeTruthy()
    expect(selected(r, 'working')).toBe(true)
  })

  it('keeps the start column when a Needs you card lands before the settled board paints', async () => {
    const raf = jest.spyOn(global, 'requestAnimationFrame').mockImplementation(() => 0)
    try {
      const r = await renderBoard()
      await waitFor(() => expect(r.queryByTestId('board-pane-needsYou')).toBeNull())
      await r.rerender(board([...items, row(waiting())]))
      expect(selected(r, 'working')).toBe(true)
    } finally {
      raf.mockRestore()
    }
  })

  it('hides the arrows when every column fits and moves one column at a time when not', async () => {
    const r = await renderBoard()
    await settle(r, 'external')
    expect(r.queryByTestId('board-arrow-next')).toBeNull()
    const track = r.getByTestId('board-track')
    await act(async () => {
      fireEvent(track, 'layout', { nativeEvent: { layout: { width: 500 } } })
      fireEvent(track, 'contentSizeChange', 1200, 600)
    })
    await fireEvent.press(r.getByTestId('board-arrow-next'))
    expect(selected(r, 'earlier')).toBe(true)
    await fireEvent.press(r.getByTestId('board-arrow-previous'))
    expect(selected(r, 'working')).toBe(true)
  })
})

it('shows the searching animation while a search with no hits is still in flight', async () => {
  const r = await render(
    <SessionBoard items={[]} searchQuery="wombat" searchPending conversationsFromServer={false} order="state" direction="desc" refreshing={false} onRefresh={jest.fn()} onPromptsChanged={jest.fn()} />,
    { wrapper: createWrapper() },
  )
  expect(r.getByTestId('searching-animation')).toBeTruthy()
})
