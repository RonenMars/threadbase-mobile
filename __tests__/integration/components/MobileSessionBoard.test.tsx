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
const mockPager: { select?: (position: number) => void } = {}
jest.mock('react-native-pager-view', () => {
  const R = jest.requireActual<typeof import('react')>('react')
  const { View } = jest.requireActual<typeof import('react-native')>('react-native')
  return {
    __esModule: true,
    default: R.forwardRef(function MockPager({ children, testID, onPageSelected }: MockPagerProps, ref: React.Ref<{ setPage: (n: number) => void }>) {
      R.useImperativeHandle(ref, () => ({ setPage: mockSetPage, setPageWithoutAnimation: mockSetPage }))
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

const board = (list: MergedItem[], onPromptsChanged: () => void = jest.fn(), searchQuery = '') => (
  <SessionBoard items={list} searchQuery={searchQuery} conversationsFromServer={false} order="state" direction="desc" refreshing={false} onRefresh={jest.fn()} onPromptsChanged={onPromptsChanged} />
)
const renderBoard = (list: MergedItem[] = items, onPromptsChanged?: () => void, searchQuery?: string) => render(board(list, onPromptsChanged, searchQuery), { wrapper: createWrapper() })

const selected = (r: Awaited<ReturnType<typeof renderBoard>>, id: BoardColumnId) => r.getByTestId(`board-column-${id}`).props.accessibilityState.selected

beforeEach(() => {
  useServersStore.setState({ activeServerIds: ['server-1'] })
  useSettingsStore.setState({ boardColumn: null })
  mockGet.mockReset()
  mockGet.mockResolvedValue({ conversations: [], hasMore: false, offset: 0, total: 0 })
  mockSetPage.mockClear()
  mockPush.mockClear()
  mockAnswer.mockReset()
  mockAnswer.mockResolvedValue()
})

describe('SessionBoard columns', () => {
  it('starts on the first column with sessions and counts each column in cards', async () => {
    const r = await renderBoard()
    expect(selected(r, 'working')).toBe(true)
    expect(r.getByTestId('board-column-working')).toHaveTextContent('Working1')
    expect(r.getByTestId('board-column-earlier')).toHaveTextContent('Earlier1')
    expect(r.getByTestId('board-column-observed')).toHaveTextContent('Observed0')
  })

  it('starts on Needs you when something waits, whatever was remembered', async () => {
    useSettingsStore.setState({ boardColumn: 'earlier' })
    const r = await renderBoard([...items, row(waiting())])
    expect(selected(r, 'needsYou')).toBe(true)
  })

  it('starts on the remembered column when nothing waits, even an empty one', async () => {
    useSettingsStore.setState({ boardColumn: 'observed' })
    const r = await renderBoard()
    expect(selected(r, 'observed')).toBe(true)
    expect(r.getByTestId('board-pager')).toBeTruthy()
  })

  it('turns the pager from a chip, and a swipe moves the selected chip and is remembered', async () => {
    const r = await renderBoard()
    await fireEvent.press(r.getByTestId('board-column-earlier'))
    expect(mockSetPage).toHaveBeenCalledWith(3)
    expect(useSettingsStore.getState().boardColumn).toBe('earlier')
    await act(async () => mockPager.select?.(0))
    expect(selected(r, 'needsYou')).toBe(true)
    expect(useSettingsStore.getState().boardColumn).toBe('needsYou')
    expect(mockSetPage).toHaveBeenCalledTimes(1)
  })

  it('tells an empty column apart with its own hint', async () => {
    const r = await renderBoard()
    expect(r.getByText('Sessions you watch but did not start show in this column.')).toBeTruthy()
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

  it('searches orphan sub-agents by their label', async () => {
    mockGet.mockResolvedValue({ conversations: [sub('x', 'elsewhere', true), sub('y', 'gone', true)], hasMore: false, offset: 0, total: 2 })
    const r = await renderBoard([], undefined, 'sub y')
    await waitFor(() => expect(r.getByTestId('board-column-working')).toHaveTextContent('Working1'))
    expect(r.getAllByText('Sub-agents of other sessions')).toHaveLength(1)
  })

  it('shows one line when sub-agents fail to load and keeps the rest of the board', async () => {
    mockGet.mockRejectedValue(new Error('down'))
    const r = await renderBoard()
    await waitFor(() => expect(r.getAllByText("Couldn't load sub-agents.")).toHaveLength(2))
    expect(r.getByText('Scan the worktrees')).toBeTruthy()
  })
})

describe('SessionBoard questions', () => {
  it('puts the question in place of the activity line', async () => {
    const r = await renderBoard([row(waiting())])
    expect(r.getByText('Run the migration?')).toBeTruthy()
    expect(r.queryByTestId('board-question-modal')).toBeNull()
  })

  it('sends on tap for a single question, with the revision the row carried', async () => {
    const changed = jest.fn()
    const r = await renderBoard([row(waiting())], changed)
    await fireEvent.press(r.getByTestId('board-question-w'))
    await fireEvent.press(r.getByTestId('board-option-q1-no'))
    await waitFor(() => expect(mockAnswer).toHaveBeenCalledTimes(1))
    expect(mockAnswer.mock.calls[0][0]).toMatchObject({ promptId: 'p1', revision: 3, responses: [{ questionId: 'q1', optionIds: ['no'] }] })
    await waitFor(() => expect(r.queryByTestId('board-question-modal')).toBeNull())
    expect(changed).toHaveBeenCalled()
  })

  it('closes without answering, and the session stays in Needs you', async () => {
    const r = await renderBoard([row(waiting())])
    await fireEvent.press(r.getByTestId('board-question-w'))
    await fireEvent.press(r.getByTestId('board-question-close'))
    expect(r.queryByTestId('board-question-modal')).toBeNull()
    expect(mockAnswer).not.toHaveBeenCalled()
    expect(r.getByTestId('board-column-needsYou')).toHaveTextContent('Needs you1')
  })

  it('holds a two-question prompt until both have a reply, then sends them in one post', async () => {
    const two = prompt({ questions: [question('q1', 'First?'), question('q2', 'Second?')] })
    const r = await renderBoard([row(waiting({ pendingPrompts: [two] }))])
    await fireEvent.press(r.getByTestId('board-question-w'))
    expect(r.getByText('Question 1 of 2')).toBeTruthy()
    expect(r.getByText('Question 2 of 2')).toBeTruthy()
    await fireEvent.press(r.getByTestId('board-option-q1-yes'))
    expect(mockAnswer).not.toHaveBeenCalled()
    await fireEvent.press(r.getByTestId('board-option-q2-no'))
    await waitFor(() => expect(mockAnswer).toHaveBeenCalledTimes(1))
    expect(mockAnswer.mock.calls[0][0]).toMatchObject({
      responses: [{ questionId: 'q1', optionIds: ['yes'] }, { questionId: 'q2', optionIds: ['no'] }],
    })
  })

  it('shows a question it cannot answer without reply buttons', async () => {
    const secret = prompt({ questions: [{ ...question('q1', 'Password?'), secret: true }] })
    const r = await renderBoard([row(waiting({ pendingPrompts: [secret] }))])
    await fireEvent.press(r.getByTestId('board-question-w'))
    expect(r.queryByTestId('board-option-q1-yes')).toBeNull()
    expect(r.getByTestId('board-question-unsupported')).toBeTruthy()
  })

  it('keeps the modal open and says so when the send fails', async () => {
    mockAnswer.mockRejectedValue(new Error('offline'))
    const r = await renderBoard([row(waiting())])
    await fireEvent.press(r.getByTestId('board-question-w'))
    await fireEvent.press(r.getByTestId('board-option-q1-yes'))
    await waitFor(() => expect(r.getByTestId('board-question-notice')).toHaveTextContent("Couldn't send your answer. Check your connection and try again."))
    expect(r.getByTestId('board-question-modal')).toBeTruthy()
  })

  it('falls back to the terminal tail, without an eye, on a server with no prompts', async () => {
    const r = await renderBoard([row(waiting({ hasOpenPrompt: undefined, pendingPrompts: undefined, lastOutput: 'Allow edit?\n' }))])
    expect(r.queryByTestId('board-question-w')).toBeNull()
    expect(r.getByText('Allow edit?')).toBeTruthy()
    await fireEvent.press(r.getByTestId('board-tail-w'))
    expect(r.queryByTestId('board-question-modal')).toBeNull()
  })
})

describe('SessionBoard from 768 up', () => {
  beforeEach(() => {
    mockWindowWidth = 1024
  })
  afterEach(() => {
    mockWindowWidth = 390
  })

  it('lays columns out side by side, folds an empty one, and unfolds it when a session lands', async () => {
    const r = await renderBoard()
    expect(r.queryByTestId('board-pager')).toBeNull()
    expect(r.getByTestId('board-pane-working')).toBeTruthy()
    expect(r.getByTestId('board-strip-needsYou')).toBeTruthy()
    await r.rerender(board([...items, row(waiting())]))
    expect(r.queryByTestId('board-strip-needsYou')).toBeNull()
    expect(r.getByTestId('board-pane-needsYou')).toBeTruthy()
  })

  it('hides the arrows when every column fits and moves one column at a time when not', async () => {
    const r = await renderBoard()
    expect(r.queryByTestId('board-arrow-next')).toBeNull()
    const track = r.getByTestId('board-track')
    await act(async () => {
      fireEvent(track, 'layout', { nativeEvent: { layout: { width: 500 } } })
      fireEvent(track, 'contentSizeChange', 1200, 600)
    })
    await fireEvent.press(r.getByTestId('board-arrow-next'))
    expect(selected(r, 'observed')).toBe(true)
    await fireEvent.press(r.getByTestId('board-arrow-previous'))
    expect(selected(r, 'working')).toBe(true)
  })
})
