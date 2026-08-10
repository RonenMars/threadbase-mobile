# Privacy-first Crash Reporting, Feedback & Diagnostics — Implementation Report

**Branch:** `feat/sentry-crash-reporting`
**Spec:** `prompt-sentry-mobile.md` (repo root)
**Status:** Phase 1 ✅ · Phase 2 ✅ · Phase 3 ✅

This document tracks the phased implementation. All three phases are complete and
verified.

---

## Phase 1 — Privacy-first Sentry Crash Reporting

### What was built

**New files (10):**

| File | Purpose |
|---|---|
| `services/sanitize.ts` | Centralized sanitizer. Allowlist-first Sentry event + breadcrumb sanitization; secret/URL/path/hostname value-pattern redaction; camelCase/snake key normalization; string + total-size caps; circular-safe; error normalization; stack scrubbing. Fails closed. |
| `services/sentry.ts` | Sentry service. Gated `init` (consent + DSN + non-dev), `beforeSend`/`beforeBreadcrumb` hooks → sanitizer, integration filtering, safe tags, capture helpers, immediate disable, connection-mode tag. |
| `services/safe-metadata.ts` | Safe build/runtime metadata + `deriveConnectionMode()` (generic `local\|remote\|unknown`, never stores URL) + release string. |
| `services/sentry-install-id.ts` | Anonymous per-install UUID under its own SecureStore key (`threadbase_sentry_install_id`), separate from the network correlator. |
| `components/RootErrorBoundary.tsx` | Root class boundary → sanitized capture, themed recovery screen. |
| `hooks/useCrashReportingSync.ts` | Keeps the SDK in lockstep with the consent setting. |
| `docs/sentry-setup.md` | Local config + required EAS secrets + manual dashboard checklist. |
| `__tests__/unit/services/{sanitize,sentry,safe-metadata}.test.ts` | Unit tests. |

**Modified:** `stores/settings.ts` (+`crashReportingEnabled`, default OFF, 5 persist
touch-points), `app/_layout.tsx` (`Sentry.wrap` + boundary + consent sync),
`app/settings.tsx` (consent toggle under Privacy + privacy-policy link + dev-only
test-crash), `jest.setup.js` (Sentry + expo-updates mocks), `app.json` (Sentry
Expo plugin), `metro.config.js` (`getSentryExpoConfig`), `.env.example`,
`package.json` (`@sentry/react-native@^8.18.0`), all 4 `common.json` + 4
`settings.json` locales, `__tests__/unit/stores/settings.test.ts`.

### Privacy behavior

- **Disabled by default; opt-in.** No init without consent AND DSN AND non-dev
  environment.
- **Everything routes through the sanitizer.** `beforeSend` drops all
  non-allowlisted top-level keys (`request`, `server_name`, `extra`, `modules`…);
  frame `vars`/`context_line`/source dropped; stacks scrubbed of paths/URLs.
- **All content-capture disabled:** Session Replay (sample rates 0), screenshots,
  view hierarchy, console capture, network breadcrumbs, user-interaction,
  `sendDefaultPii:false`; risky default integrations stripped; `tracesSampleRate:0`.
- **User data = anonymous UUID id only** (no email/username/IP/device name).
- **Disable is immediate** — `Sentry.close()` + clears the install id.

### Decisions (user-approved)

- **Install ID:** a NEW anonymous per-install UUID minted only for Sentry issue
  grouping, under its own SecureStore key — deliberately separate from
  `threadbase_device_client_id` (the network correlator).
- **Connection-mode tag:** derive a generic `local | remote | unknown` enum from
  URL protocol + RFC1918/`.local` host heuristic, never storing/sending the URL.

### Manual configuration still required

- **Sentry:** create the project; set real `organization`/`project` in
  `app.json`; disable Session Replay at the project level; keep server-side PII
  scrubbing on.
- **EAS:** `SENTRY_AUTH_TOKEN` as a **sensitive** EAS env var (source maps);
  `EXPO_PUBLIC_SENTRY_DSN` in the build env (or leave blank to keep reporting
  unavailable).
- No DSN or token is committed anywhere.

### Residual risk

Value-shape regex cannot detect arbitrary natural-language prose under an
*allowlisted, innocuously-named* field (e.g. a short unprefixed token inside an
exception message). Mitigated by the structural allowlist + key-name blocklist
being primary; the regex is a backstop. This is a fundamental limit, documented
in the sanitizer. Hardened `R2` (bare hostnames) and `R6` (breadcrumb data
enum-gated) after the adversarial review.

---

## Phase 2 — In-app Help & Feedback

### What was built

**Screen & components:**

