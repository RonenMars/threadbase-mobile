# Onboarding Redesign — Spec

**Date:** 2026-06-05  
**Branch:** docs/onboarding-review  
**Status:** Draft — awaiting user review

---

## 1. Current Flow Audit

### 1.1 Step Inventory (as-built)

| # | Step | File | Role |
|---|------|------|------|
| 0 | WelcomeStep | `steps/WelcomeStep.tsx` | Brand intro + animated glow |
| 1 | ThemeStep | `steps/ThemeStep.tsx` | Color theme picker |
| 2 | ValuePropStep | `steps/ValuePropStep.tsx` | "Why Threadbase" diagram |
| 3 | ServerNameStep | `steps/ServerNameStep.tsx` | Optional server label |
| 4 | ConnectStep | `steps/ConnectStep.tsx` | QR or manual credential entry |
| 5 | NotificationsStep | `steps/NotificationsStep.tsx` | Push permission |
| 6 | TourStep | `steps/TourStep.tsx` | 3-concept carousel (kanban/queue/terminal) |
| 7 | DoneStep | `steps/DoneStep.tsx` | Completion + Enter CTA |

Total: **8 screens** before the user enters the app.

Shell: `OnboardingShell.tsx` wraps all steps with swipe gestures, pager dots, back/skip buttons.  
Navigator: `OnboardingNavigator.tsx` owns state, step index, `paired` result, `pendingServerName`.

---

### 1.2 Findings — Problems Worth Fixing

#### F1 · Flow is too long (8 steps)
The user must tap through Welcome → Theme → ValueProp → ServerName → Connect → Notifications → Tour → Done before they see any real content. 8 screens is a long commitment for a power-tool app whose audience already knows what it does (they installed `tb` on their laptop first). Most first-run flows for developer tools land under 4 steps.

**Steps whose value is disputed:**
- **ThemeStep (step 1):** Theme selection in onboarding is a nice-to-have. Most users pick their default OS theme and change it later in Settings if at all. Placing it before the critical pairing step adds friction.
- **ValuePropStep (step 2):** The "phone is the cockpit / laptop is the runtime" diagram is visually great, but the user already knows why they downloaded the app. This step exists to sell a product that was already sold.
- **ServerNameStep (step 3):** An optional label for a server the user hasn't paired yet is low-value. Most users will skip it. The label can be set post-pairing in Settings just as easily.
- **TourStep (step 6):** A 3-concept animated carousel placed *after* the user has already paired adds zero actionable information. The kanban/queue/terminal previews are meaningful once the user is inside the Hub — not here.

#### F2 · ConnectStep "Paste Credentials" (manual mode) is confusing

The manual form wraps two fields inside a faux-terminal card with the labels `$ tb pair --server` and `$ tb pair --token`. These labels mimic shell command syntax, but they are **input labels**, not commands the user should type. The intended flow is:

1. On desktop: run `tb token --new` to generate a token  
2. Copy the URL and token separately  
3. Paste them into the mobile form

The problem: the form shows `$ tb pair --server` as if you should run that command, and `$ tb pair --token` similarly. Neither command actually exists as shown — `tb pair` runs interactively, not as `tb pair --server <url> --token <tok>`. The labels confuse the conceptual model.

Additional issues in manual mode:
- The footnote `// On your desktop, run tb token --new to mint one.` is at the bottom, below the fold on small devices, placed after the button.
- No explanation of *what* the token is or *where* to find the server URL.
- The `paste from desktop` placeholder text in the token field is helpful but the URL field placeholder `https://threadbase.local:7331` implies mDNS which may not work on all networks.
- "Open handshake" as the CTA label is jargon — users may not know what a "handshake" means here.

#### F3 · TourStep teaches the wrong things at the wrong time

The 3 concepts (Kanban, Queue, Terminal) are genuinely useful mental models. However, they're taught *before* the user has entered the app, when they can't relate what they're seeing to anything real. A guided tour overlaid on top of real app elements (contextual highlighting) would be far more effective — shown the *first time* the user lands on a relevant screen.

#### F4 · Pager dots are too prominent relative to step count

8 pager dots in a row at the bottom is visually heavy. Combined with a "Skip" button, it signals to users "there's a lot ahead, maybe I should skip" — which is the wrong call-to-action.

#### F5 · NotificationsStep is well-placed but passively worded

The push permission step comes after pairing (good — permission is meaningful at that point). However, it has no body copy explaining *what* the notifications are for (e.g., "Get notified when a session completes or needs your input"). Without that context, users decline permission at a higher rate.

---

## 2. Proposed Onboarding Flow Redesign

### 2.1 Recommendation: Compress to 4 Steps

