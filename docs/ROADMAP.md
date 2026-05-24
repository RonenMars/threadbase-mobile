# Roadmap — Planned & Shipped Features

Forward-looking feature work for Threadbase Mobile. Open bugs live in [BACKLOG.md](./BACKLOG.md).

This doc tracks **features**: new capabilities, UX changes, or feature-flag work. The historical implementation plans for shipped features are archived under [`superpowers/plans/archive/`](./superpowers/plans/archive/) — each is one self-contained build sequence at the time it shipped, useful for archaeology when revisiting an area.

Earlier-stage, not-yet-prioritized ideas live in [IDEAS.md](./IDEAS.md). When an idea is ready to commit to, promote it into this file as a numbered Feature.

---

## Status overview

| Feature | Status |
|---|---|
| Feature 1 — Tree directory view: pre-fill new-session path with current directory | Planned |
| Feature 2 — Move Export button from Historical session bottom bar into the info shelf | Planned |
| Feature 3 — Attach multiple files to a single message | Planned (larger — split into its own plan when picked up) |
| Feature 4 — Auto-deploy to App Store + Google Play | Planned (CI/release infra) |
| Feature 5 — Polish the onboarding flow | Planned (scope to be defined) |
| Feature 6 — Cross-session search with hit context + "open in session" | Planned (orchestration) |
| Feature 7 — Workspace tagging across sessions / conversations / projects | Planned (orchestration) |
| Feature 8 — Saved views: persisted filter + sort + tag combos as named tabs | Planned (orchestration) |
| Feature 9 — Side-by-side session split view | Planned (orchestration) |
| Feature 10 — Cross-server prompt templates / snippets library | Planned (orchestration) |
| Feature 11 — Workspace sync across devices via streamer | Planned (orchestration, depends on 7/8/10) |
| Feature 12 — Live Activities + Dynamic Island for in-progress sessions | Planned (mobile-native) |
| Feature 13 — Mission Control: aggregate every live session across servers | Planned (orchestration, recommended next) |
| Feature 14 — Voice prompts via on-device Whisper | Planned (mobile-native) |
| Feature 15 — Scheduled prompts ("send tomorrow at 9am") | Planned (async-collab) |
| Feature 16 — Native mini-form for Claude Code interactive prompts | Planned (mobile-native, cross-repo) |
| Feature 17 — Expand Maestro E2E coverage to high-value flows | Planned (CI/quality) |
| Feature 18 — Upgrade to Expo SDK 56 | Planned (platform/deps) |
| Feature 19 — Queue-while-thinking: recolor send button as "add to queue" during a turn, auto-send when idle | Planned (composer UX) |
| Feature 20 — Visual regression gate on Maestro screenshots | Planned (CI/quality, follow-on to Feature 17) |

