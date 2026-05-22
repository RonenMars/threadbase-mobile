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
| Bug 8 | Manage Favorites: duplicate top bar + "add to favorites" CTA on empty | Open |
| Bug 9 | Quick Access: hide Edit pencil when strip is collapsed | Open |
| Bug 10 | Conversation: show "Top" button only when scrolling up | Open |
| Bug 11 | Conversation: move "Bottom" button to bottom-right; show only when not at bottom | Open |
| Bug 12 | MessageBubble bleed + code-fence collapse cut | ✅ DONE 2026-05-22 (cdf0303, d3aec11, f58d74d, 1a020fb) |
| Issue 1 | Post-intro: cached Hub list flashes, then re-paints with server data | Open |
| Issue 2 | Hub accordion expand stalls on long projects (1,266 items → ~9 s) | Open |

**Suggested next-up order:** Bug 7 → Bug 9 (same file, ship together) → Bug 8 → Bug 10 + Bug 11 (same file, same scroll handler) → Issue 1 → Issue 2 → Bug 6 → Bug 5. Rationale at the bottom of the file under [Sequencing](#sequencing).

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

**Related:** Bug 7b and Bug 8b both need a "any-server-has-conversations" check — land them together so the signal lives in one hook.

---

## Bug 8 — Manage Favorites: duplicate top bar + empty-state CTA

**Filed:** 2026-05-22.

**8a. Remove the duplicate top bar.**
- Screenshot shows two stacked top bars: the system Stack header (`< manage-favorites`) AND the screen's own custom header (`← Back  Manage Favorites`). Both are rendering.
- Root cause: `app/_layout.tsx:178-204` declares `Stack.Screen` for `index`, `onboarding`, `session/[id]`, `conversation/[id]`, `browse`, `settings`, `project/[id]` — but **not** `manage-favorites`. So the route falls back to the default Stack header (which uses the filename as title) AND `app/manage-favorites.tsx:15-21` renders its own in-screen header.
- Two clean fixes — pick one:
  1. **Keep system header, delete in-screen header.** Add `<Stack.Screen name="manage-favorites" options={{ title: 'Manage Favorites', headerShown: true }} />` in `app/_layout.tsx`, then delete the `<View style={styles.header}>` block + its styles from `app/manage-favorites.tsx:15-21,54-65`. Consistent with `settings` and `project/[id]`.
  2. **Keep in-screen header, hide system header.** Add `<Stack.Screen name="manage-favorites" options={{ headerShown: false }} />` and leave the screen as-is. Consistent with `session/[id]` and `conversation/[id]`.
- **Recommendation: (1)** — Settings already uses the system header (`app/_layout.tsx:190-193`); Manage Favorites is the same kind of secondary nav surface. Matching settings keeps the back gesture and title behavior identical without custom code.

**8b. Empty state CTA: "Add to favorites".**
- When `favorites.length === 0` AND any queried server has > 0 conversations (i.e. there *is* something the user could favorite), the empty state currently shows static copy (`app/manage-favorites.tsx:23-27`): *"No favorites pinned yet. Tap a chip in the strip and choose 'Pin to Favorites'."*
- Replace with a primary button: **"Add to favorites"** that navigates somewhere the user can pick an item.
- **Open question for pickup:** where should the button go? Options:
  1. `/browse` (the project directory picker — `app/browse.tsx`) — lets the user pick a folder, then "Pin to Favorites" from there. Requires browse to support pinning in addition to "Start new session". Bigger lift.
  2. Back to the Hub (`/`) with the Quick Access strip auto-expanded and switched to a tab the user can pin from — but they have nothing in any tab yet either, so this doesn't help.
  3. A new dedicated "pick something to favorite" screen showing recents + popular + a project picker. Cleanest UX, most code.
  - Recommendation: defer the destination decision until brainstorm. The simplest stub that unblocks the feature is to route to the Hub with the strip expanded; refine after seeing how it feels.
- Empty-state branching:
  - `favorites empty + all servers 0 conversations` → keep the current "long-press a chip" copy (there's nothing to favorite anyway). Or hide this entire screen entry point upstream — see Bug 7b for the parallel case in the strip.
  - `favorites empty + any server has conversations` → show the CTA button.
  - `favorites non-empty` → render the existing FlatList (`app/manage-favorites.tsx:29-46`), no change.

**Files likely involved:**
- `app/_layout.tsx` — add `Stack.Screen name="manage-favorites"`
- `app/manage-favorites.tsx` — delete in-screen header (or hide system one), branch the empty state, add CTA
- `app/browse.tsx` (only if (1) is chosen as the CTA destination)
- `hooks/useConversations.ts` / `hooks/useQuickAccess.ts` — for the "any server has conversations" signal (reuse what Bug 7b lands on; don't query twice)

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

## Sequencing

Suggested next-up order (revise as profiling results come in):

1. **Bug 7** (Quick Access UX trio) — small, contained; ships a few hours of fixes that visibly improve cold launch.
2. **Bug 9** (hide pencil when collapsed) — pair with Bug 7 in the same PR, same file.
3. **Bug 8** (Manage Favorites) — same author session; reuses the "any server has conversations" signal from Bug 7b.
4. **Bug 10 + Bug 11** (conversation Top/Bottom buttons) — both live in the same `handleScroll` callback at `app/conversation/[id].tsx:202-209`. Land together. Consider folding [Bug 6](#bug-6--conversation-list-content-hidden-under-bottom-action-bar) (bottom-bar overlap) into the same screen pass since all three touch the same view.
5. **Issue 1** (cold-launch cached flash) — reuses the existing `useMinDisplayTime` helper; small.
6. **Issue 2** (Hub accordion stall) — needs profiling first; biggest perceived-perf win.
7. **Bug 6** (bottom-bar overlap) — small layout fix; can be paired with Bug 10 + Bug 11 + Feature 2 (Export relocation) since all four touch the conversation screen.
8. **Bug 5** (multi-attachment no output) — diagnose first; may collapse into Feature 3 (multi-file attachments).

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
