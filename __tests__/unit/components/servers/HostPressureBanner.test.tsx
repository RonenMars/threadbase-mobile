import React from 'react'
import { act, cleanup, fireEvent, waitFor } from '@testing-library/react-native'
import { HomeStatusPill } from '@/components/alerts/StatusPill'
import { HostPressureBanner } from '@/components/servers/HostPressureBanner'
import { useOpenStatusSurface } from '@/hooks/useOpenStatusSurface'
import { useAlertStore } from '@/stores/alerts'
import { useServersStore } from '@/stores/servers'
import { renderWithI18n } from '@/test-utils/render'
import type { HostPressureAlert, ServerConfig } from '@/types/api'

function seedServer(overrides: Partial<ServerConfig> = {}) {
  const server: ServerConfig = {
    id: 'srv_test1',
    url: 'http://192.168.1.10:7070',
    label: 'My Server',
    apiKey: 'key-abc',
    isConnected: true,
    serverInfo: {
      version: '1.0.0',
      machineName: 'host',
      platform: 'darwin',
      activeSessions: 0,
    },
    connectionError: null,
    ...overrides,
  }
  useServersStore.setState({
    servers: { [server.id]: server },
    activeServerIds: [server.id],
    displayedServerIds: [server.id],
    isLoading: false,
  })
  return server
}

const elevated: HostPressureAlert = {
  level: 'elevated',
  reasons: ['memory'],
  liveAgents: 0,
  updatedAt: '2026-08-18T00:00:00.000Z',
  os: 'darwin',
}

function Harness() {
  const open = useOpenStatusSurface()
  return (
    <>
      <HostPressureBanner />
      <HomeStatusPill onPress={open} />
    </>
  )
}

function renderBanner() {
  return renderWithI18n(<Harness />)
}

function alertTitle() {
  return useAlertStore.getState().alerts[0]?.title
}

beforeEach(() => {
  cleanup()
  useAlertStore.getState().reset()
  useServersStore.setState({
    servers: {},
    activeServerIds: [],
    displayedServerIds: [],
    isLoading: false,
    hostPressure: {},
  })
})

