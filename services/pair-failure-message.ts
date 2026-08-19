import type { TFunction } from 'i18next'
import { PairExchangeError, PairUriError } from '@/services/pair-exchange'

/** User-facing copy for a pairing failure. Same sentences on scan, deep link, and paste. */
export function resolvePairFailureMessage(err: Error, t: TFunction<'pair'>): string {
  if (err instanceof PairUriError) {
    return t(`scanner.errors.uri.${err.code}`)
  }
  if (err instanceof PairExchangeError) {
    return t(`scanner.errors.exchange.${err.kind}`)
  }
  return t('scanner.errors.generic')
}
