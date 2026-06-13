# Homepage Server State Scenarios

Reference for every UI state the homepage (`app/index.tsx`) can be in, based on the full Cartesian product of server state dimensions. Use this document to identify missing UI coverage and regression-test connectivity edge cases.

---

## 1. State Dimensions

Each server has three independent state dimensions:

| Dimension | Values | Source |
|-----------|--------|--------|
| **WS status** | `connecting` \| `connected` \| `disconnected` | `wsManager.status(id)` |
| **HTTP fetch status** | `ok` (default) \| `error` | `useServerFetchStatusStore` → `fetchStatuses[id].status` |
| **Visibility** | visible (in `displayedServerIds`) \| hidden (filtered out) | `useServersStore` → `displayedServerIds` |

A server only enters the state space at all if it is in `activeServerIds`. Hidden means it is in `activeServerIds` but not in `displayedServerIds` (the user toggled it off in FilterSortSheet).

### Derived aggregate values (computed in `app/index.tsx`)

```
healthyCount = count of activeServerIds where wsOk && fetchOk
serverCount  = activeServerIds.length

allConnected  = healthyCount === serverCount && serverCount > 0
someConnected = healthyCount > 0
```

The fetch status defaults to `ok` until a real failure is recorded — a server that has never fetched is treated as healthy from the header dot's perspective.

---

## 2. UI Components That React to Server State

| Component | What it shows | When it appears |
|-----------|---------------|-----------------|
| **Header cloud dot** | None / amber / red badge on the `Cloud` icon | Always visible; dot appears when not `allConnected` |
| **SessionsLoadingOverlay** | Full-screen scrim with spinner, "Loading (X/Y)", server label, progress bar | When `!sessionsDone` (`isDone` from `useEagerSessions`) |
| **Sessions list** | Cards for visible sessions only | Always rendered; empty if no visible sessions |
| **FAB** | Teal `+` button, always rendered | Always visible; press is a silent no-op when `activeServerIds.length === 0` |
| **ServerStatusModal** | Per-server dot + label, error detail text | On demand — opened by tapping the `Cloud` icon |

**Components that do NOT exist (no banners):**

- No `ServerIndexingBanner`
- No `ServerErrorBanner`
- No toast or inline error state

All degraded-connection feedback is gated behind tapping the Cloud icon to open `ServerStatusModal`.

---

## 3. Single-Server Scenarios

### 3.0 — No servers configured

**Condition:** `activeServerIds.length === 0`

| UI element | State |
|------------|-------|
| Header dot | None (no dot) |
| Sessions list | Empty (no sessions to show) |
| Loading overlay | Hidden (`sessionsDone` is immediately `true` with no servers to paginate) |
| FAB | Rendered, always visible — but press is a **silent no-op** |
| StatusModal (if opened) | Shows "No servers configured" empty state text |

**UX gap:** FAB looks tappable but does nothing. There is no empty-state prompt guiding the user to add a server.

---

### 3.1 — Server: Connecting

**Condition:** WS=`connecting`, fetch=`ok` (default, no request completed yet)

| UI element | State |
|------------|-------|
| Header dot | **Red** — `healthyCount=0` (WS not yet `connected`), `someConnected=false` → red |
| Sessions list | Empty (WS not yet open, no sessions fetched) |
| Loading overlay | Visible — `useEagerSessions` starts paginating; overlay shows indeterminate state until first page returns |
| FAB | Rendered and pressable → navigates to `/browse` |
| StatusModal | Amber dot, label **"Connecting…"** |

> **Note on dot color during connect:** The header dot logic uses `dark.status.failed` (red) when `someConnected=false`. Even a server that is actively connecting shows as red at the header level. The amber dot for "connecting" only appears in the per-server row inside `ServerStatusModal`. This means normal app startup looks like an error state in the header until WS connects and a fetch completes.

**UX gap:** Red dot during normal startup may look like an error. There is no transient "connecting" amber at the header level.

---

### 3.2 — Server: Connected, sessions loading

**Condition:** WS=`connected`, fetch=`ok`, `isDone=false`

| UI element | State |
|------------|-------|
| Header dot | **None** — `allConnected=true` |
| Sessions list | Partially populated as pages arrive |
| Loading overlay | **Visible** — spinner, "Loading (X/Y)", "Fetching from [server label]", progress bar fills as pages return |
| FAB | Rendered and pressable |
| StatusModal | Green dot, **"Connected"** |

---

### 3.3 — Server: Connected, sessions fully loaded

**Condition:** WS=`connected`, fetch=`ok`, `isDone=true`

| UI element | State |
|------------|-------|
| Header dot | **None** |
| Sessions list | All sessions visible and sorted |
| Loading overlay | **Hidden** |
| FAB | Rendered and pressable |
| StatusModal | Green dot, **"Connected"** |

