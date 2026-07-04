import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BrowseScreen from '@/app/browse'
import { ThemeProvider } from '@/contexts/ThemeContext'

const mockStartMutate = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    dismiss: jest.fn(),
    dismissAll: jest.fn(),
  }),
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
  useStartSession: () => ({ mutate: mockStartMutate, isPending: false }),
}))

jest.mock('@/hooks/useSession', () => ({
  useSessions: () => ({ data: [], refetch: jest.fn(), isPending: false }),
}))

beforeEach(() => {
  mockStartMutate.mockClear()
})

function renderScreen() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <BrowseScreen />
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

describe('BrowseScreen e2e provider flow', () => {
  it('starts Claude by default without an explicit provider', () => {
    const { getByText } = renderScreen()

    fireEvent.press(getByText('Start Session Here'))

    expect(mockStartMutate).toHaveBeenCalledWith(
      { path: '', projectName: '~' },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    )
  })

  it('sends codex-cli when Codex is selected', () => {
    const { getByTestId, getByText } = renderScreen()

    fireEvent.press(getByTestId('start-provider-codex-cli'))
    fireEvent.press(getByText('Start Session Here'))

    expect(mockStartMutate).toHaveBeenCalledWith(
      { path: '', projectName: '~', provider: 'codex-cli' },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    )
  })
})
