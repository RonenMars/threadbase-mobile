import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/contexts/ThemeContext'
import BrowseScreen from '@/app/browse'
import type { MultiSession } from '@/types/api'

// ─── Module mocks (localized to this test file) ─────────────────────────────

const mockServerParam = { current: 'srv_alpha' as string | undefined }
const mockPush = jest.fn()
const mockBack = jest.fn()

// expo-router — return the per-test serverId via mockServerParam
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: mockBack,
    navigate: jest.fn(),
    dismiss: jest.fn(),
    dismissAll: jest.fn(),
  }),
  useLocalSearchParams: () => ({ server: mockServerParam.current }),
  useGlobalSearchParams: () => ({}),
  useNavigation: () => ({ setOptions: jest.fn() }),
  useSegments: () => [],
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Redirect: () => null,
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: { Screen: () => null },
  Tabs: { Screen: () => null },
}))

// react-native-gesture-handler — render children, no real gestures
jest.mock('react-native-gesture-handler', () => {
  const ReactLib = require('react')
  const { View } = require('react-native')
  const noop: any = {
    activeOffsetX: () => noop,
    failOffsetY: () => noop,
    hitSlop: () => noop,
    onEnd: () => noop,
  }
  return {
    Gesture: { Pan: () => noop },
    GestureDetector: ({ children }: { children: React.ReactNode }) =>
      ReactLib.createElement(View, {}, children),
  }
})

// react-native-reanimated — only runOnJS is referenced from this screen
jest.mock('react-native-reanimated', () => ({
  runOnJS: (fn: unknown) => fn,
}))

// useBrowse / useCreateDirectory — controllable mocks (the start POST moved
// to /session/new; browse only navigates there)
const mockCreateDirMutate = jest.fn()
jest.mock('@/hooks/useBrowse', () => ({
  useBrowse: () => ({
    data: { directories: [] },
    isLoading: false,
    isError: false,
    error: null,
  }),
  useCreateDirectory: () => ({ mutate: mockCreateDirMutate, isPending: false }),
}))

