# Backlog — Open Bugs

Open bug tickets for Threadbase Mobile. Features live in [ROADMAP.md](./ROADMAP.md).

Each entry is meant to be self-contained enough to pick up without re-reading the original conversation. File pointers use `path:line` where the line number is meaningful; otherwise the path is enough.

Once a bug is fixed, leave its entry in place and move the status marker to ✅ DONE — keeps the history searchable.

---

## Status overview

| ID | Title | Status |
|---|---|---|
| Bug 1 | Conversation open: add loader (min 1.2s) to prevent flicker | ✅ DONE 2026-05-21 (7e197ab) |
| Bug 2 | Hub tree node open: loader + long-list render stall | Open (split — see Issue 1 + Issue 2) |
| Bug 3 | Quick Access strip never loads items | ✅ DONE 2026-05-16 (eea502d) |
| Bug 4 | Long conversation: scroll-to-end flickery / jumpy | ✅ DONE 2026-05-22 (78218fb) |
| Bug 5 | Multi-attachment send produces no output | Open — not diagnosed |
| Bug 6 | Conversation list content hidden under bottom action bar | Open — not diagnosed |
| Bug 7 | Quick Access strip: default-collapsed + tab reorder + hide when empty | Open |
| Bug 8 | Manage Favorites: duplicate top bar (8b CTA moved to Feature 24) | Open |
| Bug 9 | Quick Access: hide Edit pencil when strip is collapsed | Open |
| Bug 10 | Conversation: show "Top" button only when scrolling up | Open |
| Bug 11 | Conversation: move "Bottom" button to bottom-right; show only when not at bottom | Open |
| Bug 12 | MessageBubble bleed + code-fence collapse cut | ✅ DONE 2026-05-22 (cdf0303, d3aec11, f58d74d, 1a020fb) |
| Bug 13 | New session: name modal flashes open then auto-closes before user can type | Open — not diagnosed |
| Bug 14 | After starting new session, file browser stays in stack and re-shows on exit | Open — not diagnosed |
| Bug 15 | After new-session back, file browser is interaction-locked (only close works) | Open — not diagnosed |
| Bug 16 | Back from never-typed-in new session leaves an empty session alive | Open — not diagnosed |
| Bug 17 | Chat output + on-reconnect: scroll-to-bottom is jumpy, not smooth | Open — not diagnosed |
| Bug 18 | Maestro flow `server_drag_reorder.yaml.skip` crashes the app at `swipe` | Open — flow skipped |
| Bug 19 | Maestro flow `tree_server_headers.yaml.skip` can't return to hub after second pair | Open — flow skipped |
| Bug 20 | New session from tree-view (with path completion): "Path" error | Open — not diagnosed |
| Bug 21 | "Open Session" from Recents lands on "Session not found" | Open — not diagnosed |
| Bug 22 | Settings QR-scanner button is a no-op on the UI layer | Open — not diagnosed |
| Bug 23 | Popular → "New Session here" errors "Unable to load directories" | Open — not diagnosed |
| Bug 24 | Popular error text is black on black (almost invisible) | Open (visual — consult /impeccable) |
| Bug 25 | ➜ Moved to ROADMAP as [Feature 22](./ROADMAP.md#feature-22--settings-button-on-the-filter--sort-bar-parity-with-sidebar) | Moved 2026-05-25 |
| Bug 26 | Hide Quick Access Edit pencil when the active tab is empty | Open |
| Bug 27 | ➜ Moved to ROADMAP as [Feature 23](./ROADMAP.md#feature-23--onboarding-optional-server-name-slide-before-the-qr-scan) | Moved 2026-05-25 |
| Bug 28 | Pull-to-refresh modal: show IP+port when server has no name | Open |
| Bug 29 | Quick Access: open only on tab click; remove the right-side chevron | Open |
| Bug 30 | Add-to-favorites is non-functional — needs spec from Claude Code | Open — needs spec |
| Issue 1 | Post-intro: cached Hub list flashes, then re-paints with server data | Open |
| Issue 2 | Hub accordion expand stalls on long projects (1,266 items → ~9 s) | Open |

**Suggested next-up order:** Bug 13 + Bug 14 + Bug 15 + Bug 16 (all on the browse → start-session → PTY → back handoff, likely shared root cause — investigate together) → Bug 7 → Bug 9 (same file, ship together) → Bug 8 → **Bug 17 → Bug 10 + Bug 11** (same conversation FlashList; smooth-scroll fix may change at-bottom detection the scroll-button bugs rely on) → Issue 1 → Issue 2 → Bug 6 → Bug 5. Rationale at the bottom of the file under [Sequencing](#sequencing).

---

## Bug 2 — Hub tree node open: loader + long-list render stall

> **2026-05-22 update:** Reproduced on iPhone 17 sim with `tmp` (1,266 convs → >9 s stall) and `tb-mobile` (166 convs → several seconds). Smoking gun confirmed at `components/sessions/hub/ProjectHubCard.tsx:121-178` (inline `.map` over full dataset in `mergeChats` branch). Bug 2 splits cleanly into **Issue 1** (cold-launch cached flash) and **Issue 2** (accordion expand render stall) below. Keep this entry as the original report for traceability.

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

## Bug 5 — Multi-attachment send produces no output

**Filed:** 2026-05-18 — not diagnosed.

**Symptom:** Start a new session, send a message with 2 attachments — the UI never shows a response.

**Suspected cause:** Today's send-message path is built for a single attachment; the 2-attachment case either fails the send silently, succeeds server-side but doesn't deliver, or arrives but is rejected by a renderer assumption. Adjacent to the planned multi-file attachments feature (see [ROADMAP.md](./ROADMAP.md) Feature 3) — likely the same code paths.

**Diagnosis order when picked up:**
1. Inspect the network payload — does send-message ship 2 attachments at all?
2. Check streamer logs — did the turn get stored / did the assistant respond?
3. Check session WS stream — did the assistant turn arrive client-side?
4. Trace message-content reducer / renderer for any single-attachment assumption.

**Files to start with (to verify):**
- Message composer / attachment picker
- Send-message handler in `hooks/` or `services/`
- streamer send-message endpoint
- Session WS stream subscriber

---

## Bug 6 — Conversation list content hidden under bottom action bar

**Filed:** 2026-05-20 — not diagnosed.

**Symptom:** When scrolled to the end of an existing conversation (Historical view), the last message visible above the bottom action bar (Export + Resume Session) is not actually the last message. Dragging the list upward with a finger reveals more messages tucked behind the bottom bar. Releasing the finger snaps the list back to the original position, so the hidden content becomes inaccessible without a sustained drag.

**Suspected cause:** The FlatList's bottom inset / `contentContainerStyle.paddingBottom` doesn't account for the bottom action bar's height. The list believes its content ends at the visible bottom edge, but real content extends under the bar. Because there's no over-scroll commit (rubber-band only), the release snaps back.

**Likely fixes to evaluate:**
1. Add `paddingBottom` to `contentContainerStyle` equal to the bottom-bar height (+ safe-area).
2. Use `contentInset` / `contentInsetAdjustmentBehavior` to reserve space below the list.
3. Measure the bottom bar with `onLayout` and feed its height into the list's bottom padding (handles font-scale and locale changes).

**Files likely involved:**
- `app/conversation/[id].tsx` — FlatList + bottom-bar layout
- Whichever component renders the Export + Resume Session row at the bottom of the Historical view

**Related:** Bug 4 (scroll-to-end jumpy, ✅ shipped) was about scroll *animation*, not visible content offset — they're separate. Bug 6 may interact with [Feature 2](./ROADMAP.md#feature-2--move-export-button-from-historical-session-bottom-bar-into-the-info-shelf) (Export relocation) — sequence accordingly.

---

## Bug 7 — Quick Access strip: default-collapsed + tab reorder + hide when fully empty

**Filed:** 2026-05-22.

Three small UX tweaks reported together. They share a file (`components/quick-access/QuickAccessStrip.tsx`) and a store (`stores/quickAccess.ts`), so handle as one ticket.

**7a. On app load, show the strip collapsed.**
- Today the persisted default is `stripCollapsed: false` (`stores/quickAccess.ts:88`). Flip it to `true`.
- Migration: existing users have their preference persisted via the partializer (`stores/quickAccess.ts:154`). Don't force-collapse them — only change the default for fresh installs. If we want every user to see the new default once, bump the persist key or add a one-shot migration; otherwise leave persisted state alone.
- Verify the collapse chevron in `QuickAccessStrip.tsx:243-248` still works the same way once the initial state flips.

**7b. Hide the strip entirely when there's nothing to show.**
- Condition: `favorites.length === 0` AND `recents.length === 0` AND `popular.length === 0` AND every queried server reports 0 conversations.
- Today the strip only short-circuits when *all three tabs are disabled* (`QuickAccessStrip.tsx:154` → `if (enabledTabs.length === 0) return null`). That doesn't help a brand-new user who hasn't pinned anything yet — they still see an empty strip with three empty tabs and "No favorites yet — long-press an item to pin it."
- Add a second short-circuit: compute `nothingToShow = favorites.length === 0 && (recentsData?.sessions?.length ?? 0) === 0 && (popularData?.projects?.length ?? 0) === 0 && totalConversationsAcrossServers === 0`. Return `null` when true.
- `totalConversationsAcrossServers` needs sourcing — likely the same multi-server fan-out that powers the Hub list (`hooks/useEagerConversations`, see `app/index.tsx:19`). Don't trigger an extra network call just for this gate; reuse whatever's already in the cache.
- Edge case: while data is still loading on cold launch, **don't** hide the strip yet — that would cause a layout reflow once recents/popular resolve. Only hide once at least one of the queries has settled and reported zero. (Or just key the hide check off `favorites.length === 0 && hasZeroServerConversations` — favorites are local-only and synchronous, conversations come from cache.)

**7c. Reorder tabs: Recents, Popular, Favorites (currently Favorites, Recents, Popular).**
- Two places to update:
  1. `TAB_DEFS` array in `QuickAccessStrip.tsx:211-215` — reorder.
  2. `enabledTabs` builder at `QuickAccessStrip.tsx:114-120` — reorder the `if` branches so the default `effectiveTab` (`enabledTabs[0]`) becomes `recents` instead of `favorites`.
- The local state currently defaults `currentTab` to `'favorites'` (`QuickAccessStrip.tsx:29`). After the reorder, change this initial state to `'recents'` so the tab on first paint matches the new visual order.
- Side effect: the "gear" icon for managing favorites is gated on `effectiveTab === 'favorites'` (`QuickAccessStrip.tsx:232-236`). It will now appear only when the user actively switches to Favorites — fine, but verify it still hits.

**Files likely involved:**
- `components/quick-access/QuickAccessStrip.tsx`
- `stores/quickAccess.ts` (default `stripCollapsed`, possibly a migration)
- `hooks/useQuickAccess.ts` (for the "total conversations" signal — verify there's already a query result we can reuse before adding anything)

**Related:** Bug 7b and [Feature 24](./ROADMAP.md#feature-24--manage-favorites-add-to-favorites-empty-state-cta) (previously Bug 8b, now in ROADMAP) both need a "any-server-has-conversations" check — land the signal in one hook so both can reuse it.

---

## Bug 8 — Manage Favorites: duplicate top bar

**Filed:** 2026-05-22. **Note:** 2026-05-25 — the original 8b ("Add to favorites" empty-state CTA) was reclassified as a feature and moved to ROADMAP as [Feature 24](./ROADMAP.md#feature-24--manage-favorites-add-to-favorites-empty-state-cta). What remains below is the original 8a bugfix.

**Remove the duplicate top bar.**
- Screenshot shows two stacked top bars: the system Stack header (`< manage-favorites`) AND the screen's own custom header (`← Back  Manage Favorites`). Both are rendering.
- Root cause: `app/_layout.tsx:178-204` declares `Stack.Screen` for `index`, `onboarding`, `session/[id]`, `conversation/[id]`, `browse`, `settings`, `project/[id]` — but **not** `manage-favorites`. So the route falls back to the default Stack header (which uses the filename as title) AND `app/manage-favorites.tsx:15-21` renders its own in-screen header.
- Two clean fixes — pick one:
  1. **Keep system header, delete in-screen header.** Add `<Stack.Screen name="manage-favorites" options={{ title: 'Manage Favorites', headerShown: true }} />` in `app/_layout.tsx`, then delete the `<View style={styles.header}>` block + its styles from `app/manage-favorites.tsx:15-21,54-65`. Consistent with `settings` and `project/[id]`.
  2. **Keep in-screen header, hide system header.** Add `<Stack.Screen name="manage-favorites" options={{ headerShown: false }} />` and leave the screen as-is. Consistent with `session/[id]` and `conversation/[id]`.
- **Recommendation: (1)** — Settings already uses the system header (`app/_layout.tsx:190-193`); Manage Favorites is the same kind of secondary nav surface. Matching settings keeps the back gesture and title behavior identical without custom code.

**Files likely involved:**
- `app/_layout.tsx` — add `Stack.Screen name="manage-favorites"`
- `app/manage-favorites.tsx` — delete in-screen header (or hide system one)

---

## Bug 9 — Quick Access: hide Edit pencil when strip is collapsed

**Filed:** 2026-05-22.

**Symptom:** When the Quick Access strip is collapsed (chips hidden, only the tab bar visible), the Edit-mode pencil icon still renders on the right side of the tab bar. It does nothing useful in that state — there are no chips to enter edit mode for — and it's visually cluttering an already-dense row.

**Fix:** Gate the pencil button's render on `!stripCollapsed`. Today the toggles at `components/quick-access/QuickAccessStrip.tsx:237-242` render unconditionally:

```tsx
<Pressable style={styles.iconBtn} onPress={() => setEditMode((v) => !v)} hitSlop={8}>
  {editMode
    ? <Check size={16} color={dark.text.accent} />
    : <PencilSimple size={16} color={dark.text.secondary} />
  }
</Pressable>
```

Wrap in `{!stripCollapsed && ( ... )}`, or compute a `showEdit = !stripCollapsed` and guard the pressable.

**Side effects to check:**
- If the user is *in* edit mode and then collapses the strip, `editMode` stays `true` in state. When they re-expand, edit mode persists — usually fine. If we'd rather reset, also call `setEditMode(false)` from the collapse handler at `QuickAccessStrip.tsx:243`.
- The gear icon (manage favorites) at `:232-236` is already gated on `effectiveTab === 'favorites'` and isn't affected by collapsed state. Decide whether *it* should also hide when collapsed for consistency — probably yes, since neither button is actionable on a row that just shows tab labels.

**Files likely involved:**
- `components/quick-access/QuickAccessStrip.tsx:232-242`

**Related:** [Bug 7](#bug-7--quick-access-strip-default-collapsed--tab-reorder--hide-when-fully-empty) touches the same file (default-collapsed + tab reorder + hide-when-empty). Land them in one PR — shared review surface, same testing.

---

## Bug 10 — Conversation: show "Top" button only when scrolling up

**Filed:** 2026-05-22.

**Symptom:** Today the "Top" floating button (centered, top of the conversation view) appears whenever scroll position `y > 100` AND the previous scroll delta was upward. The intent is right but the implementation flickers: as soon as the user releases their finger and the scroll decelerates *downward by a single pixel*, the button disappears. So it pops in and out during natural scroll-to-read motion instead of staying available while the user is actively trying to go up.

**Current behavior** (`app/conversation/[id].tsx:207`):
```tsx
setShowScrollTop(scrollingUp && y > 100)
```
`scrollingUp` is true only on a frame where `y < prevScrollY.current` — instantaneous, not a held state.

**Desired behavior:** Show the Top button when the user is *in the act of scrolling up* — meaningfully and recently. Two interpretations to pick from on pickup:

1. **Hold-on-recent-upward-motion.** Show on any upward delta, then hold visible for ~600 ms after the last upward frame before fading out. Smooths out the decel jitter without changing the semantic meaning.
2. **Show only while finger is dragging up.** Track `onScrollBeginDrag` + `onScrollEndDrag` and show only between begin and end, when the begin→current delta is upward. More deliberate, fewer false positives.

**Recommendation:** (1) — cheaper to implement, preserves the existing meaning, matches what the user expects ("I'm reading older messages, I might want to jump to top"). Add a `useRef` for the last upward-motion timestamp, plus a `setTimeout` for the hide.

**Side notes:**
- Threshold `y > 100` is fine, keep it.
- Also consider hiding when the user is already near the top (`y < 200`) — no point offering "scroll to top" when they're already there. Combine with Bug 11's symmetric check at the bottom.

**Files involved:**
- `app/conversation/[id].tsx:202-209` (the `handleScroll` callback that sets both `showScrollTop` and `showScrollBottom`)
- `app/conversation/[id].tsx:408-416` (the Top button render)

**Related:** Bug 11 below — both bugs live in the same `handleScroll` and both render in the same `scrollBtn` style cluster. Land together.

---

## Bug 11 — Conversation: move "Bottom" button to bottom-right floating, show only when not at bottom

**Filed:** 2026-05-22.

**Symptom:** The "Bottom" button currently floats at the **center** of the screen near the bottom edge (`scrollBtnBottom: { bottom: spacing.md }` + `alignSelf: 'center'` at `app/conversation/[id].tsx:500-509`). Center placement collides visually with the read flow — the user's eye is in the middle of the screen reading text, and the button sits there too. Standard mobile chat-UI convention is a **bottom-right** floating action button (FAB-style), out of the reading column.

**Current behavior:**
- Position: centered horizontally, `bottom: spacing.md` from the bottom edge.
- Visibility logic (`:208-209`): `distFromBottom > 100` → show. This is already "only when not at bottom" — that half is correct. The fix is purely visual placement.

**Desired behavior:**
- **Position:** float in the **bottom-right corner**, ~16 pt inset from the right edge, above the bottom action bar (Resume / Export — see also [Bug 6](#bug-6--conversation-list-content-hidden-under-bottom-action-bar) for the bar's height).
- **Shape:** a circular icon button (down-caret) instead of the current pill-shaped "Bottom" text. Use Phosphor `CaretDown` or `ArrowDown` per the project icon rule. Same accent color, ~40 pt diameter, subtle shadow for elevation.
- **Visibility:** unchanged — show only when `distFromBottom > 100`. Already done in `handleScroll`.

**Side notes:**
- The Top button (Bug 10) should *probably* stay centered at the top, since it's a different affordance (less frequent, jump-to-top is a "I want to navigate" gesture vs. "I want to catch up to live"). Keep them asymmetric on purpose, or symmetrize both to top-right + bottom-right — pick when picking up.
- Watch out for safe-area-inset interaction on iPhones with home indicator. The bottom action bar already handles its own inset; the new floating button needs to clear the bar, not the screen edge.
- The threshold `distFromBottom > 100` is reasonable but worth testing on conversation page-loads: after `maintainVisibleContentPosition` settles the initial scroll, we don't want the button to flash visible-then-hidden during the first frame.

**Files involved:**
- `app/conversation/[id].tsx:417-424` (the Bottom button render — change icon, change press target, keep handler)
- `app/conversation/[id].tsx:500-510` (the `scrollBtn` + `scrollBtnBottom` styles — replace centered pill with right-anchored circular button)
- `app/conversation/[id].tsx:208-209` (visibility logic — no change needed)

**Related:** Bug 10 (same handler, same render cluster). [Bug 6](#bug-6--conversation-list-content-hidden-under-bottom-action-bar) (bottom action bar collision). Land all three on the same screen pass.

---

## Issue 1 — Post-intro: cached Hub list flashes, then re-paints with server data

**Filed:** 2026-05-22.

### Symptom

1. App finishes intro and lands on the Sessions/Hub tab. Screen shows only the projects that were already in local storage (e.g. `dotfiles 1` + `tb-mobile 3`, count badge `AK 4`).
2. A few seconds later the WebSocket + REST round-trip completes and the list re-paints with the full server-side dataset (adds `tb-mobile 166`, `tmp 1266`, `dev 3`, `T 65`, `tb-streamer 60`, `.remember 1` … count badge `AK 2703`).

The flash is jarring because the layout reflows mid-glance — the user starts reading the small list, then it suddenly grows to a long scrollable one.

### Why it happens

- `services/query-client.ts:92` persists the `projectChats` / `projectChats-all` / `session` query roots via `createAsyncStoragePersister`. On cold launch React Query hydrates from AsyncStorage first → list mounts with stale data → `isPending` is false → no loader is shown.
- When the live WebSocket / REST refresh resolves (a few seconds later — multi-server fan-out via `useQueries`), the query cache patches, the list reconciles, and the user sees the layout grow.
- This is the same class of bug as Bug 1 (conversation flicker on open from cached data, ✅ shipped) — same mechanism, different surface.

### Proposed direction (decide on pickup, don't pre-commit)

Three options, ranked by how much they hide vs. how complex they are:

1. **Min-display skeleton over the Hub list on cold launch.** Reuse the `useMinDisplayTime` hook shipped for Bug 1 (`hooks/useMinDisplayTime.ts`). Gate the Hub list behind `isGated = useMinDisplayTime(allServersFirstFetchSettled, 1200, sessionLaunchKey)`. Show `SessionsLoadingOverlay` (already exists, `components/sessions/SessionsLoadingOverlay.tsx`) until both gates lift. Simple, matches the conversation-loader pattern, hides the reflow.

2. **Stale-data dim + spinner badge.** Render cached data immediately but apply `opacity: 0.6` and show a small "syncing…" pill in the header until the first multi-server refresh resolves. The data is still visually present, the user just understands it's stale. Lower complexity, but the reflow is still visible — just easier to anticipate.

3. **Hold cached render only when "small cached vs. likely larger server result" is detectable.** E.g. compare cached project count to last-known server count (which we could persist alongside the data). If cached < last-known, gate. If cached == last-known, render immediately. More precise UX but introduces extra persisted state.

Recommendation: **(1)** — consistent with how Bug 1 was solved (commit 7e197ab, "hold conversation skeleton 1.2s to mask cache-hit flicker"). Avoid inventing a second pattern when the existing one fits.

### Verify before fixing

- Reproduce on cold launch by clearing app data (`xcrun simctl uninstall booted dev.threadbase.mobile` → reinstall) and timing the gap between intro fade-out and the server-data paint.
- Measure how long the first multi-server fan-out actually takes on the user's account (≈ "a few seconds" per the report). If it's regularly > 1.5 s, the 1.2 s min-display floor isn't enough on its own — we'd want the gate to hold *until* the multi-server fan-out resolves, with the 1.2 s only as a floor (Approach A from Bug 1).

### Files likely involved

- `app/index.tsx:1-60` (Hub mount + initial query firings)
- `hooks/useSession.ts` / `hooks/useConversations.ts` / `hooks/useQuickAccess.ts` — need a combined "all primary queries settled at least once this session" signal
- `components/sessions/SessionsLoadingOverlay.tsx` (already exists, can be reused)
- `hooks/useMinDisplayTime.ts` (already exists from Bug 1)
- `services/query-client.ts:92` — no change expected; persistence is correct, the symptom is purely visual

---

## Issue 2 — Hub accordion expand stalls on long projects (1,266 items → ~9 s)

**Filed:** 2026-05-22.

### Symptom

- Tap `tb-mobile / 166 convs`: chevron flips, then "a few seconds" of frozen UI before the accordion body paints with the conversation rows.
- Tap `tmp / 1266 convs`: chevron flips, then > 9 s of frozen UI before the body paints.

The collapse path stutters too (already noted in Bug 2 above), which rules out fetch as the culprit. **This is render cost, not network.**

### Why it happens (high confidence)

`components/sessions/hub/ProjectHubCard.tsx:121-178` builds the accordion body with **inline `.map` calls over the full list** every time `isOpen` toggles:

```tsx
{mergeChats ? (
  <View style={styles.section}>
    {[
      ...group.sessions.map((s) => ({ key: ..., ms: ..., node: <SessionRow ... /> })),
      ...group.conversations.map((c) => ({ key: ..., ms: ..., node: <ConvRow ... /> })),
    ]
      .sort((a, b) => b.ms - a.ms)
      .map((item) => item.node)}
  </View>
) : (
  <>
    {/* split view caps conversations at 5 with a See all → already cheap */}
    {group.conversations.slice(0, 5).map(...)}
  </>
)}
```

When `mergeChats` is on (the default for the demo'd account), every `.conv` and `.session` is constructed as a React element on the JS thread, all 1,266 of them, before the outer Hub list can even flush a frame. There's no virtualization inside the accordion. The `LayoutAnimation.configureNext(...)` call in `handleToggle` then has to animate the whole height delta in one tick.

The split view (`mergeChats === false`) hides this because it caps at 5 + "See all" link. So this only burns on `mergeChats === true`.

### Mitigations to consider (pick after measuring)

In rough order of expected leverage:

1. **Virtualize the accordion body with `FlashList`.** Replace the inline `.map` with a nested `<FlashList>` constrained to a max height (e.g. `maxHeight: viewportHeight * 0.7`). FlashList is already a peer dep (`@shopify/flash-list`, used in `app/conversation/[id].tsx`, `app/browse.tsx`). This makes the open-cost O(visible) instead of O(total).
   - Caveat: nested FlashList inside the outer Hub list/SectionList needs its own scroll container; it shouldn't try to scroll the parent. Easiest: hard-cap the height and let the inner list scroll independently.

2. **Lazy-mount on first expand, unmount on collapse.** Currently the conditional `{isOpen && ...}` already does mount/unmount — verify this in a render-count log to be sure React isn't keeping a hidden copy alive via `LayoutAnimation`. If it is, move to a manual unmount-after-animate pattern.

3. **Pre-sort `group.sessions + group.conversations` once at hub-load time** (in `useProjectGroups.ts` or `hubUtils.ts`), keyed by `mergeChats`. Avoids reconstructing the sorted array on every toggle. Modest gain; combine with (1).

4. **Cap rendered rows + "See all"** even in the merged view. Match the split-view pattern (5 rows + `t('hub.seeAll', { count: convCount })` → `/project/:id`). The destination project screen presumably already handles long lists (`app/project/...`). Cheapest path; sacrifices the "all in one accordion" UX choice that made merge-mode different.

5. **Defer expensive children (`<ConvRow>`, `<SessionRow>`) to `InteractionManager.runAfterInteractions`** so the accordion paints empty first, then fills. Last resort; perceived perf only.

### Verify before optimizing

- Add a `console.time('hub-expand:tmp')` around the `onToggle` → first `useLayoutEffect` of `ConvRow` mount. Confirm the >9 s is render, not unrelated.
- Profile in Hermes / Flipper React DevTools — look for the JS thread frame spike when expanding.
- Decide between (1) and (4): the choice depends on whether keeping the "everything inline under the accordion" UX matters. If product is fine with "tap to drill into project view for long projects", (4) is two lines of code. If the accordion must show everything, do (1).

### Scope-creep audit: other places in the app that render potentially long lists

Quick scan of `FlatList` / `FlashList` / `SectionList` / inline `.map` over server data, framed against the README feature list:

| Surface | File | Already virtualized? | Risk |
|---|---|---|---|
| Sessions Hub outer list | `components/sessions/hub/ProjectHubList.tsx:218,232` | ✅ SectionList + FlatList | low |
| **Hub accordion body (this issue)** | `components/sessions/hub/ProjectHubCard.tsx:121-178` | ❌ inline `.map` | **HIGH — primary culprit** |
| Tree view | `components/sessions/tree/TreeSessionsList.tsx:226,244`, `DrillView.tsx:51,69` | ✅ SectionList + FlatList | low |
| Classic sessions | `components/sessions/classic/ClassicSessionsList.tsx:75` | ✅ FlatList | low |
| Conversation thread (messages) | `app/conversation/[id].tsx:385` | ✅ FlashList | low (recent Bug 4 fixes) |
| History tab | `components/conversation/ConversationList.tsx:206` | ✅ FlatList | low — confirm with paginated query, infinite scroll already on |
| Browse (file picker) | `app/browse.tsx:332` | ✅ FlashList | low |
| Terminal output | `components/terminal/TerminalOutput.tsx:125` | ✅ FlatList | low |
| Slash command palette | `components/shared/SlashCommandBoard.tsx:66` | ✅ FlatList | low (bounded short list) |
| Manage favorites | `app/manage-favorites.tsx:29` | ✅ FlatList | low (bounded by user) |
| Quick Access strip | `components/quick-access/QuickAccessStrip.tsx:264` | ❌ inline `.map` | low — bounded by tab limit (favorites/recents/popular usually ≤ 20), monitor only |
| Prompt queue | `components/queue/*` | check on pickup | unknown — queue is usually short but verify |

**Conclusion:** the Hub accordion body is the only confirmed high-risk site. Quick Access uses `.map` but is bounded by UX (a horizontal strip with tab caps). The rest already use virtualized primitives. We should fix Hub first, profile after, and only widen scope if measurement reveals another stall.

### Files likely involved (Issue 2 fix)

- `components/sessions/hub/ProjectHubCard.tsx` — replace inline body `.map`s with virtualized list
- `components/sessions/hub/hubUtils.ts` and/or `components/sessions/hub/useProjectGroups.ts` — pre-merge + pre-sort if going with mitigation (3)
- `components/sessions/hub/ConvRow.tsx`, `SessionRow.tsx` — confirm they're cheap to mount; memoize if not
- `stores/settings.ts` — `mergeChats` setting, no change expected

### Cross-cutting notes

- Issue 1 and Issue 2 compound: on cold launch with `tmp` open by default (if "remember open accordions" is ever added), the user would see the cached-flash AND a 9 s expand stall back-to-back. Fix Issue 1 first if we want to address scope-creep risk for Issue 2 verification (the cached flash currently masks how slow the cold-launch render path *actually* is).
- Reuse `useMinDisplayTime` / `SessionsLoadingOverlay` — don't invent new patterns.
- Do **not** preemptively wrap every `.map` in a FlashList. Only the Hub accordion has measured stalls; the table above is for documentation, not a TODO list.

---

## Bug 13 — New session: name modal flashes open then auto-closes before user can type

**Filed:** 2026-05-23 — not diagnosed.

**Symptom:** From the browse screen, pick a path and tap **Start session**. The "Name this session?" modal (`NameSessionModal`, `mode="create"`) opens for a fraction of a second and then closes on its own. The user is navigated straight to `/session/[id]` without any chance to type a name or tap Skip / Start / Don't ask again.

**Expected:** Modal stays open until the user taps Save (with a non-empty name), taps Skip, or taps Don't ask me again. Only then does navigation to the session screen happen.

**Where to start looking:**

- `app/browse.tsx:177-201` — `handleStartSession` calls `startSession.mutate(...)`. On success it gates on the `askOnCreate` setting: when **true** it calls `setPendingSession({...})` (which renders the modal); when **false** it goes straight to `router.dismiss()` + `router.push(/session/...)`.
- `app/browse.tsx:389-409` — the modal is rendered as `{pendingSession ? <NameSessionModal ... /> : null}`. Both `onSave` and `onSkip` already call `router.dismiss()` + `router.push(...)` themselves, which is the *intended* close path.
- `components/sessions/NameSessionModal.tsx` — confirmed inert on mount: the `useEffect` at `:27-32` only resets local state when `visible` becomes true; it does **not** auto-fire `onSave` / `onSkip`.
- `stores/settings.ts` — `askOnCreate` flag. Default is true (verify); the "Don't ask me again" checkbox flips it off via `setAskOnCreate(false)` at `app/browse.tsx:406-409`.

**Top suspects (in order):**

1. **`askOnCreate` is stuck `false`.** If the user (or a previous bug) ever toggled "Don't ask me again", the modal branch is skipped entirely — `handleStartSession` falls through to the immediate `router.push` path. The "flash" the user perceives might actually be a transient render (e.g. a brief mount during the cleanup of `pendingSession === null` → `pendingSession === {...}` → `null` again, or the modal appearing on the *previous* session creation). Verify by:
   - `console.log(askOnCreate)` inside `handleStartSession`.
   - Inspect `stores/settings.ts` persisted state on the device (or clear app data and repro).
   - If this is the cause, the bug is mis-categorized: it's "Don't ask me again is sticky and there's no UI to re-enable it" → fix by exposing a toggle in Settings (likely already exists — verify).

2. **`router.dismiss()` is fired by the parent route while the modal is mounted as a child of `browse.tsx`.** The modal is rendered *inside* the browse screen tree, not at the root. If something — e.g. the underlying `startSession.mutate` success handler, a focus listener, a parent layout effect — dismisses the browse route after `setPendingSession` runs, the modal unmounts before the user can interact. Verify by:
   - Add `console.log('browse: unmount')` to a `useEffect` cleanup in `browse.tsx`.
   - Add `console.log('modal: render', { visible, pendingSession })` in the JSX.
   - Compare timestamps: does browse unmount within ~100 ms of the modal becoming visible?
   - Likely fix: hoist `NameSessionModal` rendering up to `_layout.tsx` (or a sibling route), so the modal survives `router.dismiss()` of the browse screen. Or delay `router.dismiss()` until *after* `onSave` / `onSkip` fire.

3. **`startSession.mutate` resolves twice** — first with a stale `onSuccess` (perhaps a retried mutation or a duplicate event from the WS layer), where the second invocation lands in the no-`askOnCreate` branch and pushes to `/session` while the modal from the first invocation is still mounting. Verify by counting `onSuccess` callbacks.

4. **Keyboard / focus race on autoFocus.** `NameSessionModal`'s `<TextInput autoFocus />` (`NameSessionModal.tsx:69`) requests the keyboard immediately. On some iOS versions, an autoFocus-triggered keyboard appearance can race with the parent `KeyboardAvoidingView` and produce a layout pass that looks like a "flash". Unlikely to be the close-itself cause, but worth a screen recording to confirm whether the modal *visually* closes vs. is occluded by a keyboard transition.

**Repro steps to capture on pickup:**

1. Fresh install or `xcrun simctl uninstall booted dev.threadbase.mobile` → reinstall.
2. Pair a server, complete onboarding.
3. From Hub: tap **+** / **New session** (whichever entry lands on `/browse`).
4. Drill into a directory.
5. Tap **Start session**.
6. Observe whether modal stays open. Record the screen if possible.
7. If modal does *not* stay open, check Settings → "Ask on create" (or equivalent) — is it on?

**Files likely involved:**

- `app/browse.tsx:177-201, 389-409`
- `components/sessions/NameSessionModal.tsx`
- `stores/settings.ts` (the `askOnCreate` flag + its persistence)
- `hooks/useStartSession.ts` (or wherever the `startSession` mutation lives — check what `onSuccess` semantics it has, including retries)
- `app/_layout.tsx` (if hoisting the modal up the tree becomes the fix)

**Related:** Same modal is reused on session exit (`app/session/[id].tsx:931`, `mode="exit"`). Worth checking whether the exit-modal variant has the same auto-close symptom — if yes, the root cause is in `NameSessionModal` itself (suspect 4); if no, it's specific to the browse → session creation handoff (suspects 1, 2, or 3). Also closely related to [Bug 14](#bug-14--after-starting-new-session-file-browser-stays-in-stack-and-re-shows-on-exit) — both bugs sit on the browse → session handoff and may share root cause.

---

## Bug 14 — After starting new session, file browser stays in stack and re-shows on exit

**Filed:** 2026-05-23 — not diagnosed.

**Symptom:** Start a new session from `/browse` (pick a path, tap **Start session**, get into `/session/[id]`). Later, when the user exits the session (back gesture / Resume Session back navigation / etc.), instead of landing on the Hub (`/`), they land back on the file browser modal — which by then is a stale view of a directory they've already moved past.

**Expected:** The browse modal should be fully dismissed at the moment session creation succeeds. Exiting the session should land the user on the Hub, never on the browser.

**Why it likely happens:** Browse is registered as a modal in the navigator (`app/_layout.tsx:186-193`, `presentation: 'modal'`). The four "session created → navigate" sites in `app/browse.tsx` all call:

```ts
router.dismiss()
router.push(`/session/${id}?...`)
```

…in that order (`browse.tsx:191-193, 217-219, 397-398, 403-404`). On Expo Router's stack, this sequence is fragile:

- `router.dismiss()` on a `presentation: 'modal'` route pops the modal off the stack, but the call is asynchronous (it queues a transition).
- `router.push(...)` fired in the same tick may end up pushed onto the stack *before* the dismiss settles, leaving the stack as `[Hub, Browse, Session]` or `[Hub, Session, Browse]` depending on order resolution. Either way, browse is still in the back stack.
- When the user later exits Session, the default back behavior pops the top of the stack → lands on Browse instead of Hub.

**Likely fixes to evaluate (pick after verifying the stack state):**

1. **Replace, don't dismiss-then-push.** Use `router.replace(...)` for the session destination instead of `dismiss()` + `push()`. `replace` swaps the top of the stack atomically, so the modal route is replaced by the session route in one operation.
   - Caveat: `replace` from a *modal* route may leave the modal-presentation wrapper around the session screen, which is wrong UX for a full-screen session. Verify on iOS — if it does, use approach (2).
2. **`router.dismissAll()` + `router.push()`** — fully clear the modal stack first, then navigate to the session. Safer than `dismiss()` if anything else can be sitting above browse.
3. **Await the dismiss before pushing.** Use `setTimeout(() => router.push(...), 0)` after `router.dismiss()` so the dismiss commits first. Hacky but cheapest if (1) and (2) don't behave correctly.
4. **Navigate, then dismiss.** Flip the order: `router.push('/session/...')` first, then `router.dismiss()` to remove browse from underneath. May produce a brief visual artifact (push transition over a still-present modal) but guarantees the back-stack is clean.

**Recommendation:** start with (1). It's the idiomatic Expo Router pattern for "this screen's job is done, swap me out." If iOS keeps the modal chrome around the session screen, fall back to (2).

**Verify before fixing:**

- Add a log in `app/_layout.tsx` (or a `useFocusEffect`/`usePathname` listener) that prints the current pathname on each navigation. Repro the bug and capture the exact sequence of pathnames the stack reports during create + exit.
- Inspect `router.canGoBack()` / `router.getState()` on the session screen right after mount — if `routes` contains `browse`, that confirms the stack is dirty.

**Files involved:**

- `app/browse.tsx:177-201, 203-229, 389-409` — the four "session created → navigate" sites that all share the same `dismiss()` + `push()` pattern. Fix in one place; refactor into a `navigateToNewSession(session)` helper to prevent drift.
- `app/_layout.tsx:186-193` — browse's modal registration; no change expected, but worth re-reading to be sure modal presentation isn't compounding the stack issue.

**Related:** [Bug 13](#bug-13--new-session-name-modal-flashes-open-then-auto-closes-before-user-can-type) sits on the same handoff. If Bug 13's root cause turns out to be suspect 2 ("parent route dismissed while modal is mounted"), Bug 14 and Bug 13 are the same underlying bug seen from two angles — fix one and verify the other.

---

## Bug 15 — After new-session back, file browser is interaction-locked (only close works)

**Filed:** 2026-05-24 — not diagnosed. **Re-repro 2026-05-25** added top-left chevron + recent-directories details.

**Symptom:** Start a new session from `/browse` (pick a path, tap **Start session**). The PTY opens at `/session/[id]`. Tap **back**. The browse modal re-appears (the same surface flagged in [Bug 14](#bug-14--after-starting-new-session-file-browser-stays-in-stack-and-re-shows-on-exit)), but in this stale state **almost nothing inside the modal responds to taps** — directory rows, the recent-directories list, "Start session", and the up-directory affordance are all dead. The **top-left back chevron** is *visually* active but only walks the directory tree inside the modal; it never dismisses the modal. The only control that actually exits the modal is the **drag-down-to-close** gesture on the modal title bar.

**Expected:** The browse modal should be fully dismissed at the moment **Start session** is tapped (i.e. as soon as session creation kicks off), not after the PTY mounts. The user should never land back on browse via the back gesture; back from the PTY should go to the Hub.

**Why it likely happens:** Same root cause family as Bug 14 — browse is presented as a modal (`app/_layout.tsx:186-193`, `presentation: 'modal'`) and the create-session flow calls `router.dismiss()` + `router.push('/session/...')` in the same tick. When the user backs out of the session, the still-on-stack browse re-presents; but its component state (mutation in flight / mounted-but-stale handlers / pending modal state from Bug 13) leaves it in a frozen mode where only the modal chrome's close gesture survives.

**Likely fix direction:** Dismiss the browse modal **immediately on Start-session tap** — before navigating to the session, before the mutation resolves. The current flow waits for `startSession.mutate(...).onSuccess` before dismissing (`app/browse.tsx:177-201, 203-229, 389-409`), which keeps browse mounted during the entire create+navigate window. Move the dismiss to fire *synchronously* with the tap, then navigate from a layout sibling once the mutation resolves (e.g. via a top-level pending-session signal, similar to how the name modal is hoisted in Bug 13's suspect 2).

**Files likely involved:**

- `app/browse.tsx:177-201, 203-229, 389-409` — Start-session handlers
- `app/_layout.tsx:186-193` — browse modal registration
- Whichever pending-session/launch-session state shape we land on for Bug 13's hoist

**Related:** [Bug 13](#bug-13--new-session-name-modal-flashes-open-then-auto-closes-before-user-can-type), [Bug 14](#bug-14--after-starting-new-session-file-browser-stays-in-stack-and-re-shows-on-exit), and [Bug 16](#bug-16--back-from-never-typed-in-new-session-leaves-an-empty-session-alive) all live on the same browse → start-session → PTY → back handoff. Likely one root cause behind multiple symptoms — investigate together.

---

## Bug 16 — Back from never-typed-in new session leaves an empty session alive

**Filed:** 2026-05-24 — not diagnosed.

**Symptom:** From `/browse`, pick a path and tap **Start session**. The PTY opens at `/session/[id]`. **Without typing anything**, tap **back**. The session is left running on the streamer — it now shows up in the Hub / Recents as a brand-new but empty session. The user clearly abandoned it (no prompt sent, no PTY input), so keeping it around is just noise.

**Expected:** If the user exits a freshly-created session before sending any input, the session should be killed (or never registered as a Hub-visible session in the first place). Hub / Recents should not show empty placeholder sessions the user immediately walked away from.

**Heuristic to use:** "User never used it" = the back exit fires before any of these happens:

- User types into the PTY composer (any non-empty input).
- User sends a prompt (`messageCount === 0` is the cleanest signal).
- User triggers any tool / action that mutates the session state.

If all of the above are still empty at exit time, the session is a discard.

**Likely fix direction (pick after diagnosis):**

1. **Lazy session creation.** Don't create the session on `/browse` **Start session** tap — just navigate to the PTY with the path + intent. Create the session on the first send (or first keystroke). Cleanest but bigger refactor; touches whatever lives in `hooks/useStartSession.ts` + the streamer-side session lifecycle.
2. **Eager create + on-exit cleanup.** Keep today's eager-create path, but on the session screen's unmount handler check `messageCount === 0 && composerEmpty`. If both, fire a delete-session call before unmounting. Smaller change, but introduces an async delete on a back gesture which can race — needs care to not leave orphans if the delete fails.
3. **Tombstone empties in the Hub list.** Render empties with `pending` styling and a `Resume / Discard` swipe. UX cop-out — the empties still pile up server-side, just hidden client-side. Not recommended unless (1) and (2) are blocked.

**Recommendation:** start with (1) if the streamer side supports "session = path + intent until first input", else (2) with a careful guard. Confirm with brainstorm before picking.

**Files likely involved:**

- `app/browse.tsx:177-201` — `handleStartSession` (the eager-create call site)
- `hooks/useStartSession.ts` (or wherever the session-create mutation lives)
- `app/session/[id].tsx` — the unmount / back handler that needs the "discard if empty" hook
- Streamer-side session lifecycle (delete-session endpoint + behavior on the local-streamer)

**Related:** [Bug 13](#bug-13--new-session-name-modal-flashes-open-then-auto-closes-before-user-can-type), [Bug 14](#bug-14--after-starting-new-session-file-browser-stays-in-stack-and-re-shows-on-exit), [Bug 15](#bug-15--after-new-session-back-file-browser-is-interaction-locked-only-close-works). All four sit on the same browse → start-session → PTY → back lifecycle. Worth a single brainstorm pass to design the whole flow rather than patching each symptom independently.

---

## Bug 17 — Chat output + on-reconnect: scroll-to-bottom is jumpy, not smooth

**Filed:** 2026-05-24 — not diagnosed.

**Symptom (two surfaces, likely shared root cause):**

1. **Streaming chat output.** While Claude is mid-turn and the assistant message is growing, the auto-scroll-to-bottom jerks — the list snaps in discrete jumps with each chunk of streamed tokens instead of riding the growing content smoothly. Particularly visible during fast streams or when the assistant emits multiple message parts in quick succession.
2. **Re-connecting to a session.** Opening (or re-opening) an existing session whose latest activity is below the fold causes the scroll to flash through intermediate positions before settling at the bottom — same jumpy quality, different trigger.

**Expected:** Both transitions should be visually smooth. The streaming case should feel like the list is *riding* the growing content (no perceptible step). The re-connect case should either land at the correct position on first paint (no animation), or animate once, decisively, to the destination.

**Suspected cause (to verify):**

- The chat list is a `FlashList` (`app/conversation/[id].tsx:385` per Bug 4 history). Bug 4 fixed the cold-open scroll-to-end jump with `maintainVisibleContentPosition` + a settle-detect + 400 ms delayed final animated scroll. That patch is good for the *initial* open but does not specifically address mid-stream auto-scroll while content height keeps changing.
- During streaming, `onContentSizeChange` fires for every chunk. If the auto-scroll handler re-invokes `scrollToEnd({ animated: true })` per chunk, the animations stack and look jumpy. The fix is usually either: (a) animate only on idle-edge with a debounced settle, (b) use `scrollToEnd({ animated: false })` while a turn is streaming and animate only at the boundary, or (c) lock the list to "bottom" via `maintainVisibleContentPosition` so the scroll position is anchored and natively follows the growing content (no JS-side scroll calls at all during stream).
- For the re-connect case, suspect a similar stacking: hydrate from React Query cache → first paint scrolls to a remembered position → server-side refresh resolves with more messages → another scroll → final settle. Each step is "correct" individually but they're not coalesced.

**Diagnosis order when picked up:**

1. Add `console.log` (or a `useRef` counter) on every `scrollToIndex` / `scrollToOffset` / `scrollToEnd` invocation in `app/conversation/[id].tsx`. Reproduce both symptoms and count how many fire per visible jump. Confirms or denies the stacking hypothesis.
2. Inspect the auto-scroll handler tied to `onContentSizeChange` (or whichever effect drives "stick to bottom"). Is it gating on "already at / near the bottom" before firing? If not, scroll calls fire even when the user scrolled up to read history.
3. Try `maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 100 }}` (or the FlashList equivalent) and see if the list auto-rides the growing content without explicit `scrollToEnd` calls during the stream.
4. For re-connect: log the sequence of cache-hydrate / server-data paints and see which one wins the final scroll. Consider gating the scroll on a single "first settle" rather than each layout pass.

**Likely fixes to evaluate (pick after diagnosis):**

1. **Anchor-to-bottom via `maintainVisibleContentPosition`.** Let RN/FlashList keep the bottom edge stable as content grows. Remove all per-chunk scroll calls during a turn. Most likely fix.
2. **Debounced animated scroll.** Coalesce `onContentSizeChange` into one `scrollToEnd({ animated: true })` per ~150 ms window, with `animated: false` between debounce windows. Cheaper but still feels like JS-driven scroll.
3. **Animate only at turn-end.** During stream, no animation (instant snap). When `isThinking` flips false, fire one animated final scroll. Visual quality depends on how often the user is already at-bottom vs. caught-up.
4. **For re-connect specifically:** delay the first auto-scroll until the second-paint settles (cache + first server refresh both resolved), then animate once.

**Recommendation:** (1) is the textbook RN/FlashList answer for "list anchored to bottom that grows". Start there; fall back to (3) if MVCP misbehaves with the existing turn-divider injection / message-edit edge cases.

**Side notes:**

- This bug touches the same `handleScroll` / scroll-button cluster as [Bug 10](#bug-10--conversation-show-top-button-only-when-scrolling-up) and [Bug 11](#bug-11--conversation-move-bottom-button-to-bottom-right-floating-show-only-when-not-at-bottom). Land Bug 17 *before* Bug 10/11 if possible — the smooth-scroll fix may change the at-bottom detection logic those bugs rely on.
- Related to [Bug 4 (✅ shipped)](#bug-4--long-conversation-scroll-to-end-flickery--jumpy): Bug 4 fixed cold-open landing; Bug 17 is the streaming + re-connect variant of the same scroll-coalescing problem. Reuse the same MVCP + settle-detect primitives if possible.

**Files likely involved:**

- `app/conversation/[id].tsx` — the chat FlashList, `handleScroll`, auto-scroll-to-bottom effects, turn-divider injection, `maintainVisibleContentPosition` settings
- `hooks/useSession.ts` or whichever hook owns `isThinking` / streaming state (for the "animate only on turn-end" variant)
- `services/query-client.ts:92` — persisted conversation root (re-connect path hydrates from here first)

---

## Bug 18 — Maestro flow `server_drag_reorder.yaml.skip` crashes the app at the `swipe` step

**Filed:** 2026-05-24. **Status:** flow skipped in `test:e2e:mock` (renamed to `.yaml.skip`) so CI can stay green. Re-include by renaming back to `.yaml` once fixed.

**Symptom:** The flow runs `setup.yaml`, taps the filter-sort button, then the conditional `runFlow` enters the multi-server branch even on a single-server fixture. The first `swipe` against `id: "drag-handle-srv_a"` causes the app to crash within ~4 s. Maestro log: *"App crashed or stopped while executing flow, please check diagnostic logs: ~/Library/Logs/DiagnosticReports directory"*.

**Root-cause hypothesis (unverified):**

1. **Most likely — branch-guard misfires.** The `when: visible: { id: "server-order-toggle" }` gate is supposed to skip the multi-server commands when only one server is paired (the default after `setup.yaml`). Maestro 2.x may evaluate `visible` more leniently than expected (or the toggle has different `testID` resolution on single-server now), so the `runFlow` enters the branch and tries to drag a `drag-handle-srv_a` row that doesn't exist. The crash is whatever React Native does when a missing-element `swipe` runs on `DraggableFlatList`.
2. **Less likely — `swipe` API misuse.** The flow uses Maestro 2.x's `swipe: { direction: DOWN, from: { id: ... } }` form (replacing the deprecated `dragAndDrop: { from, to }`). The 2.0.10 docs say this works, but it's possible the from-element resolution is brittle on RN.

**Steps to fix:**

1. Add a `MOCK_SERVERS=srv_a,srv_b` env var to `e2e/mock-server.js` and seed `setup.yaml` to pair both, so the multi-server branch has the rows it expects.
2. Add explicit `assertVisible: { id: "drag-handle-srv_a" }` *before* the `swipe`, so the flow fails the assertion (clean Maestro failure) instead of crashing the app (opaque "app stopped" error).
3. Verify Maestro 2.0.10's `swipe` syntax against [the official 2.x reference](https://maestro.mobile.dev/api-reference/commands/swipe) — confirm `from: { id }` is the right invocation.
4. If single-server should still be tested, fall through to the `notVisible` branch and assert the toggle is hidden (already in the flow).

**Re-enable:** `git mv e2e/server_drag_reorder.yaml.skip e2e/server_drag_reorder.yaml` and add the file back to the `maestro test` arglist in `package.json` → `test:e2e:mock`.

**Files likely involved:**

- `e2e/server_drag_reorder.yaml.skip` — the flow
- `e2e/setup.yaml` — server-pairing seed
- `e2e/mock-server.js` — multi-server fixture support
- `components/servers/DisplayedServersList.tsx` — drag-handle testID emission

---

## Bug 19 — Maestro flow `tree_server_headers.yaml.skip` can't return to hub after pairing second server

**Filed:** 2026-05-24. **Status:** flow skipped in `test:e2e:mock` (renamed to `.yaml.skip`). Re-include by renaming back to `.yaml` once fixed.

**Symptom:** The flow's single-server assertions pass (`tree-headers-01-single-server.png` is captured cleanly). It then deeplinks to `threadbase://onboarding?mode=add` to pair a second mock server on `:7072`. After filling the URL + key and tapping "Connect", the assertion `extendedWaitUntil: visible: { id: "hub-screen" }, timeout: 8000` fails with *"Assertion is false: id: hub-screen is visible"* after the full 8s timeout (run took 45s total because of upstream retries). The multi-server screenshot (`tree-headers-02-multi-server.png`) never gets taken.

**Root-cause hypothesis (unverified):**

1. **Most likely — second-server pairing never completes.** The mock on `:7072` may not respond to whatever the add-server flow needs (e.g. `/api/profiles` for the pair handshake, or the `POST /api/pair` endpoint). The "Connect" button stays in its busy state and the screen never routes back to the hub. Verify by tailing the `:7072` access log during the run.
2. **Less likely — onboarding deeplink param drops back to single-server.** `threadbase://onboarding?mode=add` opens the add-server screen, but on iOS the deeplink confirmation dialog ("Open in Threadbase?") may dismiss before the `mode=add` param is read, so the user lands on the full onboarding carousel instead. Compare deeplink-handler logic in `app/_layout.tsx` against what the YAML expects.

**Steps to fix:**

1. Tail mock server stdout while running the flow manually — confirm `:7072` actually receives the pair requests, and that they return whatever the app's pair-exchange logic expects (URL validation, profile shape, etc.).
2. If `:7072` is responding 200s correctly, instrument the app's pair-success handler to verify it's calling `router.replace('/')` or equivalent after the second server is added.
3. If the deeplink param is being dropped, add a one-time `assertVisible: { id: "onboarding-add-server-screen" }` (or whatever the testID is for the add-server-only carousel slide) immediately after the deeplink to confirm the flow is on the right screen.
4. Increase `extendedWaitUntil` timeout to 15s as a last resort — the pair handshake involves multiple round trips and 8s may be too tight under macOS sim load.

**Re-enable:** `git mv e2e/tree_server_headers.yaml.skip e2e/tree_server_headers.yaml` and add the file back to the `maestro test` arglist in `package.json` → `test:e2e:mock`.

**Files likely involved:**

- `e2e/tree_server_headers.yaml.skip` — the flow
- `e2e/mock-server.js` — the `:7072` second-server bind + `/api/profiles` + pair endpoints
- `services/pair-exchange.ts` — second-server pair-success handler
- `app/_layout.tsx` — deeplink routing for `threadbase://onboarding?mode=add`

---

## Cleanup TODO

Loose ends from the 2026-05-24 / 2026-05-25 worktree + branch cleanup session. Not bugs — just leftover state to resolve when convenient.

### Locked agent worktrees in `.claude/worktrees/`

- `.claude/worktrees/agent-a084388f0807eeb1f` (branch `worktree-agent-a084388f0807eeb1f`)
- `.claude/worktrees/agent-ab537bd9ae7054ebf` (branch `worktree-agent-ab537bd9ae7054ebf`)

Both branches point at `3acbd6c` (already on main). The worktrees are git-locked with reason `claude agent agent-<id> (pid 7526)`. That pid was alive at cleanup time (a separate `claude --dangerously-skip-permissions --chrome` session on `ttys025`).

**Fix:** once that session is closed, run

```sh
git worktree remove -f -f .claude/worktrees/agent-a084388f0807eeb1f
git worktree remove -f -f .claude/worktrees/agent-ab537bd9ae7054ebf
git branch -D worktree-agent-a084388f0807eeb1f worktree-agent-ab537bd9ae7054ebf
```

Don't force-remove while pid 7526 is still alive — the other session may try to write there.

### Uncommitted e2e + research changes on `main`

Working-tree changes from prior agent sessions, left untouched during the cleanup:

- `e2e/pagination-classic.yaml` (modified) — replaces unreliable `- back` swipe-from-edge with `- tapOn: "Back"` chevron + bumps hub-screen timeout 5 s → 10 s. Looks correct; needs a smoke run before committing.
- `e2e/pagination-hub.yaml` (modified) — same `back` → `tapOn: "Back"` + timeout bump fix. Ship alongside `pagination-classic.yaml`.
- `e2e/diagnose-local-sessions.yaml` (new, untracked) — diagnostic Maestro flow that pairs against the local streamer instead of the mock; written to investigate the "sessions are not displayed at all" report from 2026-05-24. The session-rendering issue is resolved, so decide whether to keep this as a permanent diagnostic flow or delete.
- `docs/research/2026-05-24-threadbase-competitive-landscape.md` (new, untracked) — competitive-landscape research doc. Independent of the e2e changes; review and commit to `docs/research/` if it stays relevant.

**Suggested split:** one commit for the two e2e fixes (they share a fix + rationale), one commit for the research doc, one decision on the diagnostic flow.

### TestFlight build with the conversation-load fix

Commit `36c504d` (`fix(conversation): drop redundant skeleton timers, shorten layout quiet window`) is on `main` and pushed, but the latest TestFlight build (103, `d45e1a0` `chore(ios): bump build number to 103`) was cut **before** the fix. The user reported the bug from build 103; a new TestFlight build is needed to verify the fix on-device. Bump build number + run the EAS submit flow when ready.

---

## Bug 20 — New session from tree-view (with path completion) errors on "Path"

**Filed:** 2026-05-25. **Status:** Open — not diagnosed.

**Symptom:** From the Hub tree view, starting a new session with the path-completion field populated returns an error referencing the path. Repro path: Hub → drill into a project node → "New session here" (or equivalent) → submit → error.

**Hypotheses (unverified):**

1. **Most likely — path normalization mismatch.** The tree-view passes a path with a trailing slash, escaped characters, or `~`-expansion the streamer's `start-session` endpoint doesn't accept. Compare against the working path format the Hub root + Recents use.
2. **Less likely — projectId vs. projectPath confusion.** Post the [[project-projectchat-migration]] work, the tree-view may still emit `projectPath` where the new contract expects `projectId`, and the server rejects it with a path-shaped error.

**Steps to investigate:**

1. Reproduce on iPhone 17 sim with the local mock; capture the exact error string and the request body sent by the app.
2. Diff the request body against the body sent by the working "New session" path from the project header.
3. Patch whichever end (mobile encode or streamer accept) is wrong.

**Files likely involved:**

- `components/sessions/hub/ProjectHubTree*.tsx` (or wherever the tree's "new session here" handler lives)
- `services/sessions.ts` (or the start-session client call site)
- `app/(modals)/new-session.tsx`

---

## Bug 21 — "Open Session" from Recents lands on "Session not found"

**Filed:** 2026-05-25. **Status:** Open — not diagnosed.

**Symptom:** Tapping "Open Session" from a Recents row routes to the session detail screen, which immediately shows "Session not found".

**Hypotheses (unverified):**

1. **Most likely — stale Recents row points to a session the server no longer has.** Recents is locally cached; if the streamer-side session was pruned, the row remains and produces a 404 on lookup. Need to filter Recents against `/sessions` on hub load, or evict on 404.
2. **Less likely — id format mismatch.** Recents writes a different id shape than `/sessions/:id` accepts (e.g. `projectPath:sessionId` vs. just `sessionId`).

**Steps to investigate:**

1. Capture which `id` is sent in the navigation params vs. what `/sessions/:id` returns.
2. If it's the stale-row case: filter Recents on hub load by intersecting with the live `/sessions` list, and evict on the first 404 hit.
3. If it's the format mismatch case: align the Recents writer with the session lookup contract.

**Files likely involved:**

- `hooks/useRecents.ts` (or wherever the Recents store lives)
- `app/conversation/[id].tsx` (the "Session not found" branch)
- Mock-server `/sessions/:id` handler in `e2e/mock-server.js` may also need updating to repro

---

## Bug 22 — Settings QR-scanner button is a no-op on the UI layer

**Filed:** 2026-05-25. **Status:** Open — not diagnosed.

**Symptom:** Tapping the QR scanner button on the Settings screen produces no UI reaction at all (no navigation, no permission prompt, no log).

**Hypothesis:** The button's `onPress` is unwired (renamed component, dropped handler during a refactor) or the handler navigates to a route that doesn't exist anymore. Easy to confirm by grepping for the button's testID.

**Steps to fix:**

1. Locate the button in `app/(tabs)/settings.tsx` (or the settings screen file); confirm `onPress`.
2. If unwired, route to the same QR-scan screen onboarding uses.
3. If routed but broken, check the destination route exists.
4. Add a Maestro testID + a `settings_qr_scanner.yaml` flow asserting the scanner screen mounts.

**Files likely involved:**

- `app/(tabs)/settings.tsx`
- `components/onboarding/QrScanScreen.tsx` (or the equivalent reused for the settings entry point)

---

## Bug 23 — Popular → "New Session here" errors "Unable to load directories"

**Filed:** 2026-05-25. **Status:** Open — not diagnosed.

**Symptom:** From the Popular Quick Access tab, tapping "New Session here" on a project shows: *"Unable to Load directories. Check that the server is running and reachable"* — even when the server is reachable (other tabs work).

**Hypotheses (unverified):**

1. **Most likely — Popular passes a project shape that lacks the server context the directory-list call needs.** Popular's payload may carry a denormalized project identifier without the `serverId`/`serverUrl` that the file-browser fetch requires; the call then hits an undefined endpoint and the error message is the generic "server unreachable" fallback.
2. **Less likely — directory-list endpoint genuinely missing from the mock/server for the Popular path.**

**Steps to investigate:**

1. Repro and capture the actual network request the file browser fires from the Popular entry point.
2. Compare against the request from the Recents and Hub entry points (which work).
3. Patch the Popular handler to pass the same fields, or normalize at the store level so all three entry points produce identical requests.
4. While in there: replace the misleading "server unreachable" message with the actual failure reason (see Bug 24 for the visual side).

**Files likely involved:**

- `components/sessions/quickAccess/PopularTab.tsx` (or the Popular row's "new session here" handler)
- `services/files.ts` / `hooks/useDirectoryList.ts` (or wherever the directory fetch lives)

---

## Bug 24 — Popular error text is black-on-black (almost invisible)

**Filed:** 2026-05-25. **Status:** Open — visual; **consult [/impeccable](../README.md) skill** for the error-state design.

**Symptom:** The error surfaced by [Bug 23](#bug-23--popular--new-session-here-errors-unable-to-load-directories) (and likely other Popular-tab errors) renders in black text on the Popular tab's black background — visible only on close inspection. UX-wise the error effectively doesn't exist.

**Direction:**

- Apply the project's standard error-state pattern (icon + colored text + actionable message). The `/impeccable` skill should drive the actual visual — don't ship something ad-hoc.
- Should match how errors surface in Recents and Favorites (look for an existing `ErrorState` / `EmptyState` component before adding a new one).
- Pair with Bug 23: while fixing the root cause of the error, also fix how the error displays.

**Files likely involved:**

- `components/sessions/quickAccess/PopularTab.tsx`
- Any shared `ErrorState` component under `components/common/` — reuse if it exists

---

## Bug 25 — ➜ Moved to ROADMAP

**Moved:** 2026-05-25 — reclassified as a feature (pure additive UI, no broken behavior). See [Feature 22 — Settings button on the Filter & Sort bar](./ROADMAP.md#feature-22--settings-button-on-the-filter--sort-bar-parity-with-sidebar).

---

## Bug 26 — Hide Quick Access Edit pencil when the active tab is empty

**Filed:** 2026-05-25. **Status:** Open. **Related:** [Bug 7](#bug-7--quick-access-strip-default-collapsed--tab-reorder--hide-when-fully-empty), [Bug 9](#bug-9--quick-access-hide-edit-pencil-when-strip-is-collapsed).

**Symptom:** The Quick Access strip's "Edit" pencil icon is shown even when the currently-selected tab (Recents / Popular / Favorites) has no items. Editing an empty set is meaningless and clutters the UI.

**Direction:**

- Hide the pencil when the active tab's item list is empty. Restore it as soon as the tab has at least one item, or when switching to a non-empty tab.
- Bundle with Bug 9's "hide when strip is collapsed" rule — same file, same conditional.

**Files likely involved:**

- `components/sessions/quickAccess/QuickAccessStrip.tsx` (the pencil's render condition)

---

## Bug 27 — ➜ Moved to ROADMAP

**Moved:** 2026-05-25 — reclassified as a feature (net-new onboarding step, not a fix). See [Feature 23 — Onboarding: optional server-name slide before the QR scan](./ROADMAP.md#feature-23--onboarding-optional-server-name-slide-before-the-qr-scan).

---

## Bug 28 — Pull-to-refresh modal: show IP+port when server has no name

**Filed:** 2026-05-25. **Status:** Open. **Related:** [Feature 23 — onboarding server-name slide](./ROADMAP.md#feature-23--onboarding-optional-server-name-slide-before-the-qr-scan).

**Symptom:** The drag-to-refresh progress modal labels the server by name. For servers without a name (paired before the [Feature 23](./ROADMAP.md#feature-23--onboarding-optional-server-name-slide-before-the-qr-scan) prompt existed, or "Skip" was tapped, or named via a path that didn't capture a label), the label is blank or "Unknown" — unhelpful when reconciling which server is refreshing.

**Direction:**

- If `server.name` is present, render as today.
- If empty, render `host:port` (e.g. `192.168.1.42:7071`) as the fallback label.
- Same fallback should apply anywhere else a server is referenced by name in the UI — audit for consistency.

**Files likely involved:**

- `components/sessions/hub/PullToRefreshModal.tsx` (or the actual file name for the progress modal)
- Possibly a shared `serverDisplayName(server)` helper to centralize the fallback

---

## Bug 29 — Quick Access: open only on tab click; remove the right-side chevron

**Filed:** 2026-05-25. **Status:** Open. **Related:** [Bug 7](#bug-7--quick-access-strip-default-collapsed--tab-reorder--hide-when-fully-empty).

**Symptom (UX):** Two ways to expand the Quick Access strip exist today — tapping a tab and tapping the chevron on the right. The chevron is redundant and clutters the strip; users discover the tap-the-tab interaction immediately.

**Direction:**

- Remove the chevron icon and its tap target.
- Wire the strip's expand/collapse purely to tab taps. Tapping the already-active tab while expanded collapses; tapping a different tab while expanded switches.
- Verify against [Bug 7](#bug-7--quick-access-strip-default-collapsed--tab-reorder--hide-when-fully-empty)'s default-collapsed behavior — these interact.

**Files likely involved:**

- `components/sessions/quickAccess/QuickAccessStrip.tsx`
- `components/sessions/quickAccess/QuickAccessTabs.tsx` (or wherever the tab onPress lives)

---

## Bug 30 — Add-to-favorites is non-functional — needs spec from Claude Code

**Filed:** 2026-05-25. **Status:** Open — **needs spec before implementation**.

**Symptom:** Tapping "Add to favorites" on a project / session row appears to do nothing (item never shows up in the Favorites tab). The feature exists in the UI but isn't wired through.

**Why this is filed as "needs spec":** before implementing, Claude Code should produce a spec under `docs/superpowers/specs/YYYY-MM-DD-favorites-design.md` covering:

- **Scope of "favorite":** is the favorite a project, a session, or both? Affects the schema.
- **Storage:** local (Zustand + SecureStore + SQLite, matching session naming) or server-side via streamer? Local is simpler but loses cross-device parity (which arrives with [Feature 11](./ROADMAP.md#feature-11--workspace-sync-across-devices-via-streamer)).
- **Display contract:** what does the Favorites tab in Quick Access render — same row shape as Recents, or a dedicated card?
- **Add/remove affordance:** star toggle on the row, long-press menu, or both?
- **Empty state:** consistent with Bug 26 (no pencil) and the existing Quick Access empty patterns.
- **Sync interaction:** does favoriting at the project level imply all that project's sessions, or only the row tapped?

Once the spec is approved, the implementation is bounded: store + read API + write API + the Quick Access tab's new data source + add/remove affordance on the row.

**Files likely involved (post-spec):**

- New `hooks/useFavorites.ts` + Zustand slice + persistence
- `components/sessions/quickAccess/FavoritesTab.tsx` (already exists as a UI shell; needs data wiring)
- Whatever row component owns the "Add to favorites" tap

---

## Sequencing

Suggested next-up order (revise as profiling results come in):

1. **Bug 7** (Quick Access UX trio) — small, contained; ships a few hours of fixes that visibly improve cold launch.
2. **Bug 9** (hide pencil when collapsed) — pair with Bug 7 in the same PR, same file.
3. **Bug 8** (Manage Favorites duplicate top bar — now header-only after 8b was promoted to [Feature 24](./ROADMAP.md#feature-24--manage-favorites-add-to-favorites-empty-state-cta)) — tiny `Stack.Screen` config fix; pair with anything that touches `app/_layout.tsx`.
4. **Bug 10 + Bug 11** (conversation Top/Bottom buttons) — both live in the same `handleScroll` callback at `app/conversation/[id].tsx:202-209`. Land together. Consider folding [Bug 6](#bug-6--conversation-list-content-hidden-under-bottom-action-bar) (bottom-bar overlap) into the same screen pass since all three touch the same view.
5. **Issue 1** (cold-launch cached flash) — reuses the existing `useMinDisplayTime` helper; small.
6. **Issue 2** (Hub accordion stall) — needs profiling first; biggest perceived-perf win.
7. **Bug 6** (bottom-bar overlap) — small layout fix; can be paired with Bug 10 + Bug 11 + Feature 2 (Export relocation) since all four touch the conversation screen.
8. **Bug 5** (multi-attachment no output) — diagnose first; may collapse into Feature 3 (multi-file attachments).

**Bugs 20–30 (filed 2026-05-25), grouped by area for batching:**

- **Quick Access trio (Bug 26, 29):** same file as Bug 7 + Bug 9 + Bug 30's Favorites wiring — land them together to avoid touching `QuickAccessStrip.tsx` four separate times.
- **Onboarding name + display ([Feature 23](./ROADMAP.md#feature-23--onboarding-optional-server-name-slide-before-the-qr-scan) + Bug 28):** ship as a pair — Bug 28's IP+port fallback is only well-tested once Feature 23 makes naming optional.
- **Settings entry points (Bug 22 + [Feature 22](./ROADMAP.md#feature-22--settings-button-on-the-filter--sort-bar-parity-with-sidebar)):** Bug 22 (QR no-op) is a regression fix, do first; Feature 22 (Settings button on Filter & Sort bar) is a small additive UI change, easy follow-up.
- **Popular tab (Bug 23 + Bug 24):** ship together — fixing the root cause (23) and the way the error displays (24) belong in one PR; consult `/impeccable` for 24's visual.
- **Session/tree errors (Bug 20, 21):** investigate in parallel — both touch session-id / path encoding across the app↔streamer boundary and may share a root cause.
- **Bug 30 (Favorites)** is **spec-gated** — do not start implementation until the design doc lands under `docs/superpowers/specs/`.

---

## Shipped

Kept here for traceability — once a bug is fixed, its full entry stays so future debugging has the context.

### Bug 1 — Conversation open: add loader (min 1.2s) to prevent flicker ✅ DONE 2026-05-21 (commit 7e197ab)

**Symptom:** Tapping a conversation transitioned instantly when cached, then re-rendered once data resolved — perceived as a flicker.

**Root cause:** Conversations are persisted via React Query's AsyncStorage persister (`PERSISTED_QUERY_ROOTS` includes `conversation`), so on return visits `isPending` is false on mount, the FlatList mounts with messages, then `onContentSizeChange` fires → triggers `scrollToBottom(false)` → visible jump.

**Fix shipped:**
- New `hooks/useMinDisplayTime.ts` — pure hook, takes `(isReady, minMs=1200, resetKey?)`, returns `isGated`. 7 tests.
- `app/conversation/[id].tsx` renders `MessageSkeletonRow` overlay during gate; real list mounts underneath so layout fires off-screen and masks the scroll-to-bottom jump.
- Approach A — single combined `isGated` boolean.
- Errors bypass the floor — error view shows immediately.
- Also fixed a pre-existing `SkeletonBox` NativeWind className bug; inline `backgroundColor` now used.

### Bug 3 — Quick Access strip never loads items ✅ DONE 2026-05-16 (commit eea502d)

**Root cause:** Strip queried only `activeServerIds[0]`. With 3 paired servers (each with its own API key), the first-added server determined what appeared — and the strip rendered silently empty regardless of cause.

**Fix shipped:**
- `hooks/useQuickAccess.ts`: hooks now take `serverIds: string[]` and fan out via `useQueries`; sessions tagged with `serverId`, popular dedup by path.
- `components/quick-access/QuickAccessStrip.tsx`: feeds `displayedServerIds` (falls back to `activeServerIds`). Added explicit empty / loading / error / no-server UI states.
- `lib/clientLog.ts`: pre-hydration drops now `console.warn` + optional `EXPO_PUBLIC_DEV_STREAMER_URL/KEY` fallback (made the bisect possible).
- 4 jest tests pass (single-server, multi-server union, popular dedup).

### Bug 4 — Long conversation: scroll-to-end flickery / jumpy ✅ DONE 2026-05-22 (commit 78218fb)

**Symptom:** When opening a long conversation that should land at the bottom, the scroll-to-end animation visibly jumped, sometimes overshooting and snapping back.

**Fix shipped (commit message `fix(bug-4): land conversation at true end + maintain position on older-page backfill`):** Two-part fix — settle-detect + `maintainVisibleContentPosition` + `onScrollBeginDrag` tracking on the FlatList, plus a 400 ms delayed animated final scroll after layout settles. Lands correctly at bottom on 268-msg conversation; "Bottom" button jumps to end without recursive backfill.

Related precursor work in commits `c829908` (cap conversation bubble height with whole-text collapse + entity decode) and the FlatList margin → padding pass (margins under-reported `contentSize` by ~640 pt across 80 rows).

### Bug 12 — MessageBubble bleed + code-fence collapse cut ✅ DONE 2026-05-22 (commits cdf0303, d3aec11, f58d74d, 1a020fb)

**Filed in-session** (not previously in this backlog). Two related problems in `components/conversation/MessageBubble.tsx`:

- **Bubble bleed:** assistant bubbles whose text contained a fenced code block painted their dark background ~150–250 pt past the visible content, masking subsequent FlashList rows. The bubble's outer `<View>` measured itself 244 pt taller than its children's `onLayout`-reported heights summed.
- **Code-fence collapse cut:** the `MAX_COLLAPSED_LINES = 10` / `MAX_COLLAPSED_CHARS = 600` truncation cut messages mid-fence, leaving an unclosed ` ``` ` rendering as plain text and the actual code block invisible until the user tapped "Show all N lines."

**Diagnosis:** Spent ~3 hours instrumenting every layer with `onLayout` logs (bubble → wrapper → each child → CodeBlock subviews). Ruled out FlashList row-height cache, `useRecyclingState` toggle, Text intrinsic-vs-glyph measurement, gap interactions, recycling pollution. The 244 pt phantom is real and reproducible but invisible to RN's JS layer. Smoking gun: removing `<CodeBlock>` from the rendered tree eliminated the phantom; the only structurally unusual element inside it was `<ScrollView horizontal>` wrapping a `<Text>` in a column-flex parent. Likely a native-layer `UIScrollView` intrinsic-content-size interaction we never pinned exactly.

**Fix shipped:**
- Replaced hand-rolled CodeBlock (header + horizontal ScrollView + plain Text) with [`prism-react-renderer`](https://github.com/FormidableLabs/prism-react-renderer) rendering each line as a wrapped-row View of token Texts. No horizontal scroll — long lines wrap. Theme `themes.oneDark`.
- Added language detection: explicit fence tag → `LANGUAGE_ALIASES` table; bare fences → `guessLanguage(code)` heuristic (bash → diff → json → markup → tsx → python → markdown → clike fallback).
- Added `DiffLines` component for diff rendering (Prism doesn't ship the `diff` grammar in prism-react-renderer's bundle): `+ ` lines on subtle green tint, `- ` lines on subtle red tint.
- Copy button: added `expo-haptics` light impact + "Copy" → "Copied" label flip for 1.5 s.
- **Removed all text/code expand-collapse** (`MAX_COLLAPSED_LINES`, `MAX_COLLAPSED_CHARS`, `MAX_CODE_LINES`, the `useRecyclingState`-backed `expanded` state in both `TextBlockBody` and `CodeBlock`, related styles). Eliminates the mid-fence truncation bug structurally. Tradeoff: long messages render as taller FlashList cells; FlashList v2 + MVCP handles them.
- Jest mock for `@shopify/flash-list` extended to expose `useRecyclingState` + `useLayoutState` as `React.useState` stubs (unblocked 22 pre-existing ToolCard / MessageBubble test failures).

**Lessons captured:** Three entries under [docs/lessons/](./lessons/):
- [`2026-05-22-bubble-bleed-horizontal-scrollview.md`](./lessons/2026-05-22-bubble-bleed-horizontal-scrollview.md) — never wrap `<Text>` in `<ScrollView horizontal>` inside a column-flex parent on iOS RN.
- [`2026-05-22-flashlist-jest-mock-hooks.md`](./lessons/2026-05-22-flashlist-jest-mock-hooks.md) — FlashList v2 hooks must be stubbed alongside `FlashList` in the Jest mock.
- [`2026-05-22-message-bubble-codeblock-refactor.md`](./lessons/2026-05-22-message-bubble-codeblock-refactor.md) — what shipped and why.

Full brainstorm record (with measurement tables + 7 ruled-out hypotheses) at [`docs/superpowers/plans/2026-05-22-flashlist-bubble-bleed-brainstorm.md`](./superpowers/plans/2026-05-22-flashlist-bubble-bleed-brainstorm.md).

Tests post-fix: 476 passing, 2 skipped pre-existing, 0 failing (was 22 failing at session start).
