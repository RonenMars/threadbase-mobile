# Threadbase Privacy Policy -- Follow-up Checklist

> **Last reviewed:** 2026-07-18 (Feature 36 code-side validation).
> Items marked with checkmarks have been verified from code. Items still unchecked require human action (store console, legal review, or production inspection).

## High priority

- [x] Verify Sentry SDK configuration. _(Verified: `services/sentry.ts` uses hardened `Sentry.init()` with all privacy options correctly set.)_
- [x] Confirm `sendDefaultPii = false`. _(Verified: line ~177 in `services/sentry.ts`.)_
- [ ] Verify server-side IP scrubbing. _(Requires Sentry project settings inspection — human-only.)_
- [x] Audit `beforeSend` sanitization. _(Verified: `beforeSend` routes through `sanitizeEvent` in `services/sanitize.ts`.)_
- [x] Verify Session Replay, Profiling, Performance Monitoring, and Tracing are disabled. _(Verified: `replaysSessionSampleRate: 0`, `replaysOnErrorSampleRate: 0`, `tracesSampleRate: 0`, no performance integrations.)_
- [x] Verify breadcrumbs (console, HTTP, navigation) are appropriate. _(Verified: `filterIntegrations` blocks Breadcrumbs, HttpContext, DeviceContext, etc. Only explicit `addSafeBreadcrumb` calls are allowed.)_

## Crash reporting

- [x] Verify exactly which fields are sent for:
    - [x] JS exception _(Verified: normalized via `normalizeError` → sanitized via `beforeSend`.)_
    - [ ] Native iOS crash _(Requires on-device test + Sentry dashboard inspection — human-only.)_
    - [ ] Native Android crash _(Requires on-device test + Sentry dashboard inspection — human-only.)_
    - [x] Manual crash report _(Verified: same `doCaptureException` path as automatic; `reportOneShot` uses identical sanitization.)_
- [x] Confirm installation identifier lifecycle. _(Verified: `getSentryInstallId` / `clearSentryInstallId` in `services/sentry-install-id.ts`; cleared on disable.)_
- [x] Verify opt-in/opt-out behavior. _(Verified: `initCrashReporting` requires `consentGranted=true`; `setCrashReportingEnabled(false)` calls `disableCrashReporting` which closes client + clears install id.)_
- [x] Verify consent model consistency. _(Verified 2026-07-18: Feature 35 implemented option (a) — both `reportOneShot` and `submitFeedbackViaSentry` self-init for explicit user actions, then tear down if standing consent was off.)_

## Feedback

- [x] Finalize feedback transport architecture. _(Verified: `services/feedback-transport.ts` implements Sentry → email → copy fallback chain; Sentry path now self-inits like crash reports.)_
- [ ] Document retention period. _(Retention is Sentry project default (90 days); needs explicit statement in published policy — human-only.)_
- [x] Document attachment handling. _(Verified: `docs/privacy-policy/proposed-privacy-policy.md` describes screenshot handling; EXIF stripped by `pickAndPrepareScreenshot`.)_

## Push notifications

- [ ] Audit notification payload. _(Requires streamer-side code review and on-device inspection — human-only.)_
- [ ] Ensure payload excludes prompts, terminal output, credentials, repository information, and conversation content. _(Requires streamer-side code review — human-only.)_

## Privacy & Legal

- [ ] Replace Sentry region placeholder. _(Requires Sentry project settings — human-only.)_
- [ ] Add controller/entity information if applicable. _(Legal/entity decision — human-only.)_
- [ ] Review GDPR/UK GDPR wording. _(Legal review — human-only.)_
- [ ] Add international transfer wording matching production. _(Legal review — human-only.)_
- [ ] Review deletion request flow. _(Requires documented process for handling email requests — human-only.)_

## Speech recognition

- [ ] Verify on-device behavior on iOS and Android. _(Requires on-device testing — human-only.)_
- [ ] Adjust wording if cloud processing is possible. _(Depends on speech recognition test results — human-only.)_

## Store compliance

- [ ] Update Apple App Privacy labels. _(App Store Connect — human-only.)_
- [ ] Update Google Play Data Safety form. _(Play Console — human-only.)_
- [ ] Verify third-party SDK disclosures. _(Store console review — human-only.)_

## Final QA

- [ ] Compare policy against production implementation. _(Requires on-device testing + Sentry dashboard inspection — human-only.)_
- [ ] Inspect raw Sentry events before release. _(Requires Sentry dashboard access — human-only.)_
- [ ] Review policy after every SDK upgrade. _(Ongoing process — human-only.)_

---

## Summary (2026-07-18)

**Code-verified items:** 12 items verified from static code analysis.

**Human-only items remaining:** 15 items require store console access, legal review, on-device testing, or Sentry dashboard inspection. These cannot be automated.

---

## Uninstall claim corrected (2026-08-14)

Found while checking the E2EE security-review fixes against the published policy.

**The claim.** The deployed page stated, in two places, that uninstalling the app deletes everything stored locally — with no qualification. That is false on iOS: `expo-secure-store` is called with no options anywhere in this repo (no `keychainAccessible`, no first-run clear), so Keychain entries survive an uninstall. `stores/servers.ts:108` says so in a code comment, and the store holds the server list, the API keys and — since 2026-08-14 — the device token that is now read back and used as the request credential. A reinstall therefore restores a working credential set.

**Resolved by changing the words, not the behaviour.** Clearing the Keychain on a detected fresh install was considered and rejected: it would force re-pairing every server after any reinstall, and it puts new logic in the credential path keyed off a marker in a store that must *not* survive uninstall. The disclosure is the proportionate fix.

**Published** in all four locales (`en`, `he`, `ar`, `ru`) in **tb-landing**, `pages.privacy.uninstallBody` and the `pages.privacy.yourControl` bullet. Both now say the uninstall removes the app's own container, that credentials in the OS secure store (such as the iOS Keychain) can survive it, and — the actionable part — that removing a server inside the app deletes that server's credentials. That last claim is true: `removeServer` deletes both `secureKeyForServer` and `secureKeyForDeviceToken` (`stores/servers.ts`).

**Wording is deliberately hedged to iOS.** Android generally clears app credential storage on uninstall, so "such as the iOS Keychain" and "can survive" are accurate where a flat "iOS Keychain / Android Keystore … will survive" would not be. Verifying Android's actual behaviour on device remains a human-only item.

**Translations are machine-produced and need a native review** before this is considered closed — he, ar and ru were written by the same pass that wrote the English. English is the authoritative text.

- [ ] Native-speaker review of the he / ar / ru uninstall wording. _(Human-only.)_
- [ ] Confirm on-device that Android clears credential storage on uninstall, and tighten the wording if it does not. _(Requires a device — human-only.)_

**`proposed-privacy-policy.md` is not the source of truth and has been marked superseded.** A line-by-line comparison on 2026-08-14 showed the *deployed* page is ahead of that draft, not behind it: the live text carries the Sentry EU processing location (still an unresolved "set this before publishing" note in the draft), the Android speech-recognition caveat, the MailerLite newsletter section, and `support@threadbase.sh` instead of the personal contact address. Reconciling the live page toward the draft would have deleted accurate disclosures. Exactly one draft sentence was better than the deployed text — the Keychain caveat — and that is what was published. Edit the tb-landing locales for any future change.
