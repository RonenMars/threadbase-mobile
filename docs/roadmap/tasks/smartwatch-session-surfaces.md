# Smartwatch surfaces for live session status

**Status:** planned.

**Goal:** Let a running session’s status — project name, running / waiting input, elapsed duration, latest terminal line — show up on paired smartwatches so the user can glance at their wrist without unlocking the phone.

## Prerequisite
[Feature 12 — Live Activities + Dynamic Island](../../ROADMAP.md#feature-12--live-activities--dynamic-island-for-in-progress-sessions) puts the session on the iPhone Lock Screen / Dynamic Island and (in parallel) as an Android Live Update / ongoing notification. This task is the wrist follow-on: Apple Watch, Samsung Galaxy Watch, OnePlus Watch, and other paired wearables.

## Why
Same “only open the app when you need to act” loop as Feature 12, one layer further from the desk. Duration belongs on the wrist the same way it belongs on the Live Activity — prefer passing `startedAt` so the system can tick a timer without per-second pushes.

## Direction (phased)

### v1 — OS mirroring (ship with / right after Feature 12)
Rely on the phone Live Activity (iOS) and Live Update / ongoing notification (Android) being forwarded by the OS to a paired watch. No Threadbase watch app required.

Validate on:
- Apple Watch (Live Activity mirror)
- At least one Wear OS device (Pixel Watch / Galaxy Watch)

### v2 — Wear OS Live Updates hygiene
Where Wear OS 7+ surfaces Android Live Updates on the watch, keep notification payloads / styles compatible so promotion just works (`ProgressStyle` / promoted ongoing where applicable).

### v3 (optional) — Native companions
Only if mirroring is insufficient:
- watchOS complication / Live Activity layout polish
- Wear OS tile or complication
- Tap-to-deep-link into `app/session/[id]` on the phone

Treat each platform as its own scoped project — there is no single cross-vendor watch API.

## Out of scope for v1
- Guaranteeing identical rich UI on every brand (OnePlus / proprietary watch OSes often only get plain notification mirroring).
- Building dedicated watch apps for every OEM.
- Relying on EU third-party-wearable Live Activity interoperability as a global product promise (region- and vendor-dependent).

## Open questions
- Is OS mirroring “good enough” for v1, or do we need a watchOS companion before calling this done?
- Concurrent-activity limits: if Feature 12 opts into multiple Live Activities, does the watch become noisy? Prefer the same opt-in / relevance scoring as the phone.
- Deep link from watch tap: open the matching session on the phone — works for Apple Watch / Wear OS companions; plain mirrored notifications may only open the app root.
- Battery / permission: Android foreground-service notification already required for Feature 12’s Android path; watch mirroring should not add a second FGS.

## Scope
- **v1:** ~0.5–1 day validation once Feature 12 ships (device mirroring check, not a parallel native track).
- **v2:** mostly payload hygiene alongside Feature 12’s Android path.
- **v3:** weeks per platform if we choose to build companions.

## Sequencing
Do not start until Feature 12’s iOS Live Activity (and ideally Android Live Update) path is shipping.

## Files likely involved
- **v1:** none beyond Feature 12 — verify mirroring on device.
- **v3 (if pursued):** watchOS Widget Extension / Wear OS module alongside `modules/live-activities/`, plus deep-link routing in `app/session/[id].tsx`.

## Verification (v1)
- Start a live session Live Activity on iPhone → Apple Watch shows project / status / elapsed without opening the phone.
- Start the Android Live Update / ongoing notification → Galaxy Watch or Pixel Watch mirrors the glanceable status.
- Ending the phone activity / notification clears (or demotes) the watch surface.
