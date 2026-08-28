import nacl from 'tweetnacl'
import naclUtil from 'tweetnacl-util'
import { parseCapabilityList, type DeviceCapability } from '@/types/devices'
import { E2EE_CLIENT_VERSION, serverIdFromUrl } from '@/types/api'
import { CleartextBlockedError, isCleartextAllowed } from '@/services/cleartext-policy'
import { HAS_SECURE_KEYCHAIN } from '@/services/secure-store'
import { beginPairHandshake, pairMessage1Payload } from '@/services/e2ee/pair-handshake'
import type { NoiseInitiator } from '@/services/e2ee/noise'

export interface PairUri {
  url: string
  token: string
  exp?: number
  /**
   * The server's long-term X25519 public key, unpadded base64url.
   *
   * The QR is the only out-of-band channel in pairing, so this is the one value
   * a man in the middle cannot substitute. The URL, `/api/info` and the exchange
   * reply's ephemeral key all cross the network before any encryption exists.
   *
   * Absent forever remains valid: a streamer that predates the field, or has the
   * handshake disabled, emits no `spk`, and that stays an ordinary successful
   * plaintext pairing. Present means this pairing must encrypt — `parsePairUri`
   * has already rejected a value that is present and unusable.
   */
  spk?: string
  /** QR payload format version. Absent on older streamers. Not a capability signal — see `parsePairUri`. */
  v?: number
}

export interface ExchangeResult {
  /**
   * The address the user typed or scanned, normalised. Never the server's
   * `publicUrl` — see the comment at the return site for why substitution was
   * removed.
   */
  url: string
  /**
   * The credential to present as `Authorization: Bearer`.
   *
   * On a legacy pairing this is the shared owner key from the sealed box. On an
   * encrypted pairing it is the authenticated **device token** (§4.1) — the
   * sealed box is a compatibility field a new client does not read, so its
   * contents never become this device's credential.
   */
  apiKey: string
  /**
   * What the server advertises as its public address, recorded and **not
   * applied**. Stored on the server record so a future feature can offer it as
   * an alternative route; nothing reads it today. Whether it is ever used, and
   * on what terms, is RonenMars/threadbase-mobile#722.
   */
  publicUrl: string | null
  machineName: string | null
  /** Per-device id minted at exchange (C5). Absent on older streamers. */
  deviceId: string | null
  /** Scoped credential — store only in SecureStore; never display. */
  deviceToken: string | null
  capabilities: DeviceCapability[] | null
  /**
   * The server's long-term X25519 public key, exactly as the QR carried it
   * (unpadded base64url), and only once the Noise handshake proved the
   * responder holds the matching private half.
   *
   * `null` on a plaintext pairing. A key nobody has proved possession of is not
   * something to pin, so an unverified one must never reach the server record.
   */
  serverPublicKey: string | null
  /**
   * True when this pairing completed a Noise handshake and the server recorded
   * it on its side. This is the client half of the downgrade lock (design.md
   * §6.3): once set, this device never speaks plaintext to that server again.
   */
  e2eeRequired: boolean
}

export type PairUriErrorCode = 'invalid' | 'expired' | 'bad-server-url' | 'bad-server-key'

/** How a pasted manual-entry credential should be resolved. */
export type PairCredentialKind = 'pair-uri' | 'pair-token' | 'api-key'

export class PairUriError extends Error {
  readonly code: PairUriErrorCode
  constructor(code: PairUriErrorCode, message: string) {
    super(message)
    this.name = 'PairUriError'
    this.code = code
  }
}

/** Classify a pasted token / URI for the manual onboarding pair path. */
export function classifyPairCredential(raw: string): PairCredentialKind {
  const trimmed = raw.trim()
  if (trimmed.startsWith('threadbase:')) return 'pair-uri'
  // Short-lived tokens from `tb-streamer pair` / `/api/pair/start` (`pt_<hex>`).
  if (trimmed.startsWith('pt_')) return 'pair-token'
  return 'api-key'
}

