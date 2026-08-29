/**
 * ServerEditModal — edit-mode label-only rename (AUDIT-M item 5)
 *
 * `stores/servers.ts`'s `editServer` clears the device static key, the pinned
 * `serverPublicKey` and `requireEncryption` whenever it decides the identity
 * changed (`identityReplaced`). A pure label-only rename must never trip that
 * branch. `__tests__/unit/stores/servers.test.ts` already covers `editServer`
 * directly with a bare `jest.fn()` SecureStore mock (no read-back possible);
 * this test instead renders the real `ServerEditModal` in edit mode with a
 * backing SecureStore map, so the pairing survives a real read-back rather
 * than only an "was not called with" assertion.
 */
import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ServerEditModal } from '@/components/servers/ServerEditModal'
import { useServersStore } from '@/stores/servers'
import * as SecureStore from '@/services/secure-store'

const mockSecureStore = new Map<string, string>()
jest.mock('@/services/secure-store', () => ({
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStore.set(key, value)
  }),
  getItemAsync: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStore.delete(key)
  }),
}))

jest.mock('@/components/pair/PairScannerModal', () => ({
  PairScannerModal: () => null,
}))

jest.mock('@/services/ws-client', () => ({
  wsManager: { connect: jest.fn() },
}))

// ServerEditModal also mounts ServerClaudeFlagsSection, a real React Query
// hook that fetches from the server — unrelated to this flow, and its real
// fetch would hang the test. Stubbed the same way
// EncryptionRefusalToClearFlow.test.tsx does.
jest.mock('@/hooks/useClaudeFlags', () => ({
  useClaudeFlags: () => ({ data: null, isLoading: false, isError: false, error: null }),
  useUpdateClaudeFlags: () => ({ mutate: jest.fn(), isPending: false, isError: false, error: null }),
}))

const URL = 'http://192.168.68.130:8766'
const SPK = 'B'.repeat(43)
const DEVICE_KEY_SENTINEL = 'sentinel-device-static-key'

function deviceStaticKeyStoreKey(serverId: string): string {
  return `threadbase_e2ee_device_key_${serverId}`
}

function apiKeyStoreKey(serverId: string): string {
  return `threadbase_api_key_${serverId}`
}

async function renderModal(serverId: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ServerEditModal visible serverId={serverId} onClose={jest.fn()} />
    </QueryClientProvider>,
  )
}

async function seedPinnedServer(): Promise<string> {
  const id = String(
    await useServersStore.getState().addServer(URL, 'key-abc', 'Studio Mac', {
      deviceId: 'device-9',
      deviceToken: 'dt_9',
      capabilities: ['history:read'],
      serverPublicKey: SPK,
      requireEncryption: true,
    }),
  )
  // Stands in for what pair-handshake.ts writes at pairing time — that module
  // is not otherwise exercised here, only the SecureStore key it uses.
  mockSecureStore.set(deviceStaticKeyStoreKey(id), DEVICE_KEY_SENTINEL)
  return id
}

beforeEach(() => {
  mockSecureStore.clear()
  useServersStore.setState({
    servers: {},
    activeServerIds: [],
    displayedServerIds: [],
    isLoading: false,
    hasEverHadServer: false,
    cacheAlert: {},
  })
})

describe('ServerEditModal — label-only edit survives the pairing', () => {
  it('leaves the device key, api key, server public key and pin untouched', async () => {
    const id = await seedPinnedServer()
    const screen = await renderModal(id)

    await waitFor(() => {
      expect(screen.getByTestId('server-edit-url-input').props.value).toBe('192.168.68.130:8766')
    })

    const labelInput = screen.getByPlaceholderText('e.g. Work Mac, Home Server')
    await fireEvent.changeText(labelInput, 'Studio Mac (renamed)')

    await waitFor(() => expect(screen.getByText('Save')).toBeEnabled())
    await fireEvent.press(screen.getByText('Save'))

    await waitFor(() => {
      expect(useServersStore.getState().getServer(id)?.label).toBe('Studio Mac (renamed)')
    })

    expect(await SecureStore.getItemAsync(deviceStaticKeyStoreKey(id))).toBe(DEVICE_KEY_SENTINEL)
    expect(await SecureStore.getItemAsync(apiKeyStoreKey(id))).toBe('key-abc')

    const server = useServersStore.getState().getServer(id)
    expect(server?.serverPublicKey).toBe(SPK)
    expect(server?.requireEncryption).toBe(true)
  })
})