| # | Step | What Changed |
|---|------|--------------|
| 0 | **WelcomeStep** | Keep as-is. Strong brand moment. |
| 1 | **ConnectStep** (renamed: "Connect a runtime") | Move earlier, make it the main event. Redesign manual mode (see §3). |
| 2 | **NotificationsStep** | Keep, add contextual body copy. |
| 3 | **DoneStep** | Keep, remove unpaired variant's "no runtime paired" text (deferral is now explicit, not a failure state). |

**Removed steps:**
- ThemeStep → move to Settings (accessible on first launch via gear icon)
- ValuePropStep → condense into WelcomeStep body copy if needed; remove entirely is fine
- ServerNameStep → remove from onboarding; label can be set post-pair from the server card in Settings
- TourStep → replace with a post-onboarding contextual tour (see §4)

**Result:** 4 screens → ~60 seconds for the median user vs. ~3 minutes today.

### 2.2 Step Details

#### Step 0 · WelcomeStep (unchanged)
No changes to the animated glow or copy. `OnboardingNavigator` skips the `pendingServerName` state because `ServerNameStep` is removed.

#### Step 1 · ConnectStep (major redesign — see §3)
The ConnectStep itself is moved to index 1 (was 4). The same three modes (`choose`, `qr-explain`, `manual`) are kept but the `manual` mode UI is redesigned.

#### Step 2 · NotificationsStep (copy update only)
Add a body text string to `locales/en/onboarding.json`:
```
notifications.body: "We'll ping you when a session finishes, hits an error, or needs a quick decision — so you don't have to keep the app open."
```
No code changes beyond displaying that copy.

#### Step 3 · DoneStep (minor copy update)
Remove the `serverHost`/`serverPort` from `OnboardingNavigator` derivation since `ServerNameStep` was removed. The paired/unpaired states stay, but unpaired body copy changes from:
> "No runtime paired yet. Hook one up from Settings when you're ready."

to:
> "Skip it for now — you can connect a runtime from Settings whenever you're ready."

(Reframes skipping as a deliberate, valid choice rather than an incomplete state.)

---

## 3. ConnectStep Manual Mode Redesign

### 3.1 Problem Statement

The current manual form uses faux-shell labels that misrepresent what the user should do. The user needs to:
1. Know they must go to their Mac/Linux terminal
2. Run a specific command to generate credentials
3. Copy two pieces of information (URL + token)
4. Paste them into the form

The form should guide this step-by-step.

### 3.2 Proposed Design: "2-step card" pattern

Replace the single monolithic TerminalCard with two labeled sections that read as a checklist.

**Section 1 — Desktop command** (static, non-interactive):

```
┌─ On your Mac ──────────────────────────────────────────┐
│  Open Terminal and run:                                 │
│                                                         │
│  $ tb token --new                                       │  ← copyable
│                                                         │
│  It prints two lines: a URL and a token.                │
└─────────────────────────────────────────────────────────┘
```

- The command `tb token --new` is tappable/copyable to clipboard.
- Short contextual label: "It prints a URL and a token — paste both below."

**Section 2 — Paste inputs** (the actual form):

```
┌─ Paste from terminal ──────────────────────────────────┐
│  Server URL                                             │
│  ┌────────────────────────────────────────────────┐    │
│  │ https://...                                    │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  Token                                                  │
│  ┌────────────────────────────────────────────────┐    │
│  │ ••••••••                                       │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

- Field labels are plain English ("Server URL", "Token"), not `$ tb pair --server`.
- A `(?)` icon next to "Token" opens an inline tooltip: "A temporary API key. Run `tb token --new` on your Mac to generate one. Valid for 24 hours."
- CTA changes from "Open handshake" to **"Connect"** — cleaner, universal.
- The `// On your desktop, run tb token --new to mint one.` footnote is **removed** — the information is now in the step itself.

### 3.3 QR Mode (no changes)
The QR explain mode is already clear and well-structured. Keep as-is.

### 3.4 Choose Mode (minor copy update)
Change "Paste credentials" → **"Type / paste manually"**. The word "credentials" is vague; "manually" signals clearly what this path is.

Change "Enter a server URL and API key by hand." → **"Use a URL and token from `tb token --new`."** This answers the implicit question "where do I get these?"

---

## 4. Post-Onboarding Contextual Tour

### 4.1 The Argument for Moving Tour Out of Onboarding

The current TourStep teaches Kanban, Queue, and Terminal concepts before the user has seen any real sessions. The concepts are abstract without context. Moving these to contextual tooltips shown on *first encounter* gives them 10x the effectiveness.

### 4.2 Proposed Tour Flows

Three independent tours, each triggered by a condition, each dismissible permanently.

---

**Tour A · Hub Tour** — triggers on first app open after onboarding (or first time Hub is shown with a configured server)

