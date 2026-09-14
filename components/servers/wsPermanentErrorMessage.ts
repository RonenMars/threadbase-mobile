import type { TFunction } from 'i18next'
import type { WsPermanentError } from '@/services/ws-client'

/**
 * Presentation helper for the one WS failure the UI currently names. Keep the
 * semantic value on the client; resolve the copy here so i18n keys stay
 * literal at the presentation boundary.
 */
export function wsPermanentErrorMessage(
  error: WsPermanentError | null,
  t: TFunction<'servers'>,
): string | null {
  if (error === null) return null
  switch (error) {
    case 'e2ee_protocol_mismatch':
      return t('error.e2eeProtocolMismatch')
  }
}

export function wsPermanentErrorStatusLabel(
  error: WsPermanentError,
  t: TFunction<'servers'>,
): string {
  switch (error) {
    case 'e2ee_protocol_mismatch':
      return t('status.e2eeProtocolMismatch')
  }
}
