> **Archived 2026-05-22.** This file has been moved to the archive. Active backlog/roadmap now lives in [`docs/BACKLOG.md`](../../../BACKLOG.md) and [`docs/ROADMAP.md`](../../../ROADMAP.md). The contents below are preserved verbatim for historical reference.

---

# Hub cached-data flash + long-list render perf

**Date:** 2026-05-22
**Status:** Backlog — not started
**Owner:** Ronen

Two related issues observed on iPhone 17 sim (iOS 26.2) after the post-onboarding flow on a multi-server account (2,703 conversations across ~10 projects, `tmp` alone holds 1,266). Both ultimately come back to the same theme: **the app paints whatever it has, then re-paints when fresh/expensive data arrives, and there's no virtualization barrier between "1,200-item dataset" and the render path.**

This doc captures both for the backlog. Split into focused plans when picking up.

---

## Issue 1 — Post-intro: cached Hub list flashes, then re-paints with server data

### Symptom (screenshots 1 → 2)

1. App finishes intro and lands on the Sessions/Hub tab. Screen shows only the projects that were already in local storage (Image 1 — `dotfiles 1` + `tb-mobile 3`, count badge `AK 4`).
2. A few seconds later the WebSocket + REST round-trip completes and the list re-paints with the full server-side dataset (Image 2 — adds `tb-mobile 166`, `tmp 1266`, `dev 3`, `T 65`, `tb-streamer 60`, `.remember 1` … count badge `AK 2703`).

The flash is jarring because the layout reflows mid-glance — the user starts reading the small list, then it suddenly grows to a long scrollable one.

### Why it happens

- `services/query-client.ts:92` persists the `projectChats` / `projectChats-all` / `session` query roots via `createAsyncStoragePersister`. On cold launch React Query hydrates from AsyncStorage first → list mounts with stale data → `isPending` is false → no loader is shown.
- When the live WebSocket / REST refresh resolves (a few seconds later — multi-server fan-out via `useQueries`), the query cache patches, the list reconciles, and the user sees the layout grow.
- This is the same class of bug as Bug 1 in `2026-05-16-loading-perf-and-tree-new-session.md` (conversation flicker on open from cached data) — same mechanism, different surface.

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

### Symptom (screenshots 3 → 8)

- Initial Hub state, accordion collapsed (Image 3).
- Tap `tb-mobile / 166 convs`: chevron flips left (Image 4), then "a few seconds" of frozen UI before the accordion body paints with the conversation rows (Image 5).
- Tap `tmp / 1266 convs`: chevron flips (Image 7), then > 9 s of frozen UI before the body paints (Image 8). Image 6 shows the post-expand state for context — note the dataset is visibly enormous.

The collapse path stutters too (already noted in Bug 2 of `2026-05-16-loading-perf-and-tree-new-session.md`), which rules out fetch as the culprit. **This is render cost, not network.**

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

When `mergeChats` is on (the default for the demo'd account), every `.conv` and `.session` is constructed as a React element on the JS thread, all 1,266 of them, before the FlashList outer (`ProjectHubList.tsx`) can even flush a frame. There's no virtualization inside the accordion. The `LayoutAnimation.configureNext(...)` call in `handleToggle` then has to animate the whole height delta in one tick.

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

---

## Cross-cutting notes

- Both issues compound: on cold launch with `tmp` open by default (if "remember open accordions" is ever added), the user would see the cached-flash AND a 9 s expand stall back-to-back. Fix Issue 1 first if we want to address scope-creep risk for Issue 2 verification (the cached flash currently masks how slow the cold-launch render path *actually* is).
- Defer to the existing `2026-05-16-loading-perf-and-tree-new-session.md` doc for the conversation-open analog (Bug 1). Reuse `useMinDisplayTime` / `SessionsLoadingOverlay` — don't invent new patterns.
- Do **not** preemptively wrap every `.map` in a FlashList. Only the Hub accordion has measured stalls; the table above is for documentation, not a TODO list.
