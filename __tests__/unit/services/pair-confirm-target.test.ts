import { pendingTargetFromApiKey, pendingTargetFromExchange, pendingTargetFromPaste } from '@/services/pair-confirm-target'
import { formatFingerprint } from '@/services/e2ee/fingerprint'
import vectors from '@/__tests__/fixtures/noise-ikpsk1-vectors.json'

function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const SPK = toBase64Url(vectors.keys.serverStaticPublic)
const FINGERPRINT = vectors.fingerprintOfServerStaticPublic

describe('pendingTargetFromExchange', () => {
  it('is e2ee with a fingerprint when the handshake proved a server key', () => {
    expect(
      pendingTargetFromExchange({
        url: 'https://a.test',
        machineName: 'studio',
        serverPublicKey: SPK,
      }),
    ).toEqual({
      kind: 'e2ee',
      machineName: 'studio',
      url: 'https://a.test',
      fingerprint: FINGERPRINT,
    })
    expect(FINGERPRINT).toBe(formatFingerprint(SPK))
  })

  it('is no-spk with no fingerprint when the QR offered none', () => {
    expect(
      pendingTargetFromExchange({
        url: 'https://a.test',
        machineName: 'old',
        serverPublicKey: null,
      }),
    ).toEqual({
      kind: 'no-spk',
      machineName: 'old',
      url: 'https://a.test',
      fingerprint: null,
    })
  })
})

describe('pendingTargetFromApiKey', () => {
  it('is api-key with neither machine nor fingerprint', () => {
    expect(pendingTargetFromApiKey('https://a.test')).toEqual({
      kind: 'api-key',
      machineName: null,
      url: 'https://a.test',
      fingerprint: null,
    })
  })
})

describe('pendingTargetFromPaste', () => {
  it('treats a long-lived key as api-key even if a label is present', () => {
    expect(
      pendingTargetFromPaste('tb_df11da2b8b037fd61d82349d182a87b6', {
        url: 'https://a.test',
        label: 'ignored',
        serverPublicKey: SPK,
      }),
    ).toMatchObject({ kind: 'api-key', fingerprint: null })
  })

  it('uses the proved server key on a pair URI', () => {
    const token = `threadbase://pair?url=${encodeURIComponent('https://a.test')}&token=pt_x&spk=${SPK}`
    expect(pendingTargetFromPaste(token, { url: 'https://a.test', label: 'studio', serverPublicKey: SPK })).toEqual({
      kind: 'e2ee',
      machineName: 'studio',
      url: 'https://a.test',
      fingerprint: FINGERPRINT,
    })
  })

  it('is no-spk for a bare pair token with no server key', () => {
    expect(
      pendingTargetFromPaste('pt_abcdef0123456789', { url: 'https://a.test', label: 'studio' }),
    ).toMatchObject({ kind: 'no-spk', fingerprint: null, machineName: 'studio' })
  })
})
