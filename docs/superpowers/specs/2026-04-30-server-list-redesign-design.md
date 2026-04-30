# Server List Redesign — Design Spec
**Date:** 2026-04-30  
**Status:** Approved

---

## Overview

Redesign the server list in the Settings screen to:
1. Replace the bottom "Remove" button with three inline icon action buttons (Delete, Edit, Refresh) placed in the card header row
2. Add a connection error indicator icon that opens a read-only error detail modal
3. Add a unified Add/Edit Server modal (replaces the onboarding navigation flow)
4. Support pull-to-refresh on the servers section to refresh all server infos
5. Migrate all icons in the app to `phosphor-react-native`

---

## Section 1 — Icon Library Migration

### Package
Add `phosphor-react-native` as the single icon library. Remove dependency on `@expo/vector-icons` (Ionicons) across all files.

### Icon mapping

| Purpose | Phosphor icon |
|---|---|
| Back navigation | `CaretLeft` |
| Three dots menu | `DotsThree` |
| Delete server | `Trash` |
| Edit server | `PencilSimple` |
| Refresh server info | `ArrowsClockwise` |
| Connection error indicator | `XCircle` (filled, `dark.text.danger`) |
| Close modal | `X` |
| Show/hide API key | `Eye` / `EyeSlash` |
| QR scan | `QrCode` |

### Files to update
- `app/_layout.tsx` — `chevron-back` → `CaretLeft`
- Any other `Ionicons` usages found across the codebase

---

## Section 2 — ServerListCard Redesign

### Layout

The bottom "Remove" button row is removed entirely. Actions move into the card header row, right-aligned.

**Normal state (no error):**
```
┌─────────────────────────────────────────┐
│ ● Production          [🗑] [✏] [↻]      │
│   http://192.168.1.10:7070              │
│   mac-pro · macOS · v1.4.2              │
└─────────────────────────────────────────┘
```

**Error state:**
```
┌─────────────────────────────────────────┐
│ ● Dev Laptop    [✕] [🗑] [✏] [↻]       │
│   http://192.168.1.20:7070              │
│   Disconnected                          │
└─────────────────────────────────────────┘
```

### Header row structure
`[status dot] [server name — flex:1] [icon buttons — flex-shrink:0]`

### Icon buttons
- 32×32 touchable area, transparent background
- Subtle highlight on press (`rgba(255,255,255,0.07)`, danger buttons `rgba(248,81,73,0.12)`)
- Colors:
  - `Trash` → `dark.text.danger` (`#f85149`)
  - `PencilSimple` → `dark.text.accent` (`#58a6ff`)
  - `ArrowsClockwise` → `dark.text.secondary` (`#7d8590`)
  - `XCircle` → `dark.text.danger` (`#f85149`) — only rendered when `server.connectionError` is set

### Button behaviors
- **Delete (`Trash`):** `Alert.alert` confirm dialog → `removeServer()`. If last server, redirect to onboarding.
- **Edit (`PencilSimple`):** opens `ServerEditModal` pre-filled with current server values.
- **Refresh (`ArrowsClockwise`):** calls `refreshServerInfo(serverId)`. While in-flight: icon dims to 40% opacity, non-interactive.
- **Error (`XCircle`):** opens `ServerErrorModal` for that server. Only visible when `server.connectionError !== null`.

### Props
```ts
interface Props {
  server: ServerConfig
  onRemove: (serverId: string) => void
  onEdit: (serverId: string) => void
  onRefresh: (serverId: string) => void
  onViewError: (serverId: string) => void
}
```

---

## Section 3 — Pull-to-Refresh on Servers Section

The `ScrollView` in `app/(tabs)/settings.tsx` gains a `RefreshControl` prop.

**Behavior:** on pull-down, calls `refreshServerInfo(serverId)` for every server in `activeServerIds` in parallel (`Promise.all`). The spinner remains visible until all settle.

### `refreshServerInfo(serverId)` store action
1. HTTP GET `{server.url}/api/info` with the server's API key (using `createApiForServer`)
2. **On success:** update `serverInfo`, set `connectionError: null`, persist
3. **On failure:** set `connectionError` to the error message string, clear `serverInfo` fields (set to `null`), persist

### Persistence
`connectionError` is persisted in SecureStore alongside the server list. On app relaunch, servers that had a connection error last session show the `XCircle` immediately, before any reconnect attempt. A successful Refresh or WS reconnect clears it.

---

## Section 4 — Error Modal (`ServerErrorModal`)

A centered modal (`Modal`, `transparent`, dark overlay). Opens when user taps the `XCircle` icon on a server card. Dismissed by tapping the backdrop, the `X` top-right button, or the `Close` bottom button.