**Suggested order for the original 5:** **Feature 2** (small UI move, isolated) → **Feature 5** (onboarding polish — needs a scoping pass first) → **Feature 1** (Tree drilled-dir path) → **Feature 4** (auto-deploy — pick up once releases are happening regularly enough to justify CI investment) → **Feature 3** (multi-file attachments, larger). Feature 2 may need to coordinate with [Bug 6](./BACKLOG.md#bug-6--conversation-list-content-hidden-under-bottom-action-bar) since both touch the bottom action bar.

**Suggested order for the orchestration cluster (6–15):** **Feature 13 Mission Control** (biggest daily-orchestration unlock, no native modules, reuses existing infra) → **Feature 6 Cross-session search** (already half-shipped at `hooks/useConversations.ts:431`; finishing it changes what the app is for) → **Feature 12 Live Activities** (highest mobile-native ceiling) → **Feature 15 Scheduled prompts** (strong async-teammate unlock if streamer cron is cheap) → **Feature 7 Tagging** → **Feature 8 Saved views** (builds on 7) → **Feature 10 Snippets** → **Feature 11 Workspace sync** (only after 7/8/10 exist and are worth syncing) → **Feature 14 Voice** (great but possibly overkill before #6 and #13 settle the workflow) → **Feature 9 Split view** (fun but iPad-coded; deprioritize if primary device is iPhone).

---

## Planned

### Feature 1 — Tree directory view: pre-fill new-session path with current directory

**Goal:** When the user has drilled into a directory in `TreeView` but hasn't opened a session yet, the "Create new session" button should pre-configure the new-session request with that directory's path on the active server.

**Core behavior:**
- Track "current drill directory" while the user is inside `DrillView` / `TreeSessionsList`.
- On "Create new session" tap from that state, pass `{ serverId, cwd: <currentDirPath> }` to the new-session flow instead of using the server default.

**Optional sub-feature A — Confirm with the user:**
- Before creating, show a sheet/modal: *"Create new session in `<path>` on `<server>`?"* with Confirm / Change path.
- Keeps the user in control if they drilled in just to browse.

**Optional sub-feature B — A/B test the confirmation:**
- If we add the confirmation (A), gate it behind an A/B flag:
  - **Variant A:** auto-use the drilled path, no prompt.
  - **Variant B:** prompt every time.
- Measure: new-session creation rate, session-abandon rate (created → never sent a message), edit-path rate.

**Open questions:**
- Where does "current drill directory" live? `stores/` (Zustand) vs. local state on `DrillView`. A store entry is cheaper if the new-session button is rendered outside `DrillView`.
- A/B test infra — do we have a feature-flag mechanism yet, or do we need to design one first? (If not, ship without B and revisit.)
- What's the fallback when the drilled path doesn't exist on the server? (Permission error, deleted dir, etc.)

**Files likely involved:**
- `components/sessions/tree/DrillView.tsx`
- `components/sessions/tree/TreeSessionsList.tsx`
- `app/index.tsx` or wherever the "Create new session" CTA lives
- `stores/servers.ts` or a new `stores/newSession.ts`
- streamer: new-session endpoint (verify it accepts `cwd`)

---

### Feature 2 — Move Export button from Historical session bottom bar into the info shelf

**Goal:** Declutter the Historical session view's **bottom bar** (where it currently sits next to the Resume Session button) by relocating the Export action into the existing info shelf inside the same screen.

**Direction:**
- Identify the current Export entry point in the Historical session view's bottom bar (next to Resume Session) and the info-shelf component it should live in.
- Move the trigger; keep the same export handler and behavior — no functional change, only placement.
- **Form factor in the shelf:** consider rendering Export as an **icon** (e.g. Phosphor `Export` / `Share`) instead of, or in addition to, a full button. An icon-only treatment fits the shelf's compact density; an icon + label combo is a middle-ground if discoverability is a concern. Pick after seeing the shelf's existing action style.
- Confirm the shelf's visual hierarchy still reads well after adding the action (it may need an action row / divider).

**Open questions:**
- Is the "info shelf" the metadata panel inside the Historical session screen, or a separate slide-up sheet? Confirm the exact component before editing.
- Icon-only vs. icon + label vs. full button — match whatever pattern the shelf already uses for other actions.
- Should the bottom bar retain any export affordance (e.g. for power users) or be fully removed? Default: fully removed — that's the point of the move; Resume Session stays as the sole bottom-bar primary.
- Any analytics event tied to the current Export button that needs its source label updated?

**Files likely involved (to verify):**
- `app/conversation/[id].tsx` or the Historical session screen route
- The bottom-bar component that currently hosts Resume Session + Export
- The info-shelf component rendered inside that screen
- Export handler (likely in a hook or `lib/`)

**Coordination:** Bug 6 ([BACKLOG.md](./BACKLOG.md#bug-6--conversation-list-content-hidden-under-bottom-action-bar)) is on the same screen — sequence them together so the bottom-bar layout only gets touched once.

---

### Feature 3 — Attach multiple files to a single message

**Goal:** Let the user attach more than one file to a message before sending, instead of being limited to a single attachment per turn.

**Direction:**
- Move from a single-attachment model to an array of pending attachments held in message-composer state.
- Composer UI: show a horizontal strip / chip list of pending files with per-file remove, plus an "Add file" affordance that stays available until a (per-message) cap is hit.
- Wire send to upload/encode all pending attachments and submit them as one user turn.

**Open questions:**
- **Per-message cap.** What's the upper limit (e.g. 5? 10? unlimited with a soft warning)? Drives UI density and validation.
- **Per-file size / total size limits.** Need a streamer-side limit and a client-side pre-check; what's the current per-file limit and does it still apply to the *sum*?
- **Supported types.** Images only, or any file (PDFs, text, code)? Mixed-type batches allowed?
- **Streamer contract.** Does the existing send-message endpoint accept an array of attachments, or do we need a new shape? Confirm before client work.
- **Upload progress UX.** One combined progress bar vs. per-file progress vs. fire-and-forget with retry on the failed ones?
- **Failure isolation.** If 1 of 3 files fails to upload, do we send the message with the 2 that succeeded, or block the whole send?
- **Picker.** iOS multi-select via `expo-image-picker` / `expo-document-picker` — confirm both support multi-select on current SDK.
- **Paste / drag.** Out of scope for v1? (Probably yes — keep it explicit-pick-only.)

**Files likely involved (to verify):**
- Message composer component (wherever the current single-file attach lives)
- Attachment upload helper in `lib/` / `services/`
- Send-message handler / hook
- streamer: send-message endpoint payload shape

**Related:** [Bug 5](./BACKLOG.md#bug-5--multi-attachment-send-produces-no-output) (multi-attachment send produces no output) is likely the same code paths surfaced as a bug. When picking up Feature 3, diagnose Bug 5 first — the fix may already collapse the two.

**Note:** This is a sizable feature — once we start it, split into its own plan doc and link back here.

---

### Feature 4 — Auto-deploy to App Store + Google Play

**Filed:** 2026-05-22.

**Goal:** Replace today's manual `/expo-local-ship` flow (build → archive → upload to TestFlight) with an automated CI pipeline that builds and submits to both App Store and Google Play on a release trigger (tag push, manual workflow dispatch, or merge to a release branch).

Today's setup (per [README](../README.md#building-for-release) + the `expo-local-ship` skill):
- Local-only: bumps `app.json` build number, archives with Xcode CLI, uploads via `xcrun altool`.
- TestFlight only — no App Store production submission, no Android pipeline.
- Cloud builds via EAS (`/ship-expo-cloud`) exist but are opt-in and still need a human in the loop.

**Direction (decide on pickup):**

1. **EAS Build + EAS Submit on GitHub Actions.** Simplest path on paper: `eas build --platform all --non-interactive` then `eas submit --platform all`. Requires EAS account billing, GitHub secrets for Apple + Google credentials, and trust in EAS's queue. Matches the `/ship-expo-cloud` flow but automated.

2. **Local build in GitHub-hosted macOS runner + Fastlane.** Keep the local build toolchain (the canonical path per project docs) but lift it into CI. Apple needs macOS runner (~10 min/min for self-hosted, or use GH macOS minutes). Android can run on Linux. Fastlane for App Store Connect + Play Console submission. More moving parts; full control.

3. **Mixed.** EAS for iOS (which is the part most painful locally — codesigning, provisioning, Xcode versions), local-style for Android (cheaper, simpler). Avoids EAS minutes for the easier platform.

**Open questions / prerequisites:**
- **App Store production listing.** Today we ship TestFlight only. Need to populate App Store Connect (screenshots, description, privacy policy URL, support URL, ratings questionnaire) before the first prod submission can succeed. This is *not* infra work — it's content + legal — and probably gates the iOS half of this feature.
- **Google Play listing.** Same — Play Console requires a complete store listing (graphics, content rating, target audience, data safety) before the first internal/closed/open/prod track upload is accepted.
- **Android build path.** The repo's iOS build setup is mature; Android has `npm run android` + Expo prebuild but no documented release archive flow. Verify `eas build --platform android` works end-to-end before betting on it, or document the local Gradle release flow first.
- **Signing.** iOS: confirm whether we keep the existing Apple ID + app-specific password setup, or move to Apple's App Store Connect API key (recommended for CI — no per-run 2FA prompts). Android: generate + securely store the upload keystore; document rotation policy.
- **Versioning.** Today the build number bumps in `app.json` per ship. Decide CI strategy: auto-increment from CI run number, derive from git tag, or read+bump from `app.json`. Consistency between iOS `buildNumber` and Android `versionCode` matters.
- **Release notes.** Pull from git log between tags? From a `CHANGELOG.md`? From the GitHub release body? Each platform needs them in a different format (App Store: "What's New" per locale; Play: release notes per track).
- **Crash + analytics provisioning.** If we don't already have Sentry/Crashlytics for prod, this is a good moment to wire it. Out of scope for the deploy plumbing itself, but flag for coordination.
- **Phased rollout.** Both stores support staged rollouts (X% of users). Default to manual promotion via the console, or wire CI to ramp automatically? Manual is safer for v1.

**Files likely involved (none yet — this is mostly new infrastructure):**
- `.github/workflows/release.yml` — new
- `eas.json` — likely needs profile additions for production tracks (currently profiled for cloud dev builds)
- `app.json` — versioning automation
- `fastlane/` directory if going with option 2
- Possibly a small `scripts/ci/` directory for shared bump-and-tag logic

**Coordination:**
- The `/expo-local-ship` skill is the user's stated default (per global memory) — Feature 4 doesn't replace it for ad-hoc TestFlight pushes; it adds a parallel automated path for tagged releases. Keep the local skill intact.
- If we ever want CI to push *to TestFlight*, that's a smaller scope and doesn't need full App Store listing — could be a Phase 1.

**Note:** Sizable feature touching credentials, billing decisions, and external account setup. Once started, split into its own plan doc; it's almost certainly bigger than a single sprint.

---

### Feature 5 — Polish the onboarding flow

**Filed:** 2026-05-22.

**Goal:** Refine the first-launch onboarding experience. Today's flow (`app/onboarding.tsx` + `components/onboarding/{OnboardingShell,OnboardingNavigator}.tsx` + `components/onboarding/steps/*`) gets users from cold install to a paired server, but the rough edges haven't been cataloged or prioritized.

**Scope is intentionally undefined.** Before designing or implementing, do a discovery pass:

1. **Audit the current flow.** Step through onboarding on a fresh sim install (`xcrun simctl uninstall booted` → reinstall). Note every friction point: copy that reads as placeholder, transitions that feel abrupt, errors that surface as system alerts instead of in-screen treatment, fields that don't autofocus, keyboard avoiding gaps, illegible contrast, missing back affordances, mismatched motion. Capture as a punch list in this entry (or a sub-plan doc if it gets long).
2. **Look at the empty-state scenarios.** What happens if the user enters an unreachable server URL? An invalid API key? Cancels the QR scanner? Denies camera permission? Tries to paste a malformed URL?
3. **Identify the top 5 fixes by impact × cost.** Don't try to do everything in one pass — onboarding polish is bottomless work. Pick the wins that meaningfully reduce drop-off or confusion.

**Likely areas (to verify in the audit):**
- **QR vs. manual entry.** Today they're parallel paths; which one converts better? Should one be primary?
- **Default server URL.** `EXPO_PUBLIC_DEFAULT_SERVER_URL` (= `http://localhost:7070`) is a dev convenience; in prod it's likely useless or actively confusing. Hide it on release builds?
- **Pairing protocol.** NaCl key exchange (`services/pair-exchange.ts`) — does the user see any meaningful state during the handshake, or just a spinner? What's the error UX if it fails?
- **Transitions.** Animation system at `components/onboarding/animations.ts` — feels deliberate but worth checking it's coherent end-to-end on Android too (the recent SDK 55 downgrade may have regressed something).
- **Theme.** Onboarding has its own `theme.ts` — verify it stays in step with the main app theme after the recent theming-system work, or intentionally deviates for a "welcome" tone.

**Open questions for the audit pass:**
- What's the actual drop-off shape? Without analytics on each step, this is qualitative. Worth wiring step-event logging before designing fixes if data doesn't exist yet.
- Is there an "onboarded skipped" state? E.g. for users restoring from backup with credentials already in Keychain.

**Files likely involved (to verify):**
- `app/onboarding.tsx`
- `components/onboarding/OnboardingNavigator.tsx`
- `components/onboarding/OnboardingShell.tsx`
- `components/onboarding/steps/*` (each step component)
- `components/onboarding/animations.ts`
- `components/onboarding/theme.ts`
- `services/pair-exchange.ts` (for pairing UX)
- `stores/servers.ts` (for "is onboarded" gating)

**Coordination:**
- [Bug 7b](./BACKLOG.md#bug-7--quick-access-strip-default-collapsed--tab-reorder--hide-when-fully-empty) hides the Quick Access strip when there's nothing to show. A newly-onboarded user has no favorites/recents/popular yet → the strip *should* be hidden post-onboarding until they have something. Make sure Feature 5's polish doesn't reintroduce an empty-strip experience by re-expanding by default.
- [Issue 1](./BACKLOG.md#issue-1--post-intro-cached-hub-list-flashes-then-re-paints-with-server-data) is "post-intro Hub flashes when cache hydrates before server data lands." The intro→Hub transition is owned by onboarding's exit, so Feature 5 might be the right place to fix the handoff (e.g. delay the navigation until first-server-fetch settles) rather than gating the Hub itself.

**Note:** Start with audit → punch list → prioritization. Don't pick a solution before the audit. Once we have the top fixes, split into its own plan doc with concrete tasks.

---

### Feature 6 — Cross-session search with hit context + "open in session"

**Filed:** 2026-05-22 (promoted from [IDEAS.md](./IDEAS.md) Idea 1).

**Goal:** Turn the existing per-server search API into a top-level workspace search that returns ranked hits across every server, with the matching message snippet inline and a tap-to-jump-to-message action.

**Why:** `hooks/useConversations.ts:431` already calls `/api/search?q=` per server. The bones are there, but it's wired into the History tab as "filter conversations by title" — not "find that one message where I told Claude about the bug we shipped last week." The mobile sweet spot is "I'm on the train, I need to look at a thing the agent said three days ago."

**Direction:**
- A dedicated `/search` route. Single input, debounced.
- Fan-out across `activeServerIds` via `useQueries`.
- Group results by server → project → conversation; show the matching message excerpt with the hit highlighted.
- Tap → deep-link to that exact message in the conversation view (existing `/conversation/[id]` + a new `?focus=<messageId>` param + scroll-to-anchor).
- Recent searches persisted to AsyncStorage.

**Open questions:**
- Does the streamer's search response already include message snippets, or just conversation metadata? If just metadata, that's a streamer-side change before client work starts. Verify against `services/api-client.ts` + streamer code.
- Ranking: simple recency first, or does the streamer return relevance? If we need to merge ranked results from N servers client-side, how do we normalize scores?
- Scoping: search-all by default vs. search-current-server. A toggle vs. a chip strip vs. respect `displayedServerIds`?
- Filters in the search results: by project, by date, by status? Or punt to v2?

**Scope:** ~1 week, assuming the streamer already returns snippets. Add ~3–5 days if streamer changes are needed.

**Files likely involved:**
- `app/search.tsx` — new
- `hooks/useConversations.ts` (extend `useConversationSearch` for multi-server)
- `services/api-client.ts` — verify search endpoint shape
- `app/conversation/[id].tsx` — add `?focus=<messageId>` handling

---

### Feature 7 — Workspace tagging across sessions / conversations / projects

**Filed:** 2026-05-22 (promoted from [IDEAS.md](./IDEAS.md) Idea 2).

**Goal:** Let the user tag any session, conversation, or project with arbitrary text labels (`bug-bash`, `production`, `client-acme`, `friday-experiment`), then filter every list view by tag — across servers.

**Why:** With 2,700+ conversations across 10 projects, the existing axes (server, project, recency) aren't enough. Tags are a flat orthogonal dimension users can define themselves. Bigger payoff the more tags exist.

**Direction:**
- A `stores/tags.ts` Zustand store. Compound key `serverId::entityType::entityId` → `string[]`. Persisted to SecureStore alongside servers (private to device for v1).
- Long-press anywhere → action sheet → "Add tag".
- New "Tags" tab inside Quick Access (per the `QuickAccessStrip.tsx` pattern).
- Filter chip in History + Sessions tabs.

**Open questions:**
- Tag autocomplete: free-text only, or remember-and-suggest? (Easy win to add suggestions from existing tags.)
- Tag colors: assign automatically (hash → palette), let user pick, or no color?
- Bulk-tag UX: multi-select mode in a list? Defer to v2?
- Cross-device sync (covered by Feature 11) vs. device-local-forever?

**Scope:** ~1.5 weeks, entirely client-side for v1.

**Files likely involved:**
- `stores/tags.ts` — new
- `components/shared/TagSheet.tsx` — new (the action sheet for managing tags on an entity)
- `components/quick-access/QuickAccessStrip.tsx` — add Tags tab option
- `components/sessions/hub/ProjectHubCard.tsx`, `ConvRow.tsx`, `SessionRow.tsx` — render tag chips inline
- `app/index.tsx` — wire tag filter into the existing FilterSortSheet

**Related:** Feature 8 (Saved views) depends on this for the tag-filter dimension. Feature 11 (Workspace sync) wants this synced once it exists.

---

### Feature 8 — Saved views: persisted filter + sort + tag combos as named tabs

**Filed:** 2026-05-22 (promoted from [IDEAS.md](./IDEAS.md) Idea 3).

**Goal:** "I want to see all *running* sessions tagged `production` from servers `prod-us` and `prod-eu`, sorted by elapsed time, every time I open the app." Save that combination as `Prod Watch`. It becomes a tab.

**Why:** Builds on Feature 7 but works without it too. Operators with many servers (`displayedServerIds`, `FilterSortSheet`) keep manually re-applying the same filters. A saved view is a one-tap re-application.

**Direction:**
- `stores/savedViews.ts` storing `{ name, serverIds, statusFilter, tagFilter?, sortBy, sortOrder }`.
- New horizontal scroll row above the Hub/Tree/Classic switcher with chip-shaped saved views.
- Long-press to rename / reorder / delete.
- "Save current view" button in `FilterSortSheet`.

**Open questions:**
- Default views shipped out of the box (e.g. "All running", "Waiting input") vs. all user-created?
- Visual treatment: tab strip vs. chip strip vs. dropdown — pick after wiring; depends on how many views people actually create.
- Conflict with the existing Hub/Tree/Classic switcher: do saved views replace it, sit above it, or live as a separate axis?

**Scope:** ~1 week if Feature 7 is already in; ~1 week standalone (without tag-filter dimension).

**Files likely involved:**
- `stores/savedViews.ts` — new
- `components/sessions/SavedViewsStrip.tsx` — new
- `components/servers/FilterSortSheet.tsx` — add "Save current view" button
- `app/index.tsx` — apply active saved view's filters on mount

**Related:** Feature 7 (Tagging) provides the tag-filter dimension. Feature 11 (Workspace sync) wants this synced.

---

### Feature 9 — Side-by-side session split view for live runs

**Filed:** 2026-05-22 (promoted from [IDEAS.md](./IDEAS.md) Idea 4).

**Goal:** Open two sessions in a 50/50 split so you can watch one while interacting with the other. Or compare diff output across two parallel approaches on the same codebase.

**Why:** Operating across multiple agents working different tickets is the orchestration-angle killer use case. Today you tab-swap, which loses the "watch terminal scroll" benefit. A real split view turns the iPad/Pro-Max into a multi-agent cockpit.

**Direction:**
- A new `/session/split?left=<id>&right=<id>` route.
- Each pane is the existing `/session/[id]` content trimmed to ~50% width.
- Tap a divider to swap, drag to resize, swipe horizontally on a pane to swap that side.
- iPad gets a full 50/50 by default; phones get a stacked vertical mode (bottom one minimized to a peek strip you can tap to expand).

**Open questions:**
- WebSocket connection accounting: does the singleton `wsManager` already support N subscribers per session, or do we need refcounting? Verify before designing.
- VirtualTerminal: one instance per pane (memory cost) or reused?
- Keyboard handling when both prompt inputs exist — which is focused, what happens on Tab?
- How do users *enter* split view? Long-press a session card → "Open beside X"? Action in the session header? Both?

**Scope:** ~2 weeks. Trickiest part is the keyboard + focus management. Memory cost of two VT100 grids may need profiling on older devices.

**Files likely involved:**
- `app/session/split.tsx` — new
- `services/ws-client.ts` — verify multi-subscriber support
- `services/virtual-terminal.ts` — verify it's safe to instantiate twice
- `app/session/[id].tsx` — extract reusable pane component

**Note:** iPad-coded. If iPhone is the primary device, deprioritize. Could potentially be cut entirely if usage data shows nobody splits.

---

### Feature 10 — Cross-server prompt templates / snippets library

**Filed:** 2026-05-22 (promoted from [IDEAS.md](./IDEAS.md) Idea 5).

**Goal:** "Apply linting + tests + commit message rules" — save the prompt once, paste into any session on any server. Optionally with variable slots (`{branchName}`, `{ticketId}`).

**Why:** People say the same things to the agent dozens of times. The composer's `stores/drafts.ts` saves the last-typed-but-not-sent draft per session — useful but not the same thing. A library is share-once-use-everywhere.

**Direction:**
- New `stores/snippets.ts` (persisted).
- A `/snippets` screen for management.
- In the composer, a button next to the attach icon opens a snippets sheet → tap to insert into the input.
- Simple `{var}` prompts: when inserting a snippet that contains `{...}` tokens, a quick inline form asks for each variable before pasting into the input.

**Open questions:**
- Snippet scope: all-servers / per-server / per-project? Start global, add scopes later if needed.
- Variable syntax: `{foo}` vs. `${foo}` vs. `{{foo}}` — `{foo}` is shortest but ambiguous with regular text containing braces. Pick after seeing real snippet content.
- Sharing snippets across users (later, requires streamer)? Likely Feature 11 territory.
- Markdown / code-fence handling in the inserted text?

**Scope:** ~1 week. Pure client for v1.

**Files likely involved:**
- `stores/snippets.ts` — new
- `app/snippets.tsx` — new
- The composer component (TBD location — likely under `components/conversation/` or `app/session/[id].tsx`)
- A new `components/shared/SnippetPickerSheet.tsx`

**Related:** Feature 11 (Workspace sync) wants this synced.

---

### Feature 11 — Workspace sync across devices via streamer

**Filed:** 2026-05-22 (promoted from [IDEAS.md](./IDEAS.md) Idea 6).

**Goal:** Phone, iPad, and web all see the same tags, snippets, saved views, and favorites. Threadbase server becomes the source of truth.

**Why:** Connective tissue. Without it, every preference is stuck on one device — fine for a hobby user, blocking for a real workflow.

**Direction:**
- A `services/workspace-sync.ts` module.
- New REST endpoints on streamer: `GET/PUT /api/workspace/preferences` (JSON blob; last-write-wins per top-level key).
- Sync triggered on app foreground + on local change (debounced).
- Conflict resolution: each top-level key is timestamped, latest wins.
- Device-local exclusions: server URLs + API keys (stay in Keychain), `stripCollapsed`, `displayedServerIds` (these are per-device UI state, not workspace state).

**Open questions:**
- Which preferences sync vs. stay device-local? Settle the list before designing the JSON shape.
- Per-server vs. per-user identity: do we sync workspace prefs *per streamer*, or merge across all paired streamers? Per-streamer is simpler and matches the multi-server architecture.
- LWW is naive — fine for v1 but causes silent overwrites. Acceptable risk?
- Encryption at rest on the streamer: tags / snippet bodies could contain sensitive text. E2E vs. trust the streamer?
- Migration path: on first launch after the feature ships, do we upload existing local state, or wait for the user to opt in?

**Scope:** ~2 weeks client + ~3–5 days streamer side. Realistically a feature that follows once Features 7 / 8 / 10 exist and are worth syncing.

**Files likely involved:**
- `services/workspace-sync.ts` — new
- `stores/tags.ts`, `stores/snippets.ts`, `stores/savedViews.ts`, `stores/quickAccess.ts` — each gets a sync hook
- streamer: new endpoint + storage table

**Sequencing:** Don't build this until Features 7, 8, and 10 are shipped or close to. Syncing a single setting isn't worth the complexity.

---

### Feature 12 — Live Activities + Dynamic Island for in-progress sessions

**Filed:** 2026-05-22 (promoted from [IDEAS.md](./IDEAS.md) Idea 7).

**Goal:** A running session shows up in the iPhone's Dynamic Island and lock-screen as a live activity: project name, status (running / waiting input), elapsed time, latest terminal line. Tap to jump in.

**Why:** *Quintessential* mobile-orchestration superpower. The user can put the phone down, watch the island for status, glance at the lock screen, and only open the app when they need to act. It's the difference between "I check the app every 2 minutes" and "the app tells me when to care."

**Direction:**
- iOS: a new native module (or `expo-live-activities` once stable — check the current Expo SDK 55 ecosystem status). On session start (or via a "make this session live" action), register an ActivityKit activity.
- Push updates via APNs to the activity, fed by the existing WS `session_update` stream (push tokens already wired in `services/push.ts`).
- Android: a foreground service notification with similar content; not as flashy but functionally parallel.

**Open questions:**
- Auto-promote all running sessions to a Live Activity, or only on user opt-in per session? iOS has a per-app limit (around 5–8 concurrent activities, depending on iOS version) — auto-promote on a multi-session orchestrator hits that fast.
- 12-hour Apple cap on Live Activities — need renewal logic for genuinely long-running sessions. Renewal = end the old activity, start a new one with the same id; OK or jarring?
- Lock-screen vs. island vs. both. Both is default; verify the layout works at all three sizes (compact / expanded / minimal).
- Android: foreground service has battery / permission implications. Worth the lift for a v1, or iOS-only first?

**Scope:** ~2 weeks iOS + ~1 week Android. Native module work is the spiky part. Start iOS-only.

**Files likely involved:**
- `modules/live-activities/` — new native module (or wrap an Expo plugin)
- `services/push.ts` — extend payload routing for activity-update pushes
- `services/ws-client.ts` — hook session_update events into the activity update path
- `app/session/[id].tsx` — "Make live" action
- streamer: send activity-update pushes alongside the existing session-update notifications

---

### Feature 13 — Mission Control: aggregate every live session across servers

**Filed:** 2026-05-22 (promoted from [IDEAS.md](./IDEAS.md) Idea 8).

**Recommended next-up for the orchestration cluster** — biggest daily unlock, lowest implementation risk (no native modules), reuses existing infra.

**Goal:** A dedicated screen that shows every live session across every server as a grid of small cards (project, last line of terminal, status badge, elapsed). Updates in real time. Tap any card to dive in.

**Why:** Today the Hub mixes live + historical + projects. When you're orchestrating, the *only* thing you care about for 30 seconds is "what's running and which one needs me?" Mission Control answers exactly that.

**Direction:**
- A new `/mission-control` route (or a tab).
- Subscribes to all WS streams via the existing `wsManager`.
- 2-column grid on phone (iPad: 3–4) of mini-cards.
- Cards highlight (amber border + haptic on first appearance) when their status flips to `waiting_input`.
- Header strip: live counts — "3 running · 2 waiting · 1 failed".
- Tap-and-hold a card → quick-reply sheet that pushes a prompt without leaving Mission Control.

**Open questions:**
- Entry point: tab vs. modal vs. swipe-down from Hub? A persistent tab is most discoverable but adds chrome.
- Card content: how much of the terminal is useful? Last 1 line? Last 3? Last 1 *non-decoration* line (the VirtualTerminal strips spinner frames already)?
- Auto-refresh cadence: subscribe to WS push (real-time but chatty) vs. throttle to 1s ticks (smoother on long-running streams)?
- Sorting: by "needs you most" (waiting_input first), by recency, or user-pickable?
- What about historical sessions completed in the last N minutes — show or hide?

**Scope:** ~1.5 weeks. Infrastructure already exists; this is largely a new view over the same data.

**Files likely involved:**
- `app/mission-control.tsx` — new (or a new tab inside `app/index.tsx`)
- `components/sessions/MissionControlCard.tsx` — new mini-card
- `services/ws-client.ts` — verify the multi-server subscribe path scales
- `hooks/useSession.ts` — extend the all-servers active-sessions query
- `components/shared/QuickReplySheet.tsx` — new sheet for tap-and-hold-to-reply

**Related:** Feature 12 (Live Activities) makes Mission Control even more useful — you act on a Live Activity prompt, Mission Control shows you the resulting state.

---

### Feature 14 — Voice prompts via on-device Whisper

**Filed:** 2026-05-22 (promoted from [IDEAS.md](./IDEAS.md) Idea 9).

**Goal:** Tap a mic icon in the composer → record → transcript inserted at the cursor. Works offline (Whisper coreml). One-handed orchestration while walking.

**Why:** Typing prompts on a phone is the single biggest friction in mobile orchestration. Voice removes it. iOS native speech recognition is OK; Whisper is excellent. The streamer doesn't need to know — it sees plain text.

**Direction:**
- A native module wrapping `whisper.cpp` with the coreml-optimized iOS build, OR `expo-speech-recognition` for the simpler-but-cloud path.
- Mic button in the composer.
- Visual waveform during recording.
- Auto-stop on 2s silence.
- Edit before send (don't auto-fire).

**Open questions:**
- On-device Whisper (best UX, ~75 MB `tiny.en` or ~150 MB `base.en` bundled with the app) vs. iOS Speech framework (no bundle bloat, but cloud-y and English-biased)? On-device is the *right* answer for an orchestration tool but adds ~150 MB to the IPA.
- Model choice: `tiny.en` is fast and fine for short prompts; `base.en` is noticeably better for technical jargon. Bundle one, or let the user pick?
- Languages: English-only v1, or multi-language from day one? `tiny` (multilingual) is ~75 MB; English-only is roughly half.
- Background recording: not for v1. Foreground only.
- Punctuation: Whisper does its own punctuation; iOS Speech doesn't. Worth normalizing?

**Scope:** ~2 weeks on-device; ~1 week for the iOS Speech fallback.

**Files likely involved:**
- `modules/whisper/` — new native module (or `expo-speech-recognition` wrapper)
- The composer component
- App bundle config (`app.json`, `Info.plist` microphone usage description) — already partially in place if push notifications are
- Privacy policy update (microphone permission disclosure for App Store)

**Note:** Possibly overkill before Features 6 and 13 settle the workflow. Revisit after those ship.

---

### Feature 15 — Scheduled prompts ("send tomorrow at 9am")

**Filed:** 2026-05-22 (promoted from [IDEAS.md](./IDEAS.md) Idea 10).

**Goal:** Compose a prompt, tap "Send later," pick a time. The streamer delivers it at that time, even if the app is closed.

**Why:** "Async teammate" pattern. Combine with Feature 12 (Live Activities) and Feature 13 (Mission Control) and you have a meaningful "I delegate to the agent, then check the result in the morning" loop. Single biggest unlock for the away-from-desk workflow.

**Direction:**
- Streamer-side: a small queue. `POST /api/sessions/:id/schedule { prompt, at }` + cron-style trigger that fires the prompt at the scheduled time.
- Client-side: `/schedule` screen listing pending scheduled prompts, edit / cancel.
- The streamer fires the prompt; existing WS flow delivers the assistant turn back to the device whenever it opens.
- Optional client-only fallback: `expo-background-fetch` (less reliable on iOS, but works if streamer cron isn't ready).

**Open questions:**
- Does the streamer already have a job-queue / cron mechanism (for session lifecycle, push tokens, etc.) we can reuse? If yes, this is a small extension. If no, the streamer side becomes the bulk of the work.
- Recurring prompts ("every Monday at 9am") — v1 or punt?
- Timezone handling: store as UTC, render in user's local. Standard fare, but worth being explicit.
- What if the session is no longer alive at fire time? Auto-resume? Notify the user and abandon? Configurable per scheduled prompt?
- Edit window: can the user edit a scheduled prompt up to T-5 minutes? Or only cancel?

**Scope:** ~1.5 weeks client + ~1 week streamer (if cron infra exists). Add 1–2 weeks streamer if cron infra needs to be built from scratch.

**Files likely involved:**
- `app/schedule.tsx` — new
- `services/api-client.ts` — new endpoint methods
- `hooks/useScheduledPrompts.ts` — new
- streamer: scheduled-prompts table + cron worker + send-as-user endpoint
- Composer: "Send later" affordance next to the send button

**Related:** Feature 13 (Mission Control) is the natural "see what your scheduled prompts did" surface.

---

### Feature 16 — Native mini-form for Claude Code interactive prompts

**Filed:** 2026-05-23.

**Goal:** When Claude Code emits an interactive question (numbered selection list, single-choice radio-style, or multi-select checkbox), surface it in the app as a native form (tappable options + submit) instead of letting it render as raw text inside the PTY scrollback that the user has to scroll to and type a number into.

**Why:** On a phone, typing numbers into the chat input to answer a question that's buried somewhere above in tool output is awkward and error-prone. This is the single widest gap between Claude Code's TTY-native UX and what a touch-native client should feel like.

**Direction:**
- Detection: most likely streamer-side. `tb-streamer` parses the prompt out of the PTY stream and emits a structured WS event (`{ type: 'prompt', shape: 'single'|'multi', options: [...], promptId }`). Keeps mobile rendering dumb; lets detection logic be hot-fixed without a mobile rebuild.
- Mobile: subscribe to the new WS event, render a `<PromptForm>` (radio for single-choice, checkbox for multi) overlay or sibling to the chat input when active. Submit via WS / sibling REST.
- PTY view: while a form is active, hide or de-emphasize the duplicate prompt text in scrollback so there's no "two places to answer" confusion.
- Fallback: if the detected shape doesn't match a known form (e.g. free-text follow-up), leave the PTY text visible — never block the user.

**Open questions:**
- Detection approach — regex vs. structured marker from `tb-streamer` vs. cooperation from Claude Code itself (env-flag-gated structured stdout, OSC escape). Plan stub recommends streamer-side WS event but the call should be made against the upstream landscape at pickup time.
- Multi-select submission is the hard part — Claude Code's multi-select TUI uses cursor keys + space + enter, which doesn't replay cleanly via stdin. Validate feasibility before committing to the multi-select variant; the single-choice form can ship independently.
- How to mask the duplicate PTY lines without breaking terminal cursor alignment.
- Cancel/dismiss behavior (background app, swipe form away, streamer-side timeout).

**Scope:** ~1 week mobile + ~1 week streamer for single-choice. Multi-select is gated on upstream support and may need to be deferred.

**Files likely involved:**
- `tb-streamer`: new prompt-detector module + WS event type + stdin-injection endpoint accepting `{ promptId, answer }`
- `tb-mobile`: new `components/session/PromptForm.tsx`, session-detail Zustand slice for `activePrompt`, WS handler wiring
- Session-detail screen integration above the chat input

**Plan stub:** [`superpowers/plans/2026-05-23-claude-code-prompt-miniform.md`](./superpowers/plans/2026-05-23-claude-code-prompt-miniform.md)

---

### Feature 17 — Expand Maestro E2E coverage to high-value flows

**Filed:** 2026-05-23.

**Goal:** Grow the Maestro smoke suite (`launch.yaml` + `browse.yaml`, ~30–60s, hub-only) into coverage of the flows most likely to regress in day-to-day work.

**Why:** Current suite proves the app boots to the hub and the filter/sort sheet opens. Session detail navigation, chat send, attachments, settings, and keyboard-avoidance are all uncovered — and several of these have been the source of recent bugs (multi-attachment Bug 5, the 2026-05-22 keyboard-avoidance fix).

**Priority order (P0 → P3):**
- **P0 — unblockers**
  1. Fix project-row testID a11y so Maestro can tap into a session detail (`e2e/README.md` "Known limits" #1). Wrap row in a `<View accessible testID>` instead of relying on `TouchableOpacity` prop forwarding.
  2. Add the mock endpoints currently 404ing (`/api/sessions/names`, `/api/projects/popular`, `/api/conversations/count`, `POST /api/push/register`) so the hub error banner stops obscuring elements.
- **P1 — regression coverage for recent fixes**
  3. Keyboard-avoidance flow on the chat input (guards the 2026-05-22 fix).
  4. Onboarding end-to-end on a freshly erased sim (`xcrun simctl erase` in CI before the run).
  5. Session rename flow.
- **P2 — needs mock work**
  6. Minimal `/ws` WebSocket fake in `e2e/mock-server.js` (frame-replay from a fixture). Unlocks `chat_send.yaml`.
  7. Single-attachment send flow.
  8. Multi-attachment send flow — currently expected to fail ([Bug 5](./BACKLOG.md) territory); use as a watchdog test that flips green when the bug is fixed.
- **P3 — broader UX**
  9. Settings: theme toggle.
  10. Settings: language switch + RTL spot-check.
  11. Filter/sort *application* (not just sheet open).

**Open questions:**
- Pay the cost of erasing the sim once per CI run for the onboarding flow, or gate behind an env flag?
- Attachment + WS flows in `test:e2e:mock` (slower smoke) or a separate `test:e2e:full` job?
- Also run the suite on Android — Maestro's `testID` handling is better there per `e2e/README.md`.

**TestIDs likely needed (preliminary):**
- `project-row-<projectId>` on the hub's project group row
- `session-detail-back`, `session-detail-rename-cta`, `session-rename-input`, `session-rename-confirm`
- `chat-input`, `chat-send-cta`, `chat-attachment-cta`, `chat-message-<index>`
- `settings-screen`, `settings-theme-toggle`, `settings-language-select`
- A keyboard-spacer anchor for asserting input visibility above the keyboard

**Files likely involved:**
- `e2e/mock-server.js` — endpoint additions + `/ws` fake
- `e2e/*.yaml` — new flow files per priority item
- `components/sessions/hub/ProjectHubCard.tsx` (or row component) — testID a11y fix
- Misc source files for the testIDs above
- `e2e/README.md` — document each new flow and its testIDs

**Plan stub:** [`superpowers/plans/2026-05-23-e2e-expansion.md`](./superpowers/plans/2026-05-23-e2e-expansion.md)

**Related:** the open "GitHub Actions: Tests + E2E" CI item — pairs naturally with this so the expanded suite runs on every push.

---

### Feature 18 — Upgrade to Expo SDK 56

**Filed:** 2026-05-23.

**Goal:** Move the app from Expo SDK 55 → 56 on a `chore/expo-56-upgrade` branch, with the full Jest + Maestro suites green, a clean `expo-doctor`, and a TestFlight archive dry-run via `/expo-local-ship`.

**Why:** Keep the toolchain current with the canary work we eventually want to absorb (SDK 56 routes/router-typing, RN 0.85, React 19.2.3). A prior 55→56 attempt was rolled back on 2026-05-06 — treat SDK 56 as still potentially fragile and prefer waiting for a patch release (`~56.0.5`+) before starting.

**Procedure:** Full step-by-step lives in the standalone brief [`docs/upgrade-to-expo-56.md`](./upgrade-to-expo-56.md) — 5 phases (discover/report → bump → code fixes → native rebuild + sim smoke → ship dry-run → PR). The brief is self-contained and is the source of truth; this entry is the pointer.

**Acceptance criteria** (copied from the brief so the roadmap entry is self-contained):
- `npm run typecheck` exits 0
- `npm run lint` ≤ `main` baseline (43 errors / 46 warnings)
- `npm run test:ci` exits 0
- `npm run test:e2e:mock` exits 0
- App launches cleanly on iPhone 17 Pro / iOS 26.4 simulator
- App launches cleanly on iOS 17.x simulator
- `expo-doctor` exits 0
- No new TS2345 / TS2322 from `t('ns:key')` cross-namespace usage
- iOS Release build succeeds via `npx expo run:ios --configuration Release --device <udid>`
- TestFlight archive via `/expo-local-ship` succeeds (no actual ship)
- PR opened with before/after dep version table

**Risk notes:**
- Prior 55→56 attempt rolled back 2026-05-06 — inspect that branch's history before redoing from scratch.
- iOS-26 Hermes path was a crash source 54→55; re-test on iOS 26.x after upgrade.
- `ship.sh` step-2 `npm install` corrupts Watchman/Metro mid-ship — reset Watchman before any ship dry-run.

**Out of scope:** NativeWind v4→v5, react-native-screens@5, expo-updates re-enablement, Zustand/Router refactors. See the brief's "Things explicitly NOT in scope" section.

**Plan stub:** [`superpowers/plans/2026-05-23-expo-56-upgrade.md`](./superpowers/plans/2026-05-23-expo-56-upgrade.md)

---

### Feature 19 — Queue-while-thinking: recolor send button as "add to queue" during a turn, auto-send when idle

**Filed:** 2026-05-24.

**Goal:** While Claude is still mid-turn (streaming a response, running a tool, "thinking"), let the user keep typing and tap a recolored send button that **queues** the message instead of either disabling the input or trying to interrupt. The moment Claude finishes the current turn, the queued message is auto-sent.

**Why:** Today the user has to wait until the turn fully settles before they can compose the next message — or worse, they type ahead and the send action is ambiguous (does it interrupt? buffer? get lost on a re-render?). A queue affordance with explicit visual state turns the dead time during a long turn into productive typing time. This is one of the most common "mobile orchestration" moments — you read the partial output, react, and want to fire the follow-up the instant the agent is free.

**Direction:**

- **Visual state of the send button.**
  - Idle (no in-flight turn): current accent color, current Phosphor icon (`PaperPlaneTilt` or whatever's in use), label "Send".
  - In-flight (Claude is mid-turn): swap to a distinct **marine / teal** tint (pick something clearly different from both the idle accent *and* the disabled gray) and swap the icon to a queue affordance (Phosphor `Plus`, `PlusCircle`, `Stack`, or `ListPlus` — see plan stub for the final pick). Optionally a small badge with the count of queued messages (`1`, `2`, …) when more than one is staged.
  - Per project icon rule: no emojis — Phosphor only.
- **Behavior on tap.**
  - Idle: send immediately, as today.
  - In-flight: push the typed text into a queue (FIFO). Clear the composer. Optionally light haptic to confirm the queue.
- **Flush on idle.**
  - Listen for the "turn finished" signal (whatever existing WS event / state slice currently flips `isThinking` → false in the session-detail screen). On the falling edge, dequeue the next message and send it as a real send.
  - If multiple messages are queued, send them one at a time, waiting for the next idle window between each — OR merge them into a single message with a separator (e.g. blank-line join). Decide on pickup; FIFO-one-at-a-time is the conservative default.
- **Queue management.**
  - Show the queued messages somewhere visible (e.g. a small chip strip above the composer, or pinned above the latest assistant turn) so the user can see what's about to fire.
  - Allow per-item cancel (tap chip → remove) and reorder (long-press → drag) only if it's cheap; otherwise FIFO-locked is fine for v1.
- **Edge cases.**
  - User backgrounds the app with a queue pending → on resume, replay state, don't lose messages.
  - User leaves the session screen entirely → queue is cleared (it's per-session ephemeral state). Confirm; the alternative is per-session-persisted queue, which feels surprising.
  - Turn errors out mid-flight → don't auto-fire the queue. Surface "queue paused — turn failed, [Send] to fire `<n>` queued messages" affordance.
  - Streaming abort (user taps Stop) → same as error: pause the queue, let the user explicitly resume or cancel.

**Open questions:**

- **Single-vs-multi-message flush.** If two messages are queued, do we (a) send them one-at-a-time across two turns, (b) merge into one message before sending, or (c) let the user pick per-queue? (a) is simplest and most faithful to what the user typed; (b) avoids creating turns the user didn't explicitly ask for; (c) is overkill for v1.
- **Where does the queue live?** Per-session ephemeral state in the session-detail screen (lost on unmount) vs. a small slice on a Zustand store (`stores/queue.ts`?) keyed by `sessionId` (survives unmount). The latter handles "user briefly navigates away and back" but adds persistence surface area. Probably ephemeral for v1.
- **"Thinking" detection.** What's the canonical signal today? Verify against `hooks/useSession.ts` / WS handler / VirtualTerminal idle detector before designing the trigger. The PTY turn-divider (shipped 2026-05-02) already has an idle-detect heuristic — reuse if applicable.
- **Visual treatment of the queued chips.** Above the composer (in-line with the input) vs. floating above the bottom-bar vs. inline with the assistant turn as "queued: <preview>". First option is most discoverable; pick after seeing the composer layout.
- **Stop/Abort interaction.** If the user taps Stop on the current turn while there's a queue, does that also flush the queue? Almost certainly yes — they're explicitly bailing out — but confirm.

**Files likely involved (to verify):**

- The composer component (TBD location — likely under `components/conversation/` or `app/session/[id].tsx`).
- The send-message handler / hook (currently in `hooks/` or `services/api-client.ts`).
- Whatever currently exposes `isThinking` / "turn in flight" state to the composer.
- A new `stores/queue.ts` (or local state on the session screen) for the queued messages.
- A small queue-chip-strip component above the composer if we go with the inline-strip UX.

**Coordination:**
- Related to [Feature 16](#feature-16--native-mini-form-for-claude-code-interactive-prompts): both touch the moment a turn is in flight, and both involve the composer area. If 16 lands first, account for the prompt-form taking precedence over the queue UI when a structured prompt is active.
- Related to [Bug 5](./BACKLOG.md#bug-5--multi-attachment-send-produces-no-output) only loosely — queueing is independent of attachments — but verify that a queued message with attachments fires the same code path on auto-send.

**Scope:** ~3–5 days client-side, no streamer change required. Single-message-at-a-time flush is a smaller, safer v1; multi-message merge / reorder is v2.

---

### Feature 20 — Visual regression gate on Maestro screenshots

**Filed:** 2026-05-24. **Depends on:** [Feature 17 — Expand Maestro E2E coverage to high-value flows](#feature-17--expand-maestro-e2e-coverage-to-high-value-flows). Pick up once the Maestro suite is stable in CI and the screenshot set has settled.

**Goal:** Turn the per-flow `takeScreenshot` checkpoints already wired into the Maestro suite into a real regression gate — each CI run diffs the captured screenshot against a committed baseline and fails the build (or surfaces a PR comment) on visual drift.

**Why:** The current setup *captures* screenshots but doesn't *compare* them. Layout regressions like Bug 6 (last message hidden behind action bar) are exactly the class of bug pixel diffs catch reliably — and the screenshots are already produced on every CI run, so the marginal cost of adding a comparator is small.

**Direction (decide on pickup):**

1. **Option A — `pixelmatch` + baselines committed to the repo (lowest friction).** Add `e2e/compare-screenshots.js` (~50 lines) that loads each `e2e/_artifacts/screenshots/*.png` and diffs against `e2e/_baselines/*.png` using `pixelmatch` + `pngjs`. New script `npm run test:e2e:regression` runs the Maestro suite then the comparator. CI invokes it on push-to-main. Baselines are captured from a clean CI run and committed.
2. **Option B — Maestro Cloud (zero friction, paid + vendor-locked).** Swap `maestro test` for `maestro cloud` in the CI job. Maestro Cloud handles the baseline storage + diff UI. Costs above the free tier; requires uploading the build to mobile.dev.
3. **Option C — Reg-Suit / Loki (open-source visual regression toolchain).** Adds an S3 (or gh-pages) bucket for baseline hosting + a PR-comment diff gallery. More polish for non-engineer reviewers; one more moving part in CI.

**Recommendation:** Start with Option A. Graduate to B or C if (a) false-positive thrash from antialiasing / font hinting becomes unmanageable, (b) the screenshot set grows past ~20 frames, or (c) designers want a UI to triage diffs.

**Open questions:**

- **Capture baselines locally or in CI?** Local sims (iOS 26.1 today) and the CI macOS runner (whatever Apple ships on `macos-14`) may not pixel-match. Capturing baselines inside CI avoids the cross-environment drift problem. First-time setup: merge an empty-baseline PR, let the CI run produce screenshots, download the `maestro-artifacts` artifact, copy into `e2e/_baselines/`, commit, re-run.
- **Crop status bar + home indicator before diffing?** They change between sim versions / clock ticks and reliably trigger false positives. Crop a 20px top + 20px bottom band before comparison, or use Maestro's `takeScreenshot` with a region argument if 2.x supports it.
- **Threshold per flow.** A global `0.5%` pixel diff threshold may be too strict for `pty-divider-01-session-detail.png` (terminal contents shift slightly) and too loose for `bug6-01-last-message-above-bar.png` (overlap is a 200pt regression, easy to detect). Per-flow override map.
- **Update workflow.** When a UI change *intentionally* changes a screenshot, the PR author needs a one-command way to update the baseline (`npm run test:e2e:regression -- --update`). Treat baselines as code: reviewed in the diff, not auto-committed.
- **CI cost.** Option A adds ~5 seconds to the existing macOS Maestro job — negligible. B and C add network round trips + paid quota.

**Files likely involved (to verify):**

- `e2e/compare-screenshots.js` (new) — the comparator.
- `e2e/_baselines/` (new directory) — committed PNGs.
- `package.json` — new `test:e2e:regression` script + `pixelmatch` + `pngjs` devDependencies.
- `.github/workflows/test.yml` — invoke regression after the existing Maestro step in the `e2e-maestro` job.
- `e2e/README.md` — document how to update baselines after intentional UI changes.

**Coordination:**

- Don't start until Feature 17 (the broader E2E expansion) has settled — the screenshot set should be stable before baselines are committed. Otherwise every Feature 17 PR churns the baselines.
- Land separately from the existing "Maestro in CI" work — that lives on `combo-a-e2e-runs` and treats Maestro as a smoke gate; this is the regression-detection layer on top.

**Scope:** ~half a day for Option A + initial baselines + one round of false-positive tuning. More if the baselines need cropping logic or per-flow threshold overrides.

---

## Shipped

Historical implementation plans archived under [`superpowers/plans/archive/`](./superpowers/plans/archive/). Each was the source of truth for that feature's build sequence at the time it shipped — useful when revisiting the area, but not active work.

| Date | Feature | Plan |
|---|---|---|
| 2026-04-23 | **Splash animation** — animated thread-lines icon → matrix-style falling digits with sweep bar, replacing the static dark splash. | [archive/2026-04-23-splash-animation.md](./superpowers/plans/archive/2026-04-23-splash-animation.md) |
| 2026-04-30 | **Projects Hub redesign** — replaced the tab navigator with a tab-free Projects hub (accordion cards per project, green FAB, avatar dropdown) while preserving Classic mode. | [archive/2026-04-30-projects-hub-redesign.md](./superpowers/plans/archive/2026-04-30-projects-hub-redesign.md) |
| 2026-04-30 | **Server list redesign** — inline icon actions (Delete/Edit/Refresh), error/edit modals, pull-to-refresh, Phosphor migration. | [archive/2026-04-30-server-list-redesign.md](./superpowers/plans/archive/2026-04-30-server-list-redesign.md) |
| 2026-05-01 | **Adopt discovered session** — prompt to kill and resume a `disc_` (discovered) session as a managed PTY, poll until live, then navigate. | [archive/2026-05-01-adopt-discovered-session.md](./superpowers/plans/archive/2026-05-01-adopt-discovered-session.md) |
| 2026-05-01 | **CardShell unified template** — extended the `Card` component to own all shared visual tokens; migrated `SessionCard` and `ProjectHubCard`. | [archive/2026-05-01-cardshell-unified-card-template.md](./superpowers/plans/archive/2026-05-01-cardshell-unified-card-template.md) |
| 2026-05-01 | **Maestro E2E setup** — Maestro flows + Node mock server covering Sessions Hub and Session Detail. | [archive/2026-05-01-maestro-e2e-setup.md](./superpowers/plans/archive/2026-05-01-maestro-e2e-setup.md) |
| 2026-05-01 | **NativeWind Wave 1** — migrated all 8 `components/ui/` primitives from `StyleSheet.create` to NativeWind `className=`, with `clsx` and tailwind config tokens. | [archive/2026-05-01-nativewind-wave1.md](./superpowers/plans/archive/2026-05-01-nativewind-wave1.md) |
| 2026-05-01 | **Server headers — Hub & Classic** — added server section headers to Hub and Classic merged layouts, matching the Tree layout. | [archive/2026-05-01-server-headers-hub-classic.md](./superpowers/plans/archive/2026-05-01-server-headers-hub-classic.md) |
| 2026-05-01 | **Tree view server headers** — server header rows above each server's tree section. | [archive/2026-05-01-tree-server-headers.md](./superpowers/plans/archive/2026-05-01-tree-server-headers.md) |
| 2026-05-02 | **i18n implementation** — i18next with 6 namespaces, RTL readiness, Zustand-backed locale system; 5-wave string extraction. | [archive/2026-05-02-i18n-implementation.md](./superpowers/plans/archive/2026-05-02-i18n-implementation.md) |
| 2026-05-02 | **PTY turn divider** — "YOU → <text>" divider injected into terminal output after each user input, once the stream goes idle. | [archive/2026-05-02-pty-turn-divider.md](./superpowers/plans/archive/2026-05-02-pty-turn-divider.md) |
| 2026-05-02 | **Quick Access strip** — collapsible strip above the session list with Favorites / Recents / Popular tabs. | [archive/2026-05-02-quick-access-strip.md](./superpowers/plans/archive/2026-05-02-quick-access-strip.md) |
| 2026-05-02 | **Session naming** — user-visible session names via 4 touchpoints (creation modal, auto-name from first message, inline rename, on-exit prompt); Zustand + SecureStore ↔ streamer SQLite. | [archive/2026-05-02-session-naming.md](./superpowers/plans/archive/2026-05-02-session-naming.md) |
| 2026-05-02 | **Theming system** — 5-theme picker (Dark, Light, Dracula, Catppuccin Mocha, Nord) with CSS custom properties + NativeWind. | [archive/2026-05-02-theming-system.md](./superpowers/plans/archive/2026-05-02-theming-system.md) |
| 2026-05-11 | **Server drag-and-drop reordering** — iOS-style jiggle animation; accessible from the Filter & Sort sheet. | [archive/2026-05-11-server-drag-reorder.md](./superpowers/plans/archive/2026-05-11-server-drag-reorder.md) |

Recent bug-only backlog docs (no new features) also archived for traceability:

- [archive/2026-05-16-loading-perf-and-tree-new-session.md](./superpowers/plans/archive/2026-05-16-loading-perf-and-tree-new-session.md) — original collected bug + feature list that became this split (BACKLOG / ROADMAP).
- [archive/2026-05-22-hub-cached-flash-and-long-list-perf.md](./superpowers/plans/archive/2026-05-22-hub-cached-flash-and-long-list-perf.md) — the perf doc that became Issue 1 and Issue 2 in BACKLOG.