describe('HostPressureBanner', () => {
  it('renders nothing when there is no host pressure', async () => {
    seedServer()
    const { queryByTestId } = await renderBanner()
    expect(queryByTestId('status-pill')).toBeNull()
  })

  it('renders nothing when host pressure is null', async () => {
    const server = seedServer()
    useServersStore.getState().setHostPressure(server.id, elevated)
    useServersStore.getState().setHostPressure(server.id, null)
    const { queryByTestId } = await renderBanner()
    expect(queryByTestId('status-pill')).toBeNull()
  })

  it('names the constraint and omits the agent count', async () => {
    const server = seedServer()
    useServersStore.getState().setHostPressure(server.id, elevated)
    const { getByTestId, queryByText } = await renderBanner()
    expect(getByTestId('status-pill')).toBeTruthy()
    expect(alertTitle()).toBe('My Server is under memory pressure.')
    expect(queryByText(/0 agents/)).toBeNull()
    expect(queryByText(/critically/)).toBeNull()
  })

  it('uses stronger copy for critical without turning it into an error', async () => {
    const server = seedServer()
    useServersStore.getState().setHostPressure(server.id, {
      ...elevated,
      level: 'critical',
      liveAgents: 9,
    })
    const { getByTestId, queryByText } = await renderBanner()
    expect(getByTestId('status-pill')).toBeTruthy()
    expect(alertTitle()).toBe('My Server is low on memory.')
    expect(queryByText(/9 agents/)).toBeNull()
  })

  it('uses the typed url when there is no label, not machineName', async () => {
    const server = seedServer({
      label: undefined,
      serverInfo: {
        version: '1.0.0',
        machineName: 'Home Mac',
        platform: 'darwin',
        activeSessions: 0,
      },
    })
    useServersStore.getState().setHostPressure(server.id, elevated)
    const { queryByText } = await renderBanner()
    expect(alertTitle()).toBe('http://192.168.1.10:7070 is under memory pressure.')
    expect(queryByText(/Home Mac/)).toBeNull()
  })

  it('still shows the banner when reasons were all unknown', async () => {
    const server = seedServer()
    useServersStore.getState().setHostPressure(server.id, {
      level: 'elevated',
      reasons: [],
      liveAgents: 2,
      updatedAt: '2026-08-18T00:00:00.000Z',
    })
    const { getByTestId, queryByText } = await renderBanner()
    expect(getByTestId('status-pill')).toBeTruthy()
    expect(alertTitle()).toBe('My Server is under pressure.')
    expect(queryByText(/2 agents/)).toBeNull()
  })

  it('uses generic advice when os and platform are unknown', async () => {
    const server = seedServer({
      serverInfo: {
        version: '1.0.0',
        machineName: 'box',
        platform: 'freebsd',
        activeSessions: 0,
      },
    })
    useServersStore.getState().setHostPressure(server.id, {
      level: 'elevated',
      reasons: ['event_loop'],
      liveAgents: 0,
      updatedAt: '2026-08-18T00:00:00.000Z',
    })
    const { getByTestId, findByText } = await renderBanner()
    expect(alertTitle()).toBe('My Server is responding slowly.')
    fireEvent.press(getByTestId('status-pill'))
    expect(await findByText(/The Threadbase server itself is delayed/)).toBeTruthy()
    expect(
      await findByText(/On the computer, quit Cursor, Chrome, or any VMs you don't need/),
    ).toBeTruthy()
  })

  it('opens OS-specific advice from the status pill', async () => {
    const server = seedServer()
    useServersStore.getState().setHostPressure(server.id, elevated)
    const { getByTestId, findByText, queryByText } = await renderBanner()
    expect(queryByText('The computer is low on free RAM.')).toBeNull()
    fireEvent.press(getByTestId('status-pill'))
    expect(await findByText('The computer is low on free RAM.')).toBeTruthy()
    expect(
      await findByText(/The CPU can still look idle/),
    ).toBeTruthy()
    expect(
      await findByText(/On this Mac, quit Cursor, Chrome, or any VMs/),
    ).toBeTruthy()
    expect(await findByText('Dismiss')).toBeTruthy()
  })

  it('mentions live agents only when that reason fired', async () => {
    const server = seedServer()
    useServersStore.getState().setHostPressure(server.id, {
      ...elevated,
      reasons: ['memory', 'agents'],
      liveAgents: 5,
    })
    const { getByTestId, findByText, queryByText } = await renderBanner()
    expect(queryByText(/5 agents/)).toBeNull()
    fireEvent.press(getByTestId('status-pill'))
    expect(await findByText('5 agents are running on this computer.')).toBeTruthy()
  })

  it('falls back to GET /api/info platform when the frame omits os', async () => {
    const server = seedServer({
      serverInfo: {
        version: '1.0.0',
        machineName: 'pc',
        platform: 'win32',
        activeSessions: 0,
      },
    })
    useServersStore.getState().setHostPressure(server.id, {
      level: 'elevated',
      reasons: ['load'],
      liveAgents: 0,
      updatedAt: '2026-08-18T00:00:00.000Z',
    })
    const { getByTestId, findByText } = await renderBanner()
    expect(alertTitle()).toBe('My Server is under load.')
    fireEvent.press(getByTestId('status-pill'))
    expect(await findByText('The CPU is busy.')).toBeTruthy()
    expect(
      await findByText(/On this Windows PC, quit Cursor, Chrome, or any VMs/),
    ).toBeTruthy()
  })

  it('closes the advice sheet when the level flips back to a dismissed one', async () => {
    const server = seedServer()
    useServersStore.getState().setHostPressure(server.id, elevated)
    const screen = await renderBanner()

    fireEvent.press(screen.getByTestId('status-pill'))
    fireEvent.press(await screen.findByTestId('host-pressure-dismiss'))
    await waitFor(() => {
      expect(screen.queryByTestId('status-pill')).toBeNull()
    })

    await act(async () => {
      useServersStore.getState().setHostPressure(server.id, { ...elevated, level: 'critical' })
    })
    fireEvent.press(screen.getByTestId('status-pill'))
    expect(await screen.findByTestId('host-pressure-sheet')).toBeTruthy()

    await act(async () => {
      useServersStore.getState().setHostPressure(server.id, elevated)
    })
    expect(screen.queryByTestId('host-pressure-sheet')).toBeNull()
    screen.unmount()
  })

  it('hides until the level changes after explicit dismiss', async () => {
    const server = seedServer()
    useServersStore.getState().setHostPressure(server.id, elevated)
    const screen = await renderBanner()
    fireEvent.press(screen.getByTestId('status-pill'))
    fireEvent.press(await screen.findByTestId('host-pressure-dismiss'))
    await waitFor(() => {
      expect(screen.queryByTestId('status-pill')).toBeNull()
    })

    await act(async () => {
      useServersStore.getState().setHostPressure(server.id, {
        ...elevated,
        liveAgents: 1,
      })
    })
    expect(screen.queryByTestId('status-pill')).toBeNull()

    await act(async () => {
      useServersStore.getState().setHostPressure(server.id, {
        ...elevated,
        level: 'critical',
      })
    })
    expect(screen.getByTestId('status-pill')).toBeTruthy()
    expect(alertTitle()).toBe('My Server is low on memory.')
    screen.unmount()
  })
})
