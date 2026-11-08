/**
 * Builds the confirmation-gate model from a pairing result.
 *
 * The gate itself is presentational; this is the only place that decides
 * which kind a given credential is, so the deep-link and paste call sites
 * cannot drift.
 */
import { formatFingerprint } from '@/services/e2ee/fingerprint'
import { classifyPairCredential } from '@/services/pair-exchange'
import type { PendingPairTarget } from '@/components/pair/PairConfirmGate'

export function pendingTargetFromExchange(result: {
  url: string
  machineName: string | null
  serverPublicKey: string | null
}): PendingPairTarget {
  if (result.serverPublicKey) {
    return {
      kind: 'e2ee',
      machineName: result.machineName,
      url: result.url,
      fingerprint: formatFingerprint(result.serverPublicKey),
    }
  }
  return {
    kind: 'no-spk',
    machineName: result.machineName,
    url: result.url,
    fingerprint: null,
  }
}

export function pendingTargetFromApiKey(url: string): PendingPairTarget {
  return { kind: 'api-key', machineName: null, url, fingerprint: null }
}

/**
 * Paste path: a `threadbase://` URI, a bare `pt_` token, or a long-lived key.
 * Only a `serverPublicKey` the handshake proved selects the e2ee kind. A pair
 * URI's own `spk` is pasted text, so a result without a proved key (a mocked
 * dev success) is `no-spk` rather than a fingerprint nobody verified.
 */
export function pendingTargetFromPaste(
  token: string,
  result: { url: string; label?: string; serverPublicKey?: string | null },
): PendingPairTarget {
  if (classifyPairCredential(token) === 'api-key') {
    return pendingTargetFromApiKey(result.url)
  }
  const machineName = result.label ?? null
  if (result.serverPublicKey) {
    return pendingTargetFromExchange({
      url: result.url,
      machineName,
      serverPublicKey: result.serverPublicKey,
    })
  }
  return pendingTargetFromExchange({
    url: result.url,
    machineName,
    serverPublicKey: null,
  })
}
