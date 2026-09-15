import React from 'react'
import { fireEvent } from '@testing-library/react-native'
import { AlertHost } from '@/components/alerts/AlertHost'
import { HomeStatusPill } from '@/components/alerts/StatusPill'
import { CacheAlertBanner } from '@/components/servers/CacheAlertBanner'
import { useOpenStatusSurface } from '@/hooks/useOpenStatusSurface'
import { useAlertStore } from '@/stores/alerts'
import { useErrorSheetStore } from '@/stores/errorSheet'
import { useServersStore } from '@/stores/servers'
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

function Harness({ onPress }: { onPress: (serverId: string) => void }) {
  const open = useOpenStatusSurface()
  return (
    <>
      <AlertHost />
      <CacheAlertBanner onPress={onPress} />
      <HomeStatusPill onPress={open} />
    </>
  )
}

function renderBanner(onPress: (serverId: string) => void) {
  return renderWithI18n(<Harness onPress={onPress} />)
}

beforeEach(() => {
  useAlertStore.getState().reset()
  useErrorSheetStore.setState({ open: false })
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
    const { queryByTestId } = await renderBanner(jest.fn())
    expect(queryByTestId('status-pill')).toBeNull()
  })

  it('raises an error for a high-severity alert so Review is on the Status sheet, not an auto-modal', async () => {
    const server = seedServer()
    useServersStore.getState().setCacheAlert(server.id, {
      fingerprint: 'fp1',
      severity: 'high',
      detectedAt: '2026-07-18T00:00:00.000Z',
      missingCount: 3,
      totalRows: 10,
    })
    const onPress = jest.fn()
    const { getByTestId, findByTestId } = await renderBanner(onPress)
    expect(getByTestId('status-pill')).toBeTruthy()
    expect(useAlertStore.getState().alerts[0].level).toBe('error')
    fireEvent.press(getByTestId('status-pill'))
    fireEvent.press(await findByTestId(`status-row-action-cache-alert:${server.id}`))
    expect(onPress).toHaveBeenCalledWith(server.id)
  })

  it('raises a warning for a low-severity alert with the missing count and server label', async () => {
    const server = seedServer()
    useServersStore.getState().setCacheAlert(server.id, {
      fingerprint: 'fp1',
      severity: 'low',
      detectedAt: '2026-07-18T00:00:00.000Z',
      missingCount: 3,
      totalRows: 10,
    })
    const { getByTestId } = await renderBanner(jest.fn())
    expect(getByTestId('status-pill')).toBeTruthy()
    expect(useAlertStore.getState().alerts[0].title).toMatch(
      /3 conversation histories are missing on My Server/,
    )
  })

  it('opens the status sheet from the pill and Review on the row calls onPress', async () => {
    const server = seedServer()
    useServersStore.getState().setCacheAlert(server.id, {
      fingerprint: 'fp1',
      severity: 'low',
      detectedAt: '2026-07-18T00:00:00.000Z',
      missingCount: 1,
      totalRows: 10,
    })
    const onPress = jest.fn()
    const { findByTestId } = await renderBanner(onPress)
    fireEvent.press(await findByTestId('status-pill'))
    expect(await findByTestId('status-sheet')).toBeTruthy()
    fireEvent.press(await findByTestId(`status-row-action-cache-alert:${server.id}`))
    expect(onPress).toHaveBeenCalledWith(server.id)
  })
})
