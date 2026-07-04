# Sync Cached-Data Notice — Design

## Problem

PR #245 replaced the full-screen loading modal with a small spinner for background
refetches (app resume via `focusManager`). The spinner alone doesn't explain *why*
the data may be momentarily stale. Add an explicit "showing cached data" message,
in a soft warning treatment, shown exactly while `isBackgroundRefreshing` is true.

Design was iterated visually (artifact `sync-pill-preview`) and locked on 2026-07-03.

## Placement matrix

| View | Single server | Multi server |
|------|---------------|--------------|
| Classic | Caption under the header fallback spinner (top-right of content area) | Chip in each `ServerHeaderRow` |
| Hub | Centered banner above the list | Chip in each `ServerHeaderRow` |
| Tree | Centered banner above the list (spinner stays in the root row) | Chip in each `ServerRootRow` |

## Copy

- Inline chips (multi-server): `sessions:sync.cachedData` — "Showing cached data"
  (the adjacent spinner already conveys "syncing").
- Banner/caption (single-server): `sessions:sync.cachedDataSyncing` —
  "Showing cached data — syncing…".
- Keys added to all locales (en/he/ar/ru).

## Visual treatment

Soft warning everywhere: text `theme.status.waiting`, background
`theme.status.waiting + '21'` (~13% alpha), radius 6–8. The banner adds a
`waiting + '4D'` border. Theme-aware via tokens — no hardcoded colors.

## Components

- `ServerHeaderRow` / `ServerRootRow`: render the chip next to the existing
  `isRefreshing` spinner. `ServerRootRow` gates the chip on `collapsible`
  (multi-server) — single-server Tree uses the banner instead.
- New `components/sessions/SyncCachedNotice.tsx`: absolute overlay
  (`pointerEvents="none"`, no layout shift), `variant: 'banner' | 'caption'`.
  Mounted once in `app/index.tsx` over the content area, visible when
  `isBackgroundRefreshing && activeServerIds.length <= 1`; variant is `banner`
  for Hub/Tree, `caption` for Classic.

## Out of scope

- No fade animation (indicators appear/disappear with state, matching the
  PR #245 spinners). Add if it feels abrupt on device.
- Multi-server Classic non-merged (segmented tabs) has no server rows and no
  header spinner — same known gap as PR #245's spinner, unchanged here.
- No changes to React Query, cold-start modal, or pull-to-refresh.
