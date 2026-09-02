import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/contexts/ThemeContext'
import BrowseScreen from '@/app/browse'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'

const mockBack = jest.fn()
const mockSetOptions = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(), replace: jest.fn(), back: mockBack,
    navigate: jest.fn(), dismiss: jest.fn(), dismissAll: jest.fn(),
  }),
  useLocalSearchParams: () => ({ server: 'srv_alpha', path: undefined }),
  useGlobalSearchParams: () => ({}),
  useNavigation: () => ({ setOptions: mockSetOptions }),
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
    activeOffsetX: () => noop, failOffsetY: () => noop, hitSlop: () => noop, onEnd: () => noop,
  }
  return {
    Gesture: { Pan: () => noop },
    GestureDetector: ({ children }: { children: React.ReactNode }) =>
      ReactLib.createElement(View, {}, children),
  }
})

jest.mock('react-native-reanimated', () => ({ runOnJS: (fn: unknown) => fn }))

const mockBrowseFails = { current: true }
jest.mock('@/hooks/useBrowse', () => ({
  useBrowse: () =>
    mockBrowseFails.current
      ? { data: undefined, isLoading: false, isError: true, error: new Error('The encryption handshake failed (401)') }
      : { data: { directories: [{ name: 'projectA' }] }, isLoading: false, isError: false, error: null },
  useCreateDirectory: () => ({ mutate: jest.fn(), isPending: false }),
  useStartSession: () => ({ mutate: jest.fn(), isPending: false }),
}))

jest.mock('@/hooks/useSession', () => ({
  useSessions: () => ({ data: [], refetch: jest.fn(), isPending: false }),
}))

// Without this the screen issues a real provider-health query and the provider
// chips stay skeletoned, so there is nothing to assert disabled on.
jest.mock('@/hooks/useProviderHealth', () => ({
  useProviderHealth: () => ({ data: { providers: [] }, isLoading: false }),
}))

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
  mockBack.mockClear()
  mockSetOptions.mockClear()
  mockBrowseFails.current = true
  useServerFetchStatusStore.setState({ statuses: {} })
})

describe('BrowseScreen — actions when the server is unreachable', () => {
  it('disables every action while the listing is errored', async () => {
    const { getByTestId } = await renderScreen()

    expect(getByTestId('browse-start-session').props.accessibilityState.disabled).toBe(true)
    expect(getByTestId('browse-new-folder').props.accessibilityState.disabled).toBe(true)
    expect(getByTestId('start-provider-claude-code').props.accessibilityState.disabled).toBe(true)
    expect(getByTestId('start-provider-codex-cli').props.accessibilityState.disabled).toBe(true)
  })

  it('disables them on an unreachable server even when the listing itself succeeded', async () => {
    mockBrowseFails.current = false
    useServerFetchStatusStore.setState({
      statuses: { srv_alpha: { status: 'error', error: 'unreachable', lastCheckedAt: 0 } },
    })
    const { getByTestId } = await renderScreen()

    expect(getByTestId('browse-start-session').props.accessibilityState.disabled).toBe(true)
    expect(getByTestId('browse-new-folder').props.accessibilityState.disabled).toBe(true)
  })

  it('leaves them enabled on a healthy server', async () => {
    mockBrowseFails.current = false
    const { getByTestId } = await renderScreen()

    expect(getByTestId('browse-start-session').props.accessibilityState.disabled).toBeFalsy()
    expect(getByTestId('browse-new-folder').props.accessibilityState.disabled).toBeFalsy()
  })

  it('keeps a header close button that still works while everything else is disabled', async () => {
    await renderScreen()

    const headerRight = mockSetOptions.mock.calls
      .map((call) => call[0].headerRight)
      .filter(Boolean)
      .pop()
    expect(headerRight).toBeDefined()

    // render is async in this setup, so the header element needs awaiting too.
    const { getByTestId } = await render(headerRight())
    fireEvent.press(getByTestId('browse-close'))
    expect(mockBack).toHaveBeenCalledTimes(1)
  })
})
