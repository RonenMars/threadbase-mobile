import React from 'react'
import { Alert } from 'react-native'
import { fireEvent } from '@testing-library/react-native'
import { EncryptionRefusalBanner } from '@/components/servers/EncryptionRefusalBanner'
import { useServersStore } from '@/stores/servers'
import { renderWithI18n } from '@/test-utils/render'
import { E2EE_CLIENT_VERSION } from '@/types/api'
import type { E2eeCapability, ServerConfig, ServerInfo } from '@/types/api'

const SERVER_ID = 'srv_test1'

const info = (e2ee?: Partial<E2eeCapability>): ServerInfo => ({
  version: '1.55.3',
  machineName: 'box',
  platform: 'darwin',
  activeSessions: 0,
  ...(e2ee
    ? { e2ee: { supported: true, enabled: true, version: E2EE_CLIENT_VERSION, required: false, ...e2ee } }
    : {}),
})

function seedServer(overrides: Partial<ServerConfig> = {}) {
  const server: ServerConfig = {
    id: SERVER_ID,
    url: 'http://192.168.1.10:7070',
    label: 'Studio Mac',
    apiKey: 'key-abc',
    isConnected: false,
    serverInfo: info(),
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

beforeEach(() => {
  useServersStore.setState({
    servers: {},
    activeServerIds: [],
    displayedServerIds: [],
    isLoading: false,
    cacheAlert: {},
    refreshServerInfo: jest.fn().mockResolvedValue(undefined),
    removeServer: jest.fn().mockResolvedValue(undefined),
  })
  jest.restoreAllMocks()
})

describe('EncryptionRefusalBanner', () => {
  it('names the server it is refusing', async () => {
    // The positive control for every "renders nothing" case below.
    seedServer({ requireEncryption: true })
    const { getByText } = await renderWithI18n(<EncryptionRefusalBanner />)
    expect(getByText(/Studio Mac/)).toBeTruthy()
  })

  it('renders nothing for a server that is not pinned', async () => {
    seedServer({ requireEncryption: false })
    const { toJSON } = await renderWithI18n(<EncryptionRefusalBanner />)
    expect(toJSON()).toBeNull()
  })

  it('renders nothing for a pinned server that is offering encryption', async () => {
    seedServer({ requireEncryption: true, serverInfo: info({}) })
    const { toJSON } = await renderWithI18n(<EncryptionRefusalBanner />)
    expect(toJSON()).toBeNull()
  })

  it('renders nothing for a pinned server that has not answered yet', async () => {
    seedServer({ requireEncryption: true, serverInfo: null })
    const { toJSON } = await renderWithI18n(<EncryptionRefusalBanner />)
    expect(toJSON()).toBeNull()
  })

  it('offers exactly two ways out, and neither of them connects', async () => {
    // The property, not the labels: any third button on this banner would be
    // the "connect anyway" the pin exists to remove, and the one thing an
    // attacker who stripped the capability would need the user to tap.
    seedServer({ requireEncryption: true })
    const { getAllByRole, getByTestId } = await renderWithI18n(<EncryptionRefusalBanner />)
    expect(getAllByRole('button')).toHaveLength(2)
    expect(getByTestId('encryption-refusal-retry')).toBeTruthy()
    expect(getByTestId('encryption-refusal-forget')).toBeTruthy()
  })

  it('re-reads the server when retry is pressed', async () => {
    seedServer({ requireEncryption: true })
    const { getByTestId } = await renderWithI18n(<EncryptionRefusalBanner />)
    fireEvent.press(getByTestId('encryption-refusal-retry'))
    expect(useServersStore.getState().refreshServerInfo).toHaveBeenCalledWith(SERVER_ID)
  })

  it('does not forget the server until the confirmation is accepted', async () => {
    seedServer({ requireEncryption: true })
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const { getByTestId } = await renderWithI18n(<EncryptionRefusalBanner />)

    fireEvent.press(getByTestId('encryption-refusal-forget'))
    expect(useServersStore.getState().removeServer).not.toHaveBeenCalled()

    // Positive control for the assertion above: it would also pass if the
    // button were wired to nothing at all.
    const buttons = alertSpy.mock.calls[0][2]
    buttons?.find((b) => b.style === 'destructive')?.onPress?.()
    expect(useServersStore.getState().removeServer).toHaveBeenCalledWith(SERVER_ID)
  })
})
