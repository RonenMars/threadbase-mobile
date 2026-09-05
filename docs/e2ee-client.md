# End-to-end encryption, client side

What the app does when a server is pinned for encryption, which failures are recoverable, and the traps found running it on hardware.

Server-side design lives in the streamer repo (`specs/end-to-end-encryption/design.md`, `NONCE-DESIGN.md`). This file is only the client's half and the things that bit us.

## The shape

| Piece | Where | What it does |
|---|---|---|
| Pairing | `services/e2ee/pair-handshake.ts` | Noise `IKpsk1` over `POST /api/pair/exchange`, keyed by the pair token in the QR |
| Server pin | server record `serverPublicKey` | Set at pairing. Its presence plus `requireEncryption` is what makes a server sealed |
| Transport handshake | `services/e2ee/context.ts` | Noise `IK`, psk-less, over `POST /api/e2ee/open`. Returns a `ctxId`, an expiry, and for a socket a one-shot ticket |
| WebSocket record layer | `services/e2ee/record.ts`, `services/ws-client.ts` | Every frame sealed; the ticket rides in `X-TB-Ticket` on the upgrade, never in the URL |
| REST envelope | `services/authed-fetch.ts` (`sealedFetch`), `services/e2ee/rest-session.ts` | Body sealed into one frame; `ctxId` and sequence in headers; paths and query stay plaintext by design |

Two context kinds, and they are not interchangeable. A **socket** context dies with its socket — there is no rekey, a new key is a new context. A **REST** context is long-lived per server and rolls over on 24h / 1 GiB / **every foreground**, with the retired one draining for 10 s so in-flight responses still decrypt.

## Failure classification — the part to get right

`services/e2ee/context.ts` defines `OpenErrorCode`, and `retryable` is true for **exactly** `E2EE_CTX_UNKNOWN` and `E2EE_TRANSIENT`. Everything else is a hard refusal to surface, never to retry:

| Code | Meaning | Retry? |
|---|---|---|
| `E2EE_CTX_UNKNOWN` | the server forgot this context (restart, eviction) | yes — one transparent re-handshake |
| `E2EE_TRANSIENT` | mapped from 429 and 5xx | yes, with backoff |
| `E2EE_DEVICE_REVOKED` | this device is no longer paired | **no** |
| `E2EE_HANDSHAKE_FAILED` | wrong server identity, tampered message | **no** |
| `E2EE_MALFORMED`, `E2EE_VERSION_UNSUPPORTED`, `E2EE_SEAL_FAILED`, `E2EE_SEQUENCE_VIOLATION` | protocol-level refusals | **no** |
| `E2EE_DISABLED`, `E2EE_NOT_PAIRED` | this server does not offer, or this device does not hold, encryption | **no** |
| `E2EE_RESPONSE_CACHED` | an HTTP cache rewrote a sealed response's status — `sealedFetch` only, never from `/open` | **no** |

Both transport consumers honour it: `ws-client.ts` returns without scheduling a reconnect, and `sealedFetch` throws `EnvelopeError(..., retryable: false)`.

**Never fall back.** A sealed socket that receives a non-binary frame throws; a pinned request never retries in the clear; a failed pairing is a failed pairing, not a plaintext success. That last one held on hardware against a real Cloudflare Access gate — the app refused rather than continuing unsealed.

## Traps found on hardware (2026-09-02)

### React Native delivers binary frames as `ArrayBuffer`

Not `Uint8Array`. A sealed socket that accepts only `Uint8Array` rejects the server's first valid frame, reconnects, and repeats until the server's five-opens-per-device-per-minute limit answers 429 — surfacing as a "busy" banner and a server that never connects. Fixed by converting before unsealing; a string frame on a sealed socket still fails closed.

### A permanent refusal can launder itself into a retryable one

Revoke a paired device while the app is open and the client retries forever. The chain:

1. `403 E2EE_DEVICE_REVOKED` — non-retryable, and shown accurately as *"This device is not paired for encryption"*.
2. Something above the transport re-issues the request anyway.
3. Those retries charge the server's per-source failure budget, so it starts answering **429**.
4. `context.ts` maps 429 → `E2EE_TRANSIENT`, which **is** retryable. The client now believes a permanent condition is temporary, and the on-screen text degrades to the false *"The server is busy; retrying shortly"*.

