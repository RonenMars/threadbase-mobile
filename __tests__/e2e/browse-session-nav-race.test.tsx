import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BrowseScreen from '@/app/browse'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { markNavigatedToSession } from '@/lib/sessionNavGuard'

// Regression for the browse→session nav race: session_ready can arrive while
// the browse modal is still dismissing. The global session_ready listener in
// app/_layout.tsx pushes /session/<id> unless the id is guarded via
// markNavigatedToSession. That guard must be set BEFORE router.back() so the
// early push is suppressed; setting it late (in the transitionEnd callback)
// leaves a window where the session opens underneath the still-open modal.

const mockBack = jest.fn()
const mockPush = jest.fn()
const mockStartMutate = jest.fn()
let transitionEndCb: ((e: { data: { closing: boolean } }) => void) | null = null

jest.mock('@/lib/sessionNavGuard', () => ({
  markNavigatedToSession: jest.fn(),
  shouldSkipAutoNav: jest.fn(() => false),
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack, navigate: jest.fn() }),
  useLocalSearchParams: () => ({ server: 'srv_alpha' }),
  useGlobalSearchParams: () => ({}),
  useNavigation: () => ({
    setOptions: jest.fn(),
    addListener: (name: string, cb: (e: { data: { closing: boolean } }) => void) => {
      if (name === 'transitionEnd') transitionEndCb = cb
      return jest.fn()
    },
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
  useStartSession: () => ({ mutate: mockStartMutate, isPending: false }),
}))

jest.mock('@/hooks/useSession', () => ({
  useSessions: () => ({ data: [], refetch: jest.fn(), isPending: false }),
}))

beforeEach(() => {
  mockBack.mockClear()
  mockPush.mockClear()
  mockStartMutate.mockClear()
  ;(markNavigatedToSession as jest.Mock).mockClear()
  transitionEndCb = null
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
  it('guards auto-nav before dismissing the modal, then pushes on transitionEnd', async () => {
    const { getByText } = await renderScreen()

    await fireEvent.press(getByText('Start Session Here'))

    // Drive the start mutation's onSuccess with a ready session.
    const { onSuccess } = mockStartMutate.mock.calls[0][1]
    onSuccess({ kind: 'ready', session: { id: 'sess_1', projectId: 'proj_1' } })

    // Guard must be set immediately, before the dismiss, and before any push.
    expect(markNavigatedToSession).toHaveBeenCalledWith('sess_1')
    const markOrder = (markNavigatedToSession as jest.Mock).mock.invocationCallOrder[0]
    const backOrder = mockBack.mock.invocationCallOrder[0]
    expect(markOrder).toBeLessThan(backOrder)
    expect(mockPush).not.toHaveBeenCalled()

    // Push happens only once the modal-dismiss transition completes.
    transitionEndCb?.({ data: { closing: true } })
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/session/sess_1'))
  })
})
