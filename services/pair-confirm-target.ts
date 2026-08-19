/**
 * Builds the confirmation-gate model from a pairing result.
 *
 * The gate itself is presentational; this is the only place that decides
 * which kind a given credential is, so the deep-link and paste call sites
 * cannot drift.
 */
import { formatFingerprint } from '@/services/e2ee/fingerprint'
import { classifyPairCredential, parsePairUri } from '@/services/pair-exchange'
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
 * A proved `serverPublicKey` from the handshake wins; otherwise a pair URI's
 * own `spk` still selects the e2ee kind so a mocked/dev success with the
 * same QR still shows the fingerprint the user is meant to compare.
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
  if (classifyPairCredential(token) === 'pair-uri') {
    try {
      const parsed = parsePairUri(token)
      return pendingTargetFromExchange({
        url: parsed.url,
        machineName,
        serverPublicKey: parsed.spk ?? null,
      })
    } catch {
      // The paste exchange already succeeded; an unparsable token here is a
      // display fallback, not a reason to invent an api-key warning.
    }
  }
  return pendingTargetFromExchange({
    url: result.url,
    machineName,
    serverPublicKey: null,
  })
}
