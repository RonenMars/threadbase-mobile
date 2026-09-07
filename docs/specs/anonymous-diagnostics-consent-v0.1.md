# Threadbase Mobile — Anonymous Diagnostics & Feedback Consent Spec

**Status:** Draft v0.1  
**Scope:** `threadbase-mobile`  
**Primary area:** Sentry initialization, anonymous diagnostics consent, crash reporting, feedback diagnostics, onboarding consent experiment  
**Out of scope for this version:** native/fatal crash recovery on next launch, logged-in/user-account identity, new analytics provider

---

## 1. Problem

Threadbase currently treats Sentry primarily as an opt-in crash-reporting system.

The existing Sentry service explicitly states that Sentry is not initialized until standing crash-reporting consent is granted, although one-shot crash reports and user feedback can temporarily initialize Sentry independently.

We want to evolve this into a clearer model where:

1. Sentry may be **initialized and ready from application startup**.
2. Initialization alone must **not authorize passive data collection**.
3. Passive crash/error/stability telemetry requires explicit **Anonymous Diagnostics** consent.
4. Explicit user actions such as submitting feedback or manually reporting a crash remain possible without standing diagnostics consent.
5. Consent should be contextual, transparent, non-coercive, and easy to understand.

The feature should be presented to users as **Anonymous Diagnostics**, rather than merely “Crash Reporting,” because standing consent may include crash/error information plus basic stability/release-health telemetry.

---

## 2. Core privacy model

The system must distinguish three independent concepts.

| Concept | Meaning |
|---|---|
| **Sentry initialized** | SDK/runtime infrastructure is available. This alone grants no permission to collect or transmit passive diagnostics. |
| **Anonymous Diagnostics enabled** | User has granted standing permission to automatically send approved diagnostic information. |
| **Explicit submission** | User deliberately sends one specific crash report or feedback report. That action authorizes only that submission when standing diagnostics are disabled. |

The core invariant is:

> **Initializing Sentry must not itself authorize network transmission, event capture, session tracking, persistent diagnostic identification, breadcrumbs, or other passive telemetry.**

The implementation must therefore **not simply move the current `performInit()` to application startup**.

The current initializer enables automatic session tracking and creates/sets the Threadbase Sentry installation identifier, so it currently represents an **active diagnostics state**, not a neutral SDK-ready state.

---

## 3. Terminology

### User-facing feature name

**Anonymous diagnostics**

Primary explanatory copy:

> **Anonymous diagnostics**  
> Help improve Threadbase by sending crash reports and basic stability data **not linked to your identity**.

### Learn More copy

> Diagnostic reports use a random installation ID so related reports from the same app installation can be grouped. They are not linked to your name, email, account, or device identity.

For legal/privacy documentation, the data should be described more precisely as **pseudonymous diagnostic data** rather than claiming strict mathematical/legal anonymity.

---

## 4. Anonymous Diagnostics data model

When Anonymous Diagnostics is enabled, Threadbase may transmit an explicitly allowlisted set of diagnostic information.

Expected categories include:

- sanitized crash/error events
- sanitized stack traces
- application version
- build number
- OS/platform/version
- JS engine/runtime information
- release/environment metadata
- anonymous Sentry session/release-health information
- coarse connection mode
- basic non-content configuration counts such as configured server count
- Threadbase's Sentry-only random installation identifier

The system must continue excluding content-oriented or identity-bearing information, including:

- prompts
- conversation/session contents
- terminal output
- source code
- credentials or API keys
- server URLs/addresses
- screenshots unless explicitly attached by the user
- view hierarchy
- session replay
- console output
- HTTP request context
- account ID
- email address unless explicitly entered into feedback
- device hardware identifiers
- advertising identifiers
- Threadbase streamer/client ID

The current Sentry configuration already disables many sensitive integrations including DeviceContext, screenshots, view hierarchy, replay, HTTP context, console capture, and others.

---

## 5. Installation identity

Threadbase will **keep its existing Sentry-only installation UUID**.

The existing implementation generates an independent random v4 UUID specifically for Sentry and deliberately keeps it separate from Threadbase's streamer/client identifier.

Requirements:

