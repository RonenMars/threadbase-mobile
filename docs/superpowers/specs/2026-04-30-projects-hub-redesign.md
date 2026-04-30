# Projects Hub Redesign

**Date:** 2026-04-30
**Status:** Approved for implementation

## Problem

Sessions and History are two separate flat lists that are easy to get lost in. The same project name (e.g. `tb-mobile`) appears repeatedly with no grouping, making it hard to understand what each entry represents or how it relates to other entries. The tab bar adds navigation weight for what is fundamentally one concern: your AI work, organized by project.

## Solution Overview

Remove the bottom tab bar entirely. Replace Sessions + History with a single **Projects** screen — the app's root — showing one accordion card per project. An avatar button (top-left) opens a small dropdown for Settings and other navigation. A green FAB (bottom-right) starts a new session. A compact single-row header holds the title, search, filter, and sort icons on the right.

Classic mode (opt-in) restores segmented Sessions / History tabs rendered inside the screen body. The FAB and avatar button persist in both modes.

---

## Layout Modes

### Hub Mode (new default)

- **No bottom tab bar**
- Root screen: Projects hub (accordion cards)
- Avatar button top-left → dropdown menu
- Green FAB bottom-right → new session
- Single-row header: Avatar · "Projects" (centered) · connection dot + 🔍 + ⊜ + ≡↑ (right)

### Classic Mode (opt-in)

- **No bottom tab bar** (tab bar removed permanently)
- Root screen: same Projects header + FAB + avatar
- Sessions / History rendered as a **segmented tab control inside the screen body** (not the OS tab bar)
- Sessions list and History list are unchanged from today

### Settings Toggle

- Location: Settings screen → Appearance section, and also as a shortcut in the avatar dropdown ("Classic view")
- Control: segmented picker "Hub | Classic"
- Default: `hub`
- Persisted key: `sessionsLayout: 'hub' | 'classic'` added to `settings.ts` store + AsyncStorage

---

## Navigation Structure

```
Root: app/index.tsx  (Projects hub — replaces tab navigator)
  ├── Avatar dropdown (inline, not a screen)
  │     ├── → app/settings.tsx          (stack push)
  │     ├── → ServerFilterSheet         (bottom sheet, existing)
  │     └── Layout toggle (hub/classic)
  ├── FAB (+) → NewSessionServerPicker  (modal, existing)
  ├── Hub card session pill tap → app/session/[id].tsx     (existing)
  ├── Hub card conversation row tap → app/conversation/[id].tsx  (existing)
  └── "See all" → app/project/[path].tsx  (new stack screen)
```

`app/(tabs)/` directory and its `_layout.tsx` are replaced by a flat stack navigator. The Expo Router tab layout is removed.

---

## Screen: Projects Hub (root)

### Header Row (single line)

```
[Avatar]    Projects    [●] [🔍] [⊜] [≡↑]
```

- **Avatar button** (left): 28×28 circle, initials or profile image. Tap → dropdown menu overlays below it. Dismissed by tapping outside or selecting an item.
- **"Projects"** title: centered
- **Connection dot** (right group): 6px circle, green=all connected, amber=partial, red=none. No label text. Tooltip/accessibility label: "N/M servers connected".
- **🔍 MagnifyingGlass** (Phosphor): toggles global search bar. Active state: white tint. Tap again or press ✕ to dismiss and clear query.
- **⊜ Funnel** (Phosphor): opens existing `ServerFilterSheet`. Active state: blue tint + 4px indicator dot when any filter is non-default.
- **≡↑ SortAscending** (Phosphor): opens new `SortSheet`. Active state: blue tint + dot when sort differs from default.

### Avatar Dropdown Menu

Small popover anchored below the avatar button. Items:

| Item | Action |
|---|---|
| ⚙️ Settings | Push `app/settings.tsx` |
| 🖥️ Servers | Open `ServerFilterSheet` (existing) |
| 📖 Classic view | Toggle `sessionsLayout` between hub/classic |

Dismissed on outside tap (backdrop with no visual, just touch handler).

