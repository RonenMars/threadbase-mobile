import i18n from '@/test-utils/i18n-setup'
import { PairExchangeError, PairUriError } from '@/services/pair-exchange'
import { resolvePairFailureMessage } from '@/services/pair-failure-message'

const t = i18n.getFixedT('en', 'pair')

describe('resolvePairFailureMessage', () => {
  it('maps URI failures onto scanner.errors.uri', () => {
    expect(resolvePairFailureMessage(new PairUriError('expired', 'Pair QR expired'), t)).toBe(
      'This pair QR has expired. Run tb-streamer pair on your server again.',
    )
    expect(resolvePairFailureMessage(new PairUriError('invalid', 'Not a URL'), t)).toBe(
      "That QR doesn't look like a Threadbase pair code.",
    )
  })

  it('maps exchange failures onto scanner.errors.exchange', () => {
    expect(
      resolvePairFailureMessage(new PairExchangeError('e2ee-version', 'failed'), t),
    ).toBe(
      'This server encrypts pairing in a version this app does not speak. Update the app and the streamer to matching versions.',
    )
  })

  it('falls back to the generic pairing sentence', () => {
    expect(resolvePairFailureMessage(new TypeError('Network request failed'), t)).toBe(
      'Pairing failed.',
    )
  })
})
