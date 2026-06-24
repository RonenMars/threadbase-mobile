import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import { useSettingsStore } from '@/stores/settings'

const GRACE_PERIOD_MS = 10_000

export function useBiometricLock() {
  const biometricLock = useSettingsStore((s) => s.biometricLock)
  // null = not yet determined; true = locked; false = unlocked
  const [locked, setLocked] = useState<boolean | null>(null)
  const authenticatingRef = useRef(false)
  const backgroundAt = useRef<number | null>(null)

  const authenticate = useCallback(async () => {
    if (authenticatingRef.current) return
    authenticatingRef.current = true
    try {
      const enrolled = await LocalAuthentication.isEnrolledAsync()
      if (!enrolled) {
        setLocked(false)
        return
      }
      setLocked(true)
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Threadbase',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      })
      if (result.success) {
        setLocked(false)
      }
    } finally {
      authenticatingRef.current = false
    }
  }, [])

  // Trigger on mount and when biometricLock is toggled on.
  // authenticate is stable (no deps); calling it in a timeout keeps it
  // out of the synchronous effect body, satisfying react-hooks/set-state-in-effect.
  useEffect(() => {
    if (!biometricLock) return
    const id = setTimeout(() => { void authenticate() }, 0)
    return () => clearTimeout(id)
  }, [biometricLock, authenticate])

  useEffect(() => {
    if (!biometricLock) return

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        backgroundAt.current = Date.now()
      } else if (state === 'active') {
        const elapsed = backgroundAt.current ? Date.now() - backgroundAt.current : Infinity
        backgroundAt.current = null
        if (elapsed > GRACE_PERIOD_MS) {
          void authenticate()
        }
      }
    })
    return () => sub.remove()
  }, [biometricLock, authenticate])

  const isLocked = biometricLock && locked !== false

  return { locked: isLocked, authenticate }
}
