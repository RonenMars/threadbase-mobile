# Projects Hub Redesign

**Date:** 2026-04-30
**Status:** Approved for implementation

## Problem

Sessions and History are two separate flat lists that are easy to get lost in. The same project name (e.g. `tb-mobile`) appears repeatedly with no grouping, making it hard to understand what each entry represents and what its relationship to other entries is. The two-tab separation between sessions and conversations adds unnecessary context-switching when a user is thinking in terms of projects, not feed types.

## Solution Overview

Replace the Sessions + History tabs with a single **Projects** tab in Hub mode. Each project gets one accordion card showing its sessions (as status pills) and its most recent conversations (up to 5 inline). Tapping "See all" opens a new Project Detail screen with the full conversation list and a local search bar. A global search bar in the hub header searches across all projects simultaneously.

Classic mode (opt-in via Settings) preserves the existing Sessions + History flat lists exactly as they are today.

---

## Layout Modes

### Hub Mode (new default)

- Tab bar has **2 tabs**: Projects (📂) + Settings (⚙️)
- Sessions and History are unified under Projects
- Each project is an accordion card

### Classic Mode (opt-in)

- Tab bar has **3 tabs**: Sessions (⚡) + History (📚) + Settings (⚙️)
- Sessions and History screens are unchanged from today
- The only change in classic mode is the toolbar icons (Funnel + SortAscending replace "Filters" text)

### Settings Toggle

- Location: Settings screen → Appearance section
- Control: segmented picker "Hub | Classic"
- Default: `hub`
- Persisted key: `sessionsLayout: 'hub' | 'classic'` in `settings.ts` store + AsyncStorage

---

## Hub Mode — Screen 1: Projects Hub

### Header

```
Projects  [🔍] [+]
[⊜ Funnel]  [≡↑ Sort]        2/3 connected ●
```

- **🔍** (MagnifyingGlass, Phosphor): toggles a search bar that slides in below the header row, above the toolbar. Tapping again or pressing ✕ collapses it and clears the query.
- **+**: opens the existing NewSessionServerPicker modal (unchanged)
- **⊜ Funnel icon** (Phosphor `Funnel`): opens the existing `ServerFilterSheet` (unchanged behavior). Shows a blue active-state tint + 4px indicator dot when any filter is non-default.
- **≡↑ Sort icon** (Phosphor `SortAscending`): opens the new `SortSheet`. Shows active tint + dot when sort differs from default.

### Global Search Bar (when open)

- Slides in with a smooth height animation (LayoutAnimation or Reanimated)
- Placeholder: "Search sessions & conversations…"
- Searches both session `projectName`/`lastOutput` and conversation `title`/`preview`/`firstMessage`/`lastMessage`
- Results replace the hub accordion list with a flat results list grouped by type (Sessions / Conversations), each result showing its project name as a subtitle
- Debounce: 300ms (same as existing ConversationList search)

### Project Hub Cards

A `FlatList` of `ProjectHubCard` components, one per distinct `projectPath`.

**Grouping logic:** Group sessions and conversations by `projectPath`. Project name displayed is `projectPath.split('/').pop()` (same as current ConversationRow).

**Card header (always visible):**
```
📁 tb-mobile                    4 · 6  ▼
```
- Project name (left)
- Session count · Conversation count (right, secondary)
- Chevron: ▼ collapsed, ▲ expanded
- Tap header → toggle expand/collapse
- **Multiple cards can be open simultaneously** (no forced collapse of others)

**Card expanded — Sessions strip:**
```
SESSIONS
● In Progress   ◑ Idle   ✕ Failed ×2
```
- One pill per session (or grouped: "✕ Failed ×2" when multiple same status)
- Pill tap → navigates to `/session/[id]?server=[serverId]`
- Pills only shown if project has sessions

**Card expanded — Conversations list:**
- Up to 5 most-recent conversations, sorted by `lastActivity` descending
- Each row: title (1 line, truncated) + `branch · N msgs` subtitle + date (right)
- Row tap → `/conversation/[id]?server=[serverId]`
- If more than 5 exist: "See all N conversations →" link below the list
- If zero conversations: conversations section hidden entirely

**Collapsed cards** show only the header row (no sessions, no conversations).

### Session Status Pills in Hub

| Display label | Color | Condition |
|---|---|---|
| **In Progress** | Green `#30d158` | `status === 'running'` |
| **Idle** | Amber `#ff9f0a` | `status === 'idle'` or `status === 'waiting_input'` |
| **Empty** | Gray `#888` | `promptCount === 0` and status not `running` |
| **Failed** | Red `#ff375f` | `status === 'failed'` |
| **Completed** | Secondary gray | `status === 'completed'` |

Existing filter chips in `ServerFilterSheet` keep their current labels (`running`, `waiting_input`, etc.) — the simplified labels are only for the hub pill display.

### Hub Sort Options

Default sort for hub cards: **Last message date** (most recent conversation or session activity, descending).

Sort sheet options (see SortSheet section below):
- Project name (A→Z / Z→A)
- Last message date (newest first / oldest first) — **default**
- Created date (newest first / oldest first)
- Status (groups In Progress → Idle → Empty → Failed → Completed)

---

## Hub Mode — Screen 2: Project Detail

**Route:** `/project/[encodedProjectPath]` (new screen)

**Header:**
```
‹ Projects    tb-mobile
```

