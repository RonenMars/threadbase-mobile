# Loading UX, Hub-list perf, Quick Access, scroll-to-end, Tree new-session path

**Date:** 2026-05-16
**Status:** Backlog — not started
**Owner:** Ronen

Captures four open bugs + one feature surfaced after the conversation-list redesign (commits 048ac78 / 3aba495 / 88-bump cycle). Use this doc as the source of truth; split into smaller plans once we start each item.

---

## Bugs

### Bug 1 — Conversation open: add loader (with min 1.2s) to prevent flicker — 🚧 IN PROGRESS (brainstorm paused 2026-05-18)

**Symptom:** Tapping a conversation transitions instantly when cached, then re-renders once data resolves — perceived as a flicker.

**Root cause confirmed:** Conversations are persisted via React Query's AsyncStorage persister (`PERSISTED_QUERY_ROOTS` includes `conversation`), so on return visits `isPending` is false on mount, the FlatList mounts with messages, then `onContentSizeChange` fires → triggers `scrollToBottom(false)` → visible jump.

**Design decisions (locked in during 2026-05-18 brainstorm):**
- Scope: loader masks **both** fetch and initial scroll-to-bottom layout
- Visual: reuse existing `MessageSkeletonRow` (10 rows)
- Helper: new `hooks/useMinDisplayTime.ts` — pure hook, takes `(isReady, minMs=1200, resetKey?)`, returns `isGated`
- Reset: on `id` route-param change (via `resetKey`)
- Errors bypass the floor — show error view immediately
- Ready signal: `data !== undefined` AND first `onContentSizeChange` has fired
- Pagination: gate lifts after first page rendered+laid out; existing `ProgressBar` handles older-page backfill
- Integration: Approach A — single combined `isGated` boolean in `app/conversation/[id].tsx`

**Outstanding before implementation:**
- Approve hook API (Section 2)
- Present Section 3 (integration spec in `[id].tsx`)
- Write spec doc to `docs/superpowers/specs/2026-05-18-conversation-loader-min-display-design.md`
- User reviews spec
- Invoke writing-plans

**Pickup notes:** Full design state at `docs/superpowers/todos/2026-05-18-conversation-loader-bug1.md`.

---

### Bug 2 — Hub tree node open: add loader AND fix long-list render stall

Two distinct problems hiding behind one symptom ("clicking a directory hangs"):

**2a. Loading state (mirror of Bug 1)**
- When a Hub directory node is tapped and conversations need to be fetched, show a loader with the same min 1.2s floor.

**2b. Long-list rendering stall (the real culprit)**
- Suspected root cause: rendering a 1000-item accordion. Confirmed correlation — closing the accordion also stutters for ~1s, which rules out fetch latency.
- Verify hypothesis by instrumenting render time vs. fetch time on a directory with 500+ conversations.
- Mitigations to evaluate (pick after measuring):
  1. **Virtualize the accordion contents.** Replace the inline `.map` with `FlatList` / `FlashList` inside the expanded section.
  2. **Lazy-mount on expand, unmount on collapse.** Don't keep collapsed-but-mounted children in the tree.
  3. **Pre-build a per-directory conversation index at hub load time** so node taps don't re-walk the dataset.
  4. **Window the accordion** — render only the visible 30–50 rows; expand the window as the user scrolls within the accordion.

**Action item:** measure before optimizing. We don't know which of 2b.1–2b.4 is needed until we profile.

**Files likely involved:**
- `components/sessions/hub/ProjectHubList.tsx`
- `components/sessions/hub/ProjectHubCard.tsx`
- `components/sessions/hub/ConvRow.tsx`
- `hooks/useQuickAccess.ts` (if pre-indexing happens here or in a sibling hook)

---

### Bug 3 — Quick Access strip never loads items ✅ DONE (2026-05-16, commit eea502d)

**Root cause:** Strip queried only `activeServerIds[0]`. With 3 paired servers (each with its own API key), the first-added server determined what appeared — and the strip rendered silently empty regardless of cause.

**Fix shipped:**
- `hooks/useQuickAccess.ts`: hooks now take `serverIds: string[]` and fan out via `useQueries`; sessions tagged with `serverId`, popular dedup by path.
- `components/quick-access/QuickAccessStrip.tsx`: feeds `displayedServerIds` (falls back to `activeServerIds`). Added explicit empty / loading / error / no-server UI states.
- `lib/clientLog.ts`: pre-hydration drops now `console.warn` + optional `EXPO_PUBLIC_DEV_STREAMER_URL/KEY` fallback (made the bisect possible).
- 4 jest tests pass (single-server, multi-server union, popular dedup).

---

### Bug 4 — Long conversation: scroll-to-end is flickery / jumpy