/**
 * The three `e2ee-*` kinds are deliberately not one kind, because the remedies
 * differ and none of them spends the pair token:
 *
 * - `e2ee-handshake` — the server could not authenticate our message 1, or we
 *   could not authenticate its message 2. Retrying with the same QR is
 *   legitimate; it is also what a man in the middle produces, so it is never a
 *   reason to pair in plaintext instead.
 * - `e2ee-malformed` — one side sent an `e2ee` field the other could not parse.
 *   Also retryable with the same QR.
 * - `e2ee-version` — the two builds do not speak the same envelope version.
 *   Retrying changes nothing; this is the one case where falling back is a
 *   deliberate decision rather than a failure, and it belongs to the caller.
 *
 * Two more are not refusals the server names, and both are hard failures with
 * no plaintext road out of them:
 *
 * - `e2ee-refused` — message 1 went out and the reply carried no message 2. The
 *   exchange did happen, so unlike the three above this one has probably spent
 *   the token; retrying wants a fresh QR.
 * - `e2ee-web-unsupported` — this build cannot hold a device key on this
 *   platform, so it declines before writing one rather than after.
 */
export class PairExchangeError extends Error {
  readonly kind:
    | 'network'
    | 'token'
    | 'rate-limited'
    | 'decrypt'
    | 'server'
    | 'cleartext'
    | 'e2ee-handshake'
    | 'e2ee-malformed'
    | 'e2ee-version'
    | 'e2ee-refused'
    | 'e2ee-web-unsupported'
  constructor(kind: PairExchangeError['kind'], message: string) {
    super(message)
    this.name = 'PairExchangeError'
    this.kind = kind
  }
}

/**
 * Failures where retrying this same pairing code cannot change the outcome.
 *
 * Scanner "Try again" goes back to the camera; deep-link "Try again" retries
 * the same URI. Neither helps for these three, and offering the button invites
 * burning attempts (or patience) on a result that cannot move. The deliberate
 * fallback — a QR without `spk`, or the manual API-key path — is somewhere else.
 */
const NON_RETRYABLE_EXCHANGE_KINDS: ReadonlySet<PairExchangeError['kind']> = new Set([
  'e2ee-version',
  'e2ee-refused',
  'e2ee-web-unsupported',
])

export function isRetryablePairFailure(err: PairExchangeError): boolean {
  return !NON_RETRYABLE_EXCHANGE_KINDS.has(err.kind)
}

/** `{ error, code }` refusals from the streamer's `handlePairExchange`, by code. */
const E2EE_REFUSAL_KINDS: Record<string, PairExchangeError['kind']> = {
  E2EE_HANDSHAKE_FAILED: 'e2ee-handshake',
  E2EE_MALFORMED: 'e2ee-malformed',
  E2EE_VERSION_UNSUPPORTED: 'e2ee-version',
}

const PAIR_EXCHANGE_TIMEOUT_MS = 15_000

/** 32 bytes of X25519 public key, unpadded base64url. */
const SERVER_PUBLIC_KEY_SHAPE = /^[A-Za-z0-9_-]{43}$/

export function parsePairUri(raw: string): PairUri {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new PairUriError('invalid', 'Not a URL')
  }
  if (parsed.protocol !== 'threadbase:') {
    throw new PairUriError('invalid', `Unexpected scheme: ${parsed.protocol}`)
  }
  if (parsed.host !== 'pair' && parsed.pathname.replace(/^\/+/, '') !== 'pair') {
    throw new PairUriError('invalid', 'Expected threadbase://pair?...')
  }
  const url = parsed.searchParams.get('url')
  const token = parsed.searchParams.get('token')
  if (!url || !token) {
    throw new PairUriError('invalid', 'Missing url or token in pair URI')
  }
  assertHttpServerUrl(url)
  const expRaw = parsed.searchParams.get('exp')
  const exp = expRaw ? Number.parseInt(expRaw, 10) : undefined
  const parsedExp = Number.isFinite(exp) ? (exp as number) : undefined
  assertNotExpired(parsedExp)
  // Absent and present-but-invalid are different answers and must stay so.
  // Absent means a streamer that offers no key, which is the legacy path. A
  // wrong-shaped one is a hard error: dropping it to `undefined` would select
  // that same legacy path, making a plaintext downgrade reachable by corrupting
  // one QR parameter (mobile-design §3.2).
  const spkRaw = parsed.searchParams.get('spk')
  if (spkRaw !== null && !SERVER_PUBLIC_KEY_SHAPE.test(spkRaw)) {
    throw new PairUriError('bad-server-key', 'Server key in pair QR is malformed')
  }
  const spk = spkRaw ?? undefined
  // Format version of the QR, and deliberately not a capability signal: `spk` is
  // the only thing that selects a path. Branching on `v` to decide whether to
  // demand encryption would be downgradable by editing one character, so a
  // wrong-shaped `v` is dropped rather than being made a second gate.
  const vRaw = parsed.searchParams.get('v')
  const vParsed = vRaw ? Number.parseInt(vRaw, 10) : undefined
  const v = Number.isFinite(vParsed) ? vParsed : undefined
  return { url, token, exp: parsedExp, spk, v }
}

