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

**Order.** The addresses are `[url, publicUrl]`: `publicUrl` is dropped when the server is not pinned, when it is absent, not `http(s)://`, equal to `url` after trailing-slash normalisation, or refused by the cleartext policy.
Only a pinned server's `publicUrl` came from the authenticated handshake; see "Unpinned servers get no fallback" under Known limits.
They are tried in order, and the second attempt starts only after the first has failed. They are never raced.

**What counts as "failed".** The address couldn't be reached on this attempt: a network error, or the first attempt's bounded timeout ran out.
An HTTP response of any status is not a reason to fall back, because the server was reached and the other address reaches the same process.
The same goes for a permanent E2EE refusal (`retryable === false`) and for a `429`/`5xx` answer from `/api/e2ee/open`.
The second attempt would cost a handshake against the five-per-minute budget to get the same answer.

**Bounded first attempt.** When a second address exists, the first attempt gets `FIRST_ADDRESS_TIMEOUT_MS = 4000`.
That applies to `/api/e2ee/open` (instead of 10 s), which picks the address for both the socket and sealed REST.
A LAN answer takes milliseconds, and a black-holed LAN address never answers at all.
The second attempt keeps today's timeouts. A server with one address behaves exactly as it does today.

**No sticky switch.** Nothing records which address worked, whether in the store, in storage, or in module state.
The address stays bound to the *connection* that found it and dies with that connection:

- **WebSocket.** Each `_doConnect` starts at `url`. The socket that opens is bound to its address for as long as it lives. `liveUrl` is cleared when it closes, and the next dial starts at `url` again.
- **Sealed REST.** The REST context *is* the connection. `acquireRestContext` opens it on the first reachable address, and the context carries that `baseUrl`. Sealed requests go to the context's address. The context already rolls over on every foreground, at 24 h, and at 1 GiB, and each reopen starts at `url`. A network failure on a context whose server has two addresses invalidates it, so walking out of Wi-Fi mid-session costs one reopen and doesn't strand requests on a dead LAN address until the next foreground.
  `authedFetch` does not replay the request that found the address dead. The api-client's own single retry (`request()`, `requestWithMeta()`) reopens the dropped context, and the reopen moves on to `publicUrl`, so a read through the api-client costs a slower load, not an error.
- **Plaintext REST and WebSocket (unpinned servers).** One address, `url`, exactly as on `main`.

**`url` is never overwritten.** Nothing writes the answering address into the record.

