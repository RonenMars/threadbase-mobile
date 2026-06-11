import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BrowseScreen from '@/app/browse'

// ─── Module mocks (localized to this test file) ─────────────────────────────

const mockPathParam = { current: undefined as string | undefined }

// expo-router — return the per-test ?path= prefill via mockPathParam
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    dismiss: jest.fn(),
    dismissAll: jest.fn(),
  }),
  useLocalSearchParams: () => ({ server: 'srv_alpha', path: mockPathParam.current }),
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

// useBrowse — root ('') always succeeds; any other path fails with the
// per-test error message in mockSubdirError.
const mockSubdirError = { current: 'Path outside browse root' }
jest.mock('@/hooks/useBrowse', () => ({
  useBrowse: (_serverId: string, path: string) =>
    path === ''
      ? { data: { directories: [{ name: 'projectA' }] }, isLoading: false, isError: false, error: null }
      : {
          data: undefined,
          isLoading: false,
          isError: true,
          error: new Error(mockSubdirError.current),
        },
  useCreateDirectory: () => ({ mutate: jest.fn(), isPending: false }),
  useStartSession: () => ({ mutate: jest.fn(), isPending: false }),
}))

jest.mock('@/hooks/useSession', () => ({
  useSessions: () => ({ data: [], refetch: jest.fn(), isPending: false }),
}))

function renderScreen() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <BrowseScreen />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockPathParam.current = undefined
  mockSubdirError.current = 'Path outside browse root'
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BrowseScreen — outside-browse-root prefill fallback', () => {
  it('falls back to the browse root when the prefilled path is outside it', async () => {
    mockPathParam.current = '/home/demo/projects/threadbase-mobile'
    const { getByTestId, getByText } = renderScreen()
    await waitFor(() => {
      expect(getByTestId('browse-cwd-~')).toBeTruthy()
    })
    expect(getByText('projectA')).toBeTruthy()
  })

  it('does not fall back on unrelated errors — surfaces them instead', () => {
    mockPathParam.current = '/home/demo/projects/threadbase-mobile'
    mockSubdirError.current = 'Server returned 500'
    const { getByTestId, getByText, queryByTestId } = renderScreen()
    expect(getByTestId('browse-cwd-/home/demo/projects/threadbase-mobile')).toBeTruthy()
    expect(queryByTestId('browse-cwd-~')).toBeNull()
    expect(getByText('Server returned 500')).toBeTruthy()
  })
})