Measured: 10 × 403 then 60 × 429 in under two minutes, still climbing. A fix needs both halves — a non-retryable verdict for a server must survive a later 429, **and** the retry above the transport must consult `retryable` at all, since it fires before any 429 exists.

### An HTTP cache can rewrite a sealed response's status (2026-09-05)

The streamer set `Cache-Control` nowhere — one occurrence in the whole repository, on an SSE route — and this client sets it nowhere either. `/api/conversations/:id` therefore went out with an `ETag` and no freshness information, which is the one combination that makes iOS's `NSURLCache` store a response and revalidate it on its **own** `If-None-Match`, whether or not the app asked for a conditional GET.

The server then answers `304`, correctly: `canCarryBody(304)` is false, so its record travels base64url in `X-TB-Env` and the body it seals is empty. The cache applies that `304` to its stored entry and hands the app the stored entry — status **200**, headers merged. `sealedFetch` prefers `X-TB-Env`, unseals it cleanly (the record is real, the counter matches, the AAD matches) and gets zero plaintext bytes. `responseFromPlaintext` builds a `200` with a null body, `requestWithMeta` is past its `304` branch, and `response.json()` throws **`JSON Parse error: Unexpected end of input`** on the messages query.

Nothing about the crypto failed. The `304`'s *status* was laundered into `200` while its payload was empty by construction, and the app's own 304 handling never saw a `304` to handle.

The server-side fix is `Cache-Control: no-store` on every sealed response (streamer #788): a record is owed to ONE accepted counter, so it has no business in a shared cache under any framing. This client refuses the artefact as well, because `X-TB-Env` on a status that *can* carry a body is unreachable from a correct streamer and is therefore a free assertion that something rewrote the status. It refuses rather than recovering: the true status was `204` or `304`, nothing in the response says which, and the real body is absent under either reading.

Do not "fix" this by having the client stop sending `If-None-Match`. The cache adds its own.

### The silence timer is expensive now

`hooks/useTerminalStream.ts` force-reconnects the socket when no WS traffic arrives for `WS_SILENCE_TIMEOUT_MS` (45 s), because iOS kills TCP silently. It cannot tell a dead socket from an idle session, so on an idle session it fires forever. Before E2EE that cost one socket dial. Now each redial costs a full Noise handshake: measured **3.1 context opens per minute at idle against a server limit of 5**, i.e. 62 % of the budget spent doing nothing.

The client already resets that timer on **any** inbound frame (the `'*'` subscription in `useTerminalStream`, since #143). The reason it still fires is that an idle socket receives nothing JS can see: the streamer's liveness signal is a WebSocket *protocol* ping, which the native layer answers without ever surfacing to `onmessage`, and `host_pressure` / `session_list` arrive only on a change. The fix is an app-level `{ type: 'ping' }` frame from the server at a cadence shorter than 45 s; the client treats it as liveness and nothing else, and a test pins that. Tracked as #946 on this side. Do not "fix" this by shortening the window or raising the server's limit — the limit is doing its job.

Note also that **every foreground rotates every REST context** (`rest-session.ts`, `onAppState`), so a foreground costs two handshakes on top of this.

### An unanswerable prompt makes a session uninteractive

When an agent asks something the user cannot answer (an unauthenticated CLI's login selector, say), the "A prompt is waiting for an answer" guard blocks sending in the **Terminal** view as well as chat — so neither a message nor a raw keystroke can get through, and the session cannot be recovered from the phone. Independent of E2EE.

### Cloudflare Access blocks encrypted pairing entirely

A sealed request carries no `Authorization` header, so an interactive Access application in front of the streamer refuses it at the edge; the request never reaches the server. The app reports *"This server offered an encrypted pairing and then did not finish it"*, which is honest about the symptom but blames the server for an intermediary's refusal — a user behind Access will regenerate pairing codes forever.

There is **no** `CF-Access-Client-*` support anywhere in this client, so a Cloudflare service token is not a remedy a user can apply today. The server-side options are to remove Access from the hostname devices use, or bypass the paths they call. Streamer builds after v1.73.0 detect the gate at boot and warn (`access.gate_detected`); on older ones this pairing failure is the only signal.

## Testing rules for this area

- Real record state and real `openContext`, never a stubbed seal/unseal for the transition under test.
- A positive control proving the harness sees an ordinary sealed frame, and a negative control proving the guard is what refuses.
- One falsifiability mutation per rule, reported as `<file>::<test>` with the verbatim assertion. Reverting a guard must turn exactly the intended test red.
