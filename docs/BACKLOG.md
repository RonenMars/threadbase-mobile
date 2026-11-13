# Backlog — Open Bugs and Leftovers

Open bug tickets for Threadbase Mobile. Features live in [ROADMAP.md](./ROADMAP.md).

Each entry is meant to be self-contained enough to pick up without re-reading the original conversation. File pointers use `path:line` where the line number is meaningful; otherwise the path is enough.

Once a bug is fixed, move it to [FEATURES.md](./FEATURES.md#completed-roadmap-and-backlog-items) as a one-line entry and delete it here; the full entry stays in git history.
Unfinished parts of partly shipped roadmap features live under [Leftovers from partly shipped features](#leftovers-from-partly-shipped-features).

---

## Status overview

| ID | Title | Status |
|---|---|---|
| Bug 2 | Hub tree node open: loader + long-list render stall | 🟡 Split — Issue 1 done ([FEATURES.md](./FEATURES.md#completed-roadmap-and-backlog-items)); Issue 2 mitigated by #576 (see below) |
| Bug 20 | New session from tree-view (with path completion): "Path" error | Open — [#608](https://github.com/RonenMars/threadbase-mobile/issues/608). Re-confirm it still reproduces: streamer #461 fixed the path decode |
| Bug 31 | Settings theme change doesn't apply colors across the whole app | 🟡 Near-done — `dark.*` refs 605 → 6 (all in `DiffViewer.tsx`), `useTheme()` 8 → 118. Residual: [#609](https://github.com/RonenMars/threadbase-mobile/issues/609) |
| Issue 2 | Hub accordion expand stalls on long projects (1,266 items → ~9 s) | 🟡 Mitigated by #576 — `ProjectHubCard` renders only the loaded page + "See more". Unmeasured: [#607](https://github.com/RonenMars/threadbase-mobile/issues/607) |
| E2E | Mock Maestro suite — remaining flow failures + env gotchas | Open — 11/15 passing. [#598](https://github.com/RonenMars/threadbase-mobile/issues/598) (stale build) ✅ **CLOSED** — `ensure-release-build.js` now fails loudly instead of silently reusing a stale `.app` ([PR #626](https://github.com/RonenMars/threadbase-mobile/pull/626), `2de1c1ae`). [#600](https://github.com/RonenMars/threadbase-mobile/issues/600) (suite cannot gate) still open. See [e2e-remaining-work.md](./e2e-remaining-work.md) |

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

## Bug 31 — Settings theme change doesn't apply colors across the whole app

**Filed:** 2026-05-25. **Audit:** 2026-05-31 (this entry). **Status:** Open — diagnosed; root cause is a codebase-wide pattern, not a single bug.

### Audit findings (2026-05-31)

Counted across `app/`, `components/`, `hooks/` (excluding `node_modules` and `.claude/`):

| Signal | Count | Verdict |
|---|---:|---|
| `dark.(bg\|text\|fg\|accent\|border).…` references | **605** | ❌ hardcoded palette |
| Hex / rgb / rgba color literals in styles | **67** | ❌ won't theme-switch |
| `useTheme()` / `useThemeColors()` / `theme.colors.…` lookups | **8** | barely used |
| NativeWind theme-token classes (`bg-bg-*`, `text-text-*`, `border-border`) | **5** | barely used |
| Imports from `@/theme` or `@/theme/*` | **0** | the runtime-theme module path isn't wired |

The infrastructure for theming is in place — `contexts/ThemeContext.tsx` exists with consumers in `app/_layout.tsx`, `app/settings.tsx`, `components/ui/Banner.tsx`; `constants/theme.ts` exports 5 palettes (`dark`, `light`, `dracula`, `catppuccin`, `nord`) plus a `THEMES` registry keyed by `ThemeId`; `tailwind.config.js` correctly maps NativeWind class names (`bg-bg-primary`, `text-text-primary`, `text-accent`, `border-border`, `bg-status-running`, etc.) to CSS variables (`var(--color-bg-primary)`).

The infrastructure is just not being **used**. The vast majority of components do `import { dark } from '@/constants/theme'` and apply `dark.bg.primary` etc. directly as `StyleSheet` values, so a runtime theme switch is invisible to them.

### The `StyleSheet.create` capture-at-import gotcha

`StyleSheet.create({ container: { backgroundColor: dark.bg.primary } })` is evaluated **once, at module import time**, and captures the value of `dark.bg.primary` then and there. Re-importing or swapping the active theme later does nothing for these stylesheets — they hold the literal value, not a live lookup. The fix isn't "rename `dark` to `theme`" — it's a structural move from `StyleSheet.create` to either:

- **NativeWind classes** (`className="bg-bg-primary text-text-primary"`) — preferred where layout allows, since they re-render against CSS variables for free.
- **`useTheme()`-derived inline styles** — for cases where a stylesheet is hot enough that NativeWind's per-render cost matters or where dynamic values are needed (`style={{ backgroundColor: theme.bg.primary }}` inside a function component that calls `useTheme()`).

### Migration scope (estimate)

- **605 `dark.*` references** to migrate — each touches a `StyleSheet.create` or an inline style.
- **67 hex/rgb literals** to convert to tokens. Some are intentional (status indicators, fixed brand colors); audit each.
- The top-level routes are the biggest offenders. Confirmed direct `dark` imports in: `app/index.tsx`, `app/manage-favorites.tsx`, `app/project/[id].tsx`, `app/browse.tsx`, `app/conversation/[id].tsx`. Sweep `app/` first.
- High-traffic components flagged in the original entry (`MessageBubble`, `ProjectHubCard`, `QuickAccessStrip`, onboarding steps) likely each have 20–50 references.

### Recommended approach

1. **Phase 1 — pilot on one screen** (suggest `app/settings.tsx` since it already has `useTheme` wiring): migrate every `dark.*` reference to NativeWind classes where layout allows, `useTheme()` otherwise. Validate against all 5 themes on simulator. Establishes the per-reference recipe.
2. **Phase 2 — sweep `app/`**: same recipe across every top-level route. Test against all 5 themes after each route.
3. **Phase 3 — sweep `components/`**: by directory (sessions/, quick-access/, onboarding/, conversation/, etc.). One PR per directory keeps the diff reviewable.
4. **Phase 4 — hex/rgb literal audit**: review the 67 hits; replace or keep with justification.
5. **Phase 5 — Banner / status-bar / nav chrome**: the system-chrome items in the original validation checklist.

Don't try to do it all in one PR. The original "single audit pass" recommendation was right, but the *fix* needs to land incrementally so each phase can be tested against all 5 themes.

### Why this stays solo (no parallel sets)

Per the merge-order doc, Bug 31 conflicts with **everything** — every UI PR in flight will touch files this migration touches. Schedule when Waves 1 + 2 are merged and no other open UI PRs exist. Consider letting an agent do the full pass with a follow-up review pass rather than splitting across sets.

### Test gates

- Each phase: switch theme to each of the 5 palettes, screenshot every top-level screen + modal, confirm no surface stayed on the previous palette.
- Jest: full suite must stay green. Existing snapshot tests may capture color literals — update them as theme tokens land.
- Manual on-device check on iPhone 17 Pro (system-chrome behavior — status bar style, keyboard appearance — differs from simulator).

---

**Symptom (original report):** Changing the theme from Settings updates some surfaces but leaves others on the previous palette. The change needs to be validated across every screen, not just the one currently visible.

**Validation checklist (sweep on each theme switch):**

- Hub: project cards, tree rows, accordion chevrons, section headers
- Conversation screen: MessageBubble (user + assistant), CodeBlock (Prism theme), DiffLines tints, Top/Bottom buttons, input area, attachment chips
- Quick Access strip: tab pills, row backgrounds, empty/loading states
- Onboarding carousel + ConnectStep + NotificationsStep
- Settings itself (including any nested screens — favorites manager, server detail, API key editors)
- Modals: new-session name modal, file browser, error banners, pull-to-refresh sheet
- System chrome: status bar style, nav bar tint, splash background, keyboard appearance

**Likely causes to look at:**

- Hard-coded color literals (`#RRGGBB` / `rgb(...)`) instead of theme tokens — grep candidates
- NativeWind class strings that don't pick up the theme variant (e.g. `bg-white` vs `bg-background`)
- Components that captured the theme into a `useMemo` / closure without including the theme value in its dependency list
- Direct imports from a static palette module rather than the live theme context/store

**Action item:** before fixing, do a single audit pass: switch theme, screenshot every top-level screen + modal, list the off-palette surfaces. Then group the fix by root cause (hard-coded literals vs missing dep arrays vs static imports) rather than screen-by-screen.

**Files to start with (to verify):**

- Theme provider / store (Zustand slice or context for the active theme)
- `tailwind.config.js` and any `themes/` or `theme/` module
- High-traffic components: `MessageBubble`, `ProjectHubCard`, `QuickAccessStrip`, onboarding steps

---

## Leftovers from partly shipped features

The shipped part of each item below is listed in [FEATURES.md](./FEATURES.md#completed-roadmap-and-backlog-items).
Only the unfinished part is tracked here.
The original roadmap entries are in git history (`git show 500e37e3:docs/ROADMAP.md`).
Verified against `origin/main` on 2026-11-02.

| Item | What is left | Tracker |
|---|---|---|
| Feature 6 — Cross-session search | A dedicated `/search` screen, recent searches kept in AsyncStorage, and results grouped by server and then project. Snippet previews (PR #778) and tap-to-jump into the conversation (`lib/conversationHref.ts`, `app/conversation/[id].tsx`) already work. | [#617](https://github.com/RonenMars/threadbase-mobile/issues/617) |
| Feature 12 — Live Activities | Self-hosters cannot turn it on: no install path provisions APNs credentials ([streamer#480](https://github.com/RonenMars/threadbase-streamer/issues/480)), and APNs key and `.env` loading are launchd-only, so Windows and Linux are out ([streamer#481](https://github.com/RonenMars/threadbase-streamer/issues/481)). | streamer#480, streamer#481 |
| Feature 12 — Android notifications | No Android push has been checked on a device: arrival, icon and colour, channel muting, Allow/Deny buttons, cold-start tap, the ongoing live-session notification, and delivery under Doze. Also open: the status-bar icon (needs a white-on-transparent 96×96 glyph), and the FCM V1 key assigned for both application ids. The streamer now sends attention pushes with `priority: "high"` (streamer#528, closed in v1.48.0; checked 2026-11-13). The Android Maestro flow `e2e/android_notifications_health.yaml` covers the health screen only, against a seeded token row, and has not been run. Checklist: [android-notifications-plan.md](./android-notifications-plan.md). | [streamer#528](https://github.com/RonenMars/threadbase-streamer/issues/528) |
| Feature 13 — Mission Control | A free-text quick reply from a board card (the board already answers pending questions and opens the row menu on long-press), and the haptic or amber highlight when a session starts waiting (not checked). Board polish PRs #1327, #1333 and #1335 are open. | [#617](https://github.com/RonenMars/threadbase-mobile/issues/617) |
| Feature 14 — Voice prompts | On-device Whisper. Dictation ships through `expo-speech-recognition` (the composer voice button, `e2e/voice_dictation.yaml`). | [#617](https://github.com/RonenMars/threadbase-mobile/issues/617) |
| Feature 17 — Maestro coverage | Flows for session rename, attachment send, keyboard avoidance on the chat input, and applying a filter or sort. The suite has 19 flows. | [#610](https://github.com/RonenMars/threadbase-mobile/issues/610) |
| Feature 20 — Visual regression gate | A screenshot comparator, a `test:e2e:regression` script and a CI step. Reference PNGs exist. | [#610](https://github.com/RonenMars/threadbase-mobile/issues/610) |
| Feature 25 — react-hooks v5 lint | CI reports zero warnings, but 45 inline `react-hooks` disables and 31 `exhaustive-deps` disables remain to be resolved. | [#621](https://github.com/RonenMars/threadbase-mobile/issues/621) |
| Feature 26 — Precompiled XCFrameworks in CI | Precompiled modules are on; confirm it in a Maestro CI build log and record the build time. | [#616](https://github.com/RonenMars/threadbase-mobile/issues/616) |
| Feature 30 — Build-time warnings | Modules are bumped; the Swift `Sendable` warnings and the Hermes warnings remain. | [#616](https://github.com/RonenMars/threadbase-mobile/issues/616) |
| Feature 34 — Codex prompt cards | The streamer side shipped (threadbase-streamer PR #1050, `codexScreen.ts`); it has not been verified on a device against a live Codex session. | [#620](https://github.com/RonenMars/threadbase-mobile/issues/620) |
| Feature 36 — Privacy checklist | 13 checklist items are ticked; 21 need a human (store listings, legal review, on-device evidence). See the [privacy follow-up checklist](./privacy-policy/privacy-follow-up-checklist.md). | [#601](https://github.com/RonenMars/threadbase-mobile/issues/601) |
| Bug 17 — Jumpy scroll-to-bottom | The fix is in (`LiveConversationView.tsx`, `ConversationHistoryList.tsx`); one on-device check of a fast stream and a reconnect is outstanding. | — |
