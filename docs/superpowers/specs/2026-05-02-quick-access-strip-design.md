# Quick Access Strip — Design Spec

**Date:** 2026-05-02
**Status:** Approved

---

## Context

The home screen (`app/index.tsx`) shows a flat session list with no way to quickly jump to frequently-used directories or pinned sessions. Users who work across many projects have to scroll or filter to find what they need. This spec adds a collapsible Quick Access Strip above the session list with three tabs: Favorites (manually pinned), Recents (auto), and Popular Projects (auto, dirs only).

---

## What We're Building

A collapsible strip rendered between the header and the session list on the home screen. It has three tabs, each independently togglable via Settings, showing chips that navigate or act on directories and sessions.

---

## Data Model

### New store: `stores/quickAccess.ts` (Zustand, persisted to AsyncStorage)

```ts
interface FavoriteItem {
  type: 'dir' | 'session'
  // dirs: absolute path string (e.g. "~/my-app")
  // sessions: composite key "serverId::sessionId"
  id: string
  label: string       // display label (path or session name)
  serverId?: string   // for sessions only
}

interface QuickAccessStore {
  // Favorites: manually pinned, ordered
  favorites: FavoriteItem[]
  // Ignored items per tab — not shown in Recents or Popular even if they qualify
  ignoredRecents: Set<string>   // id strings
  ignoredPopular: Set<string>   // id strings (paths)
  // Strip visibility
  stripCollapsed: boolean
  // Per-tab enabled flags (from settings — but stored here for simplicity)
  favoritesEnabled: boolean
  recentsEnabled: boolean
  popularEnabled: boolean

  // Actions
  pinItem: (item: FavoriteItem) => void
  unpinItem: (id: string) => void
  reorderFavorites: (from: number, to: number) => void
  ignoreRecent: (id: string) => void
  ignorePopular: (id: string) => void
  setStripCollapsed: (v: boolean) => void
  setFavoritesEnabled: (v: boolean) => void
  setRecentsEnabled: (v: boolean) => void
  setPopularEnabled: (v: boolean) => void
}
```

**Persistence key:** `threadbase_quick_access`

