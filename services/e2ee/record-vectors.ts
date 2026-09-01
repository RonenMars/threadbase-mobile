/**
 * The shape of the streamer's E2EE record vectors, declared once for tests.
 */
export interface RecordTarget {
  method?: string
  path?: string
  query?: string
  hash: string
}

export interface RecordVector {
  name: string
  key: string
  direction: number
  channel: number
  counter: string
  nonce?: string
  aad?: string
  plaintextUtf8: string
  ciphertext?: string
  frame: string
  target?: RecordTarget
}

export interface NegativeCase {
  name: string
  why?: string
  frame: string
  expect: string
  key?: string
  direction?: number
  channel?: number
  counter?: string
  target?: RecordTarget
}

export interface OpenVector {
  protocolName: string
  prologueUtf8: string
  psk: null
  keys: {
    serverStaticPrivate: string
    serverStaticPublic: string
    clientStaticPrivate: string
    clientStaticPublic: string
    clientEphemeralPrivate: string
    serverEphemeralPrivate: string
  }
  payload1Utf8: string
  payload2Utf8: string
  message1: string
  message2: string
  handshakeHash: string
  clientToServerKey: string
  serverToClientKey: string
  pairingMessage1RejectedHere: { message1: string; expect: string }
}

export interface RecordVectors {
  $provenance: string
  $comment: string
  version: number
  ctxId: string
  ctxIdBase64Url: string
  clientToServerKey: string
  serverToClientKey: string
  records: RecordVector[]
  negative: { base: RecordVector; cases: NegativeCase[] }
  restResponse: {
    key: string
    direction: number
    channel: number
    requestCounter: string
    target: RecordTarget
    plaintextUtf8: string
    frame: string
  }
  open: OpenVector
  restTargetCanonicalization: {
    hashInputUtf8: string
    decodedPathMustDiffer: { path: string; hash: string }
  }
}