- `app/help-feedback.tsx` — leaf route with 4 states: **landing** (Report a bug /
  Suggest a feature / General feedback / Privacy policy / Email support),
  **form**, **success**, **copy-fallback**. Reached from a new row in Settings →
  Help.
- `components/feedback/DiagnosticsPreview.tsx` — expandable preview of the exact
  allowlisted diagnostic fields + the plain-language "what is / isn't included"
  disclosure.

**Services (the max-effort privacy paths):**

- `services/feedback-transport.ts` — `FeedbackTransport` with the chosen **3-tier
  chain**: configured HTTPS endpoint → **Sentry User Feedback** → **native mail
  composer** → **copy + guide** to `www.threadbase.sh/feedback`. `renderReportText`
  emits only user content + allowlisted diagnostics; report goes in the email
  **body**, never a `mailto:` query string. The endpoint POST routes diagnostics
  through `sanitize()` (defense-in-depth).
- `services/feedback-diagnostics.ts` — builds the allowlist snapshot;
  connection-mode derived generically, never the URL.
- `services/feedback-screenshot.ts` — explicit pick only, `exif:false` + JPEG
  re-encode (strips metadata), downscale to 1400px, hard 3 MB cap.
- `types/feedback.ts` — `FeedbackCategory`, `FeedbackDiagnostics`,
  `FeedbackReport`, `FeedbackSubmitResult`.
- Sanitizer: added a `sanitizeFeedbackEvent` carve-out — the user's message +
  reply email pass (they chose to submit them); everything else on the event is
  still stripped.

**Config / i18n:**

- New `feedback` namespace across **en/he/ru/ar** (registered in `lib/i18n.ts`,
  `lib/i18n.types.ts`, `test-utils/i18n-setup.ts`).
- Added `expo-mail-composer@57.0.0` dependency.
- `.env.example`: `EXPO_PUBLIC_FEEDBACK_ENDPOINT`. `e2e/feedback_flow.yaml` added
  to `test:e2e:mock`.

### Final English copy

- **Landing:** "Spotted a bug in the wild?" / "Send a report, suggest a feature,
  or share an idea. No stack trace required."
- **Bug form:** "Help us squash a bug." · **Feature:** "Got a feature brewing?" ·
  **General:** "Send us a signal."
- **Success:** "Feedback committed" / "Thanks — your report made it into the queue
  with no merge conflicts."
- **Recoverable error:** "Push failed" / "…Your feedback is still here, so you can
  try again."
- **Offline:** "Looks like the network branch is offline."
- Screenshot helper, diagnostics helper, and **all privacy/consent text are
  plain, no puns.** At most one pun per screen/state; accessibility labels
  describe the real action, not the joke.

### Feedback transport chain

```
FeedbackTransport
 ├─ EndpointTransport   (only if EXPO_PUBLIC_FEEDBACK_ENDPOINT set; POST, sanitized diagnostics)
 ├─ Sentry captureFeedback   (only when crash reporting is ON)
 ├─ MailComposerTransport    (native mail app; report in the body)
 └─ Copy + guide             (copy to clipboard → paste at www.threadbase.sh/feedback)
```

### Design & privacy behavior

- Reuses existing tokens, `s.card` groups, segmented control, phosphor icons,
  theme + dark-mode, `testID` + accessibility conventions.
- **Feedback works with crash reporting OFF** — it just falls to email/copy (spec
  §130). No dark-pattern nudging toward consent.
- Screenshot never auto-captured; preview + remove control; warns it's sent as
  selected.
- Diagnostics opt-in (default on, fully previewed) — contains only build
  constants + generic enums.

### Known limitations

- The Sentry feedback transport only delivers over the network when crash
  reporting is enabled — a deliberate coupling from the chosen transport order.
  Email/copy fallbacks cover the off case.
- `www.threadbase.sh/feedback` (copy-fallback target) **does not exist yet** — the
  link is wired but the page needs creating.
- `EXPO_PUBLIC_FEEDBACK_ENDPOINT` is unset by default; no developer backend exists
  yet (Phase 3 documents this in the privacy policy).

---

## Phase 3 — Diagnostics & Privacy-Policy Updates

### What was built

**Diagnostics generator (max-effort privacy surface):**

- `services/diagnostics.ts` — centralized generator with a typed `DiagnosticsReport`
  schema, allowlist assembly, aggregate connection-state derivation, streamer-version
  collection (deduped, generic strings only), active-session sum (count only), a
  coarse (minute-precision) last-connection time, notification-permission enum, and
  the opaque Sentry event id. The whole report is passed through the central
  `sanitize()` as a final guard. Produces both human-readable text and structured
  JSON output, each size-capped.