**Note:** `ignoredRecents` and `ignoredPopular` are serialized as arrays (Sets don't JSON-serialize natively).

### Recents — derived, not stored

Recents are computed from React Query cache: the most recently accessed sessions and browse paths, ordered by `lastActivity`. No separate store needed — pull from `useEagerSessions()` and sort by `lastActivityMs`. Filter out any id in `ignoredRecents`.

### Popular — derived, not stored

Popular directories are computed by grouping all sessions by `projectPath` and counting. Sort descending by count. Filter out any path in `ignoredPopular`.

---

## Components

### `components/quick-access/QuickAccessStrip.tsx`
Top-level strip component. Renders the tab bar + collapsible body. Mounted directly in `app/index.tsx` between the header and the session list.

Props: none (reads from `useQuickAccessStore` and session data directly).

Internals:
- Tab bar: `Star`, `ClockCounterClockwise`, `Fire` Phosphor icons + label
- Collapse toggle: `CaretUp` / `CaretDown` Phosphor icon (right side of tab bar)
- Gear icon (`GearSix`): visible only when `currentTab === 'favorites'` — opens Manage Favorites screen
- Edit/Done icon (`PencilSimple`): toggles edit mode — shows delete badges on chips

### `components/quick-access/QuickAccessChip.tsx`
Single chip. Props: `item`, `tab`, `editMode`, `onPress`, `onDelete`.

- Favorites tab: blue-tinted border + background
- Edit mode: red `✕` badge in top-right corner, chip wiggles

### `components/quick-access/QuickAccessActionSheet.tsx`
Bottom sheet shown on chip tap (non-edit mode).

- **Directory chip:** "New Session here" (primary) / "Browse directory" / "Pin / Unpin" / "Cancel"
- **Session chip:** "Open session" / "Pin / Unpin" / "Cancel"

### `app/manage-favorites.tsx` (new screen)
Accessed via gear icon in strip header. Full-screen list of pinned favorites with Unpin buttons and drag-to-reorder handles (`DragHandleHorizontal` Phosphor icon). Back button returns to home.

---

## Strip Behaviour

### Initial display
- Show `INITIAL_CHIPS = 4` chips on first render (roughly 1–2 rows).
- If more items exist beyond the initial count, show a "+ N more" chip at the end.
- Tapping "+ N more" loads `LOAD_MORE_STEP = 4` additional chips and re-renders.
- Continue showing "+ N more" until all visible (non-ignored) items are displayed.

### Collapse
- Tap `CaretUp`/`CaretDown` to toggle. Persisted in `quickAccessStore.stripCollapsed`.
- Collapsed state shows only the tab bar row (no chips).

### Edit mode
- Tap `PencilSimple` to enter. All chips gain a red `✕` badge.
- Tapping `✕` on a chip:
  - **Favorites tab:** unpins the item (removes from `favorites` array)
  - **Recents / Popular tabs:** adds id to `ignoredRecents` / `ignoredPopular` — item won't appear again
- Tap `PencilSimple` again (now a checkmark) or tap outside chips to exit edit mode.

### Tab switching
- Disabled tabs (toggled off in Settings) are hidden from the tab bar entirely.
- If the currently active tab gets disabled, auto-switch to first enabled tab.
- If all tabs disabled, hide the strip entirely.

### Tapping a chip (non-edit mode)
Opens `QuickAccessActionSheet`.
- "New Session here" → `router.push('/browse?server=<serverId>&path=<path>')` for dirs, or navigates to session screen for sessions.
- "Browse directory" → `router.push('/browse?server=<serverId>&path=<path>')`.
- "Open session" → `router.push('/session/<sessionId>?server=<serverId>')`.
- "Pin / Unpin" → calls `pinItem` or `unpinItem`.

---

## Settings Integration

Add a new **"Quick Access"** section to `app/settings.tsx` with three toggle rows:

| Toggle | Default | Controls |
|---|---|---|
| Favorites | on | `favoritesEnabled` |
| Recent Sessions | on | `recentsEnabled` |
| Popular Projects | on | `popularEnabled` |

These map to fields in `QuickAccessStore`, not `SettingsStore` (keeps concerns co-located).

---

## Integration Point: `app/index.tsx`

Insert `<QuickAccessStrip />` between the header `<View>` and the layout component (`TreeSessionsList` / `ProjectHubList` / classic). No other changes to `app/index.tsx`.

---

## Icons (Phosphor)

| Element | Icon |
|---|---|
| Favorites tab | `Star` |
| Recents tab | `ClockCounterClockwise` |
| Popular tab | `Fire` |
| Collapse/expand | `CaretUp` / `CaretDown` |
| Gear (manage favorites) | `GearSix` |
| Edit mode | `PencilSimple` |
| Drag handle (manage screen) | `DragHandleHorizontal` |
| Directory chip | `Folder` |
| Session chip | `Lightning` |

---

## What's Out of Scope

- Themes (separate spec)
- Drag-to-reorder within the strip itself (manage screen handles ordering)
- Syncing favorites across devices / servers (local-only)
- Showing Popular for sessions (can't meaningfully rank sessions by popularity)

---

## Verification

1. **Favorites:** Pin a dir from Recents → appears in Favorites tab. Unpin via gear/manage → disappears. Unpin via edit mode `✕` → same.
2. **Recents:** Open several sessions → they appear in Recents ordered by last activity. Dismiss one via edit mode → stays gone across restarts.
3. **Popular:** Sessions with the same `projectPath` → that path ranks higher. Dismiss via edit mode → stays gone.
4. **Load more:** Add >4 items to any tab → "+" chip appears. Tap it → 4 more appear. Repeat until exhausted → no "+" chip.
5. **Settings toggles:** Disable "Recent Sessions" → Recents tab disappears from strip. Re-enable → returns.
6. **Collapse:** Tap caret → chips hidden, only tab bar visible. Survives navigation (persisted).
7. **Action sheet — dir:** Tap a dir chip → sheet appears with correct actions. "New Session here" → navigates to browse at path.
8. **Action sheet — session:** Tap session chip → sheet. "Open session" → navigates to session screen.
9. **Manage screen:** Gear icon (Favorites tab only) → manage screen opens. Unpin row → item removed. Back → home.
10. **Phosphor icons only:** No emojis anywhere in implementation.
