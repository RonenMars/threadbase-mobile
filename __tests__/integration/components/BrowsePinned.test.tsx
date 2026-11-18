import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/contexts/ThemeContext'
import BrowseScreen from '@/app/browse'
import type { PinnedDirEntry } from '@/lib/pinnedDirs'

const mockParams: { current: { server: string; path?: string } } = { current: { server: 'srv_alpha' } }
const mockPush = jest.fn()
const mockBack = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack, navigate: jest.fn() }),
  useLocalSearchParams: () => mockParams.current,
  useGlobalSearchParams: () => ({}),
  useNavigation: () => ({ setOptions: jest.fn() }),
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
  const noop: Record<string, () => unknown> = {}
  for (const k of ['activeOffsetX', 'failOffsetY', 'hitSlop', 'onEnd']) noop[k] = () => noop
  return {
    Gesture: { Pan: () => noop },
    GestureDetector: ({ children }: { children: React.ReactNode }) => ReactLib.createElement(View, {}, children),
  }
})

jest.mock('react-native-reanimated', () => ({ runOnJS: (fn: () => void) => fn }))

jest.mock('@/hooks/useBrowse', () => ({
  useBrowse: () => ({ data: { directories: [] }, isLoading: false, isError: false, error: null }),
  useCreateDirectory: () => ({ mutate: jest.fn(), isPending: false }),
}))

jest.mock('@/hooks/useSession', () => ({
  useSessions: () => ({ data: [], refetch: jest.fn(), isPending: false }),
}))

jest.mock('@/hooks/useProviderHealth', () => ({
  useProviderHealth: () => ({ data: { providers: [] }, isLoading: false }),
}))

const mockPinned: { current: { supported: boolean; dirs: PinnedDirEntry[] } } = {
  current: { supported: true, dirs: [] },
}
const mockPin = jest.fn()
const mockUnpin = jest.fn()
jest.mock('@/hooks/usePinnedDirs', () => ({
  usePinnedDirs: () => mockPinned.current,
  usePinDir: () => ({ mutate: mockPin, isPending: false }),
  useUnpinDir: () => ({ mutate: mockUnpin, isPending: false }),
}))

const PROJ: PinnedDirEntry = { path: '/root/proj', name: 'proj', relativePath: 'proj' }

async function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return await render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <BrowseScreen />
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockParams.current = { server: 'srv_alpha' }
  mockPinned.current = { supported: true, dirs: [] }
})

describe('BrowseScreen — pinned folders', () => {
  it('shows no pinning at all on a server without pinnedDirs', async () => {
    mockPinned.current = { supported: false, dirs: [] }
    const { queryByTestId, queryByText } = await renderScreen()
    expect(queryByTestId('browse-pin-toggle')).toBeNull()
    expect(queryByText(/Pinned/)).toBeNull()
  })

  it('offers the pin toggle but no section before anything is pinned', async () => {
    const { getByTestId, queryByText } = await renderScreen()
    expect(getByTestId('browse-pin-toggle').props.accessibilityLabel).toBe('Pin this folder')
    expect(queryByText(/Pinned/)).toBeNull()
  })

  it('pins the folder being browsed by its browse path', async () => {
    mockParams.current = { server: 'srv_alpha', path: 'proj/sub' }
    const { getByTestId } = await renderScreen()
    fireEvent.press(getByTestId('browse-pin-toggle'))
    expect(mockPin).toHaveBeenCalledWith('proj/sub', expect.anything())
    expect(mockUnpin).not.toHaveBeenCalled()
  })

  it('unpins the folder being browsed when it is already pinned', async () => {
    mockParams.current = { server: 'srv_alpha', path: 'proj' }
    mockPinned.current = { supported: true, dirs: [PROJ] }
    const { getByTestId } = await renderScreen()
    expect(getByTestId('browse-pin-toggle').props.accessibilityLabel).toBe('Unpin this folder')
    fireEvent.press(getByTestId('browse-pin-toggle'))
    expect(mockUnpin).toHaveBeenCalledWith('/root/proj', expect.anything())
    expect(mockPin).not.toHaveBeenCalled()
  })

  it('lists pins and starts a session from one', async () => {
    mockPinned.current = { supported: true, dirs: [PROJ] }
    const raf = jest.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })
    const { getByText, getByTestId } = await renderScreen()
    expect(getByText('Pinned (1)')).toBeTruthy()
    fireEvent.press(getByTestId('pinned-dir-/root/proj'))
    expect(mockBack).toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining(`path=${encodeURIComponent('/root/proj')}`))
    raf.mockRestore()
  })

  it('unpins from the row button without starting a session', async () => {
    mockPinned.current = { supported: true, dirs: [PROJ] }
    const { getByTestId } = await renderScreen()
    fireEvent.press(getByTestId('unpin-dir-/root/proj'))
    expect(mockUnpin).toHaveBeenCalledWith('/root/proj', expect.anything())
    expect(mockPush).not.toHaveBeenCalled()
  })
})