**UI.** The server edit modal (the server's settings) shows the public address when one exists, plus which address the live WebSocket is using: "your address" or "public address". The strings are in `servers` namespace keys across en/he/ru/ar.

**E2EE.** The pinned path keeps sealing on both addresses. The Noise handshake authenticates the server's static key whichever address carried it.
That is why the identity-key comparison (`/api/info` `serverIdentityKey`) is *not* built: the issue rules it out once Phase 2 is on main, and it is.
The fallback never drops to plaintext or to a `?key=` URL on a pinned server.

**Reconnect cost at idle.** Nothing new runs at idle: no timer and no probe. A healthy socket costs nothing extra.
On each backoff tick of a failed WebSocket, the dial makes at most one extra attempt.
If the first address never answered, that attempt spent no handshake: an unreachable `/open` never reaches the streamer.
The worst case is a first `/open` that did reach the streamer but answered after 4 s. That spends two handshakes on that tick instead of one, and the existing 1–30 s backoff still paces it.

## Known limits

**Unpinned servers get no fallback.**
A server paired through the legacy path stores a `publicUrl` from a reply that is unauthenticated before E2EE (`services/pair-exchange.ts:497`).
Dialling it in plaintext would send `Authorization: Bearer <apiKey>` and `/ws?key=` to whoever wrote that reply, which partly reopens TB-M-03 (`docs/security/2026-08-14-mobile-review.md`); #726 had closed it by never dialling `publicUrl`.
So `serverAddresses` returns only `url` for an unpinned server, and the plaintext REST and WebSocket paths are single-address, as on `main`.
Such a server reaches only the address the user typed; re-pairing over E2EE is what gives it a second one.
The earlier caveat "a refused plaintext WebSocket upgrade falls back as if unreachable" no longer applies: there is no plaintext fallback left to take.

**A direct sealed read with no retry of its own fails once after walking out.**
A read that bypasses the api-client — the server-info refresh (`stores/servers.ts:426`) — surfaces the network error of the request that found the address dead; the context is already dropped, so the next refresh reopens and moves on to `publicUrl`.
A replay inside `authedFetch` was built and dropped (see "Commit 2 dropped" below): the api-client retry already covers every read that goes through it, and a second retry layer would stack handshakes on top of D1.

**A reachable but slow server pays a handshake per timed-out sealed request.**
On a server with two addresses, a sealed request that times out drops its REST context, so the next request reopens it: one Noise `/open` against the five-per-minute budget.
It cannot be avoided without losing the walk-out case: a LAN address dialled from outside is usually black-holed, and that surfaces as exactly this timeout.
The api-client's retry makes it at most two handshakes per slow request (the 8 s attempt and the 15 s retry). It is not a loop, and a `429` from `/open` is retryable, never a permanent verdict.
A caller's cancel does not drop the context (`AuthedFetchInit.cancelSignal`, D1).
Keeping the context on a timeout only when it sits on the last address (`publicUrl`) was considered and rejected: at home behind a router without hairpin NAT, `publicUrl` can time out rather than error, and that rule would never drop a context stuck on it.

## Files

| File | Change |
|---|---|
| `services/server-addresses.ts` (new) | `serverAddresses(target)` → ordered, de-duplicated list, `publicUrl` only for a pinned server and only `http(s)://`; `FIRST_ADDRESS_TIMEOUT_MS` |
| `services/e2ee/context.ts` | `OpenContextArgs.timeoutMs?`; `OpenError.unreachable` (set only when the `/open` fetch threw); `TransportContext.baseUrl`; permanent-refusal memory keyed by server and address |
| `services/e2ee/rest-session.ts` | open over the address list; return the context bound to the address that answered |
| `services/authed-fetch.ts` | `AuthedTarget.publicUrl?`; sealed requests to `context.baseUrl`; invalidate on network failure when two addresses, unless the caller cancelled (`cancelSignal`); plaintext unchanged |
| `services/api-client.ts` | pass the caller's own signal as `cancelSignal` |
| `services/ws-client.ts` | `publicUrl` in the connect options; a pinned dial opens on the address that answered `/open`; `liveUrl()` on client and manager; plaintext dial unchanged |
| `app/_layout.tsx`, `app/settings.tsx`, `components/servers/ServerEditModal.tsx` | pass `publicUrl` to `wsManager.connect`; modal shows the addresses |
| `types/api.ts` | drop "Nothing reads this yet" from the `publicUrl` comment |
| `locales/{en,he,ru,ar}/servers.json` | new keys |

Tests use `192.0.2.x` and `https://tb.example.com` only: `e2ee-two-addresses.test.ts`, `e2ee-rest-envelope.test.ts`, `ws-client.test.ts`, `authed-fetch.test.ts`, `e2ee-rest-session.test.ts`, and the edit modal integration test.

## Decisions for approval

1. **REST follows the context, not every request (pinned servers).** A per-request fallback on sealed REST would make every request away from home pay the 4 s timeout.
   It would also need a fresh seal per retry. Binding the address to the REST context keeps "no sticky switch" at the connection level, which is the same granularity as the socket.
   *Recommend: as designed.*
2. **Plaintext writes don't take the 4 s timeout.** A timeout can fire after a `POST` already reached the server.
   A retry on `publicUrl` would then run it twice, for example two sessions.
   `POST`/`PUT`/`PATCH`/`DELETE` fall back only on a network error. `GET`/`HEAD` also fall back on the timeout.
   The ceiling is a write to a black-holed LAN address, which waits the caller's own timeout. *Recommend: as designed.*
   *Superseded (2026-09-23, D2): plaintext has no fallback at all now, so there is no plaintext timeout to bound.*
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

**Commit 2 dropped.** The owner's first plan replayed a sealed `GET`/`HEAD` once inside `authedFetch` after a network error.
The planner then pointed out that `request()` and `requestWithMeta()` in `services/api-client.ts` already retry once on any network error or timeout, and the retry reopens the context; I verified it at `:383` and `:565`.
Stacked, two failures in a row cost up to four fetches and three reopens instead of two and one, so the owner dropped the replay and asked instead for a test proving the recovery through the api-client retry.
Run 2 below judged the dropped replay; it is kept as data.

**Blind change for the dropped replay, written before run 2.** Not fully blind: run 1's output was already read.
Only two answers change. `rest-falls-back` loses its caveat and stays yes: the read that finds a dead address is now replayed on the reopened context.
`idle-reconnect-cost-bounded` becomes no on the strict reading: the replay is a new, single retry, and D1 still stands.

**Blind change for the D1 fix (commit 2), written before run 4.** No answer changes.
`idle-reconnect-cost-bounded` stays no on the strict reading: the first-address timers remain, and so does the slow-server timeout cost (Known limits). The fix only removes the caller-cancel share of it.

### Runs

`p` is Jev's probability that the answer is yes; `status` compares it with the expected answer at threshold 0.7.
Run 1 is commit `dc735e29` (implementation) against `origin/main`, 52,644 input tokens, 5 batches.
Run 2 is commit 1 plus the uncommitted, later dropped, sealed read replay, against `origin/main`, 53,289 input tokens, 5 batches.
Run 3 re-judged commit 1's exact code diff (only a test and this doc had changed, both outside every criterion's `paths`): 52,644 input tokens, as in run 1. Same statuses; `p` moved by at most 0.03 on an identical input.
Run 4 is commit 1 plus the D1 fix (commit 2), 55,144 input tokens. Same statuses; `idle-reconnect-cost-bounded` rose from 0.10 to 0.16 and stayed CHECK.
Run 5 judged the docs-only commit that records this trial, so the same code diff as run 4: 55,144 input tokens, one CHECK (`idle-reconnect-cost-bounded`, 0.17), every other status unchanged.
The two runs agree on every status; the largest move in `p` is 0.05 (`pinned-never-plaintext`).
Run 6 is commits 1–3 plus the uncommitted D2 fix (commit 4), 49,854 input tokens. `p` per criterion, in table order: 0.87, 0.97, 0.95, 0.07, 0.08, 0.97, **0.57 CHECK**, 0.93, 0.07, 0.95, 0.13, **0.69 CHECK**, 0.28. The criteria file was unchanged (same sha256).
No blind change was written before run 6: a process slip, recorded here rather than back-filled.