This is the nominal "all good" state.

---

### 3.4 — Server: Disconnected (clean)

**Condition:** WS=`disconnected`, fetch=`ok`

| UI element | State |
|------------|-------|
| Header dot | **Red** — `someConnected=false` |
| Sessions list | Previously fetched sessions remain visible (cached in React Query / Zustand) |
| Loading overlay | Hidden (if sessions were already loaded before disconnect) |
| FAB | Rendered and pressable (navigates to `/browse`, which will itself fail) |
| StatusModal | Red dot, **"Disconnected"** |

**UX gap:** FAB still navigates to `/browse` on a disconnected server. No in-app feedback until the user actually tries to browse or create a session.

---

### 3.5 — Server: Fetch error while WS connected

**Condition:** WS=`connected`, fetch=`error`

| UI element | State |
|------------|-------|
| Header dot | **Red** — `fetchOk=false` → `healthyCount=0` → `someConnected=false` → red |
| Sessions list | Last successfully fetched sessions remain (stale data) |
| Loading overlay | May be hidden (if pagination had previously completed) |
| FAB | Rendered and pressable |
| StatusModal | Amber dot, **"Fetch failed"** + error detail text |

> **Dot color mismatch:** Header shows **red** (no healthy servers) but modal shows **amber** for this combination (WS connected + HTTP failing). The header and modal use different color logic.

**UX gap:** Stale session data is shown silently; only the red header dot and modal (on demand) indicate the problem.

---

### 3.6 — Server: Unreachable

**Condition:** WS=`disconnected`, fetch=`error`

| UI element | State |
|------------|-------|
| Header dot | **Red** — `someConnected=false` |
| Sessions list | Last cached sessions visible (or empty on first boot) |
| Loading overlay | Hidden (pagination won't start or will have failed) |
| FAB | Rendered and pressable |
| StatusModal | Red dot, **"Unreachable"** + error detail text |

**UX gap:** Same as 3.4 and 3.5 — no inline banner. The only proactive signal is the red dot.

---

## 4. Two-Server Scenarios

Notation: `[WS/fetch]` per server, e.g. `[connected/ok]`. Both servers are in `activeServerIds` and visible unless noted.

### 4.1 — Both connected + ok

**Condition:** Server A `[connected/ok]`, Server B `[connected/ok]`, both visible

| UI element | State |
|------------|-------|
| Header dot | **None** — `allConnected=true` |
| Sessions list | Sessions from A and B, interleaved by sort order |
| Loading overlay | Visible until both servers finish paginating, then hidden |
| FAB | Tapping opens `NewSessionServerPicker` (multi-server picker) |
| StatusModal | Both rows: green dot, **"Connected"** |

---

### 4.2 — One connected, one connecting

**Condition:** Server A `[connected/ok]`, Server B `[connecting/ok]`

| UI element | State |
|------------|-------|
| Header dot | **Amber** — `healthyCount=1`, `someConnected=true`, not `allConnected` |
| Sessions list | Server A's sessions visible; Server B's arrive once WS connects and pages load |
| Loading overlay | Visible while either server is still paginating |
| FAB | Multi-server picker opens (both are active) |
| StatusModal | A: green "Connected"; B: amber "Connecting…" |

---

### 4.3 — One connected, one disconnected

**Condition:** Server A `[connected/ok]`, Server B `[disconnected/ok]`

| UI element | State |
|------------|-------|
| Header dot | **Amber** — `healthyCount=1`, `someConnected=true`, not `allConnected` |
| Sessions list | Server A sessions live; Server B sessions stale/cached |
| Loading overlay | Hidden (if both servers previously completed pagination) |
| FAB | Multi-server picker opens |
| StatusModal | A: green "Connected"; B: red "Disconnected" |

---

### 4.4 — One connected, one unreachable

**Condition:** Server A `[connected/ok]`, Server B `[disconnected/error]`

| UI element | State |
|------------|-------|
| Header dot | **Amber** — `healthyCount=1`, `someConnected=true` |
| Sessions list | Server A sessions live; Server B sessions stale (or empty on first boot) |
| Loading overlay | Hidden |
| FAB | Multi-server picker opens |
| StatusModal | A: green "Connected"; B: red "Unreachable" + error text |

---

### 4.5 — Both unreachable

**Condition:** Server A `[disconnected/error]`, Server B `[disconnected/error]`

| UI element | State |
|------------|-------|
| Header dot | **Red** — `someConnected=false` |
| Sessions list | Both servers' stale cached sessions (or empty on first boot) |
| Loading overlay | Hidden |
| FAB | Multi-server picker opens (both technically active), but any pick will fail at `/browse` |
| StatusModal | A: red "Unreachable"; B: red "Unreachable" |

**UX gap:** FAB picker still opens and lets the user pick a server, which will fail silently in `/browse`.

---

### 4.6 — One connected + ok, one hidden

**Condition:** Server A `[connected/ok]` visible, Server B `[connected/ok]` hidden (filtered out)

| UI element | State |
|------------|-------|
| Header dot | **None** — both servers in `activeServerIds`, `healthyCount=2=serverCount` → `allConnected=true` |
| Sessions list | Only Server A's sessions (B's filtered out by `displayedServerIds`) |
| Loading overlay | Visible until both servers finish paginating (hidden servers are still paginated) |
| FAB | Multi-server picker opens for both A and B (picker uses `activeServerIds`, not `displayedServerIds`) |
| StatusModal | Both rows: green "Connected" |

