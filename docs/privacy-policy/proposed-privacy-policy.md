# Proposed Privacy Policy — Threadbase Mobile

> **Status:** Proposed replacement text for <https://threadbase.sh/privacy>.
> The website source is not present in this workspace, so this file contains the
> complete proposed policy for review. It must be published to the live URL
> before the crash-reporting or feedback features ship to users.
>
> **Effective date:** _(set on publish — proposed: 2026-07-12)_
> **Contact:** ronenmars@gmail.com

Threadbase is a thin client for the Claude Code sessions you run on your own
computer, reached through a Threadbase streamer instance that you operate.
Threadbase is local-first by design: your prompts, session content, and
credentials stay on your device and on the streamers you configure. This policy
describes the specific, limited cases in which data leaves your device, and the
controls you have over each.

## The kinds of network traffic Threadbase uses

Threadbase separates its traffic into five distinct categories. Each is
described in its own section below.

1. **Core traffic to your streamers** — the app's normal function.
2. **Expo push-notification delivery** — optional notifications.
3. **Crash reporting (Sentry)** — automatic reporting is off by default and
   opt-in; a single crash can also be reported manually at any time.
4. **User-initiated feedback submissions** — only when you send feedback.
5. **Optional screenshots or diagnostics you explicitly select** — only when you
   choose to include them.

---

## 1. Core traffic to your streamers

Threadbase connects only to the streamer URLs you configure. Session content,
prompts, provider metadata, file attachments you send, and status events go
solely to those streamers. Threadbase does not route this traffic through any
Threadbase-operated server, and it does not copy it anywhere else. Your API
keys and server credentials are stored on your device (in the iOS Keychain /
Android Keystore) and are used only to authenticate to your own streamers.

## 2. Expo push-notification delivery

If you enable notifications, Threadbase obtains a push token from Expo's push
service and shares that token with each streamer you have paired, so the
streamer can notify you when a session needs attention. The token is delivered
through Expo's notification relay. Removing a server in Settings revokes its
push token. The token is an opaque delivery address; it does not contain your
session content.

To deliver notifications, your streamer also sends a notification payload through Expo's push service. Threadbase is designed so these payloads do not include prompts, terminal output, credentials, or conversation content.

## 3. Optional crash reporting (Sentry)

Threadbase includes optional crash reporting to help diagnose defects, sent
through two paths:

- **Automatic reporting.** **Disabled by default and opt-in.** Nothing is sent
  automatically unless you turn on "Automatically send sanitized crash reports" in
  **Settings → Crash Reporting**. Once enabled, future crashes are sent
  automatically until you turn it off again.
- **Manual, one-time report.** If the app crashes, the recovery screen offers a
  "Report this crash" button. Tapping it sends that single crash report even if
  automatic reporting is off. This is a deliberate action you take, not
  something the app does on its own — no report is ever sent without you
  tapping that button or having automatic reporting turned on. It does not turn
  on automatic reporting; after sending, the app may ask once whether you'd
  like to turn automatic reporting on going forward, and remembers your answer
  so it does not ask again.

Both paths send the same sanitized data described below, through the same
service.

