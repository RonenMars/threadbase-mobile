# Android notifications — plan

**Written:** 2026-10-05, against `main` at `4fb94af` (branch `claude/android-notifications-plan-xb7nzw`).
**Scope:** make push and local notifications work properly on Android phones, matching what iOS users already get.

## Where we are

Most of the notification code is already shared between iOS and Android.
The gaps are Android-specific details that the shared code doesn't cover yet, plus proof that it actually works on a device.

| Piece | State | Where |
|---|---|---|
| `POST_NOTIFICATIONS` permission (Android 13+) | Declared | `app.json` → `android.permissions`, `android/app/src/main/AndroidManifest.xml:4` |
| Permission prompt | Onboarding and Settings call `requestPermissionsAsync` | `components/onboarding/steps/NotificationsStep.tsx:50`, `hooks/usePermissionsStatus.ts:88` |
| FCM config | `google-services.json` is gitignored and applied only if present; injected in CI from `GOOGLE_SERVICES_JSON_B64` | `android/app/build.gradle:211`, `docs/tbdev.md`, `docs/deployment.md` → "Firebase QA" |
| Expo push token → streamer | Shared, registers `platform: 'android'` | `services/push.ts` → `registerPushToken` |
| Channels `needs-you` (HIGH) and `updates` (DEFAULT) | Created in `ensureAttentionSetup`, but only on the registration path | `services/push.ts:47` |
| Allow / Deny action buttons | `permission` category, answered in `answerFromNotification` | `services/push.ts`, `app/_layout.tsx:343` |
| Tap → open session (warm and cold start) | Shared | `app/_layout.tsx:343-385`, `lib/coldStartDeepLink.ts` |
| Running session "live activity" | Ongoing notification on channel `live-sessions` | `services/live-activity.android.ts` |
| Notification health screen | Shared, lists tokens per platform | `app/notification-health.tsx` |
| Small status-bar icon | **Missing** — `expo-notifications` plugin has no `icon`/`color`, no `notification_icon` drawable exists | `app.json` plugins, `android/app/src/main/res/drawable*` |
| On-device verification | **None recorded** for Android push end to end | — |
| E2E coverage | **None** for notifications on either platform | `e2e/` |

