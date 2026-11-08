# Apple Watch notifications — plan

**Status:** proposed (2026-10-05).
**Relates to:** [`docs/roadmap/tasks/smartwatch-session-surfaces.md`](../../roadmap/tasks/smartwatch-session-surfaces.md). That task covers Live Activities on the wrist. This plan covers the *alert* path: "needs your answer" and "session failed" pushes.

## Goal

When a session is waiting on the user, they find out on their wrist and, where it is safe, answer from there.
The phone can stay in a pocket.

## Where we start

- iOS mirrors a phone app's notifications to a paired Apple Watch on its own. This happens when the iPhone is locked or asleep and the watch is on the wrist and unlocked. No watch app is needed, and that already applies to every push we send.
- Pushes go streamer → Expo Push Service → APNs (`services/push.ts:143-174`, `docs/tbdev.md:90-96`). There is no hosted service, and this plan does not add one (`docs/no-hosted-service.md`).
- The `permission` category has **Allow** / **Deny** buttons (`services/push.ts:71-82`). Both use `opensAppToForeground: true` and `isAuthenticationRequired: true`, because on iOS an action that does not open the app never reaches JS once the app has been killed (`services/push.ts:68-69`). The answer is posted by JS in `answerFromNotification` (`services/push.ts:103-137`).
- The app never sets `threadIdentifier` or `interruptionLevel`. The time-sensitive entitlement is present (`ios/Threadbase/Threadbase.entitlements`), so the streamer can set the level.
- Payloads carry only the project name and session ids, never prompts or output (`docs/FEATURES.md:70`). A watch UI has nothing richer to show unless that rule changes, and this plan does not change it.
- There is no watchOS code or target anywhere in the repo.

## The real problem: a wrist tap has nowhere to go

On the watch, a mirrored notification shows our category's buttons. A tap on a button whose action brings the app to the foreground has no phone UI to open. What iOS then does is the first thing to measure (Phase 0); our assumption is that nothing usable happens.
- If the phone app is suspended, the action may still reach `addNotificationResponseReceivedListener`.
- If the app has been killed, JS does not run, and the answer is lost without any sign.

E2EE makes the obvious fix unavailable. An answer to a pinned server must go through the sealed REST context, which lives in JS (`services/e2ee/`). A native Swift handler that posts `/permission/answer` with a plain `URLSession` would send it unsealed, and that is forbidden ("never fall back to plaintext", `docs/e2ee-client.md`). Any wrist-answer path has to run the JS E2EE stack, or it has to not exist.

## Phases

### Phase 0 — Measure what mirroring already does (~0.5 day, no code)

On a physical iPhone and paired Apple Watch (simulator pairs do not mirror pushes reliably), using the test push from `app/notification-health.tsx` and a real permission gate:

| Case | Record |
|---|---|
| `waiting_input` push, phone locked | Shown on the watch? Title and body cut off? Haptic? |
| `permission` push | Are Allow / Deny shown on the watch? Does a tap reach the app when it is **suspended**? When it is **killed**? |
| Biometric lock on | `answerFromNotification` refuses, as designed. What does the user see on the wrist? |
| Focus / quiet hours | Is a time-sensitive push let through on the watch the same as on the phone? |
| Several sessions | Are they stacked by app only (no thread id)? |

Write the results into this file, then pick the Phase 2 option below. Everything after Phase 1 depends on this table.

### Phase 1 — Make the existing pushes good on the wrist (small, mostly streamer)

This is cross-repo work. File it in both repos, each describing its own half (`docs/agents/issue-tracker.md`).

**Streamer:**
- Set `threadId` (Expo, which becomes APNs `thread-id`) to `<serverId>:<sessionId>`. A session's alerts then stack together on the watch and the phone.
- Send `interruptionLevel: 'time-sensitive'` on `permission` and `waiting_input`, and `active` on `session_failed`.
- Put the project name first in the title. Keep the body within roughly 60 characters, because the watch short look shows very little.
- Send a `collapseId` / `apns-collapse-id` per gate, so a gate that is re-sent replaces its earlier alert instead of adding one.

