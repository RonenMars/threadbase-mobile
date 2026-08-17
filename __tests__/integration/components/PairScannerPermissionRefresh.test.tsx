// Returning from system Settings with the permission granted must update the
// scanner, without closing and reopening it.
//
// `useCameraPermissions` only refreshes its state when `requestPermission()` is
// called. "Open Settings" does not go through that path, so the modal kept
// rendering "Camera access is disabled" against a value captured before the
// user left — and the only way out was a remount, which is the workaround users
// find for themselves.
//
// The mock below deliberately mirrors the real hook's semantics rather than
// being convenient: `mockOsPermission` is the OS truth and can change at any time,
// while the hook's state only moves when the getter or the request runs. A mock
// that re-read `mockOsPermission` on every render would make this test pass with
// the fix reverted, since the staleness being fixed would not exist in it.

import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { act } from 'react'
import { AppState } from 'react-native'
import { PairScannerModal } from '@/components/pair/PairScannerModal'
import { PairExchangeError } from '@/services/pair-exchange'
import { ThemeProvider } from '@/contexts/ThemeContext'

jest.mock('@/services/pair-exchange', () => ({
  ...jest.requireActual('@/services/pair-exchange'),
  exchangeToken: jest.fn(),
}))

const exchangeToken = jest.requireMock('@/services/pair-exchange').exchangeToken as jest.Mock

const DENIED = { granted: false, canAskAgain: false, status: 'denied' }
const GRANTED = { granted: true, canAskAgain: true, status: 'granted' }

let mockOsPermission: { granted: boolean; canAskAgain: boolean; status: string } = DENIED

/** The scanner's barcode callback, captured so a test can deliver a QR to it. */
let mockScanHandler: ((event: { data: string }) => void) | null = null

jest.mock('expo-camera', () => {
  const React = require('react')
  return {
    CameraView: ({
      children,
      onBarcodeScanned,
    }: {
      children?: React.ReactNode
      onBarcodeScanned?: (event: { data: string }) => void
    }) => {
      mockScanHandler = onBarcodeScanned ?? null
      return React.createElement('CameraView', null, children)
    },
    useCameraPermissions: () => {
      const [held, setHeld] = React.useState(mockOsPermission)
      const getPermission = React.useCallback(async () => {
        setHeld(mockOsPermission)
        return mockOsPermission
      }, [])
      const requestPermission = React.useCallback(async () => {
        setHeld(mockOsPermission)
        return mockOsPermission
      }, [])
      return [held, requestPermission, getPermission]
    },
  }
})

let foreground: ((state: string) => void) | null = null

beforeEach(() => {
  mockOsPermission = DENIED
  foreground = null
  jest.spyOn(AppState, 'addEventListener').mockImplementation((type, handler) => {
    if (type === 'change') foreground = handler as (state: string) => void
    return { remove: jest.fn() } as ReturnType<typeof AppState.addEventListener>
  })
})

afterEach(() => {
  jest.restoreAllMocks()
})

async function renderScanner() {
  return await render(
    <ThemeProvider>
      <PairScannerModal visible onClose={jest.fn()} onSuccess={jest.fn()} />
    </ThemeProvider>,
  )
}

describe('PairScannerModal — permission granted in system Settings', () => {
  it('clears the denied state when the app returns to the foreground', async () => {
    const screen = await renderScanner()
    expect(screen.getByTestId('pair-scanner-open-settings')).toBeTruthy()

    // The user leaves, grants Camera in Settings, and comes back. Nothing in
    // the app called requestPermission, so only the OS truth has moved.
    mockOsPermission = GRANTED
    expect(foreground).toBeTruthy()
    await act(async () => {
      foreground?.('active')
    })

    // Same mounted modal — no close, no reopen.
    await waitFor(() =>
      expect(screen.queryByTestId('pair-scanner-open-settings')).toBeNull(),
    )
  })

  // The reverse direction is why the re-read is unconditional: gating it on
  // "currently denied" would leave a live camera running for a permission the
  // user has just taken away.
  it('restores the denied state when the permission is revoked while away', async () => {
    mockOsPermission = GRANTED
    const screen = await renderScanner()
    expect(screen.queryByTestId('pair-scanner-open-settings')).toBeNull()

    mockOsPermission = DENIED
    await act(async () => {
      foreground?.('active')
    })

    await waitFor(() => expect(screen.getByTestId('pair-scanner-open-settings')).toBeTruthy())
  })

  // Background/inactive transitions must not trigger a re-read; only 'active'.
  it('ignores non-active app state transitions', async () => {
    const screen = await renderScanner()
    mockOsPermission = GRANTED

    await act(async () => {
      foreground?.('background')
    })

    expect(screen.getByTestId('pair-scanner-open-settings')).toBeTruthy()
  })

  // The in-app path still works: this is the branch that was never broken, and
  // it must keep working after the hook was swapped underneath it.
  it('still clears the denied state via the in-app Allow button', async () => {
    mockOsPermission = { granted: false, canAskAgain: true, status: 'undetermined' }
    const screen = await renderScanner()

    mockOsPermission = GRANTED
    await act(async () => {
      fireEvent.press(screen.getByTestId('pair-scanner-allow-camera'))
    })

    await waitFor(() =>
      expect(screen.queryByTestId('pair-scanner-allow-camera')).toBeNull(),
    )
  })
})

// ── Which failures offer a retry, and which must not ────────────────────────
//
// The three refusal codes are distinct because their remedies are. Neither
// `E2EE_HANDSHAKE_FAILED` nor `E2EE_MALFORMED` spends the pair token, so the
// same QR is genuinely worth rescanning. `E2EE_VERSION_UNSUPPORTED` never is:
// retrying changes nothing, and offering "Try again" beside it spends the
// user's patience on an outcome that cannot move. The deliberate fallback it
// wants — a QR without `spk`, or the manual API-key path — is somewhere else,
// and none of these ever offers plaintext to this server instead.

describe('PairScannerModal — retry is offered only where it can help', () => {
  const PAIR_URI = 'threadbase://pair?url=https%3A%2F%2Fa.test&token=pt_x'

  async function scanFailingWith(kind: PairExchangeError['kind']) {
    mockOsPermission = GRANTED
    exchangeToken.mockRejectedValue(new PairExchangeError(kind, 'failed'))
    const screen = await renderScanner()

    await act(async () => {
      mockScanHandler?.({ data: PAIR_URI })
    })
    await waitFor(() => expect(screen.getByTestId('pair-scanner-support')).toBeTruthy())
    return screen
  }

  it.each<PairExchangeError['kind']>(['e2ee-handshake', 'e2ee-malformed'])(
    'offers a retry after %s, which does not spend the token',
    async (kind) => {
      const screen = await scanFailingWith(kind)
      expect(screen.getByTestId('pair-scanner-try-again')).toBeTruthy()
    },
  )

  it.each<PairExchangeError['kind']>([
    'e2ee-version',
    'e2ee-refused',
    'e2ee-web-unsupported',
  ])('offers no retry after %s, and no way to connect unencrypted', async (kind) => {
    const screen = await scanFailingWith(kind)
    expect(screen.queryByTestId('pair-scanner-try-again')).toBeNull()
    // The failure is still visible and still has no downgrade affordance —
    // a "connect anyway" button would be the downgrade wearing a consent dialog.
    expect(screen.getByTestId('pair-scanner-support')).toBeTruthy()
  })
})
