# tb-mobile — STRIDE security design review: end-to-end encryption

**Date:** 2026-08-14
**Subject:** `tb-streamer/specs/end-to-end-encryption/mobile-design.md` (with `context.md`, `design.md`, `dilemmas.md`)
**Scope:** the mobile client's half of the mobile ↔ streamer boundary. The server half is `tb-streamer/docs/security/2026-08-14-streamer-review.md`.
**Process:** `agent-skills:security-and-hardening` — Threat Model First (boundaries → assets → STRIDE per boundary → abuse cases), with `security-scanning`'s `stride-analysis-patterns`, `attack-tree-construction`, `threat-mitigation-mapping`, `security-requirement-extraction`, and the STRIDE-GPT category framework.
**DREAD:** the rubric supplied for this review — 1–10 on Damage, Reproducibility, Exploitability, Affected users, Discoverability; ranked by sum.

This reviews a design the same session authored, so it is written adversarially.
A threat the design mitigates is still in the table, with the mitigation named.
A gap the design leaves is marked **GAP** and repeated in Open questions — not quietly patched.

Citations without a prefix are `tb-mobile`; citations prefixed `tb-streamer/` are the server repo.

---

## 1. System context

`tb-mobile` is a released iOS/Android Expo/React Native app — a remote control for AI agent sessions running on a developer's own machine.
It cannot be force-updated (`tb-streamer/docs/compatibility/tb-mobile.md:3`), which is the constraint every decision below is shaped by.

What it does over the boundary:

- **Pairs** by scanning a QR, tapping a `threadbase://pair` deep link (`app/pair.tsx:74`), or pasting a credential (`services/pair-exchange.ts:38-44`). The exchange generates a `nacl.box` keypair and opens a sealed API key with the server-supplied ephemeral key (`services/pair-exchange.ts:114-115`, `:175-183`).
- **Authenticates** with `Authorization: Bearer ${server.apiKey}` on REST (`services/api-client.ts:200`, `:324`, `:381`, `:521`) and `?key=` on the WebSocket (`services/ws-client.ts:122`).
- **Streams** terminal output, session events, permission cards and conversation lines over one WebSocket.
- **Stores** credentials in SecureStore (`stores/servers.ts:109`, `:162-165`) and a React Query cache in AsyncStorage (`services/query-client.ts:186-190`).
- **Renders** plaintext terminal output — it is one of the two endpoints and cannot be otherwise.

Two transport paths, both in scope: an `https://` Cloudflare tunnel whose TLS terminates at the edge, and a direct LAN `http://` that becomes `ws://` by string substitution (`services/ws-client.ts:122`).

The proposed design pins the streamer's identity key from the QR, runs a Noise `IKpsk1` handshake, seals every REST body and WebSocket frame with ChaCha20-Poly1305, moves the device static key into SecureStore, and makes a pinned pairing refuse plaintext forever.

---

## 2. Assets

| # | Asset | Where it lives today | Why it matters |
|---|---|---|---|
| A1 | **The shared API key, per server** | SecureStore (`stores/servers.ts:162`) | It is `admin` on the paired streamer (`tb-streamer/src/services/security/capabilities.ts:63-69`). A phone holding it can drive an agent that writes files and runs shell commands. |
| A2 | **Device static key `D_priv`** (new) | SecureStore, per server (design §5.2) | Possession *is* the device's identity once E2EE lands. |
| A3 | **The pinned bit + pinned `S_pub`** (new) | SecureStore, beside the server record (design §6) | The entire anti-downgrade control. If it is clearable, E2EE is optional. |
| A4 | **Rendered terminal content** | App memory; screenshots; the OS app switcher | Source code, secrets, shell output. |
| A5 | **Persisted query cache** | AsyncStorage, unencrypted (`services/query-client.ts:186-190`) | Conversation titles, previews, project names. |
| A6 | **Device token** | SecureStore (`stores/servers.ts:164`) | Written at pairing, never read back. A narrower credential that is not in use. |
| A7 | **The server URL** | SecureStore (`stores/servers.ts:109`) | Whoever controls it controls where prompts and uploads go. |
| A8 | **Drafts and session names** | SecureStore (`stores/drafts.ts:27`, `stores/sessionNames.ts:35`) | User-authored text, correctly already in the secure store. |