| Criterion | Expect | Run 1 p | Run 1 | Run 2 p | Run 2 | Run 3 p | Run 3 | Run 4 p | Run 4 | Blind agrees (run 1) |
|---|---|---|---|---|---|---|---|---|---|---|
| `user-address-first` | yes | 0.92 | PASS | 0.92 | PASS | 0.91 | PASS | 0.89 | PASS | yes |
| `sequential-not-raced` | yes | 0.97 | PASS | 0.97 | PASS | 0.97 | PASS | 0.97 | PASS | yes |
| `bounded-first-attempt` | yes | 0.96 | PASS | 0.96 | PASS | 0.96 | PASS | 0.96 | PASS | yes |
| `no-sticky-switch` | no | 0.05 | PASS | 0.05 | PASS | 0.06 | PASS | 0.06 | PASS | yes |
| `url-never-overwritten` | no | 0.08 | PASS | 0.07 | PASS | 0.09 | PASS | 0.08 | PASS | yes |
| `websocket-falls-back` | yes | 0.97 | PASS | 0.97 | PASS | 0.97 | PASS | 0.97 | PASS | yes |
| `rest-falls-back` | yes | 0.90 | PASS | 0.92 | PASS | 0.92 | PASS | 0.90 | PASS | yes |
| `live-address-shown` | yes | 0.92 | PASS | 0.90 | PASS | 0.92 | PASS | 0.92 | PASS | yes |
| `no-identity-key-comparison` | no | 0.04 | PASS | 0.04 | PASS | 0.05 | PASS | 0.04 | PASS | yes |
| `fallback-only-when-unreachable` | yes | 0.95 | PASS | 0.94 | PASS | 0.94 | PASS | 0.94 | PASS | yes |
| `pinned-never-plaintext` | no | 0.25 | PASS | 0.20 | PASS | 0.22 | PASS | 0.21 | PASS | yes |
| `idle-reconnect-cost-bounded` | yes | 0.12 | **CHECK** | 0.11 | **CHECK** | 0.10 | **CHECK** | 0.16 | **CHECK** | no — I said yes |
| `refusal-scoped-to-address` | no | 0.17 | PASS | 0.18 | PASS | 0.16 | PASS | 0.19 | PASS | yes |

