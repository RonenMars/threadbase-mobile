/**
 * The responder half of `Noise_IKpsk1_25519_ChaChaPoly_SHA256`, for tests only.
 *
 * The app is never the responder — the streamer is. This exists so the tamper
 * and PSK-binding tests have something that rejects, and it is written by the
 * same hand as the initiator, so it proves nothing about interoperability.
 * The committed vectors are what prove that.
 */
import { PUBLIC_KEY_LENGTH, generateKeyPairFromSeed, sharedKey } from '@stablelib/x25519'
import { NOISE_PROTOCOL_NAME, SymmetricState } from '@/services/e2ee/noise'

const TAG_LENGTH = 16
const ENCRYPTED_STATIC_LENGTH = PUBLIC_KEY_LENGTH + TAG_LENGTH

function dh(secretKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  return sharedKey(secretKey, publicKey, true)
}

export interface NoiseResponderConfig {
  serverStaticPrivate: Uint8Array
  psk: Uint8Array
  prologue: Uint8Array
  ephemeralPrivate: Uint8Array
}

export interface NoiseResponder {
  readMessage1(message: Uint8Array): Uint8Array
  writeMessage2(payload: Uint8Array): Uint8Array
  handshakeHash(): Uint8Array
  split(): [Uint8Array, Uint8Array]
}

export function createNoiseResponder(config: NoiseResponderConfig): NoiseResponder {
  const s = generateKeyPairFromSeed(config.serverStaticPrivate)
  const e = generateKeyPairFromSeed(config.ephemeralPrivate)
  const sym = new SymmetricState(NOISE_PROTOCOL_NAME)
  sym.mixHash(config.prologue)
  sym.mixHash(s.publicKey)

  let re: Uint8Array = new Uint8Array(0)
  let rs: Uint8Array = new Uint8Array(0)

  return {
    readMessage1(message: Uint8Array): Uint8Array {
      if (message.length < PUBLIC_KEY_LENGTH + ENCRYPTED_STATIC_LENGTH + TAG_LENGTH) {
        throw new Error('Noise: message 1 is too short')
      }
      // -> e, es, s, ss, psk
      re = message.subarray(0, PUBLIC_KEY_LENGTH)
      sym.mixHash(re)
      sym.mixKey(re)
      sym.mixKey(dh(s.secretKey, re))
      rs = sym.decryptAndHash(
        message.subarray(PUBLIC_KEY_LENGTH, PUBLIC_KEY_LENGTH + ENCRYPTED_STATIC_LENGTH),
      )
      sym.mixKey(dh(s.secretKey, rs))
      sym.mixKeyAndHash(config.psk)
      return sym.decryptAndHash(message.subarray(PUBLIC_KEY_LENGTH + ENCRYPTED_STATIC_LENGTH))
    },

    writeMessage2(payload: Uint8Array): Uint8Array {
      // <- e, ee, se
      sym.mixHash(e.publicKey)
      sym.mixKey(e.publicKey)
      sym.mixKey(dh(e.secretKey, re))
      sym.mixKey(dh(e.secretKey, rs))
      const ciphertext = sym.encryptAndHash(payload)
      const message = new Uint8Array(e.publicKey.length + ciphertext.length)
      message.set(e.publicKey)
      message.set(ciphertext, e.publicKey.length)
      return message
    },

    handshakeHash(): Uint8Array {
      return sym.h
    },

    split(): [Uint8Array, Uint8Array] {
      return sym.split()
    },
  }
}
