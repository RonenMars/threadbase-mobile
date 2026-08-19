import React from 'react'
import { fireEvent } from '@testing-library/react-native'
import { CacheAlertBanner } from '@/components/servers/CacheAlertBanner'
import { ToastViewport } from '@/components/ui/ToastViewport'
import { useServersStore } from '@/stores/servers'
import { useToastStore } from '@/stores/toasts'
import { renderWithI18n } from '@/test-utils/render'

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

async function renderBanner(onPress = jest.fn()) {
  return {
    onPress,
    ...(await renderWithI18n(
      <>
        <ToastViewport id="home" />
        <CacheAlertBanner onPress={onPress} />
      </>,
    )),
  }
}

beforeEach(() => {
  useToastStore.getState().reset()
  useServersStore.setState({
    servers: {},
    activeServerIds: [],
    displayedServerIds: [],
    isLoading: false,
    cacheAlert: {},
  })
})

describe('CacheAlertBanner', () => {
  it('renders nothing when there is no cache alert', async () => {
    seedServer()
    const { queryByText } = await renderBanner()
    expect(queryByText(/conversation histories are missing/)).toBeNull()
  })

  it('renders nothing for a high-severity alert (handled by the modal, not the banner)', async () => {
    const server = seedServer()
    useServersStore.getState().setCacheAlert(server.id, {
      fingerprint: 'fp1',
      severity: 'high',
      detectedAt: '2026-07-18T00:00:00.000Z',
      missingCount: 3,
      totalRows: 10,
    })
    const { queryByText } = await renderBanner()
    expect(queryByText(/conversation histories are missing/)).toBeNull()
  })

  it('renders the banner for a low-severity alert with the missing count and server label', async () => {
    const server = seedServer()
    useServersStore.getState().setCacheAlert(server.id, {
      fingerprint: 'fp1',
      severity: 'low',
      detectedAt: '2026-07-18T00:00:00.000Z',
      missingCount: 3,
      totalRows: 10,
    })
    const { findByText } = await renderBanner()
    expect(await findByText(/3 conversation histories are missing on My Server/)).toBeTruthy()
  })

  it('calls onPress from the Review button', async () => {
    const server = seedServer()
    useServersStore.getState().setCacheAlert(server.id, {
      fingerprint: 'fp1',
      severity: 'low',
      detectedAt: '2026-07-18T00:00:00.000Z',
      missingCount: 1,
      totalRows: 10,
    })
    const { onPress, findByLabelText } = await renderBanner()
    fireEvent.press(await findByLabelText('Review'))
    expect(onPress).toHaveBeenCalled()
  })
})
