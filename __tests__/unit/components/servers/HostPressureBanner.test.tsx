import React from 'react'
import { act, cleanup, fireEvent, waitFor } from '@testing-library/react-native'
import { AlertHost } from '@/components/alerts/AlertHost'
import { HomeStatusPill } from '@/components/alerts/StatusPill'
import { HostPressureBanner } from '@/components/servers/HostPressureBanner'
import { useOpenStatusSurface } from '@/hooks/useOpenStatusSurface'
import { useAlertStore } from '@/stores/alerts'
import { useErrorSheetStore } from '@/stores/errorSheet'
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
      <AlertHost />
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

async function openAdvice(screen: Awaited<ReturnType<typeof renderBanner>>) {
  fireEvent.press(screen.getByTestId('status-pill'))
  expect(await screen.findByTestId('status-sheet')).toBeTruthy()
}

beforeEach(() => {
  cleanup()
  useAlertStore.getState().reset()
  useErrorSheetStore.setState({ open: false })
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
    const screen = await renderBanner()
    expect(alertTitle()).toBe('My Server is responding slowly.')
    await openAdvice(screen)
    expect(await screen.findByText(/The Threadbase server itself is delayed/)).toBeTruthy()
    expect(
      await screen.findByText(/On the computer, quit Cursor, Chrome, or any VMs you don't need/),
    ).toBeTruthy()
  })

  it('opens OS-specific advice from the status pill', async () => {
    const server = seedServer()
    useServersStore.getState().setHostPressure(server.id, elevated)
    const screen = await renderBanner()
    expect(screen.queryByText('The computer is low on free RAM.')).toBeNull()
    await openAdvice(screen)
    expect(await screen.findByText(/The computer is low on free RAM/)).toBeTruthy()
    expect(
      await screen.findByText(/The CPU can still look idle/),
    ).toBeTruthy()
    expect(
      await screen.findByText(/On this Mac, quit Cursor, Chrome, or any VMs/),
    ).toBeTruthy()
    expect(await screen.findByTestId('status-row-dismiss-host-pressure')).toBeTruthy()
  })

  it('mentions live agents only when that reason fired', async () => {
    const server = seedServer()
    useServersStore.getState().setHostPressure(server.id, {
      ...elevated,
      reasons: ['memory', 'agents'],
      liveAgents: 5,
    })
    const screen = await renderBanner()
    expect(screen.queryByText(/5 agents/)).toBeNull()
    await openAdvice(screen)
    expect(await screen.findByText(/5 agents are running on this computer/)).toBeTruthy()
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
    const screen = await renderBanner()
    expect(alertTitle()).toBe('My Server is under load.')
    await openAdvice(screen)
    expect(await screen.findByText(/The CPU is busy/)).toBeTruthy()
    expect(
      await screen.findByText(/On this Windows PC, quit Cursor, Chrome, or any VMs/),
    ).toBeTruthy()
  })

  it('closes the advice sheet when the level flips back to a dismissed one', async () => {
    const server = seedServer()
    useServersStore.getState().setHostPressure(server.id, elevated)
    const screen = await renderBanner()

    await openAdvice(screen)
    fireEvent.press(await screen.findByTestId('status-row-dismiss-host-pressure'))
    await waitFor(() => {
      expect(screen.queryByTestId('status-pill')).toBeNull()
    })

    await act(async () => {
      useServersStore.getState().setHostPressure(server.id, { ...elevated, level: 'critical' })
    })
    fireEvent.press(screen.getByTestId('status-pill'))
    expect(await screen.findByTestId('error-sheet-row-host-pressure')).toBeTruthy()
    expect(await screen.findByText('My Server is low on memory.')).toBeTruthy()

    await act(async () => {
      useServersStore.getState().setHostPressure(server.id, elevated)
    })
    expect(screen.queryByTestId('status-pill')).toBeNull()
    expect(screen.queryByTestId('error-sheet-row-host-pressure')).toBeNull()
    screen.unmount()
  })

  it('hides until the level changes after explicit dismiss', async () => {
    const server = seedServer()
    useServersStore.getState().setHostPressure(server.id, elevated)
    const screen = await renderBanner()
    await openAdvice(screen)
    fireEvent.press(await screen.findByTestId('status-row-dismiss-host-pressure'))
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
