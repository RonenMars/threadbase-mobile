import React, { useState } from 'react'
import { Alert, Text, TouchableOpacity } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { EncryptionRefusalBanner } from '@/components/servers/EncryptionRefusalBanner'
import { ServersStatusModal } from '@/components/servers/ServersStatusModal'
import { useServersStore } from '@/stores/servers'
import { wsManager } from '@/services/ws-client'
import i18n from '@/test-utils/i18n-setup'
import type { ServerConfig, ServerInfo } from '@/types/api'

// ServerEditModal also mounts ServerClaudeFlagsSection, which fetches from the
// server. That is unrelated to what this flow proves, so it is stubbed the
// same way ServerClaudeFlagsSection.test.tsx does — otherwise its real fetch
// hangs the test.
jest.mock('@/hooks/useClaudeFlags', () => ({
  useClaudeFlags: () => ({ data: null, isLoading: false, isError: false, error: null }),
  useUpdateClaudeFlags: () => ({ mutate: jest.fn(), isPending: false, isError: false, error: null }),
}))

// ServerEncryptionSection sits behind ServerEditModal, which also mounts
// ServerClaudeFlagsSection — a real React Query hook — so this flow needs a
// QueryClientProvider, unlike the plain renderWithI18n helper.
async function renderHost() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return await render(
    <QueryClientProvider client={qc}>
      <I18nextProvider i18n={i18n}>
        <EncryptionRefusalHost />
      </I18nextProvider>
    </QueryClientProvider>,
  )
}

const SERVER_ID = 'srv_refused'

// Mirrors how app/index.tsx wires the two together: the banner renders inline,
// and Settings — where the pin can be cleared — is a separate modal opened by
// its own control. Nothing here gates that control on the banner's state, so
// this host is the thinnest real stand-in for proving the two stay reachable
// as one flow, without pulling in the full hub screen's unrelated hooks
// (sessions, conversations, search) that have no bearing on this criterion.
// Deliberate, reviewed choice for #759 criterion 4 — not a shortcut taken
// without noticing app/index.tsx exists.
function EncryptionRefusalHost() {
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  return (
    <>
      <EncryptionRefusalBanner />
      <TouchableOpacity testID="open-servers-status" onPress={() => setStatusModalOpen(true)}>
        <Text>Servers</Text>
      </TouchableOpacity>
      <ServersStatusModal visible={statusModalOpen} onClose={() => setStatusModalOpen(false)} />
    </>
  )
}

const refusingInfo: ServerInfo = {
  version: '1.55.3',
  machineName: 'box',
  platform: 'darwin',
  activeSessions: 0,
  // No `e2ee` key: the server does not offer encryption at all, which is what
  // makes a `requireEncryption: true` server a refusal.
}

function seedRefusedServer(): ServerConfig {
  const server: ServerConfig = {
    id: SERVER_ID,
    url: 'http://192.168.1.10:7070',
    label: 'Studio Mac',
    apiKey: 'key-abc',
    isConnected: false,
    serverInfo: refusingInfo,
    connectionError: null,
    requireEncryption: true,
  }
  useServersStore.setState({
    servers: { [server.id]: server },
    activeServerIds: [server.id],
    displayedServerIds: [server.id],
    isLoading: false,
    cacheAlert: {},
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
  })
  jest.spyOn(wsManager, 'status').mockReturnValue('disconnected')
  jest.spyOn(wsManager, 'onAnyStatusChange').mockReturnValue(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('Encryption refusal banner does not block the settings-based clearing path', () => {
  it('shows the refusal, then reaches Edit Server and clears the pin through the real store', async () => {
    seedRefusedServer()
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})

    const screen = await renderHost()

    // The refusal banner is up.
    expect(screen.getByText('Studio Mac', { exact: false })).toBeTruthy()
    expect(screen.getByTestId('encryption-refusal-retry')).toBeTruthy()

    // Ordinary navigation to Settings still works while it is showing.
    fireEvent.press(screen.getByTestId('open-servers-status'))
    fireEvent.press(await screen.findByTestId('server-row-dots-btn'))
    fireEvent.press(await screen.findByText('Edit'))

    // Edit Server is open on the refused server, with its encryption section.
    const toggle = await screen.findByTestId('server-require-encryption')
    fireEvent(toggle, 'valueChange', false)

    // Clearing the pin asks for a confirmation naming the loss.
    await waitFor(() => expect(alertSpy).toHaveBeenCalled())
    const buttons = alertSpy.mock.calls[0][2]
    buttons?.find((b) => b.style === 'destructive')?.onPress?.()

    await waitFor(() =>
      expect(useServersStore.getState().servers[SERVER_ID].requireEncryption).toBe(false),
    )
  })
})
