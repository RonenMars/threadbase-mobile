# Store Console Wording — Draft Text for App Store Connect & Google Play

Draft answers for the actual console questionnaire fields, built on the voice
and structure of the current live policy at <https://threadbase.sh/privacy-policy>
(the "thin client for self-hosted streamers, local-first" framing) plus the
accurate crash-reporting disclosure this branch requires. Paste into the
consoles once the corrected privacy policy is live — the Privacy Policy URL
field in both consoles must point to the updated page before submitting.

> This file drafts *wording*, not settings. Nothing here has been entered into
> either console.

---

## App Store Connect — App Privacy Questionnaire

### "Do you or your third-party partners collect data from this app?"
**Yes.**

### Data type: Diagnostics → Crash Data
- **Collected:** Yes
- **Linked to the user's identity:** No
- **Used for tracking:** No
- **Purpose:** App Functionality

**Description field (free text, if offered):**
> Threadbase is a thin client for self-hosted Threadbase streamers — it does
> not run its own analytics or telemetry. Technical data is sent to Sentry, a
> third-party crash-reporting service, only in user-initiated cases:
> (1) automatically, if you turn on "Share anonymous crash reports" in Settings
> (off by default); (2) as a one-time report if you tap "Report this crash" on
> the error-recovery screen after a crash; or (3) when you submit feedback via
> the Help & Feedback screen. Cases (2) and (3) work even if automatic reporting
> is off — tapping "Send" or "Report" is treated as explicit consent for that
> single submission. Data is limited to app version, platform, OS version, and a
> sanitized error type/message/stack trace, plus a random installation
> identifier used only to group reports. It never includes prompts, terminal
> output, source code, credentials, server addresses, or session content.

### Data type: Diagnostics → Performance Data
**Not collected.** (Performance tracing is disabled in the app.)

### Data type: Contact Info → Email Address
- **Collected:** Yes
- **Linked to the user's identity:** Yes (only when provided)
- **Used for tracking:** No
- **Purpose:** App Functionality

**Description field:**
> If you send feedback through the app's Help & Feedback screen and choose to
> enter a reply email, it is included with your submission so we can respond.
> Providing it is optional; leaving it blank keeps your feedback anonymous.

### Data type: User Content → Photos or Videos
- **Collected:** Yes (only when provided)
- **Linked to the user's identity:** No
- **Used for tracking:** No
- **Purpose:** App Functionality

**Description field:**
> If you choose to attach a screenshot to feedback, it is sent exactly as
> selected. Threadbase never captures your screen automatically.

### Data type: User Content → Other User Content
- **Collected:** Yes
- **Linked to the user's identity:** No
- **Used for tracking:** No
- **Purpose:** App Functionality

**Description field:**
> The free-text description you type when submitting feedback.

### Data types explicitly NOT declared
Do not check: Identifiers → Device ID, Identifiers → User ID, Advertising
Data, Location, Browsing History, Search History, Financial Info, Health &
Fitness. Threadbase's core session/prompt traffic goes only to the streamer
URL you configure and is not "collected" by Threadbase in the App Privacy
sense — it is a pass-through the user directs, matching the app's existing
declaration for that traffic.

### "Data Not Linked to You" toggle
Enable for Crash Data and Photos/Other User Content (no identity attached).
Leave Contact Info → Email linked, since it is explicitly tied to a support
request when provided.

### "Data Used to Track You" toggle
**No**, for every data type above. Threadbase does not use any data for
cross-app or cross-site tracking, advertising, or data broker sharing.

### Privacy Policy URL field
`https://threadbase.sh/privacy-policy` — update only after the corrected policy
(covering Sentry, both crash-reporting paths, and feedback) is published.

---

## Google Play Console — Data Safety Form

### "Does your app collect or share any of the required user data types?"
**Yes.**

### Data type: App activity → Crash logs
- **Collected:** Yes
- **Shared:** No
- **Optional or required:** Optional
- **Purpose:** App functionality

**Why this data is collected (free text):**
> Threadbase is a thin client for self-hosted Threadbase streamers and runs no
> analytics or telemetry of its own. Technical data is sent to Sentry, a
> third-party crash-reporting processor, only in user-initiated cases: (1) when
> you turn on "Share anonymous crash reports" in Settings (off by default);
> (2) when you tap "Report this crash" to manually send a single report after a
> crash; or (3) when you submit feedback via the Help & Feedback screen. Cases
> (2) and (3) work even with automatic reporting off — tapping "Send" or
> "Report" is treated as explicit consent for that single submission. Logs
> contain sanitized technical details only (app version, platform, OS version,
> error type/message/stack trace) and a random installation id for grouping;
> they never contain prompts, terminal output, source code, credentials, server
> addresses, or session content.

### Data type: App info and performance → Diagnostics
- **Collected:** Yes
- **Shared:** No
- **Optional or required:** Optional
- **Purpose:** App functionality

**Why this data is collected:**
> Sanitized build/runtime metadata (app version, build number, platform, OS
> version, generic connection-status category, count of configured servers)
> shown to you and included only if you opt in when submitting feedback or a
> crash report.

### Data type: Personal info → Email address
- **Collected:** Yes (only when provided)
- **Shared:** No
- **Optional or required:** Optional
- **Purpose:** App functionality (customer support)

**Why this data is collected:**
> Only if you choose to enter a reply email when submitting feedback, so we
> can respond to you. Optional — leaving it blank keeps your feedback
> anonymous.

### Data type: Photos and videos → Photos
- **Collected:** Yes (only when provided)
- **Shared:** No
- **Optional or required:** Optional
- **Purpose:** App functionality (customer support)

**Why this data is collected:**
> Only if you explicitly attach a screenshot to a feedback submission. Never
> captured automatically.

### "Is all of the user data collected by your app encrypted in transit?"
**Yes.**

### "Do you provide a way for users to request that their data is deleted?"
**Yes** — contact ronenmars@gmail.com to request deletion of crash reports or
feedback associated with your anonymous installation id, where feasible.

### Data types explicitly NOT declared
Do not check: Location, Financial info, Health and fitness, Messages, Photos
(beyond the optional feedback attachment above), Files and docs (beyond
feedback), Calendar, Contacts, App activity → Web browsing history, App
activity → In-app search history, App activity → Installed apps, Device or
other IDs (advertising ID). Threadbase's core prompt/session traffic to your
configured streamer is user-directed pass-through, not Threadbase data
collection, and is not declared here.

### Privacy Policy URL field
`https://threadbase.sh/privacy-policy` — same requirement as App Store Connect: must
point to the corrected, published policy before submitting.

---

## Before you paste any of this in

1. Publish the corrected policy at `threadbase.sh/privacy-policy` first — both
   console forms should link to text that already says what these answers say.
2. Confirm the actual Sentry project data region (US or EU) and reflect it in
   the published policy; it doesn't need to appear in the console fields
   themselves.
3. These are drafts for you to review and adjust in your own voice — check
   character limits in each console field before pasting (App Store Connect's
   free-text fields are shorter than Play Console's).
