import React from 'react'
import { Alert } from 'react-native'
import { fireEvent } from '@testing-library/react-native'
import { ServerEncryptionSection } from '@/components/servers/ServerEncryptionSection'
import { useServersStore } from '@/stores/servers'
import { renderWithI18n } from '@/test-utils/render'
import type { ServerConfig } from '@/types/api'

const SERVER_ID = 'srv_test1'

function seedServer(overrides: Partial<ServerConfig> = {}) {
  const server: ServerConfig = {
    id: SERVER_ID,
    url: 'http://192.168.1.10:7070',
    label: 'Studio Mac',
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

beforeEach(() => {
  useServersStore.setState({
    servers: {},
    activeServerIds: [],
    displayedServerIds: [],
    isLoading: false,
    cacheAlert: {},
    setRequireEncryption: jest.fn(),
  })
  jest.restoreAllMocks()
})

describe('ServerEncryptionSection', () => {
  it('asks for the pin as a demand rather than describing a state', async () => {
    seedServer()
    const { getByText } = await renderWithI18n(<ServerEncryptionSection serverId={SERVER_ID} />)
    expect(getByText('Require encryption for this server')).toBeTruthy()
  })

  it('sets the pin immediately, with no confirmation', async () => {
    // Turning it on only ever removes a way to be downgraded, so there is
    // nothing to warn about — and a prompt here would train the user to dismiss
    // the one that matters.
    seedServer({ requireEncryption: false })
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const { getByTestId } = await renderWithI18n(<ServerEncryptionSection serverId={SERVER_ID} />)

    fireEvent(getByTestId('server-require-encryption'), 'valueChange', true)

    expect(useServersStore.getState().setRequireEncryption).toHaveBeenCalledWith(SERVER_ID, true)
    expect(alertSpy).not.toHaveBeenCalled()
  })

  it('does not clear the pin until a confirmation naming the loss is accepted', async () => {
    seedServer({ requireEncryption: true })
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const { getByTestId } = await renderWithI18n(<ServerEncryptionSection serverId={SERVER_ID} />)

    fireEvent(getByTestId('server-require-encryption'), 'valueChange', false)
    expect(useServersStore.getState().setRequireEncryption).not.toHaveBeenCalled()

    const [, message, buttons] = alertSpy.mock.calls[0]
    expect(message).toContain('Studio Mac')
    expect(message).toContain('plaintext')

    // Positive control: the assertion above would also pass if the switch were
    // wired to nothing.
    buttons?.find((b) => b.style === 'destructive')?.onPress?.()
    expect(useServersStore.getState().setRequireEncryption).toHaveBeenCalledWith(SERVER_ID, false)
  })

  it('leaves the pin set when the confirmation is cancelled', async () => {
    seedServer({ requireEncryption: true })
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const { getByTestId } = await renderWithI18n(<ServerEncryptionSection serverId={SERVER_ID} />)

    fireEvent(getByTestId('server-require-encryption'), 'valueChange', false)
    const [, , buttons] = alertSpy.mock.calls[0]
    buttons?.find((b) => b.style === 'cancel')?.onPress?.()

    expect(useServersStore.getState().setRequireEncryption).not.toHaveBeenCalled()
  })
})