function assertHttpServerUrl(raw: string): void {
  let server: URL
  try {
    server = new URL(raw)
  } catch {
    throw new PairUriError('bad-server-url', 'Invalid server URL in pair QR')
  }
  if (server.protocol !== 'http:' && server.protocol !== 'https:') {
    throw new PairUriError('bad-server-url', 'Server URL must use http or https')
  }
}

function assertNotExpired(exp?: number): void {
  if (exp != null && Date.now() / 1000 > exp) {
    throw new PairUriError('expired', 'Pair QR expired')
  }
}

export async function exchangeToken({
  url,
  token,
  deviceName,
  readOnly = false,
  serverPublicKey,
}: {
  url: string
  token: string
  deviceName?: string
  readOnly?: boolean
  /**
   * The scanned QR's `spk`. Its presence is the whole capability gate for
   * pairing: `GET /api/info` is authenticated and this is the request that
   * mints the credential, so the QR is the only thing that can say whether the
   * server speaks E2EE before a credential exists.
   */
  serverPublicKey?: string
}): Promise<ExchangeResult> {
  assertHttpServerUrl(url)
  const trimmedUrl = url.replace(/\/$/, '')
  const recipient = nacl.box.keyPair()
  const clientPublicKey = naclUtil.encodeBase64(recipient.publicKey)

  // Before `beginPairHandshake`, so nothing is written anywhere: on web the
  // store is `localStorage`, which any script that achieves XSS on the origin
  // can read, and a device static key is not a value to keep there. Refusing is
  // the whole remedy — there is deliberately no plaintext retry of this same
  // exchange (mobile-design §5.2). A QR with no `spk` never reaches here.
  if (serverPublicKey && !HAS_SECURE_KEYCHAIN) {
    throw new PairExchangeError(
      'e2ee-web-unsupported',
      'Encrypted pairing needs the Threadbase app for iOS or Android',
    )
  }

  // Before the timeout starts, because it writes this device's static key to
  // the Keychain and that write is not part of the request's budget.
  let started: Awaited<ReturnType<typeof beginPairHandshake>>
  try {
    started = await beginPairHandshake({
      serverId: serverIdFromUrl(trimmedUrl),
      serverPublicKey,
      pairToken: token,
    })
  } catch (err) {
    // Includes a `spk` that is present but unusable. mobile-design §3.2: a
    // corrupted QR parameter must not be a route back to plaintext.
    const message = err instanceof Error ? err.message : 'Could not start the encrypted pairing'
    throw new PairExchangeError('e2ee-malformed', message)
  }

  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), PAIR_EXCHANGE_TIMEOUT_MS)

  const bodyPayload: {
    token: string
    clientPublicKey: string
    deviceName?: string
    readOnly?: boolean
    e2ee?: { v: number; noise: string }
  } = { token, clientPublicKey }
  // One normalisation, used by both copies, so the authenticated payload and the
  // compatibility field can never describe the device differently.
  const trimmedDeviceName = deviceName?.trim() ? deviceName.trim().slice(0, 100) : undefined
  if (trimmedDeviceName) bodyPayload.deviceName = trimmedDeviceName
  if (readOnly) bodyPayload.readOnly = true
  // Additive and last, so a pairing with no server key serialises byte for byte
  // as it does today — which is the whole of the old-server compatibility story.
  if (started.ok) {
    // The authenticated copy of the same two values. The outer ones above stay
    // for released servers and stop being what a new server believes.
    const message1Payload = naclUtil.decodeUTF8(
      pairMessage1Payload({ deviceName: trimmedDeviceName, readOnly }),
    )
    let message1: Uint8Array
    // Only the Diffie-Hellman is inside the `try`, and deliberately so: a
    // `catch` around the whole expression would report a future bug in the
    // payload encoding to the user as "your QR is damaged", which is this same
    // misclassification pointing the other way.
    try {
      message1 = started.handshake.writeMessage1(message1Payload)
    } catch {
      // The first curve operation on the scanned key happens here, not in
      // `beginPairHandshake`: decoding checks length and alphabet, and the
      // Diffie-Hellman that would reject an unusable point is deferred until
      // message 1 is built. So a key of 43 valid base64url characters that is
      // not a point on the curve passes `parsePairUri`, passes
      // `decodeServerStaticKey`, and only fails here.
      //
      // Untranslated `Error: X25519: invalid shared key` used to escape from
      // this line — outside every `catch` in this function — so both entry
      // paths classified it as unknown, rendered the generic sentence and
      // offered "Try again" on a QR that can never succeed.
      //
      // `bad-server-key` and not an exchange kind, because this is the same
      // fact `parsePairUri` reports for a wrong-length key: the pairing code's
      // server key is unusable, permanently. Nothing about retrying or about
      // the network changes it, and the two must not look different to the
      // user for being caught one function apart.
      clearTimeout(timeoutId)
      throw new PairUriError('bad-server-key', 'Server key in pair QR is not a usable public key')
    }
    bodyPayload.e2ee = { v: E2EE_CLIENT_VERSION, noise: naclUtil.encodeBase64(message1) }
  }

  // Its own fetch rather than authedFetch's: there is no credential to present
  // until this call returns one. So the cleartext policy has to be applied here
  // too — this is the request #727 was filed about.
  const exchangeUrl = `${trimmedUrl}/api/pair/exchange`
  if (!isCleartextAllowed(exchangeUrl)) {
    clearTimeout(timeoutId)
    throw new PairExchangeError('cleartext', new CleartextBlockedError(exchangeUrl).message)
  }

  let res: Response
  try {
    res = await fetch(exchangeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: timeoutController.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new PairExchangeError('network', 'Request timed out')
    }
    const message = err instanceof Error ? err.message : 'Network error'
    throw new PairExchangeError('network', message)
  } finally {
    clearTimeout(timeoutId)
  }

  if (res.status === 429) {
    throw new PairExchangeError('rate-limited', 'Too many attempts; try again in a minute')
  }
  if (res.status === 401) {
    const body = await safeJson(res)
    throw new PairExchangeError('token', body?.error ?? 'Pair token rejected')
  }
  // The streamer refuses a bad `e2ee` field with 400 and a code, and spends no
  // token doing it. Anything else with a 400 keeps today's message.
  if (res.status === 400) {
    const body = await safeJson(res)
    const refusal = body?.code ? E2EE_REFUSAL_KINDS[body.code] : undefined
    if (refusal) {
      throw new PairExchangeError(refusal, body?.error ?? 'Server refused the encrypted pairing')
    }
    throw new PairExchangeError('server', `Server returned ${res.status}`)
  }
  if (!res.ok) {
    throw new PairExchangeError('server', `Server returned ${res.status}`)
  }

  const body = await safeJson(res)

  // ── The E2EE path reads nothing from the outer envelope ────────────────────
  //
  // Every field beside `e2ee` exists for released clients that cannot read
  // message 2, and not one of them is authenticated — an active attacker
  // rewrites all of them for free, including the sealed api key, whose seal
  // uses a server-side ephemeral key nothing here can verify. Message 2 is the
  // only part of this response the handshake proves, so on this path it is the
  // only part read. Reading an outer copy "as a fallback" is what would let the
  // unauthenticated value win.
  if (started.ok) {
    const reply = readPairHandshakeReply(started.handshake, body?.e2ee)
    return {
      url: trimmedUrl,
      // The authenticated device credential, which is what §4.1 puts in
      // `Authorization` on an encrypted pairing. The streamer resolves device
      // tokens ahead of the shared key on both the header and the `?key=`
      // query param, so this authenticates everywhere the shared key did.
      apiKey: reply.deviceToken,
      publicUrl: reply.publicUrl,
      machineName: reply.machineName,
      deviceId: reply.deviceId,
      deviceToken: reply.deviceToken,
      capabilities: reply.capabilities,
      serverPublicKey: serverPublicKey ?? null,
      e2eeRequired: true,
    }
  }

  // ── The legacy path, byte-identical to a build that never had a handshake ──

  if (!body?.ciphertext || !body.nonce || !body.ephemeralPublicKey) {
    throw new PairExchangeError('server', 'Server response missing sealed payload')
  }

  let plain: Uint8Array | null
  try {
    plain = nacl.box.open(
      naclUtil.decodeBase64(body.ciphertext),
      naclUtil.decodeBase64(body.nonce),
      naclUtil.decodeBase64(body.ephemeralPublicKey),
      recipient.secretKey,
    )
  } catch {
    plain = null
  }
  if (!plain) {
    throw new PairExchangeError('decrypt', 'Could not decrypt sealed api key')
  }

  // The address the user chose is authoritative. `publicUrl` is carried out as
  // data below and never substituted for it.
  //
  // It used to be `resolvedUrl = body.publicUrl ?? trimmedUrl`, which made a
  // typed address a fallback rather than a preference: pairing against a LAN IP
  // silently moved the app to whatever the server advertised, with no signal
  // that it happened. Two reasons that is wrong. The reply is unauthenticated
  // before E2EE — the seal uses a server-side ephemeral key the client cannot
  // verify — so one response could relocate a device permanently. And even from
  // an honest server it discards a choice the user made deliberately.
  //
  // The `assertHttpServerUrl(resolvedUrl)` that stood here went with it: it
  // guarded a value the *server* supplied, and `trimmedUrl` is already checked
  // on entry (stripping a trailing slash cannot change a protocol).

  const deviceId = typeof body.deviceId === 'string' ? body.deviceId : null
  const deviceToken = typeof body.deviceToken === 'string' ? body.deviceToken : null
  const capabilities = Array.isArray(body.capabilities)
    ? parseCapabilityList(body.capabilities)
    : null

  return {
    url: trimmedUrl,
    apiKey: naclUtil.encodeUTF8(plain),
    publicUrl: body.publicUrl ?? null,
    machineName: body.machineName ?? null,
    deviceId,
    deviceToken,
    capabilities,
    // No handshake ran, so there is no proved key to pin and nothing to demand.
    serverPublicKey: null,
    e2eeRequired: false,
  }
}

