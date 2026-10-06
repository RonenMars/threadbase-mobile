import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BrowseScreen from '@/app/browse'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { useSettingsStore } from '@/stores/settings'

// Extra directories for a new session: the tray appears only for a provider
// whose health reports `multiDirectory`, and the selection reaches
// /session/new as the `extra` param.

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

// Every level lists the same two folders, which is enough to walk
// root → shared-lib → root → api.
jest.mock('@/hooks/useBrowse', () => ({
  useBrowse: () => ({
    data: { directories: [{ name: 'shared-lib' }, { name: 'api' }] },
    isLoading: false,
    isError: false,
    error: null,
  }),
  useCreateDirectory: () => ({ mutate: jest.fn(), isPending: false }),
}))

jest.mock('@/hooks/useSession', () => ({
  useSessions: () => ({ data: [], refetch: jest.fn(), isPending: false }),
}))

let mockHealth: { data?: { providers: unknown[] }; isLoading: boolean } = {
  data: { providers: [] },
  isLoading: false,
}

jest.mock('@/hooks/useProviderHealth', () => ({
  useProviderHealth: () => mockHealth,
}))

const health = (name: string, multiDirectory?: boolean) => ({
  name,
  available: true,
  version: null,
  verifiedAgainst: { captured: [] },
  capabilities: {
    freshSessionId: 'explicit',
    resume: 'native',
    systemPrompt: 'flag',
    structuredQuestions: true,
    permissionGates: true,
    liveControl: true,
    ...(multiDirectory === undefined ? {} : { multiDirectory }),
  },
  warnings: [],
})

beforeEach(() => {
  mockBack.mockClear()
  mockPush.mockClear()
  mockHealth = { data: { providers: [] }, isLoading: false }
  useSettingsStore.setState({ showProviderVersionWarning: false })
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

function pushedParams(): URLSearchParams {
  const target = mockPush.mock.calls[0][0] as string
  return new URLSearchParams(target.split('?')[1])
}

describe('BrowseScreen additional directories', () => {
  it.each([
    ['absent', undefined],
    ['false', false],
  ])('hides the tray when the capability is %s', async (_label, multiDirectory) => {
    mockHealth = { data: { providers: [health('claude-code', multiDirectory)] }, isLoading: false }
    const { queryByTestId } = await renderScreen()

    expect(queryByTestId('browse-extra-dirs')).toBeNull()
  })

  it('sends the picked folders as `extra`, starting in the folder that is open', async () => {
    mockHealth = { data: { providers: [health('claude-code', true)] }, isLoading: false }
    const { getByTestId, getByText } = await renderScreen()

    await fireEvent.press(getByText('shared-lib'))
    await fireEvent.press(getByTestId('browse-add-directory'))
    expect(getByTestId('browse-extra-dir-shared-lib')).toBeTruthy()

    await fireEvent.press(getByText('~'))
    await fireEvent.press(getByText('api'))
    await fireEvent.press(getByText('Start Session Here'))

    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1))
    const params = pushedParams()
    expect(params.get('path')).toBe('api')
    expect(JSON.parse(params.get('extra') ?? '[]')).toEqual(['shared-lib'])
  })

  it('does not add the open folder twice', async () => {
    mockHealth = { data: { providers: [health('claude-code', true)] }, isLoading: false }
    const { getByTestId, getByText } = await renderScreen()

    await fireEvent.press(getByText('shared-lib'))
    await fireEvent.press(getByTestId('browse-add-directory'))

    expect(getByTestId('browse-add-directory').props.accessibilityState.disabled).toBe(true)
  })

  it('drops a picked folder when the session starts in it', async () => {
    mockHealth = { data: { providers: [health('claude-code', true)] }, isLoading: false }
    const { getByTestId, getByText } = await renderScreen()

    await fireEvent.press(getByText('shared-lib'))
    await fireEvent.press(getByTestId('browse-add-directory'))
    await fireEvent.press(getByText('Start Session Here'))

    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1))
    expect(pushedParams().get('extra')).toBeNull()
  })

  it('removes a folder from the tray', async () => {
    mockHealth = { data: { providers: [health('claude-code', true)] }, isLoading: false }
    const { getByTestId, getByText, queryByTestId } = await renderScreen()

    await fireEvent.press(getByText('shared-lib'))
    await fireEvent.press(getByTestId('browse-add-directory'))
    await fireEvent.press(getByTestId('browse-remove-extra-dir-shared-lib'))

    expect(queryByTestId('browse-extra-dir-shared-lib')).toBeNull()
  })

  it('does not send the selection for a provider without the capability', async () => {
    mockHealth = {
      data: { providers: [health('claude-code', true), health('cursor', false)] },
      isLoading: false,
    }
    const { getByTestId, getByText, queryByTestId } = await renderScreen()

    await fireEvent.press(getByText('shared-lib'))
    await fireEvent.press(getByTestId('browse-add-directory'))
    await fireEvent.press(getByText('~'))
    await fireEvent.press(getByText('api'))
    await fireEvent.press(getByTestId('start-provider-cursor'))

    expect(queryByTestId('browse-extra-dirs')).toBeNull()
    await fireEvent.press(getByText('Start Session Here'))
    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1))
    expect(pushedParams().get('extra')).toBeNull()
    expect(pushedParams().get('provider')).toBe('cursor')
  })
})