**Known true caveat not flagged.** `fallback-only-when-unreachable` passed at 0.95 although caveat 3 (a refused plaintext upgrade falls back, see Known limits) is a real sub-case where the strict answer is no.
Jev did not surface it.

### CHECK verdicts

Line numbers are at the commit each run judged.

**`idle-reconnect-cost-bounded`, run 1 (p 0.12).** Two parts, one of each kind.

- *Wording conflict — false alarm.* The question's clause "adds no new timer" is literally false: the change adds a per-request timer (`services/authed-fetch.ts:273`, `boundedSignal`) and shortens two existing ones (`services/ws-client.ts:324`, `services/e2ee/context.ts:321`).
  Those are the bound `bounded-first-attempt` asks for; they cap how long an attempt runs and schedule no new attempt.
  The cost bound itself holds on the WebSocket: a plaintext dial that never opened moves to the next address with no backoff only while one remains (`services/ws-client.ts:459`), then falls through to the existing backoff (`:468`, `:483`), whose tick restarts at index 0. The address loops are capped at two (`services/e2ee/context.ts:502`, `services/authed-fetch.ts:244`).
  Mine; the planner agreed.
- *Real finding — bounded REST handshake cost.* **Planner-sourced; I verified it in the code.** The sealed catch (`services/authed-fetch.ts:493`) drops the REST context on any rejection, including an abort.
  `request()` and `requestWithMeta()` in `services/api-client.ts` hand `authedFetch` one merged signal — the caller's React Query signal plus their own 8 s / 15 s timeout — and React Native's `AbortController` (`abort-controller@3.0.0`) carries no `reason`, so `authedFetch` cannot tell the two apart.
  A caller cancel (a query losing its last observer mid-fetch) and a timeout on a reachable-but-slow server therefore each cost a Noise `/open` on the next request, against the five-per-minute budget. Not a loop, but more than the design's "one handshake per walk-out".
  Ignoring aborts is not the fix: a black-holed LAN address after walking out surfaces as exactly that timeout abort. Logged as D1 below.

**`idle-reconnect-cost-bounded`, run 2 (p 0.11), on the dropped replay.** Same two parts as run 1, plus the replay itself, which was a real but bounded retry.
The replay retried a sealed `GET`/`HEAD` once after a network error, never a write, never an aborted request, and never the replay itself (the diff was never committed, so there are no line numbers to cite).
It stacks with the api-client's own single retry: two network errors in a row on both calls cost up to four fetches and three reopens, where commit 1 cost two and one.
A reopen through an unreachable address spends no handshake, so the handshakes land only on an address that answered `/open` and then failed the request.
Mine.

**`idle-reconnect-cost-bounded`, run 4 (p 0.16), on the D1 fix.** Unchanged from run 1: a wording conflict on the timers, plus the slow-server timeout cost, which is now a documented known limit rather than an open defect. Mine.

**`rest-falls-back`, run 6 (p 0.57), on the D2 fix — true detection of an intended change.** The question asks for a fallback "on both the plaintext path and the E2EE-sealed path", and D2 removed the plaintext one on purpose: `plaintextFetch` is single-address again (`services/authed-fetch.ts:242`).
The strict answer is now no, so CHECK is right. Reword before reuse to "…on the E2EE-sealed path (pinned servers)".
`websocket-falls-back` stayed PASS at 0.97 although it too is now true only for pinned servers; its question does not name the plaintext path, so a yes is defensible. Mine.

**`idle-reconnect-cost-bounded`, run 6 (p 0.69).** The same wording conflict as run 1, now smaller: `boundedSignal` and the shortened plaintext dial timer are gone, and the one remaining first-attempt timer is the `/open` bound (`services/e2ee/context.ts:321`). It rose from 0.17 to 0.69 but stayed CHECK. The cost bound holds. Mine.

### Recall: mutations M0–M5

Run in a throwaway detached worktree at `5e7baaf8` (both commits), each mutation applied uncommitted to a clean tree, judged, then reverted; the tree was confirmed clean between mutations and the worktree removed afterwards.
The clean run there scored the same statuses as run 4.
A cell is `p` and status; **bold** marks a status that changed against the clean run.

