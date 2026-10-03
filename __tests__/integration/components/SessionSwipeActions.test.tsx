import React from 'react'
import { fireEvent, screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NeedsYouCard } from '@/components/sessions/now/NeedsYouCard'
import { renderWithI18n } from '@/test-utils/render'
import { useQuickAccessStore } from '@/stores/quickAccess'
import { useServersStore } from '@/stores/servers'
import { useSessionNamesStore } from '@/stores/sessionNames'
import type { MultiSession } from '@/types/api'

const mockStop = jest.fn<Promise<void>, [{ force?: boolean; delete?: boolean }]>().mockResolvedValue(undefined)
const mockPatch = jest.fn<Promise<void>, [string, { name: string }]>().mockResolvedValue(undefined)

jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
    stopSession: { mutateAsync: (vars: { force?: boolean; delete?: boolean }) => mockStop(vars), isPending: false },
    stopWhenIdle: { mutateAsync: jest.fn(), isPending: false },
  }),
}))

jest.mock('@/services/api-client', () => ({
  ...jest.requireActual('@/services/api-client'),
  createApiForServer: () => ({ patch: (path: string, body: { name: string }) => mockPatch(path, body) }),
}))

declare global {
  var __renderSwipeActions: boolean | undefined
}

const session = (overrides: Partial<MultiSession> = {}): MultiSession => ({
  id: 'sid',
  serverId: 'server-1',
  status: 'waiting_input',
  ptyAttached: true,
  lifecycle: 'attached',
  subStatus: null,
  projectPath: '/home/user/tb-mobile',
  projectName: 'tb-mobile',
  branch: 'main',
  lastOutput: '',
  elapsedMs: 1000,
  promptCount: 1,
  startedAt: new Date().toISOString(),
  ...overrides,
})

function setServerVersion(version: string) {
  useServersStore.setState({
    servers: {
      'server-1': {
        id: 'server-1',
        url: 'http://one',
        apiKey: 'k',
        label: 'MacBook Pro',
        isConnected: true,
        serverInfo: { version, machineName: 'mac', platform: 'macOS', activeSessions: 1 },
        connectionError: null,
      },
    },
  })
}

function renderCard(s: MultiSession) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return renderWithI18n(
    <QueryClientProvider client={client}>
      <NeedsYouCard session={s} title="Fix login redirect" />
    </QueryClientProvider>,
  )
}

beforeAll(() => {
  global.__renderSwipeActions = true
})
afterAll(() => {
  global.__renderSwipeActions = false
})

beforeEach(() => {
  mockStop.mockClear()
  mockPatch.mockClear()
  useQuickAccessStore.setState({ favorites: [] })
  setServerVersion('2.0.0')
})

describe('session swipe actions', () => {
  it('offers favorite on the leading edge and rename, terminate, delete on the trailing edge', async () => {
    await renderCard(session())
    expect(screen.getByTestId('session-swipe-favorite')).toBeTruthy()
    expect(screen.getByTestId('session-swipe-rename')).toBeTruthy()
    expect(screen.getByTestId('session-swipe-terminate')).toBeTruthy()
    expect(screen.getByTestId('session-swipe-delete')).toBeTruthy()
  })

  it('toggles the session in favorites', async () => {
    await renderCard(session())
    await fireEvent.press(screen.getByTestId('session-swipe-favorite'))
    expect(useQuickAccessStore.getState().favorites).toEqual([
      expect.objectContaining({ type: 'session', id: 'server-1::session::sid', sessionId: 'sid', label: 'Fix login redirect' }),
    ])
    expect(screen.getByText('Unfavorite')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('session-swipe-favorite'))
    expect(useQuickAccessStore.getState().favorites).toEqual([])
  })

  it('renames from a prefilled dialog', async () => {
    await renderCard(session())
    await fireEvent.press(screen.getByTestId('session-swipe-rename'))
    const input = screen.getByDisplayValue('Fix login redirect')
    await fireEvent.changeText(input, 'Login redirect loop')
    await fireEvent(input, 'submitEditing')
    expect(useSessionNamesStore.getState().getName('server-1', 'sid')).toBe('Login redirect loop')
    expect(mockPatch).toHaveBeenCalledWith('/api/sessions/sid/name', { name: 'Login redirect loop' })
  })

  it('terminates straight away and asks before deleting', async () => {
    await renderCard(session())
    await fireEvent.press(screen.getByTestId('session-swipe-terminate'))
    expect(mockStop).toHaveBeenCalledWith({})
    await fireEvent.press(screen.getByTestId('session-swipe-delete'))
    expect(mockStop).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Delete this session?')).toBeTruthy()
  })

  it('drops delete on a server without end-session actions', async () => {
    setServerVersion('1.0.0')
    await renderCard(session())
    expect(screen.getByTestId('session-swipe-terminate')).toBeTruthy()
    expect(screen.queryByTestId('session-swipe-delete')).toBeNull()
  })

  it('gives an external session no swipe actions', async () => {
    await renderCard(session({ ownership: 'external' }))
    expect(screen.queryByTestId('session-swipe-favorite')).toBeNull()
    expect(screen.queryByTestId('session-swipe-rename')).toBeNull()
  })
})