---

## 3. Trust boundaries

```
   ┌──────────────────────── Phone ────────────────────────┐
   │                                                        │
   │  Rendered terminal (A4) ◄── TB-M-A ── App JS runtime    │
   │                                            │            │
   │  SecureStore  ◄── TB-M-B ──────────────────┤            │
   │  (Keychain/Keystore; localStorage on web)  │            │
   │  AsyncStorage ◄── TB-M-C ──────────────────┤            │
   │  (plain files)                             │            │
   │                                            │            │
   │  Camera ◄─ TB-M-D: optical ── QR on the developer's screen
   │  Deep link / paste ◄─ TB-M-E: any sender ── a message, a page
   │                                            │            │
   │  Sentry / feedback ◄── TB-M-F ─────────────┤            │
   └────────────────────────────────────────────┼────────────┘
                                                │
                            TB-M-G  ════════════╪════════════►  Streamer
                            public internet / LAN, http+ws
```

| ID | Boundary | Untrusted side | Today |
|---|---|---|---|
| **TB-M-A** | App runtime ↔ rendered content | Nothing — the app is an endpoint | Plaintext by necessity. Out of scope. |
| **TB-M-B** | App ↔ SecureStore | OS-level attacker, jailbreak/root, iCloud restore | Keychain/Keystore on native; **`localStorage` on web** (`services/secure-store.web.ts`). |
| **TB-M-C** | App ↔ AsyncStorage | Anything with device file access | Plain files, no encryption. |
| **TB-M-D** | QR → camera | Whoever can see the screen | The out-of-band channel the design's server authentication depends on. |
| **TB-M-E** | Deep link / pasted credential | **Anyone who can send the user a link** | Reaches `parsePairUri` with no camera and no out-of-band channel (`app/pair.tsx:74`). |
| **TB-M-F** | App ↔ Sentry | Third-party crash reporting | Sanitized by `beforeSend`/`beforeBreadcrumb` (`services/sentry.ts:206-208`) — but **attachments never reach that hook** (`services/sentry.ts:465-468`). |
| **TB-M-G** | App ↔ streamer | Every intermediary | The design's target. Fully cleartext on the LAN path today. |

**The boundary the design most changes is TB-M-G. The boundary it most *depends* on is TB-M-D** — the QR is what makes server authentication possible, and TB-M-E is the same code path with that channel removed.

---

## 4. STRIDE threats

`Mit` = mitigated by the design (section cited) · `GAP` = the design leaves it open · `RES` = accepted residual, named in the design.

