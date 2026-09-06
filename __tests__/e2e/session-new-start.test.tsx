import React from 'react'
import { Alert, type AlertButton } from 'react-native'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import NewSessionScreen from '@/app/session/new'
import { ThemeProvider } from '@/contexts/ThemeContext'
import {
  markNavigatedToSession,
  suppressAutoNavForPendingStart,
  clearAutoNavSuppress,
} from '@/lib/sessionNavGuard'
import { NetworkError } from '@/services/api-client'

// /session/new owns the whole start-spawn lifecycle: suppress global auto-nav
// BEFORE the POST (session_ready can beat the HTTP response and we don't know
// the id yet), show a countdown against the request budget, replace to the
// session on success, and offer Retry/Cancel on failure.

const mockBack = jest.fn()
const mockReplace = jest.fn()
const mockStartMutate = jest.fn()
const mockParams: { current: Record<string, string> } = {
  current: { server: 'srv_alpha', path: 'work', projectName: 'work' },
}

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: mockBack, navigate: jest.fn() }),
  useLocalSearchParams: () => mockParams.current,
  useGlobalSearchParams: () => ({}),
  useSegments: () => [],
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
}))

jest.mock('@/lib/sessionNavGuard', () => ({
  markNavigatedToSession: jest.fn(),
  suppressAutoNavForPendingStart: jest.fn(),
  clearAutoNavSuppress: jest.fn(),
}))

jest.mock('@/hooks/useBrowse', () => ({
  START_SESSION_TIMEOUT_MS: 15_000,
  useStartSession: () => ({ mutate: mockStartMutate, isPending: false }),
}))

beforeEach(() => {
  mockBack.mockClear()
  mockReplace.mockClear()
  mockStartMutate.mockClear()
  mockParams.current = { server: 'srv_alpha', path: 'work', projectName: 'work' }
  ;(markNavigatedToSession as jest.Mock).mockClear()
  ;(suppressAutoNavForPendingStart as jest.Mock).mockClear()
  ;(clearAutoNavSuppress as jest.Mock).mockClear()
})

async function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return await render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <NewSessionScreen />
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

describe('/session/new start lifecycle', () => {
  it('suppresses auto-nav before firing the start request', async () => {
    const { getByText, getByTestId } = await renderScreen()

    expect(suppressAutoNavForPendingStart).toHaveBeenCalledTimes(1)
    expect(mockStartMutate).toHaveBeenCalledTimes(1)
    expect(
      (suppressAutoNavForPendingStart as jest.Mock).mock.invocationCallOrder[0],
    ).toBeLessThan(mockStartMutate.mock.invocationCallOrder[0])
    expect(mockStartMutate.mock.calls[0][0]).toEqual({ path: 'work', projectName: 'work' })
    // Countdown starts at the full request budget, with the waking-up robot
    // (moved here from the session screen) and its rotating phrase.
    expect(getByText('15s')).toBeTruthy()
    expect(getByTestId('waking-up-animation')).toBeTruthy()
    expect(getByText("I'm waking up, I'll be ready in a moment…")).toBeTruthy()
  })

  it('marks the guard then replaces to the session on a ready result', async () => {
    await renderScreen()

    const { onSuccess } = mockStartMutate.mock.calls[0][1]
    await act(async () => onSuccess({ kind: 'ready', session: { id: 'sess_1', projectId: 'proj_1' } }))

    expect(markNavigatedToSession).toHaveBeenCalledWith('sess_1')
    expect(mockReplace).toHaveBeenCalledTimes(1)
    expect(
      (markNavigatedToSession as jest.Mock).mock.invocationCallOrder[0],
    ).toBeLessThan(mockReplace.mock.invocationCallOrder[0])
    expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('/session/sess_1'))
  })

  it('routes a pending result to the exact-id pending screen', async () => {
    await renderScreen()

    const { onSuccess } = mockStartMutate.mock.calls[0][1]
    await act(async () => onSuccess({ kind: 'pending', id: 'sess_9' }))

    expect(markNavigatedToSession).toHaveBeenCalledWith('sess_9')
    const target = mockReplace.mock.calls[0][0] as string
    expect(target).toContain('/session/sess_9')
    expect(target).toContain('starting=1')
  })

  it('shows Retry/Cancel on failure; Retry re-suppresses and re-fires, Cancel goes back', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    await renderScreen()

    const { onError } = mockStartMutate.mock.calls[0][1]
    await act(async () => onError(new NetworkError('boom', 'TIMEOUT')))

    expect(clearAutoNavSuppress).toHaveBeenCalledTimes(1)
    expect(alertSpy).toHaveBeenCalledTimes(1)
    const buttons = (alertSpy.mock.calls[0][2] ?? []) as AlertButton[]

    // Retry: a fresh attempt suppresses again and re-fires the POST.
    await act(async () => buttons.find((b) => b.text === 'Retry')?.onPress?.())
    await waitFor(() => expect(mockStartMutate).toHaveBeenCalledTimes(2))
    expect(suppressAutoNavForPendingStart).toHaveBeenCalledTimes(2)

    // Cancel on the next failure: back to the hub, no further attempts.
    const { onError: onError2 } = mockStartMutate.mock.calls[1][1]
    await act(async () => onError2(new NetworkError('still down')))
    const buttons2 = (alertSpy.mock.calls[1][2] ?? []) as AlertButton[]
    await act(async () => buttons2.find((b) => b.text === 'Cancel')?.onPress?.())
    expect(mockBack).toHaveBeenCalledTimes(1)
    expect(mockStartMutate).toHaveBeenCalledTimes(2)

    alertSpy.mockRestore()
  })

  it('suppresses Retry when the provider CLI is not installed (#748)', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    await renderScreen()

    const { onError } = mockStartMutate.mock.calls[0][1]
    await act(async () => onError(new NetworkError('The claude command was not found on this server.', 'PROVIDER_NOT_INSTALLED')))

    const buttons = (alertSpy.mock.calls[0][2] ?? []) as AlertButton[]
    expect(buttons.some((b) => b.text === 'Retry')).toBe(false)
    expect(buttons.some((b) => b.text === 'Cancel')).toBe(true)

    alertSpy.mockRestore()
  })

  it('still offers Retry for an ordinary failure', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    await renderScreen()

    const { onError } = mockStartMutate.mock.calls[0][1]
    await act(async () => onError(new NetworkError('boom')))

    const buttons = (alertSpy.mock.calls[0][2] ?? []) as AlertButton[]
    expect(buttons.some((b) => b.text === 'Retry')).toBe(true)

    alertSpy.mockRestore()
  })

  it('still offers Retry on a TIMEOUT failure', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    await renderScreen()

    const { onError } = mockStartMutate.mock.calls[0][1]
    await act(async () => onError(new NetworkError('boom', 'TIMEOUT')))

    const buttons = (alertSpy.mock.calls[0][2] ?? []) as AlertButton[]
    expect(buttons.some((b) => b.text === 'Retry')).toBe(true)

    alertSpy.mockRestore()
  })

  it('cancel button under the countdown goes back to the hub', async () => {
    const { getByTestId } = await renderScreen()

    await fireEvent.press(getByTestId('start-cancel'))

    expect(mockBack).toHaveBeenCalledTimes(1)
  })
})
