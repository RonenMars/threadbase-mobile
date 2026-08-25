import type { TFunction } from 'i18next'
import { PairExchangeError, PairUriError } from '@/services/pair-exchange'

function resolveUnknownPairFailure(value: never, t: TFunction<'pair'>): string {
  // Runtime payloads can be ahead of this client even though known local variants are exhaustive.
  void value
  return t('scanner.errors.generic')
}

/** User-facing copy for a pairing failure. Same sentences on scan, deep link, and paste. */
export function resolvePairFailureMessage(err: Error, t: TFunction<'pair'>): string {
  // A streamer ahead of this build can send a code this app has never heard of;
  // fall through to the generic sentence rather than showing a raw key.
  if (err instanceof PairUriError) {
    switch (err.code) {
      case 'invalid':
        return t('scanner.errors.uri.invalid')
      case 'expired':
        return t('scanner.errors.uri.expired')
      case 'bad-server-url':
        return t('scanner.errors.uri.bad-server-url')
      case 'bad-server-key':
        return t('scanner.errors.uri.bad-server-key')
      default:
        return resolveUnknownPairFailure(err.code, t)
    }
  }
  if (err instanceof PairExchangeError) {
    switch (err.kind) {
      case 'network':
        return t('scanner.errors.exchange.network')
      case 'token':
        return t('scanner.errors.exchange.token')
      case 'rate-limited':
        return t('scanner.errors.exchange.rate-limited')
      case 'decrypt':
        return t('scanner.errors.exchange.decrypt')
      case 'server':
        return t('scanner.errors.exchange.server')
      case 'cleartext':
        return t('scanner.errors.exchange.cleartext')
      case 'e2ee-handshake':
        return t('scanner.errors.exchange.e2ee-handshake')
      case 'e2ee-malformed':
        return t('scanner.errors.exchange.e2ee-malformed')
      case 'e2ee-version':
        return t('scanner.errors.exchange.e2ee-version')
      case 'e2ee-refused':
        return t('scanner.errors.exchange.e2ee-refused')
      case 'e2ee-web-unsupported':
        return t('scanner.errors.exchange.e2ee-web-unsupported')
      default:
        return resolveUnknownPairFailure(err.kind, t)
    }
  }
  return t('scanner.errors.generic')
}