### Global Search Bar (when open)

- Animates in below the header row with a smooth height expansion
- Placeholder: "Search sessions & conversations…"
- Searches: session `projectName` + `lastOutput`; conversation `title` + `preview` + `firstMessage.text` + `lastMessage.text`
- Results replace the hub card list with a flat list grouped by type: **Conversations** section then **Sessions** section, each result showing its project name as a secondary line
- Debounce: 300ms
- Clearing the query or dismissing returns to the hub card list

### FAB (Floating Action Button)

- Position: `bottom: 24, right: 16` absolute, above safe area
- Size: 56×56, border-radius 28
- Color: `#30d158` (green)
- Icon: Phosphor `Plus`, 24px, color `#000`
- Shadow: `0 4px 16px rgba(48,209,88,0.35)`
- Tap: opens existing `NewSessionServerPicker` modal (unchanged behavior)
- In classic mode: FAB still present, same behavior

### Project Hub Cards

A `FlatList` of `ProjectHubCard`, one per distinct `projectPath`.

**Grouping:** sessions and conversations grouped by `projectPath`. Display name: `projectPath.split('/').pop()`.

**Card header (always visible):**
```
📁 tb-mobile          4 · 6  ▼
```
- Folder icon + project name (left)
- `N sessions · M conversations` count in compact `N · M` format (right, secondary)
- Chevron rotates 180° on expand (Reanimated interpolation)
- Tap → toggle expand/collapse
- Multiple cards can be open simultaneously

**Expanded — Sessions strip** (hidden if project has no sessions):
```
SESSIONS
main · 1h 40m · 1 prompt
main · 22m 20s · 14 prompts
```
- One slim row per session: branch + elapsed time + prompt count
- No status shown here — status lives inside the individual session detail screen
- Row tap → navigate to that session
- Long-press → existing action sheet (copy ID, send input, cancel)

**Date label rule (applies to both session rows and conversation rows in the hub):**
- If only 1 item from today → show "Today"
- If 2+ items from today within the same card → show the start time (e.g. "17:40") instead of "Today" so items are distinguishable
- Yesterday, Xd ago, and older dates are unaffected

**Expanded — Conversations list** (hidden if project has zero conversations):
- Up to 5 most-recent conversations sorted by `lastActivity` descending
- Each row: title (1 line, truncated) + `branch · N msgs` (secondary) + date label (right)
- Row tap → `/conversation/[id]?server=[serverId]`
- If `messageCount > 5`: "See all N conversations →" link at bottom of card
- If exactly 0 conversations: section omitted entirely (no empty state inside card)

**Collapsed cards:** header row only.

### Hub Sort Options

Default: **Last message date, descending** (most-recent activity first).

Sort sheet options:
- Project name (A→Z / Z→A)
- Last message date *(default)*
- Created date
- Status (In Progress → Idle → Empty → Failed → Completed)

---

## Screen: Project Detail (`app/project/[path].tsx`)

**Route:** `/project/[path]` where `path` is URL-encoded `projectPath`.

**Header:**
```
‹ Projects      tb-mobile
```

**Content:**
- Search bar: always visible (not toggleable)
- Placeholder: "Search in [project name]…"
- Full paginated conversation list for this project
- Reuses `ConversationList` component, filtered to `projectPath`
- Pull to refresh, infinite scroll, skeleton loading — all inherited

---

## Classic Mode Detail

When `sessionsLayout === 'classic'`:

- Root screen renders a segmented control in the body (below the header row): `⚡ Sessions | 📚 History`
- Sessions tab: existing `SessionCard` FlatList + filter/sort toolbar icons (Funnel + SortAscending, replacing old "Filters" text)
- History tab: existing `ConversationList` unchanged
- FAB present in both tabs (new session)
- Avatar menu present (same as hub mode)
- No bottom OS tab bar in either mode

---

## Filter & Sort Toolbar

### Funnel Icon (replaces "Filters" text button)

