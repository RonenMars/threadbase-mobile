import React from 'react'
import { act, cleanup, fireEvent, waitFor } from '@testing-library/react-native'
import { HostPressureBanner } from '@/components/servers/HostPressureBanner'
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

beforeEach(() => {
  cleanup()
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
    const { toJSON } = await renderWithI18n(<HostPressureBanner />)
    expect(toJSON()).toBeNull()
  })

  it('renders nothing when host pressure is null', async () => {
    const server = seedServer()
    useServersStore.getState().setHostPressure(server.id, elevated)
    useServersStore.getState().setHostPressure(server.id, null)
    const { toJSON } = await renderWithI18n(<HostPressureBanner />)
    expect(toJSON()).toBeNull()
  })

  it('names the constraint and omits the agent count', async () => {
    const server = seedServer()
    useServersStore.getState().setHostPressure(server.id, elevated)
    const { getByTestId, getByText, queryByText } = await renderWithI18n(<HostPressureBanner />)
    expect(getByTestId('host-pressure-banner')).toBeTruthy()
    expect(getByText('My Server is under memory pressure.')).toBeTruthy()
    expect(getByText('Details')).toBeTruthy()
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
    const { getByText, queryByText } = await renderWithI18n(<HostPressureBanner />)
    expect(getByText('My Server is low on memory.')).toBeTruthy()
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
    const { getByText, queryByText } = await renderWithI18n(<HostPressureBanner />)
    expect(getByText('http://192.168.1.10:7070 is under memory pressure.')).toBeTruthy()
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
    const { getByTestId, getByText, queryByText } = await renderWithI18n(<HostPressureBanner />)
    expect(getByTestId('host-pressure-banner')).toBeTruthy()
    expect(getByText('My Server is under pressure.')).toBeTruthy()
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
    const { getByTestId, getByText, findByText } = await renderWithI18n(<HostPressureBanner />)
    expect(getByText('My Server is responding slowly.')).toBeTruthy()
    fireEvent.press(getByTestId('host-pressure-details'))
    expect(await findByText(/The Threadbase server itself is delayed/)).toBeTruthy()
    expect(
      await findByText(/On the computer, quit Cursor, Chrome, or any VMs you don't need/),
    ).toBeTruthy()
  })

  it('opens OS-specific advice from Details', async () => {
    const server = seedServer()
    useServersStore.getState().setHostPressure(server.id, elevated)
    const { getByTestId, findByText, queryByText } = await renderWithI18n(<HostPressureBanner />)
    expect(queryByText('The computer is low on free RAM.')).toBeNull()
    fireEvent.press(getByTestId('host-pressure-details'))
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
    const { getByTestId, findByText, queryByText } = await renderWithI18n(<HostPressureBanner />)
    expect(queryByText(/5 agents/)).toBeNull()
    fireEvent.press(getByTestId('host-pressure-details'))
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
    const { getByTestId, findByText, getByText } = await renderWithI18n(<HostPressureBanner />)
    expect(getByText('My Server is under load.')).toBeTruthy()
    fireEvent.press(getByTestId('host-pressure-details'))
    expect(await findByText('The CPU is busy.')).toBeTruthy()
    expect(
      await findByText(/On this Windows PC, quit Cursor, Chrome, or any VMs/),
    ).toBeTruthy()
  })

  it('hides until the level changes after explicit dismiss', async () => {
    const server = seedServer()
    useServersStore.getState().setHostPressure(server.id, elevated)
    const screen = await renderWithI18n(<HostPressureBanner />)
    fireEvent.press(screen.getByTestId('host-pressure-details'))
    fireEvent.press(await screen.findByTestId('host-pressure-dismiss'))
    await waitFor(() => {
      expect(screen.queryByTestId('host-pressure-banner')).toBeNull()
    })

    await act(async () => {
      useServersStore.getState().setHostPressure(server.id, {
        ...elevated,
        liveAgents: 1,
      })
    })
    expect(screen.queryByTestId('host-pressure-banner')).toBeNull()

    await act(async () => {
      useServersStore.getState().setHostPressure(server.id, {
        ...elevated,
        level: 'critical',
      })
    })
    expect(screen.getByTestId('host-pressure-banner')).toBeTruthy()
    expect(screen.getByText('My Server is low on memory.')).toBeTruthy()
    screen.unmount()
  })
})