| Criterion | Clean | M0 rename | M1 `publicUrl` first | M2 address remembered | M3 `url` overwritten | M4 identity-key check | M5 per-server refusals |
|---|---|---|---|---|---|---|---|
| `user-address-first` | 0.88 P | 0.89 P | **0.36 C** | **0.58 C** | 0.90 P | 0.91 P | 0.90 P |
| `sequential-not-raced` | 0.97 P | 0.97 P | 0.97 P | 0.95 P | 0.97 P | 0.97 P | 0.97 P |
| `bounded-first-attempt` | 0.96 P | 0.96 P | 0.96 P | 0.92 P | 0.95 P | 0.96 P | 0.96 P |
| `no-sticky-switch` | 0.05 P | 0.06 P | 0.06 P | **0.84 C** | **0.62 C** | 0.06 P | 0.06 P |
| `url-never-overwritten` | 0.08 P | 0.08 P | 0.08 P | 0.07 P | **0.97 C** | 0.09 P | 0.08 P |
| `websocket-falls-back` | 0.97 P | 0.97 P | 0.97 P | 0.94 P | 0.97 P | 0.97 P | 0.97 P |
| `rest-falls-back` | 0.89 P | 0.89 P | 0.89 P | 0.79 P | 0.87 P | 0.88 P | 0.89 P |
| `live-address-shown` | 0.90 P | 0.91 P | 0.88 P | 0.83 P | 0.89 P | 0.93 P | 0.91 P |
| `no-identity-key-comparison` | 0.04 P | 0.04 P | 0.04 P | 0.04 P | 0.04 P | **0.98 C** | 0.03 P |
| `fallback-only-when-unreachable` | 0.94 P | 0.94 P | 0.93 P | 0.91 P | 0.93 P | 0.94 P | 0.94 P |
| `pinned-never-plaintext` | 0.22 P | 0.20 P | 0.20 P | 0.19 P | 0.22 P | 0.24 P | 0.21 P |
| `idle-reconnect-cost-bounded` | 0.14 C | 0.14 C | 0.14 C | 0.10 C | 0.13 C | 0.13 C | 0.15 C |
| `refusal-scoped-to-address` | 0.17 P | 0.19 P | 0.22 P | 0.21 P | 0.17 P | 0.18 P | **0.72 C** |

What each mutation was:

- **M0** renames `trimSlash` to `stripTrailingSlash`. Nothing moved by more than 0.02: no false alarm from a pure rename.
- **M1** returns `[publicUrl, url]`, leaving the doc comment claiming the opposite. Caught by `user-address-first`.
- **M2** remembers the address that opened a context in a module map and AsyncStorage, and puts it first in `serverAddresses` for that server. Caught by `no-sticky-switch`, and also by `user-address-first` — correctly, since a remembered `publicUrl` is then tried before `url`.
- **M3** writes the answering address into the record's `url` through `editServer` on a WebSocket that opened on the second address. The criterion's examples name `updateServer`, `addServer` and `setState`, not `editServer`; it was caught anyway. Also caught by `no-sticky-switch` — correctly, since the record now remembers it.
- **M4** fetches `publicUrl`'s `/api/info` before opening on it and compares `serverIdentityKey` with the pin, commented as verification. Caught by `no-identity-key-comparison`.
- **M5** (owner-confirmed) restores `origin/main`'s per-server refusal memory in `services/e2ee/context.ts` and nothing else. Caught by `refusal-scoped-to-address`, but only just: 0.72 against a 0.70 threshold. It is the weakest catch of the six.

Recall: 5 of 5 defect mutations caught by the criterion written for them, with no status change on the no-op; the two extra catches (M2, M3) are true.
Across M0–M5, `idle-reconnect-cost-bounded` stayed CHECK throughout, so it carried no signal about any of them.
The criteria and the mutations were written in the same session, by the same author, so 5 of 5 is a ceiling, not an expected rate: each mutation was aimed at a criterion already on the page.
Before `idle-reconnect-cost-bounded` is reused, reword it to drop "adds no new timer", which conflicts with `bounded-first-attempt` and kept it CHECK on every run.

### Spot-checks of the three lowest PASS rows (final clean run)

All three are correct PASSes. Line numbers are at `5e7baaf8`.

