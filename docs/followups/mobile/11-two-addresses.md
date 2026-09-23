# 11 — A server has two addresses: try the user's, then `publicUrl`

Issue: [RonenMars/threadbase-mobile#734](https://github.com/RonenMars/threadbase-mobile/issues/734).
Branch `feat/two-addresses`, worktree `../tb-mobile-worktrees/two-addresses`, cut from `origin/main` at `3db6dd6a`.
Criteria: [`11-two-addresses-criteria.json`](./11-two-addresses-criteria.json). They are frozen once approved, and every later edit is logged under "Criteria change log" with its reason.

## Premise re-check (2026-09-23, against `origin/main` 3db6dd6a)

The issue's "Verified state" is dated 2026-08-15. Re-checked claim by claim:

| Claim | Now | Evidence |
|---|---|---|
| `publicUrl` is persisted on the server record | Holds | `stores/servers.ts:51`, `:68`, `:140`, `:198`, `:274` |
| `ServerConfig.publicUrl` is stored and nothing reads it | Holds, but the line moved | `types/api.ts:779` (was `:480`), and its doc comment still says "Nothing reads this yet". The only reads on main are the pairing flows passing it to `addServer` |
| `url` is the address the user typed | Holds | `services/pair-exchange.ts:473` keeps the typed address since #726 |
| The Phase 2 handshake has landed, so the identity-key comparison is ruled out | Holds | `services/e2ee/` (Noise `/open`, sealed REST, ticketed socket), streamer #590 CLOSED |

No premise change. The multi-homed server measurement was not repeated, because it is a server-side fact and this change doesn't depend on it.

## Design

**Order.** The addresses are `[url, publicUrl]`: `publicUrl` is dropped when it is absent, equal to `url` after trailing-slash normalisation, or refused by the cleartext policy.
They are tried in order, and the second attempt starts only after the first has failed. They are never raced.

**What counts as "failed".** The address couldn't be reached on this attempt: a network error, or the first attempt's bounded timeout ran out.
An HTTP response of any status is not a reason to fall back, because the server was reached and the other address reaches the same process.
The same goes for a permanent E2EE refusal (`retryable === false`) and for a `429`/`5xx` answer from `/api/e2ee/open`.
The second attempt would cost a handshake against the five-per-minute budget to get the same answer.

**Bounded first attempt.** When a second address exists, the first attempt gets `FIRST_ADDRESS_TIMEOUT_MS = 4000`.
That applies to a WebSocket dial (instead of 15 s), to `/api/e2ee/open` (instead of 10 s), and to a plaintext `GET`/`HEAD`.
A LAN answer takes milliseconds, and a black-holed LAN address never answers at all.
The second attempt keeps today's timeouts. A server with one address behaves exactly as it does today.

**No sticky switch.** Nothing records which address worked, whether in the store, in storage, or in module state.
The address stays bound to the *connection* that found it and dies with that connection:

- **WebSocket.** Each `_doConnect` starts at `url`. The socket that opens is bound to its address for as long as it lives. `liveUrl` is cleared when it closes, and the next dial starts at `url` again.
- **Sealed REST.** The REST context *is* the connection. `acquireRestContext` opens it on the first reachable address, and the context carries that `baseUrl`. Sealed requests go to the context's address. The context already rolls over on every foreground, at 24 h, and at 1 GiB, and each reopen starts at `url`. A network failure on a context whose server has two addresses invalidates it, so walking out of Wi-Fi mid-session costs one reopen and doesn't strand requests on a dead LAN address until the next foreground.
- **Plaintext REST.** There is no connection object, so each request is its own attempt: `url`, then `publicUrl`.

**`url` is never overwritten.** Nothing writes the answering address into the record.

**UI.** The server edit modal (the server's settings) shows the public address when one exists, plus which address the live WebSocket is using: "your address" or "public address". The strings are in `servers` namespace keys across en/he/ru/ar.

**E2EE.** The pinned path keeps sealing on both addresses. The Noise handshake authenticates the server's static key whichever address carried it.
That is why the identity-key comparison (`/api/info` `serverIdentityKey`) is *not* built: the issue rules it out once Phase 2 is on main, and it is.
The fallback never drops to plaintext or to a `?key=` URL on a pinned server.

**Reconnect cost at idle.** Nothing new runs at idle: no timer and no probe. A healthy socket costs nothing extra.
On each backoff tick of a failed WebSocket, the dial makes at most one extra attempt.
If the first address never answered, that attempt spent no handshake: an unreachable `/open` never reaches the streamer.
The worst case is a first `/open` that did reach the streamer but answered after 4 s. That spends two handshakes on that tick instead of one, and the existing 1–30 s backoff still paces it.

## Files

| File | Change |
|---|---|
| `services/server-addresses.ts` (new) | `serverAddresses(target)` → ordered, de-duplicated list; `FIRST_ADDRESS_TIMEOUT_MS`; `wasUnreachable(err)` |
| `services/e2ee/context.ts` | `OpenContextArgs.timeoutMs?`; `OpenError.unreachable` (set only when the `/open` fetch threw); `TransportContext.baseUrl`; permanent-refusal memory keyed by server and address |
| `services/e2ee/rest-session.ts` | open over the address list; return the context bound to the address that answered |
| `services/authed-fetch.ts` | `AuthedTarget.publicUrl?`; plaintext per-request order; sealed requests to `context.baseUrl`; invalidate on network failure when two addresses |
| `services/ws-client.ts` | `publicUrl` in the connect options; address index per dial; bounded first dial; `liveUrl()` on client and manager |
| `app/_layout.tsx`, `app/settings.tsx`, `components/servers/ServerEditModal.tsx` | pass `publicUrl` to `wsManager.connect`; modal shows the addresses |
| `types/api.ts` | drop "Nothing reads this yet" from the `publicUrl` comment |
| `locales/{en,he,ru,ar}/servers.json` | new keys |

Tests use `192.0.2.x` and `https://tb.example.com` only: `ws-client.test.ts`, `authed-fetch.test.ts`, `e2ee-rest-session.test.ts`, and the edit modal integration test.

## Decisions for approval

1. **REST follows the context, not every request (pinned servers).** A per-request fallback on sealed REST would make every request away from home pay the 4 s timeout.
   It would also need a fresh seal per retry. Binding the address to the REST context keeps "no sticky switch" at the connection level, which is the same granularity as the socket.
   *Recommend: as designed.*
2. **Plaintext writes don't take the 4 s timeout.** A timeout can fire after a `POST` already reached the server.
   A retry on `publicUrl` would then run it twice, for example two sessions.
   `POST`/`PUT`/`PATCH`/`DELETE` fall back only on a network error. `GET`/`HEAD` also fall back on the timeout.
   The ceiling is a write to a black-holed LAN address, which waits the caller's own timeout. *Recommend: as designed.*
3. **Permanent refusals are remembered per server *and address*.** `mapOpenFailure` turns any non-Threadbase answer into a permanent error (`403` → `E2EE_DEVICE_REVOKED`, `404` → `E2EE_DISABLED`, anything else → `E2EE_HANDSHAKE_FAILED`; `services/e2ee/context.ts:193-215`).
   `openContext` used to remember that per `serverId` only.
   Today `publicUrl` is never dialed, so that is harmless. With this change, a Cloudflare Access `403` on `publicUrl` while away would make the home address report "This device is not paired for encryption".
   This change creates that exposure, so it fixes it too: the memory is keyed by server and address.
   A genuine revocation then costs one refused `/open` per address, which is still no loop, and the classification itself does not change.
   `clearOpenRefusal(serverId)` still clears every address of the server. A success on one address clears only that address's verdict.
   *Owner decision (2026-09-23): fix here; criterion `refusal-scoped-to-address` added before the freeze.*
4. **4 s first-attempt timeout.** *Approved: 4000 ms.*

Decisions 1, 2 and 4 approved as recommended on 2026-09-23.

## Jev trial

Model: `claude-opus-5-5[1m]` (Opus 5.5, 1M context). Effort: the session's reasoning effort setting, low.
Jev: `jev-1.13.0` (pinned in `scripts/jev-check.mjs`), threshold 0.7, `--base origin/main`.

_Sections filled in as the trial runs: dry run, per-commit runs, blind verdicts vs Jev, recall mutations M0–M5, CHECK-row verdicts, later defects, session cost._

### Blind verdicts (written 2026-09-23, before any Jev output on the final diff)

My own answer to each question about the uncommitted implementation, with the expected answer alongside.
A caveat marks a sub-case where a strict reader could answer the other way.

| Criterion | Expect | Mine | Note |
|---|---|---|---|
| `user-address-first` | yes | yes | `serverAddresses` returns `[url, publicUrl]`; every path iterates it from index 0 |
| `sequential-not-raced` | yes | yes | `openOnFirstReachable` awaits each open in a loop; the plaintext fetch loop awaits each fetch; the WebSocket dials the next address from `_failCurrentConnection` |
| `bounded-first-attempt` | yes | yes | Caveat: plaintext writes are deliberately not bounded (decision 2), so the first address of a POST waits out the caller's own timeout |
| `no-sticky-switch` | no | no | `dialIndex` and `context.baseUrl` live and die with the socket or context; every `_doConnect()` starts at 0 |
| `url-never-overwritten` | no | no | No store write in the diff |
| `websocket-falls-back` | yes | yes | All four `wsManager.connect` call sites pass `publicUrl` |
| `rest-falls-back` | yes | yes | Caveat: on the sealed path, the request that finds a live context's address dead fails; only the next one reopens and falls back |
| `live-address-shown` | yes | yes | `ServerAddressesSection`, exhaustive switch over `t()` keys |
| `no-identity-key-comparison` | no | no | Nothing reads `/api/info` keys |
| `fallback-only-when-unreachable` | yes | yes | Caveat: a plaintext WebSocket upgrade refused with an HTTP status looks the same as an unreachable address to the platform socket, so it also moves on |
| `pinned-never-plaintext` | no | no | A pinned dial always has a context, and `_doConnect(i + 1)` re-enters the pinned branch |
| `idle-reconnect-cost-bounded` | yes | yes | No new timer; at most one extra dial or `/open` per backoff tick |
| `refusal-scoped-to-address` | no | no | Refusal memory keyed by server and address |

## Criteria change log

Pre-freeze edits, from the owner's plan review on 2026-09-23:

- `live-address-shown`: dropped "that are added to all four locale files (en, he, ru, ar)". `npm run test:i18n` already checks locale parity exactly, and a compound question pulls p toward the middle. `locales/` stays in its `paths`.
- Added `refusal-scoped-to-address` (expect no, `services/`), for decision 3.

**Frozen 2026-09-23 at 13 criteria**, sha256 `060a866959f7d0bad66a180e5fcfe36862e742d3aee6d1757ae57fc8de9d5812`. Any edit after this line is logged here with its reason and the owner's approval.

Changes to the trial run itself, not to the criteria (the criteria file is unchanged, and so is its hash):

- Added recall mutation **M5**: revert only the refusal memory in `services/e2ee/context.ts` to per-server keying. It is the only mutation that exercises `refusal-scoped-to-address`, which none of M0–M4 touch. The planner session requested it and relayed that the owner asked for it. The owner's confirmation in this session is pending.