- Keep the existing dedicated Threadbase Sentry UUID.
- Use it only for diagnostic correlation.
- It must never be derived from:
  - account identity
  - email
  - username
  - hardware identifiers
  - advertising identifiers
  - IP address
  - Threadbase client/server identity
- Do not re-enable Sentry's `DeviceContext` integration merely to obtain Sentry's native installation ID.
- Do not use private/native unsupported Sentry APIs to retrieve the SDK installation ID.
- The Threadbase Sentry UUID should remain independently controllable by Threadbase.

Repository audit currently shows the production `setUser()` usage assigning the Threadbase-generated installation ID rather than a recognizable user/account identifier.

---

## 6. Default state

For every new installation:

**Anonymous Diagnostics = OFF**

There are currently no existing users requiring migration semantics.

Application functionality must not be degraded when diagnostics remain disabled.

---

## 7. First-launch onboarding experiment

Anonymous Diagnostics consent may be offered to a randomized subset of new installations.

### Experiment allocation

**40% treatment / 60% control**

Assignment must:

- be random per installation
- be persisted locally
- remain stable for that installation
- not change between application launches

### Treatment group

The Anonymous Diagnostics option appears as a lightweight optional toggle inside the **final onboarding screen**, immediately before the primary Continue action.

Copy:

> **Anonymous diagnostics**  
> Help improve Threadbase by sending crash reports and basic stability data **not linked to your identity**.

Provide a **Learn more** affordance using the disclosure defined above.

Behavior:

- Toggle defaults **OFF**.
- Continue works regardless of its state.
- Turning it ON grants standing Anonymous Diagnostics consent.
- Leaving it OFF is considered **neutral / no explicit decision**.
- Leaving it OFF must **not** suppress future contextual diagnostics suggestions.

### Control group

No Anonymous Diagnostics prompt is shown during onboarding.

The rest of onboarding remains unchanged.

### Experiment analytics constraint

The experiment must **not create a new pre-consent telemetry mechanism merely to measure consent conversion**.

Persisting treatment assignment locally is acceptable.

Remote measurement must respect the same diagnostics consent boundary.

---

## 8. RootErrorBoundary crash flow

This specification covers **React `RootErrorBoundary` crashes only**.

Native/unrecoverable crashes and next-launch crash recovery are out of scope.

The existing error boundary already supports explicit one-shot crash reporting independently of standing consent.

## Diagnostics OFF

Show:

> ☐ **Automatically send future crash reports and diagnostics**  
> **Report this crash**

The checkbox must default **unchecked**.

### Checkbox unchecked + Report

Send only the current crash.

Do not enable standing Anonymous Diagnostics.

### Checkbox checked + Report

The Report action performs two explicit operations:

1. send this crash
2. enable standing Anonymous Diagnostics for future diagnostic reporting

The persistent preference should become active as part of the explicit report action, not merely when the checkbox is tapped.

If the user checks the option but leaves the screen without submitting, standing diagnostics must remain OFF.

## Diagnostics ON

No consent checkbox is necessary.

The application may already have automatically reported the qualifying error under the standing consent model.

The UX should avoid duplicate reporting.

---

## 9. Explicit one-shot crash reports

Explicit crash reporting remains independent of standing diagnostics consent.

When Anonymous Diagnostics is OFF:

> Tapping **Report this crash** authorizes the transmission of that specific sanitized crash report.

It must not silently enable persistent diagnostics unless the user explicitly selects the accompanying “future crash reports and diagnostics” checkbox.

The existing `reportOneShot()` architecture already follows the general one-shot concept, although its initialization behavior must be adapted to the new initialization model.

---

## 10. User feedback

User feedback and Anonymous Diagnostics remain **separate concepts**.

Users must be able to submit:

- bug reports
- feature suggestions
- general feedback

without enabling standing Anonymous Diagnostics.

Feedback currently uses Sentry's standalone User Feedback API and can self-initialize the Sentry path when standing reporting is disabled.

---

## 11. Feedback technical diagnostics attachment

The existing feedback form contains an **Include technical diagnostics** option.

Currently the implementation initializes:

`includeDiagnostics = true`

so the checkbox is preselected.

That behavior must change.

## Anonymous Diagnostics OFF

Show:

> ☐ **Include technical diagnostics**

Default: **unchecked**

The user must explicitly enable it for that submission.