/**
 * The exchange response. Every field but `e2ee` is the compatibility envelope
 * released clients read; a new client reads it only on the legacy path.
 */
interface ExchangeResponseBody {
  ciphertext?: string
  nonce?: string
  ephemeralPublicKey?: string
  publicUrl?: string | null
  machineName?: string | null
  deviceId?: string
  deviceToken?: string
  capabilities?: string[]
  error?: string
  code?: string
  e2ee?: { v?: number; noise?: string }
}

/**
 * Message 2's authenticated payload, validated. Everything the E2EE path
 * records about a server comes from here and nowhere else.
 */
interface PairHandshakeReply {
  deviceId: string
  deviceToken: string
  capabilities: DeviceCapability[]
  /** `null` on any streamer without an operator-set public URL — the LAN default. */
  publicUrl: string | null
  machineName: string
}

/** Message 2's payload before validation — what `JSON.parse` may actually hand back. */
interface PairHandshakeReplyWire {
  v?: number
  deviceId?: string
  deviceToken?: string
  capabilities?: string[]
  publicUrl?: string | null
  machineName?: string | null
  serverVersion?: string
  e2eeRequired?: boolean
}

function nonEmptyString(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0
}

/**
 * Reads and validates the reply's `e2ee` field. Throws on anything else — once
 * message 1 has gone out there is no successful outcome that is not a complete,
 * authenticated message 2.
 *
 * That the payload decrypts at all is the key confirmation — Noise's handshake
 * hash already commits to both static keys, both ephemerals and the PSK, and it
 * is the AAD for this AEAD. There is no separate confirmation value and design
 * §2.4 says there deliberately is not one. Decryption proves *who wrote it*; the
 * shape check below is what makes an authenticated `{}` a failure rather than a
 * successful pairing carrying nothing.
 */
