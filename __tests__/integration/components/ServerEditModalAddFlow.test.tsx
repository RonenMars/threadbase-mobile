/**
 * ServerEditModal — add-mode fetch-error surface
 *
 * `AddServerScreen` (now retired, see #831) validated a manually-entered
 * server with a pre-flight `authedFetch('/api/profiles')` call before ever
 * persisting it, and surfaced 401/500/network/localhost-hint failures inline.
 * `ServerEditModal` is the one surviving add/edit host; these tests prove its
 * add-mode Save path — through the real confirm gate — reaches the same
 * fetch-error surface, porting the coverage that lived in the retired
 * `onboarding-flow.test.tsx`'s `Onboarding – error handling` and
 * `Onboarding – API key visibility toggle` blocks.
 */
import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { ServerEditModal } from '@/components/servers/ServerEditModal'
import en from '@/locales/en/common.json'

jest.mock('@/components/pair/PairScannerModal', () => ({
  PairScannerModal: () => null,
}))

jest.mock('@/services/ws-client', () => ({
  wsManager: { connect: jest.fn() },
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockReset()
})

async function fillAndSave(screen: Awaited<ReturnType<typeof render>>, url: string, apiKey: string) {
  await fireEvent.changeText(screen.getByTestId('server-edit-url-input'), url)
  await fireEvent.changeText(screen.getByTestId('server-edit-key-input'), apiKey)
  await waitFor(() => expect(screen.getByText('Save')).toBeEnabled())
  await act(async () => {
    await fireEvent.press(screen.getByText('Save'))
  })
  await fireEvent.press(await screen.findByTestId('pair-confirm-add-btn'))
}

describe('ServerEditModal – add mode error handling', () => {
  it('shows auth error message on 401 response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: jest.fn().mockResolvedValue({}) })

    const screen = await render(<ServerEditModal visible serverId={null} onClose={jest.fn()} />)
    await fillAndSave(screen, '192.168.1.1:7070', 'wrong-key')

    // Pins the string, not a fragment of it: a regex on "API key" stays green
    // through a copy change that drops the pointer to where the real key lives.
    expect(await screen.findByText(en.error.authKeyRejectedOnConnect)).toBeTruthy()
  })

  it('shows network error for non-localhost URL when fetch rejects', async () => {
    mockFetch.mockRejectedValue(new TypeError('Network request failed'))

    const screen = await render(<ServerEditModal visible serverId={null} onClose={jest.fn()} />)
    await fillAndSave(screen, '192.168.1.1:7070', 'some-key')

    expect(await screen.findByText(/Could not reach that server/)).toBeTruthy()
  })

  it('shows localhost-specific warning when URL contains localhost', async () => {
    mockFetch.mockRejectedValue(new TypeError('Network request failed'))

    const screen = await render(<ServerEditModal visible serverId={null} onClose={jest.fn()} />)
    await fillAndSave(screen, 'localhost:8766', 'some-key')

    expect(await screen.findByText(/localhost/)).toBeTruthy()
  })

  it('shows network error on 500 response (non-ok is treated as network error)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: jest.fn().mockResolvedValue({}) })

    const screen = await render(<ServerEditModal visible serverId={null} onClose={jest.fn()} />)
    await fillAndSave(screen, '192.168.1.1:7070', 'key')

    expect(await screen.findByText(/Could not reach that server/)).toBeTruthy()
  })
})

describe('ServerEditModal – API key visibility toggle', () => {
  it('toggles the API key field between hidden and shown', async () => {
    const screen = await render(<ServerEditModal visible serverId={null} onClose={jest.fn()} />)

    const keyInput = screen.getByTestId('server-edit-key-input')
    expect(keyInput.props.secureTextEntry).toBe(true)

    await fireEvent.press(screen.getByTestId('server-form-toggle-api-key'))
    expect(keyInput.props.secureTextEntry).toBe(false)

    await fireEvent.press(screen.getByTestId('server-form-toggle-api-key'))
    expect(keyInput.props.secureTextEntry).toBe(true)
  })
})