> **Key nuance:** Hiding a server does not affect `activeServerIds`. Both servers are still paginated and both count toward `healthyCount`. A hidden server can still be picked in the FAB server picker.

---

### 4.7 — One connecting, one hidden (connected)

**Condition:** Server A `[connecting/ok]` visible, Server B `[connected/ok]` hidden

| UI element | State |
|------------|-------|
| Header dot | **Amber** — `healthyCount=1` (B connected+ok), `serverCount=2`, `someConnected=true`, not `allConnected` |
| Sessions list | No sessions yet from A (still connecting); B's sessions filtered out |
| Loading overlay | Visible |
| FAB | Multi-server picker |
| StatusModal | A: amber "Connecting…"; B: green "Connected" |

---

### 4.8 — One unreachable (visible), one hidden (connected)

**Condition:** Server A `[disconnected/error]` visible, Server B `[connected/ok]` hidden

| UI element | State |
|------------|-------|
| Header dot | **Amber** — `healthyCount=1` (B), `someConnected=true`, not `allConnected` |
| Sessions list | Server A stale/empty sessions only (B hidden) |
| Loading overlay | Hidden (if A previously completed or failed pagination) |
| FAB | Multi-server picker for both A and B |
| StatusModal | A: red "Unreachable"; B: green "Connected" |

---

### 4.9 — One connected + ok, one fetch-failed while connected

**Condition:** Server A `[connected/ok]`, Server B `[connected/error]`

| UI element | State |
|------------|-------|
| Header dot | **Amber** — `healthyCount=1` (A only), `someConnected=true` |
| Sessions list | Server A sessions live; Server B stale |
| Loading overlay | Hidden or retrying depending on session pagination state |
| FAB | Multi-server picker |
| StatusModal | A: green "Connected"; B: amber "Fetch failed" + error detail |

---

### 4.10 — Both connected + fetch-failed

**Condition:** Server A `[connected/error]`, Server B `[connected/error]`

| UI element | State |
|------------|-------|
| Header dot | **Red** — `healthyCount=0`, `someConnected=false` |
| Sessions list | Both stale (last good cache) |
| Loading overlay | Hidden |
| FAB | Multi-server picker |
| StatusModal | A: amber "Fetch failed"; B: amber "Fetch failed" |

> **Color mismatch:** Header shows **red** (no healthy servers) but modal shows **amber** for each server (WS connected + HTTP failing). The header `someConnected=false` path always uses the failure color regardless of WS state.

---

### 4.11 — Both disconnected (no error)

**Condition:** Server A `[disconnected/ok]`, Server B `[disconnected/ok]`

| UI element | State |
|------------|-------|
| Header dot | **Red** — `someConnected=false` |
| Sessions list | Both stale cached sessions |
| Loading overlay | Hidden |
| FAB | Multi-server picker |
| StatusModal | A: red "Disconnected"; B: red "Disconnected" |

---

### 4.12 — Three-server edge: one connected, one unreachable, one hidden

**Condition:** Server A `[connected/ok]` visible, Server B `[disconnected/error]` visible, Server C `[connected/ok]` hidden

| UI element | State |
|------------|-------|
| Header dot | **Amber** — `healthyCount=2` (A and C), `serverCount=3`, `someConnected=true`, not `allConnected` |
| Sessions list | A sessions (live), B sessions (stale/empty) — C hidden |
| Loading overlay | Hidden (if A, B, C done paginating) |
| FAB | Three-server picker (all three in `activeServerIds`) |
| StatusModal | A: green; B: red "Unreachable"; C: green |

---

## 5. Loading Overlay Scenarios

The `SessionsLoadingOverlay` is controlled by the `isDone` flag from `useEagerSessions`. It appears at `zIndex: 50` covering the full screen with a semi-transparent scrim.

### 5.1 — First boot, no cache

**Condition:** App launched for the first time, no persisted React Query cache

