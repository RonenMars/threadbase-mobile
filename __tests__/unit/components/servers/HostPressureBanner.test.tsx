import React from 'react'
import { fireEvent } from '@testing-library/react-native'
import { HostPressureBanner } from '@/components/servers/HostPressureBanner'
import { ToastViewport } from '@/components/ui/ToastViewport'
import { useServersStore } from '@/stores/servers'
import { useToastStore } from '@/stores/toasts'
import { renderWithI18n } from '@/test-utils/render'
import type { HostPressureAlert } from '@/types/api'

function seedServer(overrides: Partial<import('@/types/api').ServerConfig> = {}) {
  const server = {
    id: 'srv_test1',
    url: 'http://192.168.1.10:7070',
    label: 'My Server',
    apiKey: 'key-abc',
    isConnected: true,
    serverInfo: null,
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
  reasons: ['memory', 'load'],
  liveAgents: 3,
  updatedAt: '2026-08-18T00:00:00.000Z',
}

async function renderBanner() {
  return renderWithI18n(
    <>
      <ToastViewport id="home" />
      <HostPressureBanner />
    </>,
  )
}

beforeEach(() => {
  useToastStore.getState().reset()
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
    expect(queryByTestId('host-pressure-banner')).toBeNull()
  })

  it('renders nothing when host pressure is null', async () => {
    const server = seedServer()
    useServersStore.getState().setHostPressure(server.id, elevated)
    useServersStore.getState().setHostPressure(server.id, null)
    const { queryByTestId } = await renderBanner()
    expect(queryByTestId('host-pressure-banner')).toBeNull()
  })

  it('renders the elevated banner with testID', async () => {
    const server = seedServer()
    useServersStore.getState().setHostPressure(server.id, elevated)
    const { getByTestId, getByText } = await renderBanner()
    expect(getByTestId('host-pressure-banner')).toBeTruthy()
    expect(getByText('My Server is under load (3 agents running)')).toBeTruthy()
  })

  it('renders the critical banner with testID', async () => {
    const server = seedServer()
    useServersStore.getState().setHostPressure(server.id, {
      ...elevated,
      level: 'critical',
      liveAgents: 9,
    })
    const { getByTestId, getByText } = await renderBanner()
    expect(getByTestId('host-pressure-banner')).toBeTruthy()
    expect(getByText('My Server is critically low on resources (9 agents running)')).toBeTruthy()
  })

  it('opens a non-destructive sheet on tap', async () => {
    const server = seedServer()
    useServersStore.getState().setHostPressure(server.id, elevated)
    const { getByTestId, findByText } = await renderBanner()
    fireEvent.press(getByTestId('host-pressure-banner'))
    expect(await findByText('3 agents are running on My Server')).toBeTruthy()
    expect(await findByText(/Memory pressure/)).toBeTruthy()
    expect(await findByText('Close')).toBeTruthy()
  })
})
