import type { TFunction } from 'i18next'
import { PairExchangeError, PairUriError } from '@/services/pair-exchange'
import type { PairUriErrorCode } from '@/services/pair-exchange'

// Each key is written out rather than built as t(`scanner.errors.uri.${code}`),
// for two reasons. A static analyser cannot resolve an assembled key, so
// `i18next-cli status --unused` reports all fifteen as dead. And an assembled
// key that misses renders the key itself — a failed pairing would show the user
// "scanner.errors.exchange.e2ee-refused". Both maps are exhaustive over their
// union, so adding an error kind without copy is a compile error.
const URI_ERROR_KEYS = {
  invalid: 'scanner.errors.uri.invalid',
  expired: 'scanner.errors.uri.expired',
  'bad-server-url': 'scanner.errors.uri.bad-server-url',
  'bad-server-key': 'scanner.errors.uri.bad-server-key',
} as const satisfies Record<PairUriErrorCode, string>

const EXCHANGE_ERROR_KEYS = {
  network: 'scanner.errors.exchange.network',
  token: 'scanner.errors.exchange.token',
  'rate-limited': 'scanner.errors.exchange.rate-limited',
  decrypt: 'scanner.errors.exchange.decrypt',
  server: 'scanner.errors.exchange.server',
  cleartext: 'scanner.errors.exchange.cleartext',
  'e2ee-handshake': 'scanner.errors.exchange.e2ee-handshake',
  'e2ee-malformed': 'scanner.errors.exchange.e2ee-malformed',
  'e2ee-version': 'scanner.errors.exchange.e2ee-version',
  'e2ee-refused': 'scanner.errors.exchange.e2ee-refused',
  'e2ee-web-unsupported': 'scanner.errors.exchange.e2ee-web-unsupported',
} as const satisfies Record<PairExchangeError['kind'], string>

/** User-facing copy for a pairing failure. Same sentences on scan, deep link, and paste. */
export function resolvePairFailureMessage(err: Error, t: TFunction<'pair'>): string {
  // A streamer ahead of this build can send a code this app has never heard of;
  // fall through to the generic sentence rather than showing a raw key.
  if (err instanceof PairUriError) {
    return t(URI_ERROR_KEYS[err.code] ?? 'scanner.errors.generic')
  }
  if (err instanceof PairExchangeError) {
    return t(EXCHANGE_ERROR_KEYS[err.kind] ?? 'scanner.errors.generic')
  }
  return t('scanner.errors.generic')
}