- `services/diagnostic-events.ts` — a bounded in-memory ring buffer of lifecycle
  events. Events are a **strict enum only** (`app_started`, `connection_*`,
  `server_added/removed`, `feedback_*`, …) with coarse timestamps; anything not in
  the enum is rejected by construction, so free-form text cannot enter.
- `app/diagnostics.tsx` — a screen with a live preview, the plain-language
  included / excluded / control disclosures, and Copy + Share actions.
  Reached from the "Copy diagnostics" row on the Help & Feedback landing.
- `services/sentry.ts` gained `getLastEventId()` (keeps the Sentry import
  centralized).
- Lifecycle events wired at their natural call sites: `app_started` at boot,
  `server_added`/`server_removed` in the servers store, and `feedback_opened`/
  `feedback_submitted` in the feedback screen.

### Privacy behavior

The diagnostics report contains only build constants, generic enums, bounded
counts, a coarse timestamp, streamer version strings, an opaque Sentry event id,
and the strict lifecycle-event enum. It never reads server URLs, ids (which are
URL-derived fingerprints), machine names, credentials, session ids/titles, paths,
or any user content. Tests seed the stores with sensitive server data (URL,
apiKey, machineName, label, id) and assert none of it appears in the text or JSON
output.

### Privacy-policy & disclosure updates

- `docs/proposed-privacy-policy.md` — the complete proposed replacement for
  <https://threadbase.sh/privacy-policy> (the website source is not in this workspace).
  It distinguishes the five traffic categories, states that crash reporting is
  opt-in and off by default, names Sentry, lists the categories sent and excluded,
  covers retention/deletion/processing-region placeholders, and uses plain,
  pun-free language.
- `README.md` — the Privacy section and the local-first feature bullet updated so
  the now-inaccurate "no crash reporting / no telemetry" claims are corrected
  conservatively.
- `docs/store-privacy-checklist.md` — a manual-review checklist of the App Store
  Connect and Google Play Console privacy declarations Ronen must review before
  releasing. It does not claim any console setting was changed.

### Known limitations

- The proposed privacy policy must be published to the live URL, and its effective
  date + Sentry processing region filled in, before these features ship.
- `docs/store-privacy-checklist.md` is a checklist only — the actual store-console
  declarations must be set by hand.

---

## Exact information that may leave the device

Only when the user opts in / explicitly submits:

- **Crash reporting (opt-in):** app version, build number, platform, OS
  major/minor, JS engine, environment/channel, Expo runtime version, EAS update
  id, an anonymous per-install UUID (grouping only), a derived generic
  connection-mode enum, and scrubbed exception type/message/stack frames.
- **Feedback (explicit submit):** the user's own typed description, an optional
  reply email, an explicitly-picked EXIF-stripped screenshot, and the allowlisted
  diagnostics block (only when the opt-in checkbox is checked).

## Exact information intentionally excluded

Prompts, agent conversation content, terminal output, source code, file contents,
file attachments (beyond an explicit screenshot), repository names/paths,
absolute/home paths, environment variables, API keys, auth tokens, authorization
headers, pairing payloads, QR contents, streamer credentials, complete server
URLs, query parameters, IP addresses, hostnames, WebSocket payloads,
request/response bodies, user-entered session names, clipboard contents, and
device names.

---

## Tests & checks

- **TypeScript:** clean (`tsc --noEmit`, exit 0).
- **ESLint** (incl. strict i18n `--max-warnings=0`): clean.
- **121 Phase 1 + Phase 2 tests pass** (sanitizer, sentry, transport, diagnostics,
  safe-metadata, settings store, + an 18-test feedback flow).
- **Full suite:** 875 passing. The only failures are a **pre-existing flaky
  suite** (`conversation-search-anchor`) — verified to fail identically with the
  shared-file changes stashed on the base commit, so it is not introduced by this
  work.
- **Maestro:** `feedback_flow.yaml` drives Settings → Help & Feedback → bug form →
  fill → diagnostics preview, and deliberately **does not submit** (no real report
  sent).
- **Adversarial privacy reviews** (independent agents, both phases): all leak
  vectors SAFE. Findings hardened: Phase 1 R2 (bare hostnames) + R6 (breadcrumb
  data); Phase 2 R1 (endpoint POST now sanitized).

---

## Manual follow-ups before release

- Publish `docs/proposed-privacy-policy.md` to <https://threadbase.sh/privacy-policy>,
  and set its effective date + Sentry processing region.
- Create the Sentry project and set the real org/project slugs; configure
  `EXPO_PUBLIC_SENTRY_DSN` (runtime) and `SENTRY_AUTH_TOKEN` (EAS, sensitive).
- Review the App Store Connect and Google Play Console privacy declarations per
  `docs/store-privacy-checklist.md`.
- Create the `www.threadbase.sh/feedback` page referenced by the copy-fallback.
