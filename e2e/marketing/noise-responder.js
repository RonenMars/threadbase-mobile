'use strict'

// The server half of the app's Noise_IKpsk1 pairing handshake, enough for the
// demo streamer to reach the "encrypted" pair-confirm screen. A plain-JS port
// of test-utils/noise-responder.ts and the SymmetricState in
// services/e2ee/noise.ts — Node cannot load those TypeScript files. Only the
// handshake is here; the sealed REST/WS transport that follows it is not.

const { ChaCha20Poly1305 } = require('@stablelib/chacha20poly1305')
const { hmac } = require('@stablelib/hmac')
const { SHA256, hash: sha256 } = require('@stablelib/sha256')
const { generateKeyPairFromSeed, sharedKey } = require('@stablelib/x25519')

const NOISE_PROTOCOL_NAME = 'Noise_IKpsk1_25519_ChaChaPoly_SHA256'
const PAIR_PROLOGUE = Buffer.from('threadbase-e2ee/1 pair', 'utf8')
const PSK_LABEL = Buffer.from('threadbase-e2ee/1 psk', 'utf8')
const DIGEST_LENGTH = 32
const NONCE_LENGTH = 12
const PUBLIC_KEY_LENGTH = 32
const TAG_LENGTH = 16

const concat = (...parts) => Buffer.concat(parts.map((p) => Buffer.from(p)))
const dh = (secretKey, publicKey) => sharedKey(secretKey, publicKey, true)

function hkdf(ck, ikm) {
  const temp = hmac(SHA256, ck, ikm)
  const out1 = hmac(SHA256, temp, Uint8Array.of(1))
  const out2 = hmac(SHA256, temp, concat(out1, Uint8Array.of(2)))
  const out3 = hmac(SHA256, temp, concat(out2, Uint8Array.of(3)))
  return [out1, out2, out3]
}

// 4 zero bytes, then the counter as 64-bit little-endian (Noise §12.3).
function noiseNonce(counter) {
  const nonce = new Uint8Array(NONCE_LENGTH)
  let remaining = counter
  for (let i = 4; i < NONCE_LENGTH && remaining > 0; i++) {
    nonce[i] = remaining & 0xff
    remaining = Math.floor(remaining / 256)
  }
  return nonce
}

class SymmetricState {
  constructor(protocolName) {
    const name = Buffer.from(protocolName, 'ascii')
    if (name.length <= DIGEST_LENGTH) {
      this.h = new Uint8Array(DIGEST_LENGTH)
      this.h.set(name)
    } else {
      this.h = sha256(name)
    }
    this.ck = this.h
    this.k = null
    this.n = 0
  }

  mixHash(data) {
    this.h = sha256(concat(this.h, data))
  }

  mixKey(ikm) {
    const [ck, k] = hkdf(this.ck, ikm)
    this.ck = ck
    this.k = k
    this.n = 0
  }

  mixKeyAndHash(ikm) {
    const [ck, temp, k] = hkdf(this.ck, ikm)
    this.ck = ck
    this.mixHash(temp)
    this.k = k
    this.n = 0
  }

  encryptAndHash(plaintext) {
    const ciphertext = this.k
      ? new ChaCha20Poly1305(this.k).seal(noiseNonce(this.n++), plaintext, this.h)
      : plaintext
    this.mixHash(ciphertext)
    return ciphertext
  }

  decryptAndHash(ciphertext) {
    let plaintext = ciphertext
    if (this.k) {
      const opened = new ChaCha20Poly1305(this.k).open(noiseNonce(this.n), ciphertext, this.h)
      if (!opened) throw new Error('Noise: authentication failed')
      this.n++
      plaintext = opened
    }
    this.mixHash(ciphertext)
    return plaintext
  }
}

function derivePairPsk(pairToken) {
  return sha256(concat(PSK_LABEL, Buffer.from(pairToken, 'utf8')))
}

function serverPublicKey(serverStaticPrivate) {
  return generateKeyPairFromSeed(serverStaticPrivate).publicKey
}

function createNoiseResponder({ serverStaticPrivate, psk, ephemeralPrivate }) {
  const s = generateKeyPairFromSeed(serverStaticPrivate)
  const e = generateKeyPairFromSeed(ephemeralPrivate)
  const sym = new SymmetricState(NOISE_PROTOCOL_NAME)
  sym.mixHash(PAIR_PROLOGUE)
  sym.mixHash(s.publicKey)
  let re = new Uint8Array(0)
  let rs = new Uint8Array(0)

  return {
    readMessage1(message) {
      const encryptedStaticEnd = PUBLIC_KEY_LENGTH * 2 + TAG_LENGTH
      if (message.length < encryptedStaticEnd + TAG_LENGTH) throw new Error('Noise: message 1 is too short')
      re = message.subarray(0, PUBLIC_KEY_LENGTH)
      sym.mixHash(re)
      sym.mixKey(re)
      sym.mixKey(dh(s.secretKey, re))
      rs = sym.decryptAndHash(message.subarray(PUBLIC_KEY_LENGTH, encryptedStaticEnd))
      sym.mixKey(dh(s.secretKey, rs))
      sym.mixKeyAndHash(psk)
      return sym.decryptAndHash(message.subarray(encryptedStaticEnd))
    },

    writeMessage2(payload) {
      sym.mixHash(e.publicKey)
      sym.mixKey(e.publicKey)
      sym.mixKey(dh(e.secretKey, re))
      sym.mixKey(dh(e.secretKey, rs))
      return concat(e.publicKey, sym.encryptAndHash(payload))
    },
  }
}

module.exports = { createNoiseResponder, derivePairPsk, serverPublicKey }
