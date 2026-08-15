import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BrowseScreen from '@/app/browse'
import { ThemeProvider } from '@/contexts/ThemeContext'

// Browse no longer fires the start POST itself — it hands the parameters to
// /session/new via the route, and that screen owns the mutation. The provider
// travels as a query param (only when Codex is selected, matching the old
// payload shape).

const mockBack = jest.fn()
const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack, navigate: jest.fn() }),
  useLocalSearchParams: () => ({ server: 'srv_alpha' }),
  useGlobalSearchParams: () => ({}),
  useNavigation: () => ({ setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) }),
  useSegments: () => [],
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Redirect: () => null,
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: { Screen: () => null },
  Tabs: { Screen: () => null },
}))

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

jest.mock('react-native-reanimated', () => ({
  runOnJS: (fn: unknown) => fn,
}))

jest.mock('@/hooks/useBrowse', () => ({
  useBrowse: () => ({
    data: { directories: [] },
    isLoading: false,
    isError: false,
    error: null,
  }),
  useCreateDirectory: () => ({ mutate: jest.fn(), isPending: false }),
}))

jest.mock('@/hooks/useSession', () => ({
  useSessions: () => ({ data: [], refetch: jest.fn(), isPending: false }),
}))

// Settled and empty by default. Left unmocked, this hook fetched for real,
// failed, and the tests below happened to run against an errored query — which
// stopped being harmless once a loading health check skeletons the selector
// these tests press. Each test that cares sets its own state.
let mockHealth: {
  data?: { providers: unknown[] }
  isLoading: boolean
} = { data: { providers: [] }, isLoading: false }

jest.mock('@/hooks/useProviderHealth', () => ({
  useProviderHealth: () => mockHealth,
}))

beforeEach(() => {
  mockBack.mockClear()
  mockPush.mockClear()
  mockHealth = { data: { providers: [] }, isLoading: false }
})

const health = (name: string, available: boolean) => ({
  name,
  available,
  version: null,
  verifiedAgainst: { captured: [], min: null },
  capabilities: {},
  warnings: [],
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

describe('BrowseScreen e2e provider flow', () => {
  it('starts Claude by default without an explicit provider', async () => {
    const { getByText } = await renderScreen()

    await fireEvent.press(getByText('Start Session Here'))

    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1))
    const target = mockPush.mock.calls[0][0] as string
    expect(target).toContain('/session/new?')
    expect(target).not.toContain('provider=')
  })

  it('sends codex-cli when Codex is selected', async () => {
    const { getByTestId, getByText } = await renderScreen()

    await fireEvent.press(getByTestId('start-provider-codex-cli'))
    await fireEvent.press(getByText('Start Session Here'))

    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1))
    const target = mockPush.mock.calls[0][0] as string
    expect(target).toContain('/session/new?')
    expect(target).toContain('provider=codex-cli')
  })

  // `available === false` cannot express "we do not know yet": an undefined
  // health reads as not-unavailable, so the buttons painted enabled and then
  // greyed out once the answer arrived. They sit outside the directory list's
  // loading branch, so they paint before either request resolves.
  describe('while the health answer is still in flight', () => {
    beforeEach(() => {
      mockHealth = { data: undefined, isLoading: true }
    })

    it('skeletons the selector instead of claiming both providers work', async () => {
      const { getByTestId, queryByTestId } = await renderScreen()

      expect(getByTestId('start-provider-skeleton-claude-code')).toBeTruthy()
      expect(getByTestId('start-provider-skeleton-codex-cli')).toBeTruthy()
      expect(queryByTestId('start-provider-claude-code')).toBeNull()
      expect(queryByTestId('start-provider-codex-cli')).toBeNull()
    })
  })

  describe('once the health answer arrives', () => {
    it('leaves an available provider selectable', async () => {
      mockHealth = { data: { providers: [health('codex-cli', true)] }, isLoading: false }
      const { getByTestId } = await renderScreen()

      expect(getByTestId('start-provider-codex-cli').props.accessibilityState.disabled).toBe(false)
    })

    it('marks an unavailable provider disabled', async () => {
      mockHealth = { data: { providers: [health('codex-cli', false)] }, isLoading: false }
      const { getByTestId } = await renderScreen()

      expect(getByTestId('start-provider-codex-cli').props.accessibilityState.disabled).toBe(true)
    })
  })

  // An older streamer has no /api/providers, so the query settles with no data.
  // That must fail open — skeletoning forever, or greying every provider,
  // would make the screen unusable against a server that works fine.
  it('shows normal, selectable buttons when health never answers', async () => {
    mockHealth = { data: undefined, isLoading: false }
    const { getByTestId, queryByTestId } = await renderScreen()

    expect(queryByTestId('start-provider-skeleton-codex-cli')).toBeNull()
    expect(getByTestId('start-provider-codex-cli').props.accessibilityState.disabled).toBe(false)
  })
})