**App:**
- Keep the button labels short in every locale (`locales/*/settings.json` → `notification.actionAllow` / `actionDeny`). Check ar, he and ru in particular.
- Add `categorySummaryFormat` / a localized `previewPlaceholder` only where expo-notifications exposes it. Add no shims.
- When the server leaves out any of the fields above, nothing breaks. It is just plainer, as "degrade, don't break" requires.

**Verify:** add watch cases to `e2e/docs/ts6-notifications.md`. Extend `__tests__/unit/services/push-attention.test.ts` if the category options change.

### Phase 2 — Answering from the wrist (decision needed after Phase 0)

There is one `permission` category, and it is used by the phone and the watch alike. iOS has no "watch-only" option on an action, so changing the foreground flag changes phone behaviour as well.

**Option A — Leave it as it is, but say so (recommended if Phase 0 shows foreground taps are dropped).**
Keep the buttons as foreground actions. Tapping the notification body on the watch tells the user to open the phone. Add one line to the notification-health screen: "Answer from Apple Watch isn't supported yet". This costs about a day and loses nothing.

**Option B — Background action + headless JS.**
Change Allow / Deny to `opensAppToForeground: false`. Register an `expo-task-manager` notification task (`Notifications.registerTaskAsync`) so iOS wakes the app in the background and JS can run `answerFromNotification` through the existing E2EE path.
- *Spike first:* confirm that expo-notifications 57 delivers **action responses** (not only incoming pushes) to the background task on iOS when the app has been killed. The comment at `push.ts:68-69` says it does not. If the spike confirms that, Option B is dead.
- *Costs:*
  - Adds `UIBackgroundModes: remote-notification` and a task-manager dependency (`bundle exec pod install`, commit lockfiles together).
  - The E2EE REST context must come up cold within iOS's roughly 30 s background budget. That includes a Noise handshake, which counts against the server's 5-per-minute limit.
  - The biometric-lock rule still applies: with the lock on, a wrist answer is refused.
- *Phone behaviour changes:* Allow from the lock screen no longer opens the app. Decide whether that is acceptable.

**Option C — watchOS companion app** (see Phase 3). Only this gives the watch its own trustworthy place to answer. It costs weeks.

### Phase 3 (optional) — watchOS companion

Do this only if Phase 2 Option A is not enough and B is ruled out.

- A new watchOS app target (SwiftUI). It needs a config plugin in `plugins/` so `expo prebuild --no-clean` keeps it, the way `withLiveActivityTarget` does for widgets.
- It receives the mirrored notification and shows a custom long look (`WKUserNotificationHostingController`) with Allow / Deny.
- **Transport:** WatchConnectivity `sendMessage` to the phone app, which answers through the JS E2EE stack. This needs a small native module to bridge WCSession into JS, and it does not solve the "phone app killed" case. The alternative, a watch-side Noise/E2EE client, means pairing keys on a second device. That is a separate design and a separate security review.
- **Signing:**
  - The new target needs its own development profile.
  - Teach `scripts/select-dev-profile.py` / `scripts/dev-device.sh` about it.
  - Add it to the ship pipelines and to `ci-paths.txt` / `docs/ci-significant-paths.md`.
- A Live Activity / complication polish overlap with the smartwatch-surfaces task v3. Do them together if both are pursued.

## Non-goals

- Showing prompt or output text on the watch. The payload privacy rule stands.
- Any relay or hosted push service.
- Wear OS. That is covered by the smartwatch-surfaces task, and its Android channels (`needs-you`) already bridge to Wear notifications.

## Housekeeping found while planning

- `docs/ROADMAP.md:383` still says ordinary pushes are "not implemented at all". That has been out of date since attention-v1 shipped (`affe749`). Fix it in the same PR as Phase 1.
- `NotificationEvent` (`types/api.ts:685-690`, `services/ws-client.ts:41`) is declared but nothing handles it. It is irrelevant here, because the watch only ever sees APNs alerts, not WebSocket events. Do not build on it.

## Rough cost

| Phase | Effort | Repos |
|---|---|---|
| 0 | 0.5 day, device needed | — |
| 1 | 1–2 days | streamer + mobile |
| 2A | ~1 day | mobile |
| 2B | 3–5 days after a 1-day spike, may be ruled out | mobile |
| 3 | 2–4 weeks + security review | mobile (+ streamer if watch-side E2EE) |
