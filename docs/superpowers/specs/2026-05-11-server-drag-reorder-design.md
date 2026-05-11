# Server Drag-and-Drop Reordering

**Date:** 2026-05-11
**Status:** Approved

## Context

Users add multiple servers to Threadbase Mobile but have no way to control the order they appear in any view. The order is currently determined by insertion time. This feature lets users reorder their servers via drag-and-drop with an iOS-style jiggle animation, accessible from the Filter & Sort sheet.

## Scope

Entry point: `FilterSortSheet` Servers section only. `ServersManageModal` and `ServerStatusModal` are out of scope for this iteration.

## Data Layer

**Store:** `stores/servers.ts`

Server order is already implicit in `activeServerIds: string[]`. One new action is needed:

```ts
reorderServers: (orderedIds: string[]) => void
```

Replaces `activeServerIds` with the new order and calls the existing `persistServerList()`. No new fields on `ServerConfig`. `displayedServerIds` is left untouched — display order in the hub derives naturally from the new `activeServerIds` order since consumers iterate `activeServerIds` and filter.

## UI — FilterSortSheet Section Header

`FilterSortSheet` (`components/servers/FilterSortSheet.tsx`) gains a local `isEditingOrder` boolean via `useState`. The "Servers" section header gets a Phosphor icon button on the right:

- `LockSimpleOpen` when `isEditingOrder` is false
- `LockSimple` when `isEditingOrder` is true

Tapping the icon toggles `isEditingOrder`. The icon is hidden entirely when `activeServerIds.length < 2`.

`isEditingOrder` and `reorderServers` (from store) are passed as props to `DisplayedServersList`.

## UI — DisplayedServersList Component

**File:** `components/servers/DisplayedServersList.tsx`

New props:
```ts
isEditingOrder?: boolean
onReorder?: (orderedIds: string[]) => void
```

**Normal mode** (`isEditingOrder` false): no change from today.

**Edit mode** (`isEditingOrder` true):
- `ScrollView` + `.map()` replaced by `DraggableFlatList` from `react-native-draggable-flatlist`
- Data source: `activeServerIds` (full list, not `displayedServerIds`)
- Quick-action buttons (All/Latest only/None) hidden
- Each row: `Switch` hidden, `DotsSixVertical` (Phosphor) drag handle shown on the right
- Each row wraps content in `Animated.View` with jiggle animation (see below)
- `onDragEnd`: calls `onReorder(data.map(s => s.id))`

## Animation — Jiggle Effect

Each row manages its own Reanimated `useSharedValue` for rotation. Animation starts the moment `isEditingOrder` becomes true, stops and snaps to 0 when it becomes false.

```ts
// Start
rotation.value = withRepeat(
  withSequence(
    withTiming(-2, { duration: 80 }),
    withTiming(2,  { duration: 80 }),
  ),
  -1,
  true
)

// Stop
rotation.value = withTiming(0, { duration: 100 })
```

Each row receives an `index` prop and applies a phase offset of `index * 40ms` initial delay to avoid all cards moving in perfect sync (iOS-style natural feel).

## Edge Cases

| Scenario | Behavior |
|---|---|
| Single server | Lock icon hidden; no reorder affordance shown |
| Active drag | `DraggableFlatList` scales the dragged card up (built-in `isActive`); others continue jiggling |
| Sheet dismissed while editing | Order already persisted on each `onDragEnd`; no data loss, no confirmation needed |
| `displayedServerIds` after reorder | Members unchanged; display order derives from new `activeServerIds` automatically |

## Files to Modify

| File | Change |
|---|---|
| `stores/servers.ts` | Add `reorderServers` action |
| `components/servers/FilterSortSheet.tsx` | Add `isEditingOrder` state, lock icon button, pass props to `DisplayedServersList` |
| `components/servers/DisplayedServersList.tsx` | Add `isEditingOrder` + `onReorder` props, conditional `DraggableFlatList` render, jiggle animation per row |

## Dependencies

All already installed:
- `react-native-draggable-flatlist@^4.0.3`
- `react-native-reanimated@4.2.1`
- `react-native-gesture-handler@~2.30.0`
- `phosphor-react-native` (for `LockSimple`, `LockSimpleOpen`, `DotsSixVertical` icons)

## Verification

1. Open Filter & Sort sheet with 2+ servers configured
2. Tap the lock icon in the Servers section header — cards jiggle, switches disappear, drag handles appear
3. Drag a server card to a new position — on release, order updates immediately
4. Close and reopen Filter & Sort — new order persists
5. Return to hub — all view modes (Tree/Hub/Classic) reflect the new server order
6. With a single server — lock icon is not shown
7. Tap lock icon again — jiggle stops, switches reappear, order is locked
8. Run `npm test` — all existing tests pass