Highlights in sequence:
1. **Session cards** — "Each card is a Claude Code session running on your Mac. Tap to open it."
2. **Lane indicators** — "The color stripe shows state: blue = running, amber = plan, grey = done."
3. **New session button** — "Tap here to start a session. Your Mac runs the agent; you drive from here." *(only shown if server is configured)*

Interaction: each tooltip has a "Got it →" button. The sequence auto-advances on a 6-second timeout if the user doesn't tap.

---

**Tour B · Session Detail Tour** — triggers on first time the user opens a session (i.e., taps a session card)

Highlights in sequence:
1. **Message bubble stream** — "Tool calls and output stream here in real time."
2. **Queue button / prompt input** — "Type a follow-up or queue the next prompt while Claude is still working."
3. **Terminal toggle** — "Switch to raw output view for the full stdout stream."

---

**Tour C · New Session Tour** — triggers on first "new session" action (only if a server is connected)

Highlights in sequence:
1. **Project picker** — "Choose which project to run in. This maps to a directory on your Mac."
2. **Prompt input** — "Describe what you want Claude to do. Be specific about files or goals."
3. **Submit button** — "Tap Send. The agent starts on your Mac immediately."

---

### 4.3 Implementation Approach

**Option A: Custom spotlight overlay (recommended)**  
A `TourOverlay` component renders a semi-transparent full-screen backdrop with a hole cut out over the highlighted element. The target element's position is captured with `onLayout` + `ref.measure()`. A tooltip card renders adjacent to the hole.

Pros: no new dependencies, full control over animation style.  
Cons: requires ref forwarding to each highlighted element. Some elements (list items in FlashList) need `testID`-based measurement.

**Option B: react-native-spotlight-tour or similar library**  
Pros: less code.  
Cons: another dependency, harder to theme to Threadbase's dark aesthetic.

**Option C: Inline contextual hints (no overlay)**  
First-time-only inline banner cards above key elements instead of a spotlight. Less dramatic but simpler to implement and more reliable.

Recommendation: **Option A** for Tour A (Hub) and **Option C** for Tours B and C (in-context hints are sufficient there).

---

### 4.4 Persistence

Each tour's dismissed/completed state stored in AsyncStorage:
- `threadbase_tour_hub` — `'seen'` when Hub tour is dismissed or completed
- `threadbase_tour_session` — `'seen'` when Session tour is dismissed
- `threadbase_tour_new_session` — `'seen'` when New Session tour is dismissed

Tours can be re-triggered via Settings → "Restart app tour" for discoverability.

---

## 5. Implementation Plan (Summary)

### Phase 1 · Compress onboarding to 4 steps
- Remove `ThemeStep`, `ValuePropStep`, `ServerNameStep`, `TourStep` from `OnboardingNavigator`
- Update `TOTAL_STEPS` constant from 8 → 4
- Remove `pendingServerName` state and `handleServerNameSubmit` from navigator (server label settable post-pair in Settings)
- Update `onboarding.json` with notification body copy and simplified ConnectStep strings
- Update `DoneStep` unpaired copy

### Phase 2 · Redesign manual mode in ConnectStep
- Refactor `manual` mode layout: two-section card (desktop command + paste inputs)
- Replace `$ tb pair --server` / `$ tb pair --token` labels with plain "Server URL" / "Token"
- Add copyable `tb token --new` command in the first section
- Add inline token tooltip (`?` icon)
- Rename CTA: "Open handshake" → "Connect"
- Update `pasteCredentials` choice card copy

### Phase 3 · Implement Hub Tour (Tour A)
- Create `TourOverlay` component with spotlight cutout + tooltip card
- Wire `onLayout` + `measure` refs on Hub session card, lane indicator, new-session button
- AsyncStorage key `threadbase_tour_hub` controls first-show logic
- Add "Restart app tour" option to Settings

### Phase 4 · In-context hints for Tour B and Tour C
- Session Detail: first-open banner below the header with "Swipe right on any message for actions."
- New Session: first-open inline hint above the project picker
- Both dismissible, stored in AsyncStorage

---

## 6. Out of Scope

- ThemeStep is not being deleted — it should be accessible from Settings on first launch via a "choose theme" prompt or simply as the existing theme picker.
- The QR pairing flow (PairScannerModal + pair-exchange service) is unchanged.
- i18n: strings updated in `en/onboarding.json` only; other locales follow the standard i18n backfill process.
- No changes to `AddServerScreen` (Settings entry point for adding a server after onboarding).

---

## 7. Success Criteria

- Median time-to-Hub (first real screen) drops from ~3 minutes to under 60 seconds.
- Pairing completion rate in onboarding improves (fewer users entering the app without a server connected).
- Tour A (Hub spotlight) is dismissed "Got it" rather than "skip" by >50% of first-time users — indicating comprehension, not avoidance.
- No regression in existing E2E flows (`npm run test:e2e:mock`).