- Phosphor `Funnel`, 20px
- Minimum tappable area: 36×36
- Default color: `dark.text.secondary`
- Active: `#0a84ff` tint + `#0a84ff18` background + 4px dot indicator (top-right corner of button bounds)
- Active when: any status excluded, or any server hidden
- Opens: existing `ServerFilterSheet` (content unchanged)

### SortAscending Icon (new)

- Phosphor `SortAscending`, 20px
- Same sizing and active-state rules as Funnel
- Active when: sort differs from default (Last message, Descending)
- Opens: new `SortSheet`

### SortSheet (`components/servers/SortSheet.tsx`)

BottomSheet, `snapPoints: ['40%', '70%']`, same backdrop and handle style as `ServerFilterSheet`.

**Sort by** (single-select chips): Project name · Last message date *(default)* · Created date · Status

**Order** (single-select chips): ↑ Ascending · ↓ Descending *(default)*

Apply/Cancel pattern identical to `ServerFilterSheet`. Changes take effect on Apply.

`SortSheet` is used in both hub and classic modes.

---

## Data / Store Changes

### `settings.ts`

```ts
// Add to SettingsStore interface
sessionsLayout: 'hub' | 'classic'
setSessionsLayout: (v: 'hub' | 'classic') => void

// Add to PersistedSettings
sessionsLayout: 'hub' | 'classic'
```

Default: `'hub'`. Persisted to AsyncStorage alongside existing keys.

### Sort State

`sortBy: SortBy` and `sortOrder: SortOrder` live in component state (not persisted).

```ts
// New types (add to types/api.ts or a new types/ui.ts)
export type SortBy = 'projectName' | 'lastActivity' | 'startedAt' | 'status'
export type SortOrder = 'asc' | 'desc'
```

---

## New Components & Files

| Path | Description |
|---|---|
| `app/index.tsx` | New root screen — renders `ProjectHubList` (hub) or classic segmented view |
| `app/project/[path].tsx` | Project detail screen — full conversation list + search |
| `components/sessions/hub/ProjectHubList.tsx` | FlatList of `ProjectHubCard`. Manages accordion state, search bar, sort/filter props. |
| `components/sessions/hub/ProjectHubCard.tsx` | Accordion card: header + session strip + conversation rows |
| `components/servers/SortSheet.tsx` | Sort bottom sheet (style matches `ServerFilterSheet`) |
| `components/ui/AvatarMenu.tsx` | Avatar button + dropdown overlay |
| `components/ui/FAB.tsx` | Green floating action button |

---

## Files Removed / Replaced

| File | Disposition |
|---|---|
| `app/(tabs)/_layout.tsx` | Deleted — tab navigator replaced by stack |
| `app/(tabs)/sessions.tsx` | Logic moved into `app/index.tsx` + `ProjectHubList` |
| `app/(tabs)/history.tsx` | Logic moved into `app/index.tsx` (classic mode) + `app/project/[path].tsx` |

---

## What Does Not Change

- `SessionCard.tsx` — used as-is in classic Sessions tab
- `ConversationList.tsx` / `ConversationRow` — used as-is in classic History tab and project detail screen
- `app/session/[id].tsx`, `app/conversation/[id].tsx` — untouched
- `ServerFilterSheet` — content unchanged; trigger changes from text button to icon
- Long-press session actions (copy ID, send input, cancel) — preserved; in hub mode, long-press on session pill triggers same action sheet

---

## Open Questions Resolved

| Question | Decision |
|---|---|
| Bottom tab bar? | Removed permanently (both modes) |
| Settings access? | Avatar dropdown top-left → Settings push; shortcut toggle in dropdown |
| New session button? | Green FAB bottom-right, always visible |
| Header layout? | Single compact row: Avatar · title · [●][🔍][⊜][≡↑] |
| Multiple accordions? | Yes — no forced collapse |
| History tab in hub mode? | Inside hub cards (5 inline) + Project Detail screen |
| Global search? | 🔍 icon in header → animated bar; Project Detail has persistent local bar |
| Classic mode tab bar? | Segmented control in screen body, no OS tab bar |
| Sort persistence? | Component state only |
