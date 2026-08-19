import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { NetworkError } from '@/services/api-client'
import { authedFetch, AuthError } from '@/services/authed-fetch'
import {
  classifyPairCredential,
  exchangeToken,
  parsePairUri,
  PairExchangeError,
  PairUriError,
} from '@/services/pair-exchange'
import { resolvePairFailureMessage } from '@/services/pair-failure-message'
import { defaultPairDeviceName } from '@/services/pair-device-name'
import type { DeviceCapability } from '@/types/devices'

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
  deviceId?: string
  deviceToken?: string
  capabilities?: DeviceCapability[]
  /** Advertised public address of the server. Recorded, never used as `url`. */
  publicUrl?: string
  /** Server identity key proved by the pairing handshake. Absent on a plaintext pairing. */
  serverPublicKey?: string
  /** True when the pairing completed a Noise handshake — the client half of the downgrade lock. */
  requireEncryption?: boolean
}

interface PairOptions {
  url: string
  token: string
  onSuccess?: (result: PairResult) => void
  /** When true, request a read-only device credential from the streamer. */
  readOnly?: boolean
}

// Schedule per HANDOFF: 200/700/1100/1700ms; auto-advance 700ms after `paired`.
const SCHEDULE = {
  dial: 200,
  resolve: 700,
  handshake: 1100,
  paired: 1700,
  done: 2400,
}

function defaultDeviceName(): string {
  return defaultPairDeviceName()
}

async function resolveCredentials(
  url: string,
  token: string,
  readOnly = false,
): Promise<PairResult> {
  const trimmedUrl = url.replace(/\/$/, '')
  const trimmedToken = token.trim()
  const kind = classifyPairCredential(trimmedToken)
  const deviceName = defaultDeviceName()

  if (kind === 'pair-uri') {
    const parsed = parsePairUri(trimmedToken)
    const exchanged = await exchangeToken({
      url: parsed.url,
      token: parsed.token,
      deviceName,
      readOnly,
      serverPublicKey: parsed.spk,
    })
    return {
      url: exchanged.url,
      apiKey: exchanged.apiKey,
      label: exchanged.machineName ?? undefined,
      deviceId: exchanged.deviceId ?? undefined,
      deviceToken: exchanged.deviceToken ?? undefined,
      capabilities: exchanged.capabilities ?? undefined,
      publicUrl: exchanged.publicUrl ?? undefined,
      serverPublicKey: exchanged.serverPublicKey ?? undefined,
      requireEncryption: exchanged.e2eeRequired,
    }
  }

  if (kind === 'pair-token') {
    // A bare `pt_` token is typed or pasted, so it carries no server key and
    // this stays the plaintext path — there is no out-of-band channel to lose.
    const exchanged = await exchangeToken({
      url: trimmedUrl,
      token: trimmedToken,
      deviceName,
      readOnly,
    })
    return {
      url: exchanged.url,
      apiKey: exchanged.apiKey,
      label: exchanged.machineName ?? undefined,
      deviceId: exchanged.deviceId ?? undefined,
      deviceToken: exchanged.deviceToken ?? undefined,
      capabilities: exchanged.capabilities ?? undefined,
      publicUrl: exchanged.publicUrl ?? undefined,
      serverPublicKey: exchanged.serverPublicKey ?? undefined,
      requireEncryption: exchanged.e2eeRequired,
    }
  }

  // Long-lived API key (`tb_…`): Bearer-check /api/profiles.
  const res = await authedFetch({ url: trimmedUrl, apiKey: trimmedToken }, '/api/profiles')
  if (!res.ok) throw new NetworkError(`HTTP ${res.status}`)
  await res.json()
  return { url: trimmedUrl, apiKey: trimmedToken }
}

function messageForPairFailure(
  err: Error,
  tPair: TFunction<'pair'>,
  tCommon: TFunction<'common'>,
): string {
  if (err instanceof PairUriError || err instanceof PairExchangeError) {
    return resolvePairFailureMessage(err, tPair)
  }
  if (err instanceof AuthError) {
    return tCommon('error.authKeyRejectedOnConnect')
  }
  if (err instanceof NetworkError || err instanceof TypeError) {
    return tPair('scanner.errors.exchange.network')
  }
  return tPair('scanner.errors.generic')
}

// Mocks the handshake in dev; resolves pair tokens / URIs / API keys in prod.
export function useTBPair() {
  const { t: tPair } = useTranslation('pair')
  const { t: tCommon } = useTranslation('common')
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
    ({ url, token, onSuccess, readOnly }: PairOptions) => {
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

          const result = await resolveCredentials(url, token, readOnly === true)

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
          fail(messageForPairFailure(
            err instanceof Error ? err : new Error('handshake failed'),
            tPair,
            tCommon,
          ))
        }
      })()
    },
    [append, fail, phase, reset, tCommon, tPair],
  )

  return { phase, log, error, pair, reset }
}