### Layout
```
┌─────────────────────────────────────────┐
│                              [X]        │
│  ● Dev Laptop                           │
│                                         │
│  URL      http://192.168.1.20:7070      │
│  API Key  ••••••••  (last 4 visible)    │
│  Machine  —                             │
│  Platform —                             │
│  Version  —                             │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ ✕  Failed to reach server —    │    │
│  │    ECONNREFUSED (scrollable)    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │             Close               │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Details
- Server name + status dot at top
- Detail rows: URL (monospace), API key masked (`••••••••` + last 4 chars), Machine / Platform / Version from `serverInfo` (shows `—` when null)
- Error box: `rgba(248,81,73,0.08)` background, `rgba(248,81,73,0.25)` border, `XCircle` icon + full `connectionError` string. Scrollable if error is long.
- `X` top-right: 44×44 tap target
- `Close` button at the bottom
- Tapping backdrop dismisses
- Modal is **read-only** — no actions other than dismiss

### Props
```ts
interface Props {
  visible: boolean
  server: ServerConfig | null
  onClose: () => void
}
```

---

## Section 5 — Add/Edit Server Modal (`ServerEditModal`)

Same modal style as Error Modal (centered, dark overlay, `Animated.spring`). Used for both **Add Server** and **Edit Server**. Replaces the `router.push('/onboarding?mode=add')` call in settings.

### Layout
```
┌─────────────────────────────────────────┐
│  Add Server / Edit Server     [X]       │
│                                         │
│  Label (optional)              [▣]      │
│  ┌─────────────────────────────────┐    │
│  │ Production                      │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Server URL                             │
│  ┌─────────────────────────────────┐    │
│  │ http://192.168.1.10:7070        │    │
│  └─────────────────────────────────┘    │
│                                         │
│  API Key                                │
│  ┌─────────────────────────────────┐    │
│  │ ••••••••••••••••         [👁]   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─ inline error (when present) ───┐    │
│  │ ✕  A server with this URL and  │    │
│  │    API key already exists       │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │            Save                 │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Field details
- **Label:** optional, plain text input
- **Server URL:** `keyboardType="url"`, `autoCapitalize="none"`, `autoCorrect={false}`
- **API Key:** `secureTextEntry` by default; `Eye`/`EyeSlash` Phosphor icon toggles visibility
- **QR icon (`QrCode`, 18px, `dark.text.accent`):** sits right-aligned on the "Label" label row. Taps open existing `PairScannerModal`. On successful scan, pre-fills URL and API Key fields then returns to this modal.

### Validation & save
- **Duplicate check:** on Save, compare normalised URL + API key against all existing servers, excluding the server currently being edited. If match found → show inline red error box (same style as error modal error box). Modal stays open.
- **Edit with URL change:** `serverIdFromUrl` will produce a different ID. `editServer` action removes old entry and inserts new one at the same position in `activeServerIds` and `displayedServerIds`, reconnects WS with new credentials.
- **Discard confirmation:** if any field was modified, tapping `X` or the backdrop shows `Alert.alert("Discard changes?")` before dismissing.
- On successful save: dismiss modal, update store, reconnect WS.

### Props
```ts
interface Props {
  visible: boolean
  /** null = Add mode, string = Edit mode (serverId) */
  serverId: string | null
  onClose: () => void
}
```

---

## Section 6 — Store & Type Changes

### `types/api.ts`

**`ServerConfig`** — add:
```ts
connectionError: string | null
```

**`PersistedServer`** (internal to `stores/servers.ts`) — add:
```ts
connectionError?: string
```

### `stores/servers.ts`

| Change | Detail |
|---|---|
| `loadPersistedServers` | Read `connectionError` from persisted data and restore it on each `ServerConfig` |
| `persistServerList` | Write `connectionError` per server into the SecureStore payload |
| `addServer` | Before creating, check for duplicate (same normalised URL + same API key). Return `{ error: 'duplicate' }` instead of throwing so the modal can show it inline |
| Add `refreshServerInfo(serverId)` | GET `/api/info`, update `serverInfo` + `connectionError`, persist |
| Add `editServer(serverId, patch)` | `patch: { url, apiKey, label }`. Handles ID change: remove old entry, insert new at same position. Reconnects WS. Persists. |

### `app/(tabs)/settings.tsx`

- `ScrollView` → add `RefreshControl` (pull triggers `Promise.all` of `refreshServerInfo` for all `activeServerIds`)
- `+ Add Server` button → opens `ServerEditModal` with `serverId={null}`
- Pass `onEdit`, `onRefresh`, `onViewError` callbacks into each `ServerListCard`
- Manage modal visibility state: `editServerId: string | null | 'new'`, `errorServerId: string | null`

### New components

| File | Purpose |
|---|---|
| `components/servers/ServerEditModal.tsx` | Add/Edit modal (Section 5) |
| `components/servers/ServerErrorModal.tsx` | Error detail modal (Section 4) |

---

## Out of scope

- Reordering servers (drag-and-drop)
- Per-server toggle visibility (already handled by Displayed Servers section)
- Any changes to the onboarding flow itself (only the settings screen `+ Add Server` button is redirected to the new modal)