Server side: `docs/ROADMAP.md:383` (2026-08-11) says the streamer never sends ordinary pushes (RonenMars/threadbase-streamer#528).
Commit `affe749` (2026-09-26) registers the `attention-v1` feature, which only makes sense if the streamer now sends attention pushes.
**Check streamer#528 before starting Phase 3** — if the streamer still doesn't send them, the Android client work is only testable through `/api/push/test`.

## Phase 1 — Fix the Android-specific gaps (client only)

### 1.1 Status-bar icon

Android draws the small icon from its alpha channel only.
With no `icon` set, it falls back to the full-colour launcher icon, which shows as a solid white square.

- Add `assets/notification-icon.png`: 96×96, white glyph on transparent background, no padding beyond Material's 2dp safe zone.
- Configure the plugin:

  ```json
  ["expo-notifications", {
    "icon": "./assets/notification-icon.png",
    "color": "#0d1117",
    "defaultChannel": "updates"
  }]
  ```

- Apply with `npx expo prebuild --platform android --no-clean` (never a bare `prebuild` — it wipes `android/`, see CLAUDE.md).
  Commit the generated `res/drawable-*/notification_icon.png` and the `AndroidManifest.xml` `meta-data` entries for `com.google.firebase.messaging.default_notification_icon` / `_color` / `_channel_id`.
- `defaultChannel` matters for pushes that arrive before the app has ever created channels (fresh install, never opened after a reinstall): FCM otherwise drops them into the auto-created "Miscellaneous" channel.

### 1.2 Create channels before asking for permission

On Android 13+, the system prompt for `POST_NOTIFICATIONS` is shown only after the app has created at least one channel; otherwise `requestPermissionsAsync` can return denied without showing anything.
Today channels are created only inside `registerPushToken`, which runs after permission is granted.

- Call `ensureAttentionSetup()` before `requestPermissionsAsync()` in `NotificationsStep.tsx` and `usePermissionsStatus.ts`.
  Better: route both through `requestPermissions()` in `services/push.ts` and make that the one place that does it.
- Unit test: on `Platform.OS === 'android'`, `setNotificationChannelAsync` is called before `requestPermissionsAsync`.

### 1.3 "Denied forever" handling

After two denials Android stops showing the prompt (`canAskAgain: false`).

- In `usePermissionsStatus.ts`, read `canAskAgain` and, when false, change the action to open system settings (`Linking.openSettings()`).
- Copy goes in `locales/*/settings.json` through `t()` — no literals (see "No Inline Conditional Text in JSX").

### 1.4 Per-channel controls

Android users can mute a single channel from system settings, which our in-app switches don't know about.

- On the notification health screen, read `getNotificationChannelAsync('needs-you' | 'updates' | 'live-sessions')` and show a line when a channel's importance is `NONE`, with a button to the system channel page.
- Keep the in-app preferences (`lib/notification-prefs.ts`) as the source of truth for what the streamer *sends*; the channel state only explains why something sent wasn't shown.

### 1.5 Action buttons on the lock screen

`isAuthenticationRequired` in the `permission` category is iOS-only.
On Android, Allow/Deny from a locked phone opens the app, which then shows the biometric lock if enabled; `answerFromNotification` already refuses when `biometricLock` is on.

- No code change needed; add a unit test that pins this behaviour for Android so it isn't "fixed" later into answering from the lock screen.

## Phase 2 — Build and credentials

- Confirm the Expo project (`projectId` in `app.json` extra) has the **FCM V1** service-account key assigned for both `com.ronenmars.threadbase` and `com.ronenmars.threadbase.dev`.
  `docs/tbdev.md:111` notes the Expo wizard files it in the wrong slot.
- Confirm the Deploy workflow writes `google-services.json` from `GOOGLE_SERVICES_JSON_B64` for the Play build — `docs/tbdev.md:101` says no Deploy run has used the two-client file yet.
- Add a build-time check (in the ship scripts, not Gradle) that fails a **release** Android build when `google-services.json` is absent.
  The silent skip in `build.gradle:213` is right for local dev but turns into "push never works" for a store build.

## Phase 3 — Verify on a real phone

Run on at least one Android 13+ device and one Android 12 or lower device (the permission flow differs).

1. Fresh install → onboarding notifications step → system prompt appears.
2. Notification health screen shows an `android` token for each paired server.
3. "Send test" (`/api/push/test`) → notification arrives with the correct icon and colour, app in foreground, background, and killed.
4. Attention push (if the streamer sends them): `needs-you` vibrates with the triple pulse; Allow/Deny buttons answer the gate; tap opens the right session on cold start.
5. Running session shows the `live-sessions` ongoing notification and clears when the session ends.
6. Mute a channel in system settings → health screen reports it.
7. Change app language → channel names update (Android shows the new name in system settings).
8. Battery saver / Doze: lock the phone for 30 minutes, then send a test push; it should arrive (HIGH importance channels map to FCM high priority only if the streamer sends `priority: 'high'` — confirm in the streamer).

Record results with device model, Android version, and date in `docs/dev-on-physical-device-android.md`.

## Phase 4 — Tests and docs

- Unit tests for 1.2, 1.3, 1.5 under `__tests__/unit/services/` and `__tests__/unit/hooks/`.
- Maestro: one Android-only flow that grants notifications in onboarding and checks the health screen shows a token row (push delivery itself can't be asserted on an emulator without Play services + a real FCM key; leave that to Phase 3).
  Add it to the relevant `test:e2e:*` script.
- Update `docs/ROADMAP.md` Feature 12 entry and `docs/FEATURES.md` once Phase 3 passes.
- `docs/expo-web-support.md` is unaffected (notifications stay native-only).

## Out of scope

- Android 16 promoted ongoing notifications / status-bar chip for live sessions — `expo-notifications` doesn't expose `setRequestPromotedOngoing`; needs a native module (see the comment in `services/live-activity.android.ts`).
- Notification grouping/summary per server — worth doing once attention pushes are live and noisy.
- Anything that sends pushes without Expo's push service: per CLAUDE.md "Product claims" and `docs/no-hosted-service.md`, re-read those before changing where push payloads go.

## Order and size

| Phase | Size | Depends on |
|---|---|---|
| 1.1 icon | ½ day (needs an icon asset) | — |
| 1.2 channels before prompt | ½ day | — |
| 1.3 denied-forever | ½ day | 1.2 |
| 1.4 channel health | 1 day | — |
| 1.5 test only | 1 hour | — |
| 2 credentials | ½ day, mostly console work | — |
| 3 device verification | 1 day | 1, 2, streamer#528 status |
| 4 tests and docs | 1 day | 1 |

Phase 1 items are independent and can each be their own PR (`fix(notifications): …`).