**Content:**
- Search bar (always visible, not toggleable — this is a search-centric screen)
- Full paginated conversation list for this project (reuses `ConversationList` component)
- Filtered by `projectPath`, otherwise identical behavior to the History tab
- Pull to refresh, infinite scroll, skeleton loading — all inherited from `ConversationList`

---

## Filter & Sort Toolbar

### Filter Icon (replaces "Filters" text)

- Component: Phosphor `Funnel` icon, 20px, `dark.text.accent` color
- Tappable area: 36×36 minimum
- Active state: icon color `#0a84ff`, background `#0a84ff18`, small 4px dot indicator top-right of button
- Active when: any status filter is non-default, or any server is hidden
- Opens: existing `ServerFilterSheet` (no behavior change)

### Sort Icon (new)

- Component: Phosphor `SortAscending` icon, 20px
- Tappable area: 36×36 minimum
- Active state: same blue tint + dot as filter
- Active when: sort differs from default (Last message, Descending)
- Opens: new `SortSheet`

### SortSheet

Same visual style as `ServerFilterSheet` (BottomSheet, `snapPoints: ['40%', '70%']`, backdrop, handle indicator).

**Sort by section** (single-select chips):
- Project name
- Last message date *(default)*
- Created date
- Status

**Order section** (single-select chips):
- ↑ Ascending
- ↓ Descending *(default)*

Apply/Cancel buttons (same pattern as filter sheet). Changes take effect on Apply.

`SortSheet` is used for **both** Hub mode and Classic mode Sessions screen. Classic History screen sort is handled by the existing mechanism (no change needed there since it already sorts by `lastActivity`).

---

## Data / Store Changes

### `settings.ts`

Add to `SettingsStore` interface:
```ts
sessionsLayout: 'hub' | 'classic'
setSessionsLayout: (v: 'hub' | 'classic') => void
```

Add to `PersistedSettings`:
```ts
sessionsLayout: 'hub' | 'classic'
```

Default: `'hub'`.

### Sort State

Sort state (`sortBy` + `sortOrder`) lives in the Sessions screen component state (same as current `sortType`), not in the settings store — it is session-level UI state, not a persistent preference. If persistence is desired later it can be added.

New `SortBy` type:
```ts
export type SortBy = 'projectName' | 'lastActivity' | 'startedAt' | 'status'
export type SortOrder = 'asc' | 'desc'
```

---

## New Components

### `ProjectHubList`

`components/sessions/hub/ProjectHubList.tsx`

- Receives: `sessions: MultiSession[]`, `conversations: MultiConversation[]`, `sortBy`, `sortOrder`
- Groups by `projectPath` → array of `ProjectGroup { projectPath, sessions, conversations }`
- Applies sort to the groups array
- Renders `FlatList<ProjectGroup>` of `ProjectHubCard`
- Manages accordion open state: `Set<string>` of open projectPaths (stored in `useState`)
- Manages global search query state + search bar visibility
- Passes `isOpen`, `onToggle` to each card

### `ProjectHubCard`

`components/sessions/hub/ProjectHubCard.tsx`

- Props: `group: ProjectGroup`, `isOpen: boolean`, `onToggle: () => void`
- Animated expand/collapse (LayoutAnimation.configureNext on toggle)
- Session pills strip (hidden if no sessions)
- Conversation rows (hidden if no conversations and no sessions strip would show)
- "See all" link (hidden if convos ≤ 5)

### `SessionStatusPill`

`components/sessions/hub/SessionStatusPill.tsx`

- Props: `session: MultiSession`
- Renders a colored pill with derived label (In Progress / Idle / Empty / Failed / Completed)
- Tappable, navigates to session

### `SortSheet`

`components/servers/SortSheet.tsx`

- Same structure as `ServerFilterSheet`
- Props: `visible`, `onClose`, `sortBy`, `onChangeSortBy`, `sortOrder`, `onChangeSortOrder`

---

## Navigation Changes

`app/(tabs)/_layout.tsx`:
- Hub mode: render 2 tabs (Projects, Settings). Sessions tab href becomes the hub. History tab is not rendered.
- Classic mode: render 3 tabs as today.
- Read `sessionsLayout` from settings store to decide.

New route: `app/project/[path].tsx`
- Stack screen (not a tab)
- Receives `path` param (URL-encoded `projectPath`)
- Shows project name in header with back button
- Renders `ConversationList` filtered by project

---

## What Does Not Change

- `SessionCard.tsx` — used unchanged in classic mode
- `ConversationList.tsx` and `ConversationRow` — used unchanged in classic History tab and project detail screen
- `/session/[id]` and `/conversation/[id]` detail screens — untouched
- `ServerFilterSheet` — content unchanged, only the trigger button changes (text → icon)
- All existing sort/filter behavior in Sessions classic mode is preserved
- Long-press session actions (copy ID, send input, cancel) — preserved in classic mode; in hub mode, long-press on a session pill triggers the same action sheet

---

## Open Questions Resolved

| Question | Decision |
|---|---|
| Multiple accordions open simultaneously? | Yes — no forced collapse |
| History tab in hub mode? | Removed; lives inside Project Hub cards + Project Detail screen |
| Search in hub? | Header 🔍 icon for global search; Project Detail has persistent local search |
| Sort persistence? | Component state only (not persisted to AsyncStorage) |
| Tab count in hub mode? | 2 tabs: Projects + Settings |
