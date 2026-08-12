import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BrowseScreen from '@/app/browse'
import { ThemeProvider } from '@/contexts/ThemeContext'

// The Explorer lists directories (navigable) and files (view-only). Files must
// render but never navigate — tapping one leaves the current directory intact.

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() }),
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
    data: { path: '', directories: [{ name: 'src' }], files: [{ name: 'README.md' }] },
    isLoading: false,
    isError: false,
    error: null,
  }),
  useCreateDirectory: () => ({ mutate: jest.fn(), isPending: false }),
}))

jest.mock('@/hooks/useSession', () => ({
  useSessions: () => ({ data: [], refetch: jest.fn(), isPending: false }),
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

describe('BrowseScreen — files in the Explorer', () => {
  it('renders both directories and files', async () => {
    const { getByTestId, getByText } = await renderScreen()
    expect(getByTestId('browse-first-directory')).toBeTruthy()
    expect(getByTestId('browse-file-README.md')).toBeTruthy()
    expect(getByText('README.md')).toBeTruthy()
  })

  it('navigates into a directory when its row is tapped', async () => {
    const { getByTestId } = await renderScreen()
    fireEvent.press(getByTestId('browse-first-directory'))
    await waitFor(() => expect(getByTestId('browse-cwd-src')).toBeTruthy())
  })

  it('does not navigate when a file row is tapped', async () => {
    const { getByTestId } = await renderScreen()
    fireEvent.press(getByTestId('browse-file-README.md'))
    // cwd is unchanged — the file is view-only, not selectable.
    expect(getByTestId('browse-cwd-~')).toBeTruthy()
  })
})