**Symptom:** When opening a long conversation that should land at the bottom, the scroll-to-end animation visibly jumps, sometimes overshooting and snapping back.

**Three candidate solutions to evaluate** (pick one after a quick spike):

1. **Inverted FlatList + render-from-bottom.** Flip the list so index 0 is the newest message. Initial render naturally lands on the latest item with no programmatic scroll needed. Tradeoff: requires reversing all list logic; pagination becomes "load more" at the bottom.

2. **Two-phase render: hidden mount → measured scroll → reveal.** Render the list with `opacity: 0` (or `pointerEvents: none` behind a splash), wait for `onContentSizeChange` to fire once with a stable size, call `scrollToEnd({ animated: false })`, then fade the list in. Tradeoff: adds a brief "loading" frame but eliminates visible jump.

3. **`maintainVisibleContentPosition` + pinned anchor.** Use FlatList's `maintainVisibleContentPosition` with the last message as the anchor; let RN keep it pinned through layout passes instead of re-scrolling. Tradeoff: iOS-friendly, Android support has been spotty historically — needs a check on current RN version.

**Recommendation:** start with (2) — lowest blast radius, doesn't restructure the list. Fall back to (1) if (2) still flickers on cold loads.

---

### Bug 6 — Conversation list content hidden under bottom action bar (filed 2026-05-20, not diagnosed)

**Symptom:** When scrolled to the end of an existing conversation (Historical view), the last message visible above the bottom action bar (Export + Resume Session) is not actually the last message. Dragging the list upward with a finger reveals more messages tucked behind the bottom bar. Releasing the finger snaps the list back to the original position, so the hidden content becomes inaccessible without a sustained drag.

**Suspected cause:** The FlatList's bottom inset / `contentContainerStyle.paddingBottom` doesn't account for the bottom action bar's height. The list believes its content ends at the visible bottom edge, but real content extends under the bar. Because there's no over-scroll commit (rubber-band only), the release snaps back.

**Likely fixes to evaluate:**
1. Add `paddingBottom` to `contentContainerStyle` equal to the bottom-bar height (+ safe-area).
2. Use `contentInset` / `contentInsetAdjustmentBehavior` to reserve space below the list.
3. Measure the bottom bar with `onLayout` and feed its height into the list's bottom padding (handles font-scale and locale changes).

**Files likely involved:**
- `app/conversation/[id].tsx` — FlatList + bottom-bar layout
- Whichever component renders the Export + Resume Session row at the bottom of the Historical view

**Related:** Bug 4 (scroll-to-end jumpy) is about scroll *animation*, not visible content offset — keep them separate.

---

### Bug 5 — Multi-attachment send produces no output (filed 2026-05-18, not diagnosed)

**Symptom:** Start a new session, send a message with 2 attachments — the UI never shows a response.

**Suspected cause:** Today's send-message path is built for a single attachment; the 2-attachment case either fails the send silently, succeeds server-side but doesn't deliver, or arrives but is rejected by a renderer assumption. Adjacent to Feature 3 (multi-file attachments per message) — likely the same code paths.

**Diagnosis order when picked up:**
1. Inspect the network payload — does send-message ship 2 attachments at all?
2. Check streamer logs — did the turn get stored / did the assistant respond?
3. Check session WS stream — did the assistant turn arrive client-side?
4. Trace message-content reducer / renderer for any single-attachment assumption

**Files to start with (to verify):**
- Message composer / attachment picker
- Send-message handler in `hooks/` or `services/`
- streamer send-message endpoint
- Session WS stream subscriber

---

## Feature

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

**Note:** This is a sizable feature — once we start it, split into its own plan doc.

---

## Sequencing suggestion

1. ~~**Bug 3** (Quick Access)~~ ✅ shipped 2026-05-16
2. **Bug 1** (conversation loader) — 🚧 in progress; establishes the min-display-time helper.
3. **Bug 2a** (Hub loader) — reuses the helper from Bug 1.
4. **Bug 2b** (Hub long-list perf) — needs profiling first; biggest win.
5. **Bug 4** (scroll-to-end) — spike solution 2, fall back to 1.
6. **Bug 6** (bottom-bar overlap) — small layout fix; can be done alongside Bug 4 since both touch the same screen.
7. **Bug 5** (multi-attachment no output) — diagnose first; may collapse into Feature 3.
8. **Feature 2** (Export button relocation) — small, isolated UI move; good warm-up. Note: relocating Export out of the bottom bar may interact with Bug 6's fix — sequence accordingly.
9. **Feature 1** (Tree drilled-dir new-session path) — ship without A/B first, then add the prompt + experiment.
10. **Feature 3** (multi-file attachments) — larger; split into its own plan doc when picked up.
