// The demo streamer's Noise responder (e2e/marketing/noise-responder.js) must
// agree with the real streamer: the committed vectors were produced by it, so
// reproducing message 2 byte for byte from the committed message 1 is the
// whole check.
const naclUtil = require('tweetnacl-util')
const { createNoiseResponder, derivePairPsk, serverPublicKey } = require('../../e2e/marketing/noise-responder')
const vectors = require('../fixtures/noise-ikpsk1-vectors.json')

const b64 = naclUtil.decodeBase64

describe('demo streamer Noise responder', () => {
  it('reads the committed message 1 and reproduces the committed message 2', () => {
    const server = createNoiseResponder({
      serverStaticPrivate: b64(vectors.keys.serverStaticPrivate),
      psk: b64(vectors.psk),
      ephemeralPrivate: b64(vectors.keys.serverEphemeralPrivate),
    })
    expect(naclUtil.encodeUTF8(server.readMessage1(b64(vectors.message1)))).toBe(vectors.payload1Utf8)
    expect(naclUtil.encodeBase64(server.writeMessage2(naclUtil.decodeUTF8(vectors.payload2Utf8)))).toBe(vectors.message2)
  })

  it('derives the committed PSK and the committed server public key', () => {
    expect(naclUtil.encodeBase64(derivePairPsk(vectors.pairToken))).toBe(vectors.psk)
    expect(naclUtil.encodeBase64(serverPublicKey(b64(vectors.keys.serverStaticPrivate)))).toBe(vectors.keys.serverStaticPublic)
  })
})