The existing **See what's included** disclosure should remain available.

## Anonymous Diagnostics ON

Do **not** show a pre-checked checkbox.

Instead:

- hide the Include technical diagnostics consent checkbox
- include the approved diagnostics automatically
- keep **See what's included** available for transparency

The rationale is that the user has already granted standing authorization for the same diagnostics/purpose.

If Anonymous Diagnostics is later disabled, the form returns to the explicit unchecked-checkbox behavior.

---

## 12. Feedback screenshots

Screenshots remain independent from Anonymous Diagnostics.

A screenshot may only be included when the user explicitly selects one for that particular feedback submission.

Anonymous Diagnostics consent must **never automatically attach screenshots to feedback or crash reports**.

Existing screenshot privacy preparation such as metadata stripping should remain.

---

## 13. Feedback email

Email remains optional and explicitly user-entered.

Anonymous Diagnostics consent must never:

- populate an email automatically
- associate an account email with diagnostics
- attach an email to unrelated diagnostic events

A feedback report may contain the email only when the user explicitly entered it into that feedback submission.

---

## 14. Post-feedback Anonymous Diagnostics suggestion

After successful feedback delivery, users with Anonymous Diagnostics OFF may receive a lightweight suggestion.

CTA:

> **Enable anonymous diagnostics**

The suggestion should be:

- non-modal
- non-blocking
- clearly separate from the feedback submission result
- shown only **after successful feedback delivery**
- absent when Anonymous Diagnostics is already enabled

The user should understand that the feedback was already successfully sent and enabling diagnostics is optional.

Example concept:

> **Help improve Threadbase**  
> Enable anonymous diagnostics to automatically send future crash reports and basic stability information.  
> **Enable anonymous diagnostics** · **Not now**

### Frequency

Maximum:

> **2 impressions in any rolling 30-day period**

Use persisted impression timestamps rather than a calendar-month counter.

“Not now” dismisses only the current suggestion.

It must **not** mean “never ask again.”

The existing permanent-ish `crashReportingUpsellDismissed` semantics will therefore need reconsideration or replacement.

The RootErrorBoundary inline checkbox is **not subject to this frequency limit** because it is contextual to an actual crash rather than a promotional suggestion.

---

## 15. Settings

Settings should expose a persistent control:

> **Anonymous diagnostics**

Description should align with onboarding:

> Help improve Threadbase by sending crash reports and basic stability data not linked to your identity.

A Learn More disclosure should remain available.

Changing the setting:

### OFF → ON

Begin standing diagnostic reporting.

This may enable:

- crash/error reporting
- approved session/release-health telemetry
- approved safe diagnostic metadata
- Sentry-only installation correlation

### ON → OFF

Stop future passive diagnostic transmission immediately.

Any diagnostic mechanisms requiring standing consent must stop.

The behavior of the existing Sentry-only UUID on disable should remain privacy-oriented; exact lifecycle semantics can be finalized during technical design.

---

## 16. SDK initialization architecture

The implementation should evolve from a binary:

`Sentry not initialized` / `Sentry fully active`

model toward a distinction between:

**SDK-ready state** and **diagnostics-enabled state**.

The existing `performInit()` cannot directly become the unconditional startup initializer because it currently:

- enables Sentry
- enables auto-session tracking
- generates/loads the Threadbase Sentry installation ID
- assigns that ID to the Sentry user context
- installs capture behavior intended for active reporting

The implementation design must ensure that before Anonymous Diagnostics consent:

- no automatic session telemetry is transmitted
- no crash/error event is passively transmitted
- no content telemetry is transmitted
- no passive diagnostic breadcrumb is transmitted
- no persistent diagnostics identity is attached merely because the SDK became ready
- explicit user submissions remain possible

The exact Sentry APIs/configuration necessary to implement this safely should be validated against the installed `@sentry/react-native` version during implementation planning.

Current dependency:

`@sentry/react-native ^8.18.0`

---

## 17. Web/IP privacy requirement

React Native Web requires special consideration because it does not have the same native installation identity behavior as iOS/Android.

Threadbase must ensure that Sentry does not use/store the user's IP address as a substitute diagnostic identity on web.

This should be enforced through both:

- SDK configuration where applicable
- Sentry project-side privacy configuration

