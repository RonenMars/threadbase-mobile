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

- [ ] **Diagnostics → Crash Data** — collected when the user opts into crash
      reporting. Linked to the user? **No** (anonymous install id only). Used for
      tracking? **No**. Purpose: **App Functionality / Analytics? → App
      Functionality** (crash diagnosis), not advertising.
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
      (<https://threadbase.sh/privacy>) once the proposed policy in
      `docs/proposed-privacy-policy.md` is live.
- [ ] `ITSAppUsesNonExemptEncryption` remains `false` (unchanged; HTTPS/standard
      crypto only).

## Google Play Console — Data Safety

Review **Play Console → your app → Policy → App content → Data safety** and
update the form:

- [ ] **App activity / Crash logs** — **Data collected** (not shared), when the
      user opts into crash reporting. Optional? **Yes** (users can opt out).
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

- [ ] Both stores: crash reporting must be described as **optional / off by
      default**, matching the in-app consent behavior.
- [ ] Both stores: do **not** declare advertising, tracking, or fingerprinting —
      the app does none.
- [ ] Publish `docs/proposed-privacy-policy.md` to
      <https://threadbase.sh/privacy> **before** submitting a build with these
      features, and set the effective date + Sentry processing region in that
      document first.
- [ ] Beta / TestFlight release notes: mention that this build adds optional,
      off-by-default crash reporting and an in-app feedback screen.
