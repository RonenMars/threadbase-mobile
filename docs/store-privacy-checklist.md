# Store Privacy Declarations — Manual Review Checklist

Introducing opt-in Sentry crash reporting and user-initiated feedback changes
what the app may transmit, so the **App Store Connect** and **Google Play
Console** privacy declarations must be reviewed and updated by hand. These
console settings cannot be changed from the codebase — this is a checklist of
what **Ronen** must review and set in each console before releasing a build that
includes these features.

> Nothing here has been changed in any store console. This document only lists
> what to review.

## App Store Connect — App Privacy

Review **App Store Connect → your app → App Privacy** and update the "Data
Collection" answers. The features add these data types (all optional / opt-in):

- [ ] **Diagnostics → Crash Data** — collected in two situations: (1)
      automatically, whenever the user has turned on the standing "Share
      anonymous crash reports" setting; (2) as a one-time explicit action even
      when that setting is OFF, if the user taps "Report this crash" on the
      crash-recovery screen. Both paths send the same sanitized data through the
      same code path — declare Crash Data as collected, **optional** (the
      automatic path can be disabled; the manual path only fires on an explicit
      tap). Linked to the user? **No** (anonymous install id only, and the
      one-tap path does not persist any additional identifier). Used for
      tracking? **No**. Purpose: **App Functionality** (crash diagnosis), not
      advertising.
- [ ] **Diagnostics → Performance Data** — **Not collected** (performance tracing
      is disabled; `tracesSampleRate: 0`). Confirm you do **not** declare this.
- [ ] **Contact Info → Email Address** — collected **only if** the user
      voluntarily enters a reply email in feedback. Linked to the user? It is
      user-provided contact info — declare as collected, **not used for
      tracking**, purpose **App Functionality (Customer Support)**.
- [ ] **User Content → Photos or Videos** — collected **only if** the user
      explicitly attaches a screenshot to feedback. Purpose **App Functionality
      (Customer Support)**, not tracking.
- [ ] **User Content → Other User Content** — the free-text feedback description.
      Purpose **App Functionality (Customer Support)**.
- [ ] **Identifiers** — confirm you do **NOT** declare Device ID / advertising
      identifier. The install id is an app-generated anonymous UUID, not a device
      or advertising identifier.
- [ ] Confirm **"Data Not Linked to You"** for crash data and diagnostics, since
      no identity is attached.
- [ ] Confirm **"Data Not Used to Track You"** across all of the above (no
      cross-app/website tracking, no data brokers).
- [ ] Update the **Privacy Policy URL** to the published policy
      (<https://threadbase.sh/privacy-policy>) once the proposed policy in
      `docs/privacy-policy/proposed-privacy-policy.md` is live.
- [ ] `ITSAppUsesNonExemptEncryption` is `true`. The app implements its own
      cryptography — X25519, ChaCha20-Poly1305, SHA-256, HMAC and HKDF via
      `@stablelib`, composed by the Noise handshake in `services/e2ee/*` — which
      is not the platform TLS Apple exempts. It was `false` while TLS was the
      only crypto; the E2EE pairing wiring made that answer wrong.
- [ ] App Encryption Documentation is filed in App Store Connect. Every
      algorithm is a published standard, so this is the French declaration only
      and **not** a CCATS. Two waits in series: App Store Connect asks for the
      French encryption declaration **approval form**, meaning ANSSI's response
      rather than the declaration sent to them, and Apple then approves that
      upload before any build can carry it. That gate binds at **TestFlight**,
      not only at App Review. See
      `threadbase-streamer:specs/end-to-end-encryption/plan.md`
      § "App Store export compliance".

## Google Play Console — Data Safety

Review **Play Console → your app → Policy → App content → Data safety** and
update the form:

- [ ] **App activity / Crash logs** — **Data collected** (not shared). Two
      collection paths: automatic when the standing "Share anonymous crash
      reports" setting is on, and a one-time explicit "Report this crash" tap on
      the crash-recovery screen that works even when that setting is off.
      Optional? **Yes** for both — automatic reporting can be turned off, and the
      manual path only ever fires on an explicit tap, never in the background.
      Processed ephemerally? **No** (retained by Sentry). Purpose: **App
      functionality / Analytics? → App functionality (crash diagnosis)**.
- [ ] **App info and performance → Diagnostics** — the sanitized technical
      metadata (version, OS version, generic connection mode, etc.). **Data
      collected**, optional, purpose **App functionality**.
- [ ] **Personal info → Email address** — **collected only if** the user enters a
      reply email in feedback. Optional? **Yes**. Purpose **App functionality /
      customer support**.
- [ ] **Photos and videos → Photos** — **collected only if** the user explicitly
      attaches a screenshot. Optional? **Yes**. Purpose **customer support**.
- [ ] Confirm **no data is declared as "shared"** with third parties for
      advertising; Sentry is a processor for app-functionality crash diagnosis,
      not an advertising/tracking partner.
- [ ] Confirm **no Advertising ID** collection is declared.
- [ ] State that the user **can request deletion** (contact email) and that data
      is **encrypted in transit** (HTTPS).
- [ ] Update the **Privacy Policy URL** to the published policy.

## Cross-cutting reminders

- [ ] Both stores: **automatic** crash reporting must be described as optional /
      off by default, matching the in-app toggle. Additionally disclose that
      **user-initiated submissions can still use Sentry** independent of that
      toggle — this includes both the "Report this crash" tap on the crash
      screen and the Help & Feedback submission (both are explicit, deliberate
      actions the user takes, not automatic collection). This means "crash data
      is never sent while the setting is off" would be an inaccurate description
      and must not be used; the accurate framing is "automatic reporting is off
      by default; user-initiated submissions may still use Sentry".
- [ ] Both stores: do **not** declare advertising, tracking, or fingerprinting —
      the app does none.
- [ ] After a manual report is sent, the app may show a one-time prompt asking
      whether to turn on automatic crash reporting going forward; declining sets
      a local "don't ask again" flag and the prompt never reappears. This prompt
      does not itself send any data — only the user's Yes/No answer changes the
      standing setting.
- [ ] Publish `docs/privacy-policy/proposed-privacy-policy.md` (updated to also describe the
      manual "Report this crash" path) to <https://threadbase.sh/privacy-policy>
      **before** submitting a build with these features, and set the effective
      date + Sentry processing region in that document first. The current live
      policy states the app runs no crash-reporting service of any kind — that
      statement must be corrected before this build can ship.
- [ ] Beta / TestFlight release notes: mention that this build adds crash
      reporting (automatic, opt-in and off by default, plus a manual "Report this
      crash" option on the error screen) and an in-app feedback screen.