- **`pinned-never-plaintext` (score 0.78, p 0.22).** A pinned dial computes `pinned` at the top of every `_doConnect` (`services/ws-client.ts:252`) and opens only a ticketed socket with `?key=` stripped (`:289`); the plaintext `new WebSocket` (`:291`) is the other branch. The no-backoff redial to the next address requires `!context` (`:456`, `:459`), and a pinned socket always has one. REST picks the path from `isPinned` (`services/authed-fetch.ts:209`, `:224`–`:225`), and an open failure on the sealed path becomes an `EnvelopeError` (`:460`), never a plaintext retry.
- **`refusal-scoped-to-address` (score 0.83, p 0.17).** Refusals are looked up and recorded under server, then address (`services/e2ee/context.ts:461`, `:481`). `__tests__/unit/e2ee-two-addresses.test.ts:152` proves an access-gate refusal on `publicUrl` does not stop the user address, and `:172` that a real revocation costs one `/open` per address.
- **`user-address-first` (score 0.88, p 0.88).** `serverAddresses` returns `[url, publicUrl]` (`services/server-addresses.ts:26`), and every consumer starts at index 0: the E2EE open (`services/e2ee/context.ts:502`), the plaintext REST loop (`services/authed-fetch.ts:255`), and the WebSocket, whose `_doConnect` defaults to index 0.

### Defects found later

| # | Found by | What | Criterion covering it | Jev flagged it |
|---|---|---|---|---|
| D1 | Planner, from the run 1 CHECK row | An aborted sealed request (caller cancel or api-client timeout) drops the REST context on a two-address server, so the next request pays a handshake (`services/authed-fetch.ts:493` at `dc735e29`). Fixed in commit 2: `api-client` passes the caller's own signal as `cancelSignal`, and a cancel keeps the context; a timeout still drops it. The slow-server timeout cost remains, in Known limits. | `idle-reconnect-cost-bounded`, partly: it asks about retry loops and backoff ticks, not about per-request context drops | The row was CHECK, but for a reason Jev did not state; the wording conflict alone would have produced it |
| D2 | Planner review after commit 3 | The plaintext fallback sent the API key (`Authorization: Bearer`, `/ws?key=`) to an unpinned server's `publicUrl`, which the legacy pairing path stores from an unauthenticated reply (`services/pair-exchange.ts:497`); this partly reopened TB-M-03. `serverAddresses` also accepted any non-`http`/`ws` scheme, because `isCleartextAllowed` passes every scheme it does not police. Fixed in commit 4: `publicUrl` only for pinned servers and only `http(s)://`, and the plaintext fallback removed. | None. `pinned-never-plaintext` asks the reverse question (a pinned server never goes plaintext), and no criterion asks where an unpinned server may send its key | No. Every run passed the fallback criteria on the plaintext path |

### Cost

From `session-profile.mjs` on session `f9e9ccc8-e330-407d-9c66-e106bf97e286`, taken before the docs-only commit that records it, so the last turn is missing.
List-price estimates, not billing.

- **Session:** 94.9 min wall clock, 176 API calls on `claude-opus-5-5`, about $24.87, no subagents.
- **Jev:** 12 real runs, 653,088 input tokens, about $0.027 at $0.042 per Mtok.
  The profiler's detector listed 6 runs; one was the dry run, which reports no tokens and is not counted.
  It missed the six mutation runs, which a driver script ran as subprocesses; their tokens (329,079) come from the runs' own output.
  Counted runs: runs 1–5, the clean run in the mutation worktree, and M0–M5.
- **Comparison:** the whole Jev trial cost about a thousandth of the session that produced the change.

## Criteria change log

Pre-freeze edits, from the owner's plan review on 2026-09-23:

- `live-address-shown`: dropped "that are added to all four locale files (en, he, ru, ar)". `npm run test:i18n` already checks locale parity exactly, and a compound question pulls p toward the middle. `locales/` stays in its `paths`.
- Added `refusal-scoped-to-address` (expect no, `services/`), for decision 3.

**Frozen 2026-09-23 at 13 criteria**, sha256 `060a866959f7d0bad66a180e5fcfe36862e742d3aee6d1757ae57fc8de9d5812`. Any edit after this line is logged here with its reason and the owner's approval.

Changes to the trial run itself, not to the criteria (the criteria file is unchanged, and so is its hash):

- Added recall mutation **M5**: revert only the refusal memory in `services/e2ee/context.ts` to per-server keying. It is the only mutation that exercises `refusal-scoped-to-address`, which none of M0–M4 touch. The planner session requested it and relayed that the owner asked for it. The owner confirmed it in this session on 2026-09-23.