// useSessions — controllable per-test data via mockSessions
const mockSessions: { current: MultiSession[] } = { current: [] }
jest.mock('@/hooks/useSession', () => ({
  useSessions: () => ({ data: mockSessions.current, refetch: jest.fn(), isPending: false }),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SERVER_ID = 'srv_alpha'
const OTHER_SERVER_ID = 'srv_beta'

const makeSession = (overrides: Partial<MultiSession>): MultiSession => ({
  id: overrides.id ?? 'id',
  serverId: overrides.serverId ?? SERVER_ID,
  status: 'idle',
  ptyAttached: false,
  subStatus: null,
  projectPath: '/home/user/projects/foo',
  projectName: 'foo',
  lastOutput: '',
  elapsedMs: 0,
  promptCount: 0,
  startedAt: '2024-01-01T00:00:00Z',
  ...overrides,
})

async function renderScreen() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return await render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <BrowseScreen />
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  mockPush.mockClear()
  mockBack.mockClear()
  mockCreateDirMutate.mockClear()
  mockServerParam.current = SERVER_ID
  mockSessions.current = []
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BrowseScreen — recent directories accordion', () => {
  it('hides the accordion when no prior sessions exist on this server', async () => {
    const { queryByText } = await renderScreen()
    expect(queryByText(/Recent directories/)).toBeNull()
  })

  it('hides the accordion when only other servers have sessions', async () => {
    mockSessions.current = [
      makeSession({
        id: 'a',
        serverId: OTHER_SERVER_ID,
        projectPath: '/elsewhere/proj',
        projectName: 'proj',
      }),
    ]
    const { queryByText } = await renderScreen()
    expect(queryByText(/Recent directories/)).toBeNull()
    expect(queryByText('/elsewhere/proj')).toBeNull()
  })

  it('renders unique recent directories for the current server', async () => {
    mockSessions.current = [
      makeSession({
        id: 'a',
        projectPath: '/home/user/projects/alpha',
        projectName: 'alpha',
        startedAt: '2024-01-01T00:00:00Z',
      }),
      makeSession({
        id: 'b',
        projectPath: '/home/user/projects/beta',
        projectName: 'beta',
        startedAt: '2024-01-03T00:00:00Z',
      }),
      // Duplicate path — should be deduped
      makeSession({
        id: 'c',
        projectPath: '/home/user/projects/alpha',
        projectName: 'alpha',
        startedAt: '2024-01-02T00:00:00Z',
      }),
      // Different server — should be filtered out
      makeSession({
        id: 'd',
        serverId: OTHER_SERVER_ID,
        projectPath: '/home/user/projects/gamma',
        projectName: 'gamma',
      }),
    ]

    const { getByText, queryByText } = await renderScreen()

    expect(getByText('Recent directories (2)')).toBeTruthy()
    expect(getByText('/home/user/projects/alpha')).toBeTruthy()
    expect(getByText('/home/user/projects/beta')).toBeTruthy()
    expect(queryByText('/home/user/projects/gamma')).toBeNull()
  })

  it('lists recent directories newest-first', async () => {
    mockSessions.current = [
      makeSession({
        id: 'old',
        projectPath: '/home/user/projects/older',
        projectName: 'older',
        startedAt: '2024-01-01T00:00:00Z',
      }),
      makeSession({
        id: 'new',
        projectPath: '/home/user/projects/newer',
        projectName: 'newer',
        startedAt: '2024-01-05T00:00:00Z',
      }),
      makeSession({
        id: 'mid',
        projectPath: '/home/user/projects/middle',
        projectName: 'middle',
        startedAt: '2024-01-03T00:00:00Z',
      }),
    ]

    const { getAllByText } = await renderScreen()
    const paths = getAllByText(/\/home\/user\/projects\//).map(
      (node) => node.props.children as string,
    )
    expect(paths).toEqual([
      '/home/user/projects/newer',
      '/home/user/projects/middle',
      '/home/user/projects/older',
    ])
  })

  it('caps the list at 8 entries even when more sessions exist', async () => {
    mockSessions.current = Array.from({ length: 12 }, (_, i) =>
      makeSession({
        id: `s${i}`,
        projectPath: `/home/user/projects/p${i}`,
        projectName: `p${i}`,
        startedAt: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      }),
    )
    const { getByText, queryByText, getByTestId } = await renderScreen()
    expect(getByText('Recent directories (8)')).toBeTruthy()
    // Preview shows only the 3 newest; older paths stay hidden until Display all
    expect(getByText('/home/user/projects/p11')).toBeTruthy()
    expect(getByText('/home/user/projects/p10')).toBeTruthy()
    expect(getByText('/home/user/projects/p9')).toBeTruthy()
    expect(queryByText('/home/user/projects/p8')).toBeNull()
    expect(getByTestId('recent-dirs-display-all')).toBeTruthy()
  })

  it('opens Display all modal with searchable full list when more than 3 recents', async () => {
    mockSessions.current = Array.from({ length: 5 }, (_, i) =>
      makeSession({
        id: `s${i}`,
        projectPath: `/home/user/projects/p${i}`,
        projectName: `p${i}`,
        startedAt: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      }),
    )

    const { getByTestId, queryByTestId, getByPlaceholderText } = await renderScreen()

    expect(queryByTestId('recent-dir-row-/home/user/projects/p1')).toBeNull()
    await fireEvent.press(getByTestId('recent-dirs-display-all'))

    expect(getByTestId('recent-dirs-modal')).toBeTruthy()
    expect(getByTestId('recent-dir-row-/home/user/projects/p1')).toBeTruthy()
    expect(getByTestId('recent-dir-row-/home/user/projects/p0')).toBeTruthy()

    await fireEvent.changeText(getByPlaceholderText('Search locations'), 'p1')
    expect(getByTestId('recent-dir-row-/home/user/projects/p1')).toBeTruthy()
    expect(queryByTestId('recent-dir-row-/home/user/projects/p0')).toBeNull()
    expect(queryByTestId('recent-dir-row-/home/user/projects/p4')).toBeNull()
  })

  it('hides Display all when there are 3 or fewer recent directories', async () => {
    mockSessions.current = Array.from({ length: 3 }, (_, i) =>
      makeSession({
        id: `s${i}`,
        projectPath: `/home/user/projects/p${i}`,
        projectName: `p${i}`,
        startedAt: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      }),
    )
    const { queryByTestId } = await renderScreen()
    expect(queryByTestId('recent-dirs-display-all')).toBeNull()
  })

  it('navigates to /session/new with the absolute path when a recent row is tapped', async () => {
    mockSessions.current = [
      makeSession({
        id: 'a',
        projectPath: '/home/user/projects/alpha',
        projectName: 'alpha',
      }),
    ]

    const { getByText } = await renderScreen()
    await fireEvent.press(getByText('/home/user/projects/alpha'))

    expect(mockBack).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1))
    const target = decodeURIComponent(mockPush.mock.calls[0][0] as string)
    expect(target).toContain('/session/new?')
    expect(target).toContain('path=/home/user/projects/alpha')
    expect(target).toContain('projectName=alpha')
  })

  it('navigates without a provider param for the default Claude start', async () => {
    const { getByText } = await renderScreen()

    await fireEvent.press(getByText('Start Session Here'))

    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1))
    const target = mockPush.mock.calls[0][0] as string
    expect(target).toContain('/session/new?')
    expect(target).not.toContain('provider=')
  })

  it('carries provider=codex-cli when Codex is selected for a new session', async () => {
    const { getByTestId, getByText } = await renderScreen()

    await fireEvent.press(getByTestId('start-provider-codex-cli'))
    await fireEvent.press(getByText('Start Session Here'))

    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1))
    const target = mockPush.mock.calls[0][0] as string
    expect(target).toContain('/session/new?')
    expect(target).toContain('provider=codex-cli')
  })

  it('collapses the recent list when the header is tapped', async () => {
    mockSessions.current = [
      makeSession({
        id: 'a',
        projectPath: '/home/user/projects/alpha',
        projectName: 'alpha',
      }),
    ]

    const { getByText, queryByText } = await renderScreen()

    // Initially expanded
    expect(getByText('/home/user/projects/alpha')).toBeTruthy()

    // Tap header → collapse
    await fireEvent.press(getByText('Recent directories (1)'))
    expect(queryByText('/home/user/projects/alpha')).toBeNull()

    // Tap header → expand again
    await fireEvent.press(getByText('Recent directories (1)'))
    expect(getByText('/home/user/projects/alpha')).toBeTruthy()
  })
})