| ID | Cat | Threat | Affected component | Assumption relied on | Status |
|---|---|---|---|---|---|
| **TB-M-01** | S | A `threadbase://pair` **deep link** or pasted URI pairs the app to an attacker-controlled server. The app then streams the user's prompts and uploads to the attacker and renders attacker-authored terminal output as if it were their own agent | `app/pair.tsx:74` rebuilds the URI from route params; `services/pair-exchange.ts:38-44`, `:57-81` | That the user reads a confirmation dialog. A human control, not a cryptographic one | **Mit, weakly** (design §3.3 — confirmation gate for non-camera paths) |
| **TB-M-02** | S | MITM at pairing: the client opens the sealed box with whatever `ephemeralPublicKey` the response carried and cannot verify the responder | `services/pair-exchange.ts:175-183` | That `spk` is present in the QR and enforced | **Mit for E2EE pairings** (design §3.2); open on the legacy path |
| **TB-M-03** | T | Persistent relocation: `resolvedUrl = body.publicUrl ?? trimmedUrl`, validated only as http-or-https, so the responder chooses the URL the app uses from then on | `services/pair-exchange.ts:188`, `:83-93` | That the E2EE path carries `publicUrl` inside the authenticated handshake payload | **Mit on the E2EE path** (design §3.2); open on the legacy path |
| **TB-M-04** | I | The LAN path is cleartext — `url.replace(/^http/, 'ws')` yields `ws://`, carrying terminal output, prompts, and the admin key in the query string across the local network | `services/ws-client.ts:122` | That sealed frames make the scheme irrelevant, and that the ticket removes the credential from the URL | **Mit** (design §4.2, and tb-streamer design §3.5) |
| **TB-M-05** | I | `{ type: 'auth', token: this.apiKey }` is sent as the first frame on **every** connection, and the server has no handler for it | `services/ws-client.ts:179` vs `tb-streamer/src/server-wiring.ts:607-671` | None. It is a credential transmission with no reader | **Mit** (design §4.2 — delete it) |
| **TB-M-06** | T | Downgrade: a pinned server "becomes" an old one, or the handshake is made to fail so the client falls back | `services/api-client.ts`, `services/ws-client.ts`; design §6 | **That no "connect anyway" affordance is ever added.** This is a product-discipline assumption, and it is the one the whole design rests on | **Mit** (design §6 — hard failure, no fallback path) |
| **TB-M-07** | I | On the `web` target, keys live in `localStorage`, readable by any script achieving XSS on the origin | `services/secure-store.web.ts` | That web either refuses E2EE pairing or shows a weaker-storage banner | **Mit by disclosure only** (design §5.2) |
| **TB-M-08** | I | AsyncStorage persists conversation-derived data unencrypted; the `conversation` root is on the persist allow-list while the comment above it says bodies are not persisted | `services/query-client.ts:186-190`, `:197-202`, `:206-207` | That every query under that root remembers to opt out. Detail screens do (`app/conversation/[id].tsx:164`, `:321`); a future one might not | **Mit** (design §5.2 — invert to opt-in), residual per dilemma D-5 |
| **TB-M-09** | E | A jailbroken or rooted device reads SecureStore and the in-memory plaintext | `services/secure-store.ts:1` | That the phone is not compromised. Explicitly out of scope | **RES — out of scope, listed so it is not mistaken for a gap** |
| **TB-M-10** | D | Pure-JS ChaCha20 cannot keep up with the terminal stream, stalling the same JS thread that renders the terminal | design §2; dilemma D-3 | That `@stablelib` throughput is adequate at PTY chunk rates on a mid-range Android device | **GAP — unmeasured; the assumption most likely to be overturned** |
| **TB-M-11** | D | Strict WS counter closes and reconnects on any duplicate or reorder, so one intermediary artefact becomes a reconnect loop | design §4.2 | That a single TCP connection is ordered and gap-free through the whole RN WebSocket stack | **RES** (dilemma D-2 names the flip condition) |
| **TB-M-12** | I | A feedback screenshot bypasses Sentry's `beforeSend` — attachments never touch that hook — so a screenshot of a terminal showing secrets is uploaded unsanitized | `services/sentry.ts:465-468` | That the user chose to send it and knows what was on screen | **GAP — pre-existing, user-consented, unmitigated by content sanitization** |
| **TB-M-13** | S | SecureStore survives app uninstall by design, so credentials for a server the user believed removed persist across a reinstall — and `D_priv` will inherit that property | `stores/servers.ts:108` (the code's own comment), `:162-165` | That "remove server" deletes every key (`:201` deletes the device token) | **GAP — the design adds a key to a store with this property without addressing it** |
| **TB-M-14** | E | The device token is stored and never read — every request sends the **shared admin key**, so a compromised phone yields `admin` rather than the scoped credential its device row describes | `services/api-client.ts:200` vs `stores/servers.ts:164`, `:201` | That switching the header to the device token is safe with released streamers, which already accept it (`tb-streamer/src/api/middleware/auth.middleware.ts:71-86`) | **Mit** (design §4.1) |
| **TB-M-15** | R | No local record of which server or device an action targeted; the connection log carries a `serverId` and an event name only | `services/ws-client.ts:95-99` | That the server keeps the audit trail. It does not either — see `tb-streamer` TB-S-14 | **GAP — unaddressed on both sides** |
| **TB-M-16** | T | A malformed or wrong-length `spk` must be a hard error; if any code path ever treats it as "absent", one corrupted QR parameter becomes a silent downgrade to plaintext | design §3.2; `services/pair-exchange.ts:70-80` | That the parser distinguishes "absent" from "invalid" and always has | **Mit by specification** — needs a test, not a comment |
| **TB-M-17** | T | The pinned bit's storage location *is* the anti-downgrade control. In AsyncStorage it is clearable by anyone with device file access | design §6; contrast `services/query-client.ts:186-190` | That it goes to SecureStore and never to AsyncStorage | **Mit by specification** (design §6) |
| **TB-M-18** | T | The app renders content it does not author. Under TB-M-01 every `terminal_output` frame, `permission` prompt and `question` card is attacker-written and rendered as trusted UI. **E2EE makes this narrowly worse:** a pinned, encrypted, fingerprint-confirmed connection is the strongest trust signal the app has, and it says nothing about whether the peer is benign | `services/virtual-terminal.ts`; permission and question cards (`tb-streamer/src/types.ts:253`, `:258`) | That the paired server is the user's own machine. Authentication proves *which* peer, never *whether it should be trusted* | **GAP — and partly created by the design** |

### Abuse cases

| Use case | Abuse case | Covered by |
|---|---|---|
| "Tap a link my colleague sent to pair with their demo server" | "Tap a link an attacker sent and pair with theirs" | TB-M-01 |
| "Pair over my home Wi-Fi" | "Pair over a café's Wi-Fi with someone in the middle" | TB-M-02, TB-M-03 |
| "Use the app on my LAN without a tunnel" | "Read every prompt and grab the admin key off the same LAN" | TB-M-04 |
| "Reconnect when my phone wakes up" | "Collect the API key from the auth frame the app sends on every reconnect" | TB-M-05 |
| "Fall back gracefully when the server is old" | "Be an old server" | TB-M-06, TB-M-16 |
| "Send a screenshot with my bug report" | "Receive a screenshot of someone's terminal showing an API key" | TB-M-12 |
| "Remove a server I no longer use" | "Reinstall the app and find the credentials still there" | TB-M-13 |
| "Encrypt everything on the wire" | "Make encryption so slow the user turns it off — or the terminal unusable" | TB-M-10 |

---

## 5. DREAD scores

Rubric: 1–10 each on **D**amage, **R**eproducibility, **E**xploitability, **A**ffected users, **D**iscoverability. Ranked by sum.
Every score of 8 or above carries a one-line justification below the table.

| Rank | ID | Cat | D | R | E | A | Di | **Sum** |
|---|---|---|---|---|---|---|---|---|
| 1 | TB-M-04 | I | 9 | 10 | 6 | 7 | 7 | **39** |
| 2 | TB-M-01 | S | 9 | 9 | 7 | 7 | 6 | **38** |
| 3 | TB-M-14 | E | 8 | 10 | 6 | 9 | 4 | **37** |
| 4 | TB-M-05 | I | 7 | 10 | 6 | 8 | 4 | **35** |
| 5 | TB-M-02 | S | 9 | 7 | 5 | 6 | 6 | **33** |
| 5 | TB-M-06 | T | 9 | 7 | 5 | 6 | 6 | **33** |
| 5 | TB-M-16 | T | 9 | 8 | 6 | 5 | 5 | **33** |
| 8 | TB-M-03 | T | 8 | 8 | 5 | 5 | 5 | **31** |
| 9 | TB-M-18 | T | 7 | 9 | 5 | 5 | 4 | **30** |
| 10 | TB-M-07 | I | 8 | 8 | 5 | 3 | 5 | **29** |
| 11 | TB-M-08 | I | 5 | 8 | 4 | 7 | 4 | **28** |
| 11 | TB-M-10 | D | 5 | 7 | 4 | 7 | 5 | **28** |
| 11 | TB-M-15 | R | 3 | 9 | 8 | 6 | 2 | **28** |
| 14 | TB-M-13 | S | 6 | 8 | 4 | 6 | 3 | **27** |
| 14 | TB-M-17 | T | 8 | 7 | 4 | 5 | 3 | **27** |
| 16 | TB-M-12 | I | 6 | 8 | 3 | 4 | 4 | **25** |
| 17 | TB-M-09 | E | 9 | 6 | 3 | 2 | 3 | **23** |
| 18 | TB-M-11 | D | 5 | 6 | 3 | 5 | 3 | **22** |

**Justifications for scores ≥ 8**

- **TB-M-04 D=9** — the LAN path carries full terminal content *and* a replayable admin credential in a query string.
- **TB-M-04 R=10** — it is the steady state of that code path, not an exploit: every connection, every time.
- **TB-M-01 D=9** — the app becomes a remote control for someone else's machine and a live feed of the user's prompts and uploads to an attacker.
- **TB-M-01 R=9** — a link is a deterministic, repeatable delivery mechanism with no timing requirement.
- **TB-M-14 D=8** — the credential the phone actually holds is `admin`, not the read/control scope the device row describes.
- **TB-M-14 R=10 / A=9** — it is the code path on every request for every user of every version.
- **TB-M-05 R=10** — sent on every single connection, unconditionally.
- **TB-M-05 A=8** — every user, every reconnect, including every wake-from-background.
- **TB-M-02 D=9 / TB-M-06 D=9 / TB-M-16 D=9** — each hands the attacker the admin credential or returns the system to full plaintext, which is every other threat here at once.
- **TB-M-16 R=8** — a corrupted or stripped QR parameter is trivially repeatable.
- **TB-M-03 D=8** — the redirection is persisted, so it outlives the attacker's on-path position.
- **TB-M-03 R=8 / TB-M-07 R=8 / TB-M-08 R=8 / TB-M-12 R=8 / TB-M-13 R=8** — each is a deterministic property of the code path rather than a probabilistic exploit.
- **TB-M-07 D=8** — the value exposed on web is the API key, i.e. admin on the paired streamer.
- **TB-M-15 R=9 / E=8** — it is the absence of a control, so it holds on every action with no attacker effort.
- **TB-M-17 D=8** — clearing one stored bit disables the entire anti-downgrade defence.
- **TB-M-09 D=9** — a compromised device is a total compromise of that pairing, including `D_priv`.
- **TB-M-18 R=9** — once the peer is hostile, every rendered frame is under its control, on every screen, indefinitely.

---

## 6. Attack trees — top 3 by DREAD

Notation per `attack-tree-construction`: `(OR)` any child suffices, `(AND)` all children required.
Leaf attributes: **skill** / **cost** / **detection risk**.

### 6.1 TB-M-04 (39) — Harvest a developer's terminal and admin key off the LAN

```
[GOAL] Read terminal content and obtain a replayable credential from a nearby phone
  │
  ├── (AND) A. Be on the same network segment
  │     ├── A1. Join an open or shared Wi-Fi (café, co-working,
  │     │        conference, shared office)                        skill: none / cost: $  / detect: none
  │     ├── A2. Compromise or spoof the AP                         skill: med  / cost: $$ / detect: low
  │     └── A3. ARP/DNS spoof to become on-path                    skill: low  / cost: $  / detect: low
  │
  ├── (OR) B. Capture the plaintext
  │     ├── B1. Passive sniff of ws:// frames                      skill: low  / cost: $  / detect: none
  │     │        └── services/ws-client.ts:122
  │     ├── B2. Read ?key= from the upgrade request                skill: low  / cost: $  / detect: none
  │     │        └── the credential is IN the URL
  │     ├── B3. Read the redundant { type:'auth', token } frame     skill: low / cost: $  / detect: none
  │     │        └── services/ws-client.ts:179 — sent on every connect
  │     └── B4. Read the Bearer header off plain-http REST calls    skill: low / cost: $  / detect: none
  │
  └── (OR) C. Escalate
        ├── C1. Replay the key against POST /api/sessions/:id/input skill: low / cost: $ / detect: low
        │        └── session ids come free: the server unicasts the
        │            full session list on WS open
        │            (tb-streamer/src/server-wiring.ts:597-598)
        ├── C2. Use admin to set bypassPermissions, then drive
        │        a fresh session                                    skill: low / cost: $ / detect: med
        └── C3. Rotate the key and lock the owner out               skill: none / cost: $ / detect: high
```

**Where the design cuts the tree:** B1–B4 all fall. Frames are sealed (§4.2), the credential leaves the URL (ticket, server design §3.5), and the redundant `auth` frame is deleted.
Branch A is unchanged and unchangeable — the app cannot choose its network.
Branch C survives *if* a credential is obtained any other way, and C1's "session ids come free" step is not addressed by either design (see `tb-streamer` TB-S-05).

### 6.2 TB-M-01 (38) — Pair the app to an attacker's streamer

```
[GOAL] Become the "server" the user's app talks to
  │
  ├── (OR) A. Deliver a pair URI without the camera channel
  │     ├── A1. Send a threadbase://pair link in a message,
  │     │        an email, or a web page                            skill: none / cost: $ / detect: none
  │     │        └── app/pair.tsx:74 rebuilds and parses it
  │     ├── A2. Persuade the user to paste a URI or a raw API key   skill: low / cost: $ / detect: none
  │     │        └── services/pair-exchange.ts:38-44; the `api-key`
  │     │            branch skips the exchange entirely
  │     └── A3. Display a QR the user scans, believing it is theirs  skill: low / cost: $ / detect: low
  │              (a screen-share, a doc, a "setup guide")
  │
  ├── (AND) B. Survive the client's checks
  │     ├── B1. Present a valid pair token — trivial, the
  │     │        attacker runs the server                           skill: none / cost: $ / detect: none
  │     ├── B2. Present a matching spk — trivial for the same reason skill: none / cost: $ / detect: none
  │     │        └── pinning proves "the server in THIS QR", not
  │     │            "a server the user should trust"
  │     └── B3. Get past the confirmation gate (design §3.3)         skill: low / cost: $ / detect: HIGH
  │              └── a fingerprint the user has never seen before
  │                  is not a fingerprint they can evaluate
  │
  └── (OR) C. Profit
        ├── C1. Receive every prompt the user types                 skill: none / cost: $ / detect: none
        ├── C2. Receive every uploaded file                         skill: none / cost: $ / detect: none
        ├── C3. Render attacker-authored "agent output" and
        │        "permission" cards to phish further                skill: low  / cost: $ / detect: med
        └── C4. Sit as a relay in front of the real server if the
                 user was also given a genuine URL                  skill: med  / cost: $$ / detect: low
```

**Where the design cuts the tree:** almost nowhere, and this is the most important honest finding in the mobile half.
`spk` pinning defeats a MITM on a *legitimate* pairing (TB-M-02); it does nothing against a *fully attacker-operated* server, because the attacker controls the QR and the key in it.
The only control on this path is B3 — a human reading a fingerprint they have no baseline for. Its detection risk is high (the user might refuse) but its bypass difficulty is low (the user probably will not).
**This threat is not a cryptography problem and it will not be solved by more cryptography.**

### 6.3 TB-M-14 (37) — Get admin from a phone that should only have a scoped token

```
[GOAL] Hold admin on the streamer via the mobile client
  │
  ├── (OR) A. Obtain what the phone stores
  │     ├── A1. Read SecureStore on a jailbroken/rooted device      skill: high / cost: $$ / detect: low
  │     ├── A2. Read localStorage on the web target                 skill: med  / cost: $  / detect: low
  │     │        └── services/secure-store.web.ts (XSS on the origin)
  │     ├── A3. Restore a device backup that carried the Keychain
  │     │        item — SecureStore survives uninstall by design
  │     │        (stores/servers.ts:108)                            skill: med  / cost: $  / detect: none
  │     └── A4. Capture it in transit ──► 6.1 branch B
  │
  └── (AND) B. What you get is admin, not a scoped credential
        ├── B1. The stored apiKey is the LEGACY credential          — structural
        │        └── tb-streamer/src/services/security/capabilities.ts:63-69
        ├── B2. Every request sends it                              — structural
        │        └── services/api-client.ts:200, :324, :381, :521
        └── B3. The narrower deviceToken is written and never read  — structural
                 └── stores/servers.ts:164 (write), :201 (delete),
                     no read site anywhere
```

**Where the design cuts the tree:** branch B entirely, by switching the header to the device token (§4.1) — which is the C5 work finally being used rather than merely stored.
Branch A survives: A1 and A2 are out of scope and disclosed, but **A3 is neither**. The design adds `D_priv` to a store whose documented property is surviving uninstall, and says nothing about backup/restore semantics for it (TB-M-13).

---

## 7. Prioritized mitigations

Types per `threat-mitigation-mapping`: **P**reventive / **D**etective / **C**orrective.

### P0 — do these or the design does not deliver what it claims

| # | Control | Type | Difficulty | Closes |
|---|---|---|---|---|
| M1 | Seal every REST body and WS frame at the two module boundaries (`services/api-client.ts`, `services/ws-client.ts`), with a test asserting no plaintext body leaves either module on a pinned server | P | High | TB-M-04, TB-M-02 |
| M2 | Delete `{ type: 'auth', token }` (`services/ws-client.ts:179`). Do not implement it server-side — it is a credential sent to nothing. This is a one-line change that can ship **today**, ahead of everything else here | P | Trivial | TB-M-05 |
| M3 | Switch the `Authorization` header to the stored device token, which released streamers already accept (`tb-streamer/src/api/middleware/auth.middleware.ts:71-86`). Also shippable ahead of E2EE, and it is the difference between a lost phone leaking `admin` and leaking a revocable scope | P | Low | TB-M-14 |
| M4 | Store the pinned bit and pinned `S_pub` in SecureStore, never AsyncStorage, and hard-fail with no "connect anyway" affordance | P | Medium | TB-M-06, TB-M-17 |
| M5 | Treat a malformed `spk` as a hard error, with a test that distinguishes "absent" (legacy, allowed) from "invalid" (refuse). A comment is not sufficient for a control this load-bearing | P | Low | TB-M-16 |

### P1 — the human-factors controls the cryptography cannot provide

| # | Control | Type | Difficulty | Closes |
|---|---|---|---|---|
| M6 | Confirmation gate for the deep-link and paste paths — machine name, fingerprint, and an explicit confirm — with the camera path exempt because pointing a camera at a screen *is* the out-of-band channel | P | Medium | TB-M-01 |
| M7 | Make the confirmation meaningful rather than decorative: show whether this fingerprint has been seen before, and make a **first-ever** pairing visually distinct from a re-pair. A fingerprint with no baseline is not a security control | D | Medium | TB-M-01 (B3) |
| M8 | Warn on the `api-key` paste path that it can never be encrypted or pinned (`services/pair-exchange.ts:43`), rather than letting it silently produce a permanently unprotected server | D | Low | TB-M-01 (A2) |
| M9 | Decide and document `D_priv`'s backup/restore semantics — `WHEN_UNLOCKED_THIS_DEVICE_ONLY` as designed, plus an explicit "remove server" that deletes every key including the new one | P | Low | TB-M-13 |
| M9b | Keep the encryption indicator scoped to what it proves. "Encrypted to *this* machine" is true; anything that reads as "this connection is safe" is not, because authentication proves which peer and never whether that peer is benign | P | Low | TB-M-18 |

### P2 — at rest on the phone

| # | Control | Type | Difficulty | Closes |
|---|---|---|---|---|
| M10 | Invert `shouldPersistQuery` from opt-out to opt-in (`services/query-client.ts:213-218`) and bump `persistBuster` (`:195`), making the code match the comment that already claims bodies are not persisted | P | Low | TB-M-08 |
| M11 | Web target: refuse E2EE pairing outright, or show a persistent weaker-storage banner. It must not claim the native guarantee | P | Low | TB-M-07 |
| M12 | Warn in the feedback flow that a screenshot is uploaded as-is and bypasses content sanitization (`services/sentry.ts:465-468`) — the existing sanitizer is good and this is the one hole in it | D | Low | TB-M-12 |

### P3 — measure before believing

| # | Control | Type | Difficulty | Closes |
|---|---|---|---|---|
| M13 | Benchmark `@stablelib` seal/unseal at realistic `terminal_output` chunk rates on a mid-range Android device with the terminal rendering, **before** committing to pure JS. This decides dilemma D-3, and it is a measurement, not an argument | D | Medium | TB-M-10 |
| M14 | Instrument counter violations before relying on strict WS ordering, so an intermediary artefact is distinguishable from an attack | D | Low | TB-M-11 |
| M15 | Run all three suites on any change here — unit, integration, and the Maestro mock suite (`npm run test:e2e:mock`). `test:unit` alone is a false green for a change that touches a shared client module | D | Low | regression risk across M1–M4 |

**Defense-in-depth check.** The mobile half is Preventive-heavy and has essentially no Detective layer: the app cannot tell the user that anything unusual happened. For TB-M-01 — the second-highest-scoring threat and the one cryptography does not touch — M7 is the only real control, and it is a UI decision rather than a protocol one.

**Two of the P0 items are independent of E2EE and should not wait for it.** M2 and M3 are small, self-contained, and each removes a live exposure that exists in the shipped app today.

---

## 8. Open questions

1. **Does the confirmation gate actually help?** M6/M7 rest on a user evaluating a fingerprint they have never seen. Is there a better anchor — the streamer's `machineName` matched against a previously-paired one, a first-pairing-vs-re-pairing distinction, anything that gives the user a baseline? Without one, the control against TB-M-01 is decorative.

2. **Should the `api-key` paste path survive at all?** It cannot be pinned, cannot be encrypted, and produces a permanently unprotected server record. Is it load-bearing for any real user, or is it a debugging affordance that outlived its purpose?

3. **What is `D_priv`'s backup/restore story?** SecureStore survives uninstall by the code's own account (`stores/servers.ts:108`). The design specifies `THIS_DEVICE_ONLY` for the new key, which means a restored device must re-pair — is that acceptable product behaviour, and does "remove server" delete every key including it? (TB-M-13)

4. **Native crypto module: yes or no?** Everything about the record layer's viability on the terminal stream rests on this, and it is a product decision about `pod install` churn and web-target parity, not a security one. (dilemma D-3, TB-M-10)

5. **Is the persist allow-list or the comment the intended contract?** `services/query-client.ts:197-202` allows the `conversation` root while `:206-207` says bodies are not persisted. Today the detail screens opt out, so both are true — but a new query under that root would silently persist message content. (TB-M-08)

6. **Should the app keep any local security log?** Neither side records which device did what (TB-M-15 here, TB-S-14 in the streamer). If the answer is "the server owns the audit trail", the server needs to actually build one; if it is "nobody does", that should be a written decision rather than a gap.

7. **`{ type: 'auth', token }` — was there ever a server handler?** `services/ws-client.ts:179` sends it; `tb-streamer/src/server-wiring.ts:607-671` has no branch for it. Removing it is safe against every streamer that exists today, but confirming there was never a version that required it would make that a certainty rather than an inference.

8. **How much trust should the encryption indicator convey?** TB-M-18 is the one place this design makes something worse: a pinned, encrypted, fingerprint-confirmed connection is the app's strongest trust signal, and against an attacker-operated server it is fully earned and completely misleading. The wording constraint in design §7 covers *which ends*; it does not cover *which peer*, and the two are different claims. Worth deciding before any padlock icon ships.
