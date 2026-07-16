/**
 * Anonymous, per-install identifier used ONLY for crash-report issue grouping
 * ("affected users" counts in Sentry).
 *
 * This is deliberately SEPARATE from `services/device-id.ts`
 * (`threadbase_device_client_id`), which is a network correlator sent to
 * streamers as `X-Client-Id`. Reusing that here would let Sentry correlate
 * crash reports with streamer traffic — so we mint an independent random UUID
 * under its own SecureStore key and never send anything else identifying.
 *
 * The value is not derived from device hardware, advertising identifiers, or
 * any credential. It is a random v4 UUID and nothing more.
 */

import * as SecureStore from './secure-store'
import { randomBytes } from 'tweetnacl'

const KEY = 'threadbase_sentry_install_id'

let cached: string | null = null

function generateUUID(): string {
  const b = randomBytes(16)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const hex = Array.from(b)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Resolve the anonymous install id, generating and persisting one on first use.
 * Never throws — on any SecureStore failure it returns a fresh in-memory UUID
 * so crash reporting still functions without a persistent id.
 */
export async function getSentryInstallId(): Promise<string> {
  if (cached) return cached
  try {
    const stored = await SecureStore.getItemAsync(KEY)
    if (stored) {
      cached = stored
      return stored
    }
    const id = generateUUID()
    await SecureStore.setItemAsync(KEY, id)
    cached = id
    return id
  } catch {
    const id = generateUUID()
    cached = id
    return id
  }
}

/**
 * Delete the persisted install id. Called when the user disables crash
 * reporting so no correlator lingers on the device.
 */
export async function clearSentryInstallId(): Promise<void> {
  cached = null
  try {
    await SecureStore.deleteItemAsync(KEY)
  } catch {
    // best-effort
  }
}