- **Service provider.** Crash reports are processed by
  [Sentry](https://sentry.io/), a third-party error-monitoring service, under
  Sentry's own terms and data-processing agreements.
- **What is sent.** Only sanitized technical information: the app version and
  build number, the platform (iOS or Android), the operating-system major/minor
  version, the JavaScript engine, the release channel or environment, the Expo
  runtime version, the EAS update identifier, a generic connection-mode category
  (local, remote, or unknown), and the type, message, and stack trace of the
  error. Reports also include an anonymous, randomly generated installation
  identifier used only to group reports; it is not tied to your identity, your
  device's advertising identifier, or your streamer credentials.
- **What is excluded.** Crash reports do not intentionally include prompts,
  terminal output, source code, file contents, credentials, authentication
  tokens, server addresses, hostnames, IP addresses, repository names or paths,
  session names or content, or your device name. A sanitization step runs in the
  app on every report it sends, and anything that cannot be confidently
  sanitized is dropped rather than sent. Crashes captured by the underlying iOS
  or Android platform layer are transmitted by that platform's own crash
  handler; those are covered instead by server-side scrubbing rules configured
  on our error-reporting account, including the exclusion of IP addresses.
- **A note on absolutes.** We design crash reporting to exclude the categories
  above, and we apply sanitization before sending. We cannot, however, describe
  unexpected behavior in the underlying SDK or platform as an absolute
  impossibility, which is why crash reporting is opt-in and off by default.
- **Your control.** You can enable or disable crash reporting at any time in
  Settings. Disabling it stops future reporting immediately and deletes the
  pseudonymous app-specific installation identifier from your device.
- **Previously submitted reports.** Reports already sent before you disable
  crash reporting remain in Sentry subject to the retention below; disabling
  does not retroactively delete them.
- **Retention.** Crash reports are retained according to the configured Sentry
  project retention (by default, 90 days) and then deleted.
- **Deletion requests.** To request deletion of reports associated with your
  pseudonymous app-specific installation identifier where feasible, contact
  ronenmars@gmail.com.
- **Processing location.** Crash reports are processed in the region configured
  for the Sentry project. _(Set this to the actual Sentry data region — for
  example, United States or European Union — before publishing.)_

## 4. User-initiated feedback submissions

The Help & Feedback screen lets you send a bug report, feature request, or
general feedback. This is always a deliberate action you initiate; Threadbase
never sends feedback on its own.

Submitting feedback is always a deliberate action you take. Tapping the **Send** button authorizes Threadbase to transmit only the information shown on the submission screen. No additional permission dialog is required because the submission itself is initiated by you.

- **What is sent.** The description you type, an optional reply email address if
  you provide one, and — only if you leave the "Include technical diagnostics"
  option enabled — the same sanitized technical diagnostics described for diagnostics below. Before you submit, the screen shows you exactly what
  will be included. Technical diagnostics are optional and can be disabled before sending.
- **How it is sent.** When you tap Send, Threadbase first attempts to deliver
  your feedback through the Sentry User Feedback channel. This works even if
  you have not turned on automatic crash reporting — just like the one-time
  "Report this crash" button, tapping Send is treated as explicit consent for
  that single submission. If Sentry is unavailable, feedback falls back to your
  device's email application, or a copy-to-clipboard option. The success screen
  shows which delivery method was used. Feedback submissions are always
  initiated by you and do not enable automatic crash reporting.
- **Optional email.** If you provide a reply email, it is stored with your
  feedback so we can respond. Leaving it blank keeps your submission anonymous.
- **What is excluded.** As with crash reports, feedback does not intentionally
  include prompts, terminal output, source code, credentials, server addresses,
  or session content.

## 5. Optional screenshots and diagnostics you select

- **Screenshots.** Threadbase never captures your screen automatically. If you
  attach a screenshot to feedback, you select it explicitly from your photo
  library, you can preview and remove it, and it is submitted exactly as you
  selected it. Attached screenshots are re-encoded to strip embedded metadata
  (such as location) and are size-limited. Screenshots are used only to deliver
  the feedback you submit and are not retained beyond what is necessary for that
  submission and its handling.
- **Diagnostics.** You can copy or export a diagnostics report from the app. It
  contains only the sanitized technical diagnostics described above —
  never prompts, terminal output, credentials, server addresses, session
  content, or your device name. You control whether it is copied or submitted.

Screenshots and manually entered feedback may contain content you choose to
include. Please review anything you attach before submitting.

---

## What stays on your device

- Your prompts and draft prompts.
- Claude Code, Codex, and other agent conversation content.
- Terminal output and session content.
- Your streamer URLs, API keys, and pairing credentials (in the iOS Keychain /
  Android Keystore).
- Your session names, favorites, and app settings.

Uninstalling the app deletes everything Threadbase stored locally. Crash reports
or feedback you submitted before uninstalling are not stored on your device and
are governed by the retention terms above.

## What we do not collect

Threadbase does not use advertising, tracking, fingerprinting, or behavioral
telemetry. It does not include a product-analytics SDK. It does not
automatically capture your screen, console output, or network requests. The only
data that leaves your device is the core streamer traffic you direct, the optional push-notification token and notification payload, manual feedback submissions that you choose to send, and—only with your explicit action or opt-in consent—the crash reports, screenshots, and diagnostics described above.

## Permissions the app uses

| Permission | Why |
|---|---|
| Camera | Scanning a QR code to pair with a streamer, and attaching photos to your sessions. |
| Photo library | Attaching photos from your library to your sessions, and attaching a screenshot to feedback. |
| Microphone | Dictating prompts by voice. |
| Speech recognition | Converting your speech to text on-device. |
| Face ID / biometrics | Optionally locking access to your conversations. |
| Notifications | Delivering session notifications, if you enable them. |

## Your control

- Crash reporting is off by default; enable or disable it any time in Settings.
- Feedback and diagnostics are only ever sent when you initiate them.
- Removing a server revokes its push token.
- Uninstalling the app removes Threadbase data stored in the app's local container. Some credentials stored by the operating system's secure credential storage (such as the iOS Keychain) may remain after uninstalling.
- Contact ronenmars@gmail.com with any privacy question or deletion request.

---

_Last updated: 2026-07-12 (proposed). Contact: ronenmars@gmail.com._
