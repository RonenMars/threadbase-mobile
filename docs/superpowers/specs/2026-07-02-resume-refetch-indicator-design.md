# Resume Refetch Indicator — Design

## Problem

The full-screen `LoadingOverlay` modal (`components/ui/LoadingOverlay.tsx`) currently can appear any time sessions/conversations refetch, including when the app resumes from the background (React Query's `refetchOnWindowFocus`, driven by `focusManager` in `services/query-client.ts`, fires a real refetch on every `AppState → active`). Blocking the whole screen for a background-triggered refresh is disruptive — the user was already looking at their data and shouldn't be locked out while it silently re-syncs.

The modal should only appear on a true cold start (app launched from closed/not-running). Any other refetch (resume from background, or general "already running" refresh) should show a small, non-blocking spinner instead.

## Current state (relevant code)

- `app/index.tsx`:
  - `convLoaderMode: 'full' | 'minimal'` state, `nextLoaderModeRef` — set to `'full'` on every `AppState → active`, but never actually read anywhere. Effectively dead code today.
  - `showConvProgress = !convDone && convLoaderMode === 'full'`
  - `LoadingOverlay` renders when `visible={!sessionsDone || showConvProgress}`
  - `handleRefresh` (manual pull-to-refresh) explicitly sets `convLoaderMode = 'full'` — this is intentional and out of scope for this change.
- `useEagerSessions()` exposes `isDone` (aliased `sessionsDone`); `useEagerConversations()` exposes `isDone` (aliased `convDone`). Both are already the correct "is a fetch in flight" signals — no new data-layer work needed.
- Tree view (`components/sessions/tree/TreeSessionsList.tsx` + `ServerRootRow.tsx`) shows a server-name header row only when `multiServer` (visible server count > 1). Single-server tree view, Hub view (`ProjectHubList`, grouped by project), and Classic view have no server-name row.

## Design

### 1. Cold-start detection

Replace the orphaned `nextLoaderModeRef` with a `hasLoadedOnceRef` (`useRef(false)`), flipped to `true` right after the first cold-start fetch completes (`sessionsDone && convDone` first becomes true). The modal's visibility condition becomes:

```ts
const isColdStart = !hasLoadedOnceRef.current
const showModal = isColdStart && (!sessionsDone || showConvProgress)
```

`AppState → active` no longer sets any loader-mode ref — it's simply not needed for the modal condition. The `focusManager` refetch still fires (unchanged), but since `hasLoadedOnceRef.current` is already `true` by the time a resume happens, the modal never opens for it.

`handleRefresh` (manual pull-to-refresh) is untouched — it already has its own dedicated pull-to-refresh spinner UI (`refreshing={manualRefreshing}`), independent of the modal condition.

### 2. Resume/background spinner signal

```ts
const isBackgroundRefreshing = hasLoadedOnceRef.current && (!sessionsDone || !convDone)
```

True whenever a refetch is in flight after the initial cold-start load has completed — covers both app-resume refetches and any other passive background refetch. Explicitly excludes the cold-start window (modal owns that) and excludes manual pull-to-refresh visually (that already shows its own pull spinner; this flag can still be true concurrently without visual conflict since the two indicators live in different places).

### 3. Placement

- **Tree view, multi-server** (`ServerRootRow`, `collapsible === true`): render a small `ActivityIndicator` (`size="small"`) to the right of `serverLabel` when `isBackgroundRefreshing`. New prop `isRefreshing?: boolean` threaded from `TreeSessionsList` → `ServerRootRow`.
- **Everywhere else with no server-name row** (single-server tree view, Hub view, Classic view): small `ActivityIndicator` in the existing screen header in `app/index.tsx`, placed next to the header's Cloud/status icon (`styles.headerRight`). Visible regardless of layout mode, doesn't scroll, doesn't intercept touches.

Both use the same `ActivityIndicator` pattern already established in `components/sessions/SessionStatusBadge.tsx` — no new spinner component.

### 4. Out of scope

- No changes to React Query config, `focusManager`, or refetch triggers.
- No changes to manual pull-to-refresh behavior.
- No changes to `SlowQueryBanner` (60s-slow-query banner is orthogonal and unaffected).
- Hub view's per-project grouping is not changed to show server names — it falls back to the header spinner like Classic view.

## Testing

- Existing Maestro/jest coverage for `LoadingOverlay` visibility should be updated to assert it only shows once per JS instance (cold start), not on simulated `AppState` resume.
- Manual verification: cold launch → modal shows; background app → foreground → modal does NOT show, header/tree spinner does.