The implementation phase should verify actual behavior against the currently deployed Sentry configuration rather than relying solely on SDK defaults.

---

## 18. Consent semantics

Consent must be purpose-specific and explicit.

The following actions count as standing consent:

- switching Anonymous Diagnostics ON in Settings
- switching it ON in the onboarding treatment
- checking **Automatically send future crash reports and diagnostics** and then submitting the crash report
- selecting **Enable anonymous diagnostics** from the post-feedback suggestion

The following do **not** count as standing consent:

- leaving the onboarding toggle OFF
- viewing the Learn More page
- submitting ordinary feedback
- explicitly attaching diagnostics to a single feedback report
- submitting a one-shot crash report while its future-reporting checkbox is unchecked
- dismissing a post-feedback suggestion

---

## 19. State model

Conceptually, replace the existing crash-reporting-centric state with:

```text
anonymousDiagnosticsEnabled: boolean
```

Default:

```text
false
```

Additional state will be necessary for:

```text
onboardingDiagnosticsExperimentVariant
postFeedbackDiagnosticsSuggestionImpressions[]
```

The exact persistence representation can be decided during implementation.

The current settings store already persists `crashReportingEnabled` and related notice/upsell flags.

Whether to rename the internal field or preserve it temporarily for migration/code-churn reasons remains an implementation decision.

Since there are currently no users, backward-compatibility constraints are minimal.

---

## 20. Privacy/compliance principles

The design should follow these principles across Israel, EU/EEA, and U.S. markets:

### Transparency

Users must understand what Anonymous Diagnostics includes.

### Data minimization

Only fields with a justified diagnostic purpose should be transmitted.

### Purpose limitation

Diagnostic information must not be repurposed for advertising, profiling, or unrelated analytics.

### Withdrawal

Users must be able to disable standing diagnostics in Settings.

### No dark patterns

Consent controls must:

- default OFF
- not be visually coercive
- not block application functionality
- not use preselected consent checkboxes

### Pseudonymous identity

The Sentry installation identifier should be described accurately in detailed privacy documentation as a randomly generated installation identifier rather than claiming that no identifier exists.

The product-facing feature may still be named **Anonymous Diagnostics** because reports are not linked to a recognizable user/account identity.

---

## 21. Non-goals

This iteration does **not** attempt to implement:

- detecting native fatal crashes on the next application launch
- asking users to upload a previously captured native crash after restart
- account/user identification in Sentry
- behavioral/product analytics
- advertising analytics
- session replay
- performance tracing beyond explicitly approved stability/session information
- automatic screenshot collection
- server-side Threadbase telemetry
- a new analytics/experimentation backend

---

## 22. Initial acceptance criteria

The feature is considered correct when all of the following hold:

1. A fresh installation starts with Anonymous Diagnostics OFF.
2. Sentry may be SDK-ready at startup without passive diagnostic transmission.
3. 40% of new installations receive the final-onboarding optional diagnostics toggle.
4. The onboarding toggle defaults OFF.
5. Leaving onboarding diagnostics OFF is neutral and does not suppress later contextual prompts.
6. RootErrorBoundary allows one-shot crash reporting while standing diagnostics are OFF.
7. Its future-diagnostics checkbox defaults unchecked.
8. Checking that box and submitting enables standing Anonymous Diagnostics.
9. Feedback works regardless of Anonymous Diagnostics state.
10. With diagnostics OFF, the feedback diagnostics checkbox defaults unchecked.
11. With diagnostics ON, the checkbox is hidden and approved diagnostics are included automatically.
12. Screenshots remain explicitly selected per feedback report.
13. Successfully submitted feedback may show the Anonymous Diagnostics suggestion at most twice per rolling 30-day window.
14. Disabling Anonymous Diagnostics stops passive diagnostic reporting.
15. No recognizable Threadbase user/account ID is sent to Sentry.
16. The existing independent Threadbase Sentry installation UUID remains the diagnostic correlation identifier.
17. DeviceContext remains blocked unless a later privacy review explicitly approves changing that.
18. Web diagnostics do not identify users using their IP address.
19. User-facing wording consistently uses **Anonymous diagnostics**.
20. Detailed disclosures accurately explain the random installation identifier.
