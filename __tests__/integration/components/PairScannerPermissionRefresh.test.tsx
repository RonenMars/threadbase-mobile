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
import { ThemeProvider } from '@/contexts/ThemeContext'

const DENIED = { granted: false, canAskAgain: false, status: 'denied' }
const GRANTED = { granted: true, canAskAgain: true, status: 'granted' }

let mockOsPermission: { granted: boolean; canAskAgain: boolean; status: string } = DENIED

jest.mock('expo-camera', () => {
  const React = require('react')
  return {
    CameraView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('CameraView', null, children),
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
