import { useEffect } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { useCameraPermissions } from 'expo-camera'

/**
 * `useCameraPermissions`, re-read whenever the app returns to the foreground.
 *
 * The underlying hook only updates its state when `requestPermission()` is
 * called. Sending the user to system Settings does not go through that path, so
 * a user who grants the permission and comes back finds the screen still
 * insisting it is denied — it is reading a value captured before they left.
 * Only unmounting and remounting cleared it, which is the workaround users find
 * for themselves: close the modal, reopen it.
 *
 * The fix is the third element of the tuple, which the call sites were dropping.
 * It is the NON-prompting getter: it re-reads the OS state and updates the hook
 * without ever showing a dialog, which is what makes it safe to call on every
 * foreground rather than only when something is known to have changed.
 *
 * Deliberately not gated on the permission being denied. Gating would skip the
 * case where the user revokes camera access while away and returns — the screen
 * would keep showing a live camera for a permission that no longer exists. An
 * unconditional re-read costs one cheap native call per foreground and is
 * correct in both directions.
 */
export function useLiveCameraPermissions() {
  const [permission, requestPermission, getPermission] = useCameraPermissions()

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') void getPermission()
    })
    return () => sub.remove()
  }, [getPermission])

  return [permission, requestPermission] as const
}
