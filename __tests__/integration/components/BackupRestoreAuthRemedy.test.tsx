// A refused credential has two remedies and they are not interchangeable.
//
// A revoked device has to pair again: a `devicesDurable` server keeps being
// sent the device token whatever the user types into the API key field, so
// "check your API key" opens a screen that cannot fix it. A refused shared key
// is the opposite — editing the key is exactly the fix. Asserting only that
// "an error appeared" passes on the broken behaviour these tests exist to
// catch, so each case asserts the remedy it MUST name and the one it must NOT.

import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'
import BackupRestoreScreen from '@/app/backup-restore'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthError } from '@/services/authed-fetch'
import { useServersStore } from '@/stores/servers'
import type { ServerConfig } from '@/types/api'
import type { RestoreDryRunResponse } from '@/types/backup'
import en from '@/locales/en/common.json'

const mockExportBackup = jest.fn()
const mockMutateAsync = jest.fn()

jest.mock('@/services/backup', () => ({
  ...jest.requireActual('@/services/backup'),
  exportBackup: (serverId: string) => mockExportBackup(serverId),
}))

jest.mock('@/hooks/useBackup', () => ({
  useBackupRestore: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}))

const SERVER: ServerConfig = {
  id: 'srv_alpha',
  url: 'https://box.example.com',
  apiKey: 'tb_shared',
  label: 'box',
  isConnected: true,
  serverInfo: null,
  connectionError: null,
}

const ARCHIVE_JSON = JSON.stringify({
  manifest: {
    formatVersion: 1,
    createdAt: '2026-08-15T00:00:00.000Z',
    streamerVersion: '1.52.3',
    sourceHost: 'box',
    includesSecrets: false,
    counts: { projects: 0 },
  },
  projects: [],
})

const CLEAN_DRY_RUN: RestoreDryRunResponse = {
  applied: false,
  summary: { create: 0, update: 0, conflict: 0 },
  plan: { create: [], update: [], conflict: [] },
}

beforeEach(() => {
  jest.clearAllMocks()
  useServersStore.setState({
    servers: { srv_alpha: SERVER },
    activeServerIds: ['srv_alpha'],
    displayedServerIds: ['srv_alpha'],
  })
})

async function renderScreen() {
  return await render(
    <ThemeProvider>
      <BackupRestoreScreen />
    </ThemeProvider>,
  )
}

async function errorAfterExport(err: Error): Promise<string> {
  mockExportBackup.mockRejectedValue(err)
  const screen = await renderScreen()
  fireEvent.press(screen.getByTestId('backup-export'))
  const node = await waitFor(() => screen.getByTestId('backup-action-error'))
  return String(node.props.children)
}

describe('BackupRestoreScreen — the remedy a refused credential names', () => {
  // Asserting only /pair/i and /API key/i is NOT enough: AuthError's English
  // diagnostic already satisfies both, so those assertions stay green with the
  // mapping deleted. Pinning the translated string as well is what makes the
  // test fail on the behaviour being fixed — and the regexes on top of it are
  // what fail if the two keys ever collapse into one shared sentence.
  it('tells a revoked device to pair again, and never mentions the API key', async () => {
    const message = await errorAfterExport(new AuthError('device', '/api/backup/export'))
    expect(message).toBe(en.error.authDeviceRevoked)
    expect(message).toMatch(/pair/i)
    expect(message).not.toMatch(/API key/i)
  })

  it('tells a refused shared key to update the key, and never mentions pairing', async () => {
    const message = await errorAfterExport(new AuthError('shared', '/api/backup/export'))
    expect(message).toBe(en.error.authKeyRejected)
    expect(message).toMatch(/API key/i)
    expect(message).not.toMatch(/pair/i)
  })

  // Everything else reaching this branch was already an English service
  // diagnostic, and stays one — this change narrows the fallback, not replaces it.
  it('leaves a non-auth failure on its own message', async () => {
    const message = await errorAfterExport(new Error('Failed to reach https://box.example.com'))
    expect(message).toBe('Failed to reach https://box.example.com')
  })

  it('maps the dry-run failure the same way', async () => {
    mockMutateAsync.mockRejectedValue(new AuthError('device', '/api/backup/restore'))
    const screen = await renderScreen()
    await fireEvent.changeText(screen.getByTestId('backup-paste-input'), ARCHIVE_JSON)
    await fireEvent.press(screen.getByTestId('backup-dry-run'))
    const node = await waitFor(() => screen.getByTestId('backup-action-error'))
    expect(node.props.children).toBe(en.error.authDeviceRevoked)
  })

  it('maps the apply failure the same way', async () => {
    jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _body, buttons) => buttons?.[1]?.onPress?.())
    mockMutateAsync.mockResolvedValueOnce(CLEAN_DRY_RUN)
    mockMutateAsync.mockRejectedValueOnce(new AuthError('shared', '/api/backup/restore'))

    const screen = await renderScreen()
    await fireEvent.changeText(screen.getByTestId('backup-paste-input'), ARCHIVE_JSON)
    await fireEvent.press(screen.getByTestId('backup-dry-run'))
    fireEvent.press(await waitFor(() => screen.getByTestId('backup-apply')))

    const node = await waitFor(() => screen.getByTestId('backup-action-error'))
    expect(node.props.children).toBe(en.error.authKeyRejected)
  })
})
