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

beforeEach(() => {
  mockBack.mockClear()
  mockPush.mockClear()
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
})
