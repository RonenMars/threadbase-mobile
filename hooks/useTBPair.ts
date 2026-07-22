import { useCallback, useRef, useState } from 'react'
import { AuthError, NetworkError } from '@/services/api-client'
import {
  classifyPairCredential,
  exchangeToken,
  parsePairUri,
  PairExchangeError,
  PairUriError,
} from '@/services/pair-exchange'

export type PairLogKind = 'i' | 'd' | 'ok' | 'err'

export interface PairLogLine {
  k: PairLogKind
  t: string
}

export type PairPhase = 'idle' | 'dialing' | 'resolving' | 'handshake' | 'ok' | 'err'

export interface PairResult {
  url: string
  apiKey: string
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

async function resolveCredentials(url: string, token: string): Promise<PairResult> {
  const trimmedUrl = url.replace(/\/$/, '')
  const trimmedToken = token.trim()
  const kind = classifyPairCredential(trimmedToken)

  if (kind === 'pair-uri') {
    const parsed = parsePairUri(trimmedToken)
    const exchanged = await exchangeToken({ url: parsed.url, token: parsed.token })
    return { url: exchanged.url, apiKey: exchanged.apiKey }
  }

  if (kind === 'pair-token') {
    const exchanged = await exchangeToken({ url: trimmedUrl, token: trimmedToken })
    return { url: exchanged.url, apiKey: exchanged.apiKey }
  }

  // Long-lived API key (`tb_…`): Bearer-check /api/profiles.
  const res = await fetch(`${trimmedUrl}/api/profiles`, {
    headers: { Authorization: `Bearer ${trimmedToken}` },
  })
  if (res.status === 401) throw new AuthError()
  if (!res.ok) throw new NetworkError(`HTTP ${res.status}`)
  await res.json()
  return { url: trimmedUrl, apiKey: trimmedToken }
}

function messageForPairFailure(err: unknown): string {
  if (err instanceof PairUriError) {
    if (err.code === 'expired') return 'pair link expired · run tb pair again'
    if (err.code === 'bad-server-url') return 'invalid server URL in pair link'
    return 'invalid pair link · paste the threadbase:// URL from tb pair'
  }
  if (err instanceof PairExchangeError) {
    if (err.kind === 'token') return 'token rejected · run tb pair again'
    if (err.kind === 'rate-limited') return 'too many attempts · try again shortly'
    if (err.kind === 'network') return 'connection refused · is the server running?'
    if (err.kind === 'decrypt') return 'could not unseal api key'
    return 'exchange failed'
  }
  if (err instanceof AuthError) {
    return 'token rejected · check THREADBASE_API_KEY'
  }
  if (err instanceof NetworkError || err instanceof TypeError) {
    return 'connection refused · is the server running?'
  }
  return 'handshake failed'
}

// Mocks the handshake in dev; resolves pair tokens / URIs / API keys in prod.
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
          append({ k: 'i', t: `dial ${trimmedUrl || 'pair-uri'}` })
          setPhase('resolving')
        })
        schedule(SCHEDULE.resolve, () => {
          append({ k: 'd', t: 'mdns → 192.168.1.42:8766' })
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

      const dialTarget =
        classifyPairCredential(token) === 'pair-uri' ? 'pair-uri' : trimmedUrl

      schedule(SCHEDULE.dial, () => {
        append({ k: 'i', t: `dial ${dialTarget}` })
        setPhase('resolving')
      })

      ;(async () => {
        try {
          const kind = classifyPairCredential(token)
          if (kind === 'pair-uri' || kind === 'pair-token') {
            append({ k: 'd', t: 'exchanging pair token…' })
          }

          const result = await resolveCredentials(url, token)

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
            onSuccess?.(result)
          })
        } catch (err) {
          fail(messageForPairFailure(err))
        }
      })()
    },
    [append, fail, phase, reset],
  )

  return { phase, log, error, pair, reset }
}