- `isDone = false` immediately on mount
- Overlay appears with indeterminate bar (total=0 until first page returns)
- Title: "Loading sessions" (no ratio until `total > 0`)
- Subtitle: "Fetching from [server label]" once the current server is known
- Progress bar: empty until `total > 0`

---

### 5.2 — Cache hit on launch

**Condition:** App re-launched, React Query cache is warm (stale but present)

- Cached sessions render immediately in the list
- `isDone` may briefly be `false` while background revalidation runs
- If cache is fresh, overlay may not appear at all or flashes briefly
- If cache is stale and full revalidation runs, overlay appears as in 5.1

---

### 5.3 — Manual pull-to-refresh

**Condition:** User pulls down on the sessions list

- `handleSessionsRefresh` calls `refetchSessions()`
- `manualRefreshing = true` → shows `RefreshControl` spinner in the list header
- `isDone` resets to `false` → `SessionsLoadingOverlay` reappears over the stale list
- Both `RefreshControl` and the full-screen overlay are visible simultaneously during the refetch
- When pagination completes: overlay hides, `manualRefreshing = false` → `RefreshControl` hides

---

### 5.4 — Multi-server sequential pagination

**Condition:** Two+ servers configured, `useEagerSessions` paginates them sequentially

- Overlay visible throughout; server label updates as each server becomes current
- Progress counters are global: `loaded` and `total` accumulate across all servers
- Between servers (after server A finishes, before server B's first page returns), `total` reflects the running global total and `currentServerLabel` updates to B
- Overlay hides once the last server's last page has returned

---

### 5.5 — Pagination with hidden server

**Condition:** Server B is hidden (`displayedServerIds` excludes it) but in `activeServerIds`

- `useEagerSessions` still paginates Server B (it uses `activeServerIds`, not `displayedServerIds`)
- Overlay shows Server B's label while fetching even though B's sessions will not appear in the list
- **UX inconsistency:** The overlay says "Fetching from [B]" but no sessions from B will appear once the overlay disappears.

---

### 5.6 — Pagination complete

**Condition:** All servers' sessions fetched, `isDone = true`

- Overlay hidden (`return null` in `SessionsLoadingOverlay`)
- Sessions list is fully populated and scrollable
- Normal operation resumes

---

## 6. Currently Implemented UI vs Gaps

### Summary: what each scenario proactively shows

| Scenario | Proactive signal | On-demand signal (tap Cloud icon) |
|----------|-----------------|-----------------------------------|
| All connected + loaded | Nothing (clean state) | All rows green "Connected" |
| Any server connecting | Red header dot | Amber dot per connecting server in modal |
| Any server disconnected | Amber or red dot | Red "Disconnected" per server |
| Any fetch error | Amber or red dot | Amber/red "Fetch failed" / "Unreachable" + error text |
| Sessions loading | Full-screen overlay with progress bar | N/A (overlay is proactive) |
| No servers configured | Nothing | Modal shows empty-state text |

### UX gaps

| Gap | Scenario(s) | Description |
|-----|-------------|-------------|
| **Silent FAB on no servers** | 3.0 | FAB is always rendered and appears interactive, but pressing it executes `if (activeServerIds.length === 0) return` with no feedback. No empty-state prompt to add a server. |
| **Red dot on first connect** | 3.1 | During normal startup `healthyCount=0` immediately, so the dot turns red. It does not show amber or nothing while connecting — only the per-server modal row is amber. Users may misread this as an error. |
| **FAB navigates into failing servers** | 3.4, 3.5, 3.6, 4.5 | When all active servers are down or unreachable, FAB still opens the picker/browse screen. The failure surfaces only after the user picks a server and the browse screen fails. |
| **Overlay fetches hidden servers** | 5.5 | Loading overlay shows a hidden server's label and counts its sessions in the progress meter, but none of those sessions will appear in the list after the overlay dismisses. |
| **Stale data shown without staleness indicator** | 3.4, 3.5, 3.6, 4.5, 4.10, 4.11 | Cached sessions from a failed/disconnected server remain in the list with no visual marker. The header dot is the only signal, and only if the user notices and acts on it. |
| **Header dot color mismatch vs modal** | 3.5, 4.10 | WS=`connected` + fetch=`error`: header shows **red** (0 healthy servers) but modal shows **amber** per server. The header red implies "nothing working" which conflicts with the amber "partial problem" framing in the modal. |
| **No reconnecting indicator** | Post-disconnect reconnect | After disconnect + reconnect cycle, the dot stays red until WS is `connected` AND a fetch succeeds. There is no visible "reconnecting" transition state in the header. |
| **No error count in dot** | All multi-server error states | The amber/red dot gives no count. With 3+ servers, users cannot tell from the dot alone how many servers are failing. |