function readPairHandshakeReply(
  handshake: NoiseInitiator,
  raw: { v?: number; noise?: string } | undefined,
): PairHandshakeReply {
  // Message 1 was sent, so a reply with no message 2 is the server refusing to
  // encrypt after the fact. That is a hard failure, never a plaintext result:
  // answering as an old server is a man in the middle's cheapest attack, and a
  // streamer that will not encrypt is expected to omit `spk` from the QR and
  // never get asked (GATE 5).
  if (raw == null) {
    throw new PairExchangeError(
      'e2ee-refused',
      'Server did not complete the encrypted pairing it offered',
    )
  }
  const noise = raw.noise
  if (!nonEmptyString(noise)) {
    throw new PairExchangeError('e2ee-malformed', 'Server sent a malformed e2ee reply')
  }
  if (raw.v !== E2EE_CLIENT_VERSION) {
    throw new PairExchangeError(
      'e2ee-version',
      `Server replied with e2ee version ${String(raw.v)}; this app speaks ${E2EE_CLIENT_VERSION}`,
    )
  }

  let payload: Uint8Array
  try {
    payload = handshake.readMessage2(naclUtil.decodeBase64(noise)).payload
  } catch {
    // Wrong static key, wrong PSK, or a rewritten reply — one kind, because the
    // remedy is the same and the difference is only useful to whoever caused it.
    throw new PairExchangeError('e2ee-handshake', 'Could not authenticate the handshake reply')
  }

  let parsed: PairHandshakeReplyWire
  try {
    parsed = JSON.parse(naclUtil.encodeUTF8(payload)) as PairHandshakeReplyWire
  } catch {
    throw new PairExchangeError('e2ee-malformed', 'Server sent an unreadable handshake payload')
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new PairExchangeError('e2ee-malformed', 'Server sent an unreadable handshake payload')
  }
  const wire = parsed

  if (wire.v !== E2EE_CLIENT_VERSION) {
    throw new PairExchangeError(
      'e2ee-version',
      `Handshake payload is version ${String(wire.v)}; this app speaks ${E2EE_CLIENT_VERSION}`,
    )
  }
  // A pairing that cannot produce a device id and a device token has not
  // registered this device, whatever else it managed to say.
  if (!nonEmptyString(wire.deviceId) || !nonEmptyString(wire.deviceToken)) {
    throw new PairExchangeError(
      'e2ee-malformed',
      'Encrypted pairing did not return a device credential',
    )
  }
  if (!Array.isArray(wire.capabilities) || !nonEmptyString(wire.serverVersion)) {
    throw new PairExchangeError('e2ee-malformed', 'Encrypted pairing returned an incomplete result')
  }
  // `null` is a value here, not a failure: the streamer defaults `publicUrl` to
  // null and only fills it from `--public-url` / `THREADBASE_PUBLIC_URL` /
  // `public_url:`, none of which a LAN streamer sets. So the ordinary local
  // pairing authenticates `"publicUrl": null`, and demanding a string here —
  // which is what the written contract says, and is the tempting reading —
  // would refuse every LAN pairing while looking like a handshake bug.
  //
  // An ABSENT key is still malformed. The streamer builds a typed object
  // literal and `JSON.stringify` drops `undefined` but never `null`, so the key
  // is always on the wire. "Server has no public URL" and "server sent a
  // payload missing a field" are two different bugs and must not collapse.
  if (!(wire.publicUrl === null || typeof wire.publicUrl === 'string')) {
    throw new PairExchangeError('e2ee-malformed', 'Encrypted pairing returned an incomplete result')
  }
  // Always a real string — the streamer passes `os.hostname()`, which cannot be
  // null or absent. Empty is tolerated rather than refused: it is a display
  // label, and failing a whole pairing over a cosmetic field is the opposite of
  // the rule that a missing optional field renders without it.
  if (typeof wire.machineName !== 'string') {
    throw new PairExchangeError('e2ee-malformed', 'Encrypted pairing returned an incomplete result')
  }
  // The server records the same bit at this same event. A reply that declines to
  // say so has not pinned us, and pinning it alone would produce the split state
  // §6.1 exists to prevent.
  if (wire.e2eeRequired !== true) {
    throw new PairExchangeError(
      'e2ee-refused',
      'Server completed the handshake without requiring encryption',
    )
  }

  return {
    deviceId: wire.deviceId,
    deviceToken: wire.deviceToken,
    capabilities: parseCapabilityList(wire.capabilities),
    publicUrl: wire.publicUrl,
    machineName: wire.machineName,
  }
}

async function safeJson(res: Response): Promise<ExchangeResponseBody | null> {
  try {
    const parsed: ExchangeResponseBody = await res.json()
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}
