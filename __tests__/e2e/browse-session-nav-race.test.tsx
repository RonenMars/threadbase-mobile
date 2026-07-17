import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BrowseScreen from '@/app/browse'
import { ThemeProvider } from '@/contexts/ThemeContext'

// Regression for the browse→session nav race (Bug 14). Browse is a modal;
// pushing a route while it is still in navigation state parks the route under
// the modal envelope, and native-stack never emits transitionEnd for a
// programmatic router.back() (the route leaves state synchronously and the
// listener dies with the screen). The working sequence: back() first, then
// push /session/new one frame later — that screen owns the start POST,
// because React Query drops mutate() callbacks when browse unmounts.

const mockBack = jest.fn()
const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack, navigate: jest.fn() }),
  useLocalSearchParams: () => ({ server: 'srv_alpha' }),
  useGlobalSearchParams: () => ({}),
  useNavigation: () => ({
    setOptions: jest.fn(),
    addListener: () => jest.fn(),
  }),
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

jest.mock('react-native-reanimated', () => ({ runOnJS: (fn: unknown) => fn }))

jest.mock('@/hooks/useBrowse', () => ({
  useBrowse: () => ({ data: { directories: [] }, isLoading: false, isError: false, error: null }),
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
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return await render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <BrowseScreen />
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

describe('browse → session navigation race', () => {
  it('dismisses the modal first, then pushes /session/new one frame later', async () => {
    const { getByText } = await renderScreen()

    await fireEvent.press(getByText('Start Session Here'))

    expect(mockBack).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1))
    expect(mockBack.mock.invocationCallOrder[0]).toBeLessThan(mockPush.mock.invocationCallOrder[0])
    const target = mockPush.mock.calls[0][0] as string
    expect(target).toContain('/session/new?')
    expect(target).toContain('server=srv_alpha')
  })

  it('disables the start button once navigation kicked off', async () => {
    const { getByText, queryByText } = await renderScreen()

    await fireEvent.press(getByText('Start Session Here'))

    // The button swaps to a disabled spinner, so a second tap has no target.
    expect(queryByText('Start Session Here')).toBeNull()
    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1))
    expect(mockBack).toHaveBeenCalledTimes(1)
  })
})
