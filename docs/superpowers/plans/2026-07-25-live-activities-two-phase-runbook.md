# Live Activities + Dynamic Island — Two-Phase Implementation Runbook

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running session appears as a glanceable live surface — project name, status, elapsed time, latest terminal line — on the iPhone Lock Screen and Dynamic Island (Phase 1), and as an Android promoted ongoing notification (Phase 2). Tapping deep-links into `app/session/[id]`.

**Architecture:** The existing WebSocket `session_update` stream drives a reconciler that starts / updates / ends Live Activities. No new transport, no backend change, no custom native module.

**Tech stack:** `expo-widgets` (stable since SDK 56) + `@expo/ui/swift-ui`. Repo is on Expo SDK 57.0.1 / RN 0.86.

**Branch:** `docs/live-activities-runbook`, cut from `integration-merge-354-355-376` at `f2242bc4`.

**Source brief:** [`live-activities.md`](../../../live-activities.md) — Feature 12 in [`docs/ROADMAP.md`](../../ROADMAP.md#feature-12--live-activities--dynamic-island-for-in-progress-sessions), promoted from [`docs/IDEAS.md`](../../IDEAS.md) Idea 7.

---

## Feature 12's roadmap text is stale — read this first

All line references below are verified against `integration-merge-354-355-376`, **not** `main` (the two have diverged; `services/push.ts` in particular differs).

| Roadmap / brief claim | Reality on this branch |
|---|---|
| "check the current Expo **SDK 55** ecosystem status" | Repo is on **SDK 57.0.1**, RN 0.86 (`package.json`). |
| "or `expo-live-activities` once stable" | `expo-live-activity` (software-mansion-labs) is **deprecated**; its README points at `expo-widgets`. The package name in the roadmap never existed. |
| "a new native module … `modules/live-activities/`" | **Not needed.** `expo-widgets` went stable in SDK 56 with a complete Live Activity API. There is no `modules/` dir in the repo and this runbook does not create one. This deletes the ~2 weeks the roadmap budgeted for "the spiky part". |
| "push tokens already wired in `services/push.ts`" | Client-side only. The streamer endpoint is a **no-op stub**: `app.post("/api/push/register", (c) => c.json({ ok: true }))` (`tb-streamer src/api/routes/misc.routes.ts:99`). It stores nothing and sends nothing. |
| "Push updates via APNs … fed by the existing WS `session_update` stream" | These are two different transports and the app has only the WS one working. `services/push.ts:40` uses `getExpoPushTokenAsync()` — an **Expo relay token**. ActivityKit updates need **direct APNs** (`apns-push-type: liveactivity`, topic `<bundleId>.push-type.liveactivity`, p8 key). Expo's relay does not proxy that. |
| "iOS has a per-app limit (around 5–8 concurrent activities)" | The limit is **5**. |
| "12-hour Apple cap" | Precisely: **8h active + up to 4h more on the Lock Screen = 12h** maximum. |
| Android: "a foreground service notification" | An FGS is **not required**. Android 16 promotes an ongoing notification to a status-bar chip via `setRequestPromotedOngoing` + `POST_PROMOTED_NOTIFICATIONS`. See Decision 4. |

**Two doc paths in the brief do not exist on this branch.** `docs/roadmap/index.md` and `docs/roadmap/tasks/smartwatch-session-surfaces.md` live only on the unmerged branch `origin/docs/smartwatch-roadmap`. Links to them are marked as pending throughout.

**Filename note:** the brief asked for `live-activities-two-phase-runbook.md`. Every other file in `docs/superpowers/plans/` uses a `YYYY-MM-DD-` prefix, so this doc follows the house convention instead.

---

## 1. Goal & non-goals

### Goal

A session in `running` or `waiting_input` becomes a live surface showing project name, status, a self-ticking elapsed timer, and the latest terminal line. Tapping it opens `/session/<id>?server=<serverId>`.

### Non-goals for this runbook

- **No `modules/live-activities/`** — obsolete, see the stale-roadmap table.
- **No streamer changes in Phase 1a.** Phase 1b scopes them; they do not block 1a.
- **No "Make live" button.** See Decision 1.
- **No watch work.** See §9.
- **No hand-styled `minimal` or expanded Island layouts in v1.** They render as system defaults by choice (Decision 3).
- **In Phase 1a: no updates while the app is fully suspended, and no renewal past ~8h.** Both are honest limitations of the WS-only path, made visible via `staleDate`. Phase 1b fixes both.

---

## 2. Current-state findings

### The session model

`types/api.ts:4` — the wire enum has **no terminal state**:

```ts
export type SessionStatus = 'running' | 'waiting_input' | 'idle'
```

`'idle'` means both "never started" and "finished". Three different end-of-life signals are used in different places today: `completedAt` being set, `ptyAttached === false && status === 'idle'`, and the `notification` WS frame. Decision 6 picks one.

This branch carries fields `main` does not — `sessionName`, `model`, `effort`, `permissionMode`, `ownership`, `processLiveness` (`types/api.ts:6-70`). Two matter here:

```ts
ownership?: 'managed' | 'external' | 'historical'
processLiveness?: 'alive' | 'gone' | 'unknown'
```

`processLiveness: 'gone'` is a cleaner "this is over" signal than the three legacy heuristics. Decision 6 uses it as a secondary check.

`serverId` is **not** on `Session`. It is on the wrapper at `types/api.ts:398`:

```ts
export interface MultiSession extends Session {
  serverId: string
  serverLabel?: string
}
```

Identity is always the `(serverId, sessionId)` pair, never `sessionId` alone.

`elapsedMs` is a **server-pushed snapshot, not a clock**. Nothing in the app ticks it; the UI shows a frozen value until the next `session_update`. This is exactly why the activity must receive `startedAt` and let iOS render a native self-ticking timer.

### The update path

`app/_layout.tsx:120` — inside the `[activeServerIds]` effect:

```ts
const unsubUpdate = wsManager.onAll('session_update', (msg) => {
  if (msg.type !== 'session_update') return
  ...
  const key = ['session', msg.serverId, msg.session.id]
  ...
})
```

Every status change funnels through this one place, and `serverId` is already stamped. It is the correct and only sensible hook point.

**Attach inside this same effect, not elsewhere.** `services/ws-client.ts:341`:

```ts
/** Register a handler across ALL active (and future) clients for a given message type. */
onAll(type: string, handler: ServerMessageHandler): () => void {
  const unsubs: (() => void)[] = []
  for (const [serverId, client] of this.clients) {
    ...
  }
}
```

The docstring says "and future clients" but the loop only iterates clients that exist at call time. A second `onAll` call made from a different lifecycle would silently miss any server connected later. Attaching inside the existing `[activeServerIds]` effect side-steps this, because the effect re-runs whenever that list changes.

Session state lives in the **TanStack Query cache** (`['session', serverId, sessionId]`), not in Zustand. `stores/sessions.ts` holds only prompt queues.

### Deep links

Scheme is `threadbase` (`app.json:7`), registered on both platforms. Routing is filesystem-based via expo-router — there is no explicit `linking` config. The canonical shape, used at `app/_layout.tsx:160`:

```ts
const target = `/session/${msg.session.id}?server=${msg.serverId}`
```

**Cold-start gap (verified: zero hits for `getLastNotificationResponseAsync` / `useLastNotificationResponse` across `app/`, `hooks/`, `services/`).** A tap that launches the app from a terminated state lands on `/`, not the session. Lock Screen taps are overwhelmingly cold-start, so Phase 1a must fix this or the feature's primary interaction is broken. Task 6.

### Native configuration

- `app.json` sets `deploymentTarget: "16.4"` — above the 16.1 Live Activity floor and the 16.2 push floor. **No bump needed.**
- `ios/Threadbase/Threadbase.entitlements` has `aps-environment` (`development`) but **no App Group**.
- `ios/Threadbase/Info.plist` has **no `NSSupportsLiveActivities`**.
- The Xcode project has exactly **one target** (`productType = com.apple.product-type.application`); `ios/Podfile.properties.json` shows `"targets":[]`.
- `plugins/` contains one plugin, `withAndroidReleaseSigning.js` — Android-only. There is **no iOS config-plugin precedent** in this repo.
- Android manifest declares **no** `POST_NOTIFICATIONS`, no `FOREGROUND_SERVICE*`, and **no `<service>` elements at all**.

### The riskiest unknown — CNG vs committed native dirs

`expo-widgets` is documented as a **CNG** library: its config plugin generates the widget-extension target during `expo prebuild`. This repo instead **commits** hand-maintained `ios/` and `android/`, and CLAUDE.md requires `prebuild --no-clean` to preserve them.

Whether the plugin injects a new `PBXNativeTarget` into an **existing** committed `project.pbxproj` under `--no-clean` is undocumented. Compounding it, `ios/Podfile:58` opens a `post_install` hook that strips `SwiftUICore` from `OTHER_LDFLAGS` and injects `-Xfrontend -disable-autolink-framework -Xfrontend SwiftUICore` into every pod target (an Xcode 26 workaround). A Live Activity widget *is* SwiftUI + WidgetKit, so the extension may need the inverse treatment.

**This is Task 1, a hard-timeboxed spike.** Everything else is cheap; this is the one thing that can invalidate the approach.

### Testing constraints

`e2e/README.md` documents that Maestro cannot even reliably tap hub rows (iOS a11y aggregation drops `testID`). **Maestro drives the app only — it can see neither the Dynamic Island nor the Lock Screen.** Stated explicitly so nobody burns a day trying. Native mocks are centralized in `jest.setup.js` (25 `jest.mock` calls), not `__mocks__/`.

---

## 3. Decisions

| # | Question | Decision | Rationale |
|---|---|---|---|
| 1 | Auto-promote vs opt-in | **Auto-promote, cap 3, LRU-evict. No "Make live" button in v1.** | 5 is the hard ceiling. A cap of 3 leaves headroom for another app surface and for churn. Auto-promotion *is* the product promise — a manual button means opening the app to configure the thing that saves you opening the app. ✅ *Confirmed with product.* |
| 2 | 12-hour cap | **Phase 1a: `staleDate` only, no renewal. Phase 1b: full background renewal via silent push.** | Background renewal is the desired end state, but it needs the APNs stack — the same infrastructure Phase 1b builds anyway. Doing both in 1b is one build-out instead of two. 1a greys out honestly in the meantime. ✅ *Confirmed with product (renewal = D, sequenced into 1b).* |
| 3 | Island presentations | **Lock Screen `banner` + `compactLeading` / `compactTrailing` only.** `minimal` and expanded stay system-default in v1. | Compact is the state the Island occupies ~95% of the time; it carries the value at roughly half the cost of all five. `minimal` and expanded still render — just unstyled. Revisit once real usage shows how often the cap-3 multi-activity (minimal) state is hit. ✅ *Confirmed with product.* |
| 4 | Android FGS | **No foreground service.** Promoted ongoing notification via `setRequestPromotedOngoing` + `POST_PROMOTED_NOTIFICATIONS`. | An FGS needs a justifiable type, drains battery, and invites Play policy review. The app is not doing background work — the *server* is. Below API 36 this degrades to a plain ongoing notification, which is an acceptable v1 floor. |
| 5 | Update path | **Phase 1a = WS-only, ships alone. Phase 1b = APNs stack + background renewal.** | The streamer's push endpoint is a stub and Expo tokens cannot carry ActivityKit payloads. WS already delivers the exact data needed, for free — so 1a is mergeable and device-validated with zero backend work, satisfying the brief's "iOS ships before Android" constraint. ✅ *Confirmed with product.* |
| 6 | Content-state schema + terminal state | **Flat, primitives only.** `startedAt` as epoch ms. `lastOutput` truncated to 90 chars. End the activity when `processLiveness === 'gone'`, or `completedAt` is set, or (`status === 'idle' && !ptyAttached`). | The state crosses a native bridge and will later ride a 4 KB APNs payload. Primitives keep it cheap and typed — no `any`/`unknown` (repo rule). The three-way terminal check covers managed, external, and legacy servers. |
| 7 | Test strategy | **Unit** (pure helpers) + **integration** (mocked native module) + **manual device checklist**. Maestro is out. | Maestro cannot observe the Island or Lock Screen at all. Keeping all branching logic in pure helpers is what makes this testable without a device. |

**Needs product confirmation before coding:** Decision 2 (accepting a hard stop at 8h) and Decision 3 (whether Lock Screen alone would do for v1, which would cut Task 4 roughly in half).

---

## 4. Architecture

```
tb-streamer
    │  WS frame: { type: 'session_update', session: Session }
    ▼
services/ws-client.ts  ── wsManager.onAll(...) stamps { ...msg, serverId }
    │
    ▼
app/_layout.tsx  [activeServerIds] effect          ← the ONE hook point
    ├─→ queryClient.setQueryData(...)               (existing behavior, untouched)
    └─→ liveActivity.reconcile(serverId, session)   (new)
              │
              ▼
      services/live-activity.ts   ── pure decide() + native side effects
              │  start / update / end, cap 3, LRU-evict
              ▼
      widgets/SessionLiveActivity.tsx   (expo-widgets, @expo/ui/swift-ui)
              │
              ▼
      Lock Screen + Dynamic Island ──tap──▶ threadbase://session/<id>?server=<serverId>
                                                        │
                                                        ▼
                                              app/session/[id].tsx
```

**Reconciler contract.** On every `session_update`:

1. Compute `LiveSessionState` from the `Session`.
2. Terminal (Decision 6) → `end()` that activity, release its slot.
3. Live and already tracked → `update()`.
4. Live and untracked → `start()` if a slot is free; else evict the least-recently-updated live activity and take its slot.

Steps 2–4 are a **pure function** (`decideActions`) returning a list of actions. Only the thin caller touches the native module, which is what makes this unit-testable with no device and no mocking beyond the module boundary.

---

## 5. Shared content-state contract

Used by both phases. New file, `types/live-activity.ts`:

```ts
/** Status shown on a live surface. Narrower than SessionStatus: terminal sessions end the activity. */
export type LiveActivityStatus = 'running' | 'waiting_input'

/**
 * Content state for one live session surface.
 * Flat primitives only — this crosses a native bridge and will later ride a
 * 4 KB APNs payload. `startedAt` is epoch ms so the OS can tick its own timer
 * instead of us pushing per-second updates.
 */
export interface LiveSessionState {
  sessionId: string
  serverId: string
  projectName: string
  status: LiveActivityStatus
  startedAt: number
  lastOutput: string
  serverLabel?: string
}

/** Max concurrent activities. iOS allows 5; 3 leaves headroom. See Decision 1. */
export const MAX_LIVE_ACTIVITIES = 3

/** Terminal-line budget. Dynamic Island compact slots are very narrow. */
export const LAST_OUTPUT_MAX_CHARS = 90
```

`elapsedMs` is deliberately **absent** — it is a stale snapshot (§2). The surface renders a native timer from `startedAt`.

---

## 6. Phase 1 — iOS

Phase 1 is split so iOS ships and validates without any backend work (the brief's hard constraint):

- **Phase 1a — WS-driven, no backend.** Tasks 1–8. Mergeable and device-verifiable alone. Long sessions grey out at ~8h via `staleDate`.
- **Phase 1b — APNs stack + background renewal.** Tasks 9–11, §8. Cross-repo. Adds updates while suspended *and* the renewal that removes the 8h ceiling — one build-out, since both need the same infrastructure.

### Prerequisites

- Xcode 26.x (matching the `ios/Podfile` SwiftUICore hook).
- A physical device on iOS 16.4+. **The simulator does not render the Dynamic Island Live Activity reliably** — Lock Screen only. Island verification is device-only.
- Apple Developer team `GUW6BN8X57`; App Group provisioning permitted.
- No `deploymentTarget` bump needed (already 16.4).

### Dependencies and config

```bash
npx expo install expo-widgets @expo/ui
```

`app.json` — add to `plugins`:

```json
[
  "expo-widgets",
  {
    "bundleIdentifier": "com.ronenmars.threadbase.widgets",
    "groupIdentifier": "group.com.ronenmars.threadbase",
    "widgets": [
      {
        "name": "SessionLiveActivity",
        "displayName": "Session",
        "description": "Live status for a running Claude Code session."
      }
    ]
  }
]
```

`enablePushNotifications` is **omitted** in Phase 1 — it is a Phase 1b concern (Decision 5).

The plugin adds `NSSupportsLiveActivities` and the App Group entitlement. **Always `--no-clean`:**

```bash
npx expo prebuild --platform ios --no-clean
cd ios && pod install && cd ..
```

Commit `package.json`, `package-lock.json`, and `ios/Podfile.lock` together (CLAUDE.md rule).

### File map

| Path | Action | Why |
|---|---|---|
| `types/live-activity.ts` | **Add** | Shared contract (§5). |
| `services/live-activity.ts` | **Add** | Pure `decideActions` + thin native caller. |
| `services/live-activity.web.ts` | **Add** | No-op shim; the app supports Expo Web and this module is native-only. |
| `widgets/SessionLiveActivity.tsx` | **Add** | The five presentations. |
| `app/_layout.tsx` | **Modify** | One call inside the existing `[activeServerIds]` effect (~line 120) + cold-start handling. |
| `app.json` | **Modify** | Plugin block above. |
| `scripts/git-hooks/ci-paths.txt` | **Modify** | `widgets/` is a new top-level source dir. |
| `docs/ci-significant-paths.md` | **Modify** | Mirror the entry with a one-line reason. |
| `docs/expo-web-support.md` | **Modify** | Record the native-only blocker. |
| `jest.setup.js` | **Modify** | Mock `expo-widgets`, following the `expo-notifications` block's style. |
| `services/ws-client.ts` | **No change** | Already stamps `serverId`. |
| `types/api.ts` | **No change** | `Session` already carries every needed field. |

### Task 1 — Spike: does the plugin work on committed native dirs? *(½ day, hard timebox)*

The one thing that can invalidate the approach. Do not start Task 2 until this resolves.

- [ ] Branch from `docs/live-activities-runbook`; install `expo-widgets` + `@expo/ui`; add the `app.json` plugin block.
- [ ] Run `npx expo prebuild --platform ios --no-clean`.
- [ ] **Pass criteria, all four:**
  - A second `PBXNativeTarget` with `productType = com.apple.product-type.app-extension` exists in `ios/Threadbase.xcodeproj/project.pbxproj`.
  - `ios/Podfile`'s `post_install` SwiftUICore hook (line ~58) is **unmodified**.
  - `npx expo run:ios --device` builds and launches.
  - `git diff --stat ios/` is reviewable, not a full regeneration.
- [ ] **On failure**, record which criterion failed, then fall back: write `plugins/withLiveActivityTarget.js` using `withXcodeProject`, modeled on `plugins/withAndroidReleaseSigning.js` — tagged `mergeContents`, idempotent across prebuild, and a **loud throw** when the anchor stops matching. Budget +1–2 days.
- [ ] If the extension hits the Xcode 26 SwiftUICore link error, apply the inverse of the Podfile hook to the extension target and note it in the runbook.

**Verify:** app builds and runs on a physical device with the widget target present.

### Task 2 — Shared contract and pure helpers

No native code, fully unit-testable. Land this even if Task 1 is still in flight.

- [ ] Add `types/live-activity.ts` exactly as §5.
- [ ] In `services/live-activity.ts`, add pure exports:
  - `toLiveState(session: Session, serverId: string): LiveSessionState | null` — returns `null` when terminal (Decision 6). Truncates `lastOutput` to `LAST_OUTPUT_MAX_CHARS` on a word boundary where possible, collapsing whitespace and stripping ANSI escapes.
  - `isTerminal(session: Session): boolean` — `processLiveness === 'gone' || !!completedAt || (status === 'idle' && !ptyAttached)`.
  - `decideActions(tracked, incoming): LiveActivityAction[]` — start / update / end / evict, honoring `MAX_LIVE_ACTIVITIES` with LRU eviction.
- [ ] Unit tests, `__tests__/unit/services/live-activity.test.ts`:
  - `running` and `waiting_input` map to a live state; each terminal signal independently returns `null`.
  - Truncation respects the cap; ANSI escapes are stripped.
  - 4th concurrent session evicts the least-recently-updated, not the oldest-started.
  - A session flipping terminal frees its slot for a waiting session.

**Verify:** `npx jest __tests__/unit/services/live-activity.test.ts` passes. No native module imported by this file's pure section.

### Task 3 — The widget

- [ ] Add `widgets/SessionLiveActivity.tsx` using `createLiveActivity`. **v1 designs two surfaces only** (Decision 3):
  - `banner` — Lock Screen: project name, status pill, native timer, truncated last line.
  - `compactLeading` — status icon. `compactTrailing` — native timer.
  - `minimal` and `expanded*` — **leave unimplemented in v1.** They still render as system defaults; do not hand-style them. Add a comment saying this is deliberate so the next reader does not "fix" it.
- [ ] Render elapsed with the **system timer** driven by `startedAt`. Never push a per-second update.
- [ ] Colors come from existing theme tokens; **no emoji** anywhere (CLAUDE.md). Note that in-app UI uses Phosphor icons, but the widget renders through `@expo/ui/swift-ui` and cannot import Phosphor — use SF Symbols there and say so in a comment.
- [ ] Extract any multi-branch UI string into a named `const` above the return (CLAUDE.md).
- [ ] Add `widgets/` to `scripts/git-hooks/ci-paths.txt` **and** mirror it in `docs/ci-significant-paths.md`.

**Verify:** builds; Lock Screen activity renders when started manually from a dev button or test hook.

### Task 4 — Reconciler + wiring

- [ ] In `services/live-activity.ts`, add the impure layer: a module-level `Map` of tracked activities keyed `` `${serverId}::${sessionId}` `` (matching `stores/sessions.ts`'s existing compound-key convention), and `reconcile(serverId, session)` applying `decideActions` to the `expo-widgets` instance API.
- [ ] On app start, call `SessionLiveActivity.getInstances()` and adopt anything already running (survives an app restart mid-session), ending orphans whose session is no longer live.
- [ ] Add `services/live-activity.web.ts` exporting the same signatures as no-ops, so Metro's platform resolution keeps web working.
- [ ] Wire into `app/_layout.tsx` **inside the existing `[activeServerIds]` effect**, in the `onAll('session_update')` handler at ~line 120, immediately after the existing cache writes. Add nothing to the effect's dependency array.
- [ ] Guard with `Platform.OS === 'ios'` for now; Phase 2 replaces the guard with the platform-split module.
- [ ] Mock `expo-widgets` in `jest.setup.js` in the house style — section banner comment, `jest.fn()` per method, a comment explaining any non-obvious stub.
- [ ] Integration test `__tests__/integration/components/LiveActivity.reconcile.test.tsx`: a simulated `session_update` starts an activity; a terminal update ends it; a 4th start evicts.

**Verify:** `npm run test:unit && npm run test:integration` green. On device, starting a session raises a Live Activity within ~1s.

### Task 5 — Deep link into the session

- [ ] Pass the URL as `start()`'s second argument: `` `threadbase://session/${sessionId}?server=${serverId}` `` — matching the shape already used at `app/_layout.tsx:160`.
- [ ] Confirm warm-tap routes correctly through the existing expo-router filesystem linking (no `linking` config change should be needed).

**Verify:** tapping the activity with the app backgrounded opens the right session on the right server.

### Task 6 — Cold-start deep link (existing gap)

Verified: `getLastNotificationResponseAsync` / `useLastNotificationResponse` appear **nowhere** in `app/`, `hooks/`, or `services/`. Lock Screen taps are mostly cold-start, so without this the feature's main interaction silently fails.

- [ ] In `app/_layout.tsx`, handle the launch-time URL/notification response and route once servers have hydrated.
- [ ] Respect the existing nav races: `AuthGate`'s `router.replace('/')` and the `shouldSkipAutoNav` guard (`lib/sessionNavGuard`) — a deep link arriving before hydration must not be stomped.
- [ ] Integration test: cold start with a pending session URL lands on `/session/<id>`, not `/`.

**Verify:** force-quit the app, tap the Live Activity, land on the correct session.

### Task 7 — Lifecycle, expiry, and honesty

- [ ] Set `staleDate` ≈ 8h from `startedAt` so an expired activity greys out rather than lying (Decision 2). **Phase 1a stops here** — no renewal. Phase 1b (Task 10) removes this ceiling.
- [ ] End with dismissal policy `'immediate'` on terminal, so a finished session does not linger.
- [ ] Handle WS disconnect: on `onAnyStatusChange` → disconnected, mark surfaces stale rather than ending them (the session is probably still alive; we just cannot see it).
- [ ] Document the suspended-app limitation in `docs/expo-web-support.md`'s sibling location or a short note in the feature docs.

**Verify:** kill the WS; the activity goes stale instead of vanishing or freezing a lie.

### Task 8 — Verification checklist and exit criteria

Manual device checklist (Maestro cannot do any of this):

- [ ] Lock Screen: project, status, ticking timer, last line — all correct and legible.
- [ ] Dynamic Island **compact** (the default state) on a physical Island-capable device.
- [ ] `minimal` (two activities at once) and **expanded** (long-press) render as system defaults without visual breakage — they are deliberately unstyled in v1 (Decision 3). Confirm they look acceptable, not broken.
- [ ] Timer ticks with the app force-quit (proves native timer, not JS).
- [ ] `waiting_input` is visually distinct from `running` at a glance.
- [ ] 4 concurrent sessions → exactly 3 activities, least-recently-updated evicted.
- [ ] Terminal session → activity disappears.
- [ ] Tap: warm **and** cold start both land on the right session and server.
- [ ] Dark and light appearance.
- [ ] Simulator caveat confirmed: Lock Screen renders, Island does not — do not treat that as a bug.

**Phase 1a exit criteria:** all of the above pass on a physical device; `npm run test:unit`, `test:integration`, `lint`, `typecheck` green; no `any`/`unknown` introduced; `ios/Podfile.lock` committed alongside the package changes; `ci-paths.txt` and `docs/ci-significant-paths.md` in sync. **1a ships here — do not wait on 1b.**

### Phase 1b — Tasks 9–11 *(cross-repo; does not block 1a)*

Build the APNs stack and background renewal together — they need identical infrastructure.

- [ ] **Task 9 — APNs plumbing.** Set `enablePushNotifications: true` in the `expo-widgets` plugin block. Capture ActivityKit tokens via `addPushToStartTokenListener` (app-wide) and `instance.getPushToken()` (per-activity). Extend the register payload with a token `kind` — these are **not** Expo tokens. Streamer work per §8.
- [ ] **Task 10 — Background renewal (Decision 2, option D).** ~30 min before `staleDate`, the streamer sends a silent push that ends the activity and starts a replacement carrying the original `startedAt`, so the displayed elapsed time stays continuous across the swap. Renew only while the session is still live; never renew a terminal one.
- [ ] **Task 11 — Verify renewal.** An 8h+ session keeps its surface with the app never opened; elapsed time reads continuously across the renewal boundary (no reset to 0:00); a session that ends during the renewal window does not resurrect.

**Phase 1b exit criteria:** a >8h session retains a live, accurate surface with the app fully suspended throughout; APNs update budget respected (no per-second traffic — the timer is native).

---

## 7. Phase 2 — Android

Does not block and does not modify Phase 1's merged behavior beyond swapping a platform guard for a platform-split module.

**Live Updates vs plain ongoing notification — pick for v1:** **promoted ongoing notification**, no foreground service (Decision 4). On Android 16+ (API 36) `setRequestPromotedOngoing` yields the status-bar chip; below that it degrades to an ordinary ongoing notification, which is an acceptable floor. There is no Dynamic Island equivalent on Android and this runbook does not pretend otherwise — the honest UX is a persistent notification plus, on 16+, a compact status-bar chip.

### Requirements

Verified against Android docs. A promoted ongoing notification must:

- declare `android.permission.POST_PROMOTED_NOTIFICATIONS` (non-runtime) **and** `POST_NOTIFICATIONS` (runtime, API 33+ — currently declared nowhere in the manifest);
- request promotion via `setRequestPromotedOngoing(true)`;
- use Standard, `BigTextStyle`, `CallStyle`, `ProgressStyle`, or `MetricStyle`;
- be **ongoing**, have a `contentTitle`, and use a channel that is **not** `IMPORTANCE_MIN`;
- **not** set `customContentView`, **not** be a group summary, **not** be `colorized`.

Chip text comes from `setShortCriticalText`; elapsed uses `setWhen` + `setUsesChronometer(true)` — the Android analogue of iOS's native timer, so again **no per-second pushes**.

### Tasks

- [ ] Confirm `compileSdk` ≥ 36 (currently inherited from Expo defaults via `rootProject.ext`); raise through `expo-build-properties` if short.
- [ ] Add `POST_NOTIFICATIONS` + `POST_PROMOTED_NOTIFICATIONS` to `app.json` → `android.permissions`.
- [ ] Add `services/live-activity.android.ts` implementing the same exported signatures against `expo-notifications`, reusing `decideActions` unchanged from Task 2.
- [ ] Create a dedicated channel at `IMPORTANCE_DEFAULT` (not MIN, or promotion is refused).
- [ ] `contentIntent` → `threadbase://session/<id>?server=<serverId>`; the existing `MainActivity` intent filter (`launchMode="singleTask"`, `threadbase` scheme) already handles it — no manifest change needed.
- [ ] Gate promotion on `NotificationManager.canPostPromotedNotifications()`; fall back silently to a plain ongoing notification.
- [ ] Remove the `Platform.OS === 'ios'` guard added in Task 4.
- [ ] Unit-test the Android mapping; reuse the shared `decideActions` tests untouched.

### Verification and exit criteria

- [ ] Android 16+ device: status-bar chip appears, shows a ticking chronometer, tap deep-links correctly.
- [ ] Android 13–15 device: plain ongoing notification, no crash, no permission error.
- [ ] Permission denied → app still functions, no activity, no error dialog.
- [ ] Cap of 3 holds; terminal sessions clear their notification.
- [ ] **OEM caveat:** verify on at least one aggressive-battery OEM (Samsung / Xiaomi), where ongoing notifications can be culled. Document what you find — do not promise uniform behavior.

---

## 8. Streamer / backend follow-ups — Phase 1b *(cross-repo, non-blocking)*

Required for **two** Phase 1b capabilities that share this infrastructure: updates while the app is suspended, **and** background renewal past the 8h cap (Decision 2). **Not required for Phase 1a to ship.**

Current state: `tb-streamer src/api/routes/misc.routes.ts:99` is a stub returning `{ ok: true }`, storing nothing.

Required work, in order:

1. **Mobile:** obtain ActivityKit tokens — `addPushToStartTokenListener` (app-wide) and `instance.getPushToken()` (per-activity). These are *not* Expo push tokens; a new endpoint or an extended `PushRegisterPayload` is needed to carry a token `kind`.
2. **Streamer:** persist tokens (the current endpoint discards them).
3. **Streamer:** a **direct APNs** sender — Expo's relay cannot do this. Requires an APNs p8 key, `apns-push-type: liveactivity`, `apns-topic: com.ronenmars.threadbase.push-type.liveactivity`, `apns-priority: 5` or `10`, and an `aps` body with `timestamp`, `event`, `content-state`, and `stale-date`.
4. **Both:** set `enablePushNotifications: true` in the `expo-widgets` plugin block.
5. **A renewal scheduler** — fire ~30 min before each activity's `staleDate` while its session is still live (Task 10).
6. Respect APNs budget — this is exactly why `startedAt` (not `elapsedMs`) is in the contract.

Note `aps-environment` is currently `development`; production pushes need the production entitlement.

---

## 9. Risks and open follow-ups

| Risk | Likelihood | Mitigation |
|---|---|---|
| `expo-widgets` plugin cannot patch committed `project.pbxproj` under `--no-clean` | **Medium — the main risk** | Task 1 spike, timeboxed, with a `withXcodeProject` fallback modeled on the existing Android plugin. |
| Xcode 26 SwiftUICore link error hits the widget extension | Medium | The Podfile hook (`ios/Podfile:58`) shows the shape of the fix; apply its inverse to the extension. |
| Activity goes stale while suspended, and stops at ~8h | **Certain in 1a** — accepted | `staleDate` makes both visible rather than a silent lie. Phase 1b (Tasks 9–11) resolves both. |
| Renewal swap visibly resets the timer | Medium (1b) | Task 10 carries the original `startedAt` into the replacement activity so elapsed time reads continuously. Explicitly verified in Task 11. |
| Renewal resurrects a session that just ended | Low (1b) | Renew only when the session is still live at fire time; Task 11 tests this case. |
| A future `expo prebuild` without `--no-clean` wipes the target | Medium | CLAUDE.md already mandates `--no-clean`; Task 1 re-states it. |
| OEM battery managers kill Android ongoing notifications | Medium | Verify on a Samsung/Xiaomi device; document honestly rather than promise parity. |
| `onAll` snapshot bug bites a future refactor | Low now | Task 4 attaches inside the existing effect. The underlying `services/ws-client.ts:341` docstring is wrong and worth a separate fix — **out of scope here**. |

**Smartwatch — later, do not expand.** OS mirroring of the phone surface is the v1 path; no watch app. See `docs/roadmap/tasks/smartwatch-session-surfaces.md` — ⚠️ that file and `docs/roadmap/index.md` exist only on the unmerged branch `origin/docs/smartwatch-roadmap`, so these links resolve only once it merges. Read meanwhile with `git show origin/docs/smartwatch-roadmap:docs/roadmap/tasks/smartwatch-session-surfaces.md`.

**Noted, not acted on (pre-existing, out of scope):** the `onAll` docstring/behavior mismatch; three duplicated `formatElapsed` implementations (`components/sessions/hub/hubUtils.ts:13`, `components/sessions/SessionCard.tsx:35`, `app/session/[id].tsx:400`); and the `notification` WS frame being defined but subscribed to by nothing.

---

## 10. Suggested PR split

Small, conventional-commit, no AI attribution. iOS is fully mergeable before Android starts.

| PR | Title | Contents | Depends on |
|---|---|---|---|
| 1 | `chore(ios): add expo-widgets and live activity target` | Deps, `app.json` plugin, prebuild output, `Podfile.lock`, spike findings | — |
| 2 | `feat(live-activity): add shared content-state contract and reconciler helpers` | `types/live-activity.ts`, pure helpers, unit tests, `ci-paths.txt` + docs sync | — (parallel with 1) |
| 3 | `feat(ios): render session live activity on lock screen and dynamic island` | `widgets/SessionLiveActivity.tsx`, `_layout.tsx` wiring, jest mock, integration tests | 1, 2 |
| 4 | `fix(routing): handle cold-start deep links into sessions` | `getLastNotificationResponseAsync` handling + test | 3 |
| — | — | **← Phase 1a ships here** | — |
| 5 | `feat(live-activity): capture activitykit push tokens` | Token listeners, payload `kind`, `enablePushNotifications` | 4 |
| 6 | `feat(live-activity): renew activities past the 8h cap` | Renewal scheduler + continuity of `startedAt` (cross-repo w/ streamer) | 5 |
| 7 | `feat(android): promote running sessions to an ongoing notification` | `.android.ts`, permissions, channel, guard removal | 3 |

PR 2 is independent of the spike and can land first if Task 1 runs long. PR 7 (Android) depends only on PR 3 — it does **not** wait on the Phase 1b push work.

---

## Self-Review

- [ ] Every `file:line` citation verified against `integration-merge-354-355-376` (**not `main`** — they have diverged; `services/push.ts` differs materially).
- [ ] No `any` / `unknown` introduced anywhere.
- [ ] No emoji in app UI; SF Symbols in the widget, Phosphor in RN screens, and the reason for the split is commented.
- [ ] `ci-paths.txt` and `docs/ci-significant-paths.md` both updated for `widgets/`.
- [ ] Every `expo prebuild` invocation carries `--no-clean`.
- [ ] `package.json` + `package-lock.json` + `ios/Podfile.lock` committed together.
- [ ] `docs/expo-web-support.md` records the native-only blocker; `.web.ts` shim present.
- [ ] Comments explain non-obvious *why*, never restate the code.
- [ ] `npx eslint` on staged files before each commit.
- [ ] No AI attribution in any commit or PR text.
