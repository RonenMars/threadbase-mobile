import { useCallback, useRef, useState } from 'react'
import { AuthError, NetworkError } from '@/services/api-client'

export type PairLogKind = 'i' | 'd' | 'ok' | 'err'

export interface PairLogLine {
  k: PairLogKind
  t: string
}

export type PairPhase = 'idle' | 'dialing' | 'resolving' | 'handshake' | 'ok' | 'err'

export interface PairResult {
  url: string
  apiKey: string
  /** Optional display name (user-entered or machine name from pair exchange). */
  label?: string
}

interface PairOptions {
  url: string
  token: string
  onSuccess?: (result: PairResult) => void
}

// Schedule per HANDOFF: 200/700/1100/1700ms; auto-advance 700ms after `paired`.
const SCHEDULE = {
  dial: 200,
  resolve: 700,
  handshake: 1100,
  paired: 1700,
  done: 2400,
}

// Mocks the handshake in dev; calls a real /api/profiles auth check in prod.
export function useTBPair() {
  const [phase, setPhase] = useState<PairPhase>('idle')
  const [log, setLog] = useState<PairLogLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const append = useCallback((line: PairLogLine) => {
    setLog((prev) => [...prev, line])
  }, [])

  const reset = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setPhase('idle')
    setLog([])
    setError(null)
  }, [])

  const fail = useCallback((message: string) => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    append({ k: 'err', t: message })
    setPhase('err')
    setError(message)
  }, [append])

  const pair = useCallback(
    ({ url, token, onSuccess }: PairOptions) => {
      if (phase !== 'idle' && phase !== 'err') return
      reset()
      setPhase('dialing')

      const schedule = (ms: number, fn: () => void) => {
        const id = setTimeout(fn, ms)
        timersRef.current.push(id)
      }

      const trimmedUrl = url.replace(/\/$/, '')
      const finishMockSequence = () => {
        schedule(SCHEDULE.dial, () => {
          append({ k: 'i', t: `dial ${trimmedUrl}` })
          setPhase('resolving')
        })
        schedule(SCHEDULE.resolve, () => {
          append({ k: 'd', t: 'mdns → 192.168.1.42:7331' })
          setPhase('handshake')
        })
        schedule(SCHEDULE.handshake, () => {
          append({ k: 'd', t: 'tls 1.3 · cert ok · token verifying…' })
        })
        schedule(SCHEDULE.paired, () => {
          append({ k: 'ok', t: 'paired as iphone-15.local' })
          setPhase('ok')
        })
        schedule(SCHEDULE.done, () => {
          onSuccess?.({ url: trimmedUrl, apiKey: token })
        })
      }

      if (__DEV__) {
        finishMockSequence()
        return
      }

      // Prod: real auth check against the server before advancing.
      schedule(SCHEDULE.dial, () => {
        append({ k: 'i', t: `dial ${trimmedUrl}` })
        setPhase('resolving')
      })

      ;(async () => {
        try {
          const res = await fetch(`${trimmedUrl}/api/profiles`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.status === 401) throw new AuthError()
          if (!res.ok) throw new NetworkError(`HTTP ${res.status}`)
          await res.json()

          schedule(SCHEDULE.resolve - SCHEDULE.dial, () => {
            append({ k: 'd', t: 'mdns → handshake' })
            setPhase('handshake')
          })
          schedule(SCHEDULE.handshake - SCHEDULE.dial, () => {
            append({ k: 'd', t: 'tls 1.3 · cert ok · token verifying…' })
          })
          schedule(SCHEDULE.paired - SCHEDULE.dial, () => {
            append({ k: 'ok', t: 'paired' })
            setPhase('ok')
          })
          schedule(SCHEDULE.done - SCHEDULE.dial, () => {
            onSuccess?.({ url: trimmedUrl, apiKey: token })
          })
        } catch (err) {
          if (err instanceof AuthError) {
            fail('token rejected · check THREADBASE_API_KEY')
          } else if (err instanceof NetworkError || err instanceof TypeError) {
            fail('connection refused · is the server running?')
          } else {
            fail('handshake failed')
          }
        }
      })()
    },
    [append, fail, phase, reset],
  )

  return { phase, log, error, pair, reset }
}
