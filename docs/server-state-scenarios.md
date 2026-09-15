# Homepage Server State Scenarios

Reference for every UI state the homepage (`app/index.tsx`) can be in, based on the Cartesian product of server state dimensions. Use this document to identify missing UI coverage and regression-test connectivity edge cases.

The header has **no** server-status bell, cloud icon, or coloured dot. Connectivity is:

- **Banners** in the scrolling list header (`ServerOfflineBanner`, `ServerWarmingBanner`, `ServerUnsupportedBanner`, plus `ServerIndexingBanner`)
- **`ServerStateMessage`**, a home-viewport toast (not a header control)
- **`ServersStatusModal`**, opened from that toast, the all-offline empty state’s Details action, or other “view details” affordances

---

## 1. State Dimensions

Each server has three independent state dimensions:

| Dimension | Values | Source |
|-----------|--------|--------|
| **WS status** | `connecting` \| `connected` \| `disconnected` | `wsManager.status(id)` |
| **HTTP fetch status** | `ok` (default) \| `error` \| `warming_up` | `useServerFetchStatusStore` → `fetchStatuses[id].status` |
| **Visibility** | visible (in `displayedServerIds`) \| hidden (filtered out) | `useServersStore` → `displayedServerIds` |

A server only enters the state space at all if it is in `activeServerIds`. Hidden means it is in `activeServerIds` but not in `displayedServerIds` (the user toggled it off in FilterSortSheet).

Fetch status defaults to `ok` until a real failure or warmup is recorded.

### Derived values in `app/index.tsx`

The homepage no longer computes `healthyCount` / `allConnected` / `someConnected`. Aggregates that still exist:

```
allServersFailed = activeServerIds.length > 0
  && sessionsDone
  && every active server has fetchStatuses[id].status === 'error'

warmingServerIds = activeServerIds where fetchStatuses[id].status === 'warming_up'
```

`ServerStateMessage` classifies each active server locally (healthy / unreachable / fetch-failed / disconnected / connecting / indexing) to pick toast copy. `ServersStatusModal` paints its own per-row dots from WS + fetch status.

---

## 2. UI Components That React to Server State

| Component | What it shows | When it appears |
|-----------|---------------|-----------------|
| **Header** | Brand, `Now \| Projects`, search / filter / settings | Always. No connectivity glyph. |
| **`ServerStateMessage`** | Home toast: connecting / disconnected / unreachable / refresh-failed / indexing | Info toasts wait 2s; warning and error are immediate. Tap opens `ServersStatusModal`; Retry calls `retryFailed()`. Renders nothing of its own (`return null`). |
| **`ServerOfflineBanner`** | “Server unreachable” + host label + Retry | One per active server whose fetch status is `error`, unless the all-offline empty state replaced the list. |
| **`ServerWarmingBanner`** | “Server is warming up” + host label | One per active server whose fetch status is `warming_up`. Now-list history also becomes skeleton rows for those ids. |
| **`ServerUnsupportedBanner`** | “Server needs an update” | One per `unsupportedServerIds` host (when fetch is not already `error` / `warming_up`). |
| **`ServerIndexingBanner`** | Scan progress while a displayed host is `warming_up` | Same fetch status as `ServerWarmingBanner`; can appear together with it. |
| **`LoadingOverlay`** (`testID` `sessions-loading-overlay`) | Full-screen scrim, spinner, sessions progress | Only when there is **no** cached list data **and** sessions (or grouped summaries) are still fetching. |
| **`SyncCachedNotice`** | “Showing cached data” | Background refresh with a warm cache, single-server only. |
| **Sessions list** | Now or Projects rows for visible sessions | Replaced by `NoServersWelcome` or the all-offline `EmptyState` in those two empty cases. |
| **FAB** | `+` new session. Hides on scroll-down, reveals on tab switch / scroll-up. | Press with no servers shows a toast (`sessions:fab.noServerHint`). Press toward an unreachable host opens `ServerErrorModal` instead of Browse. |
| **`ServersStatusModal`** | Per-server dot + label + error detail | On demand — toast tap, all-offline Details, not from the header. |
| **`NoServersWelcome`** | Add-a-server empty state | `activeServerIds.length === 0` and the user has never had a server. |
| **All-offline `EmptyState`** | “Can’t connect to your servers” + Details + Retry | `allServersFailed`. Details opens `ServersStatusModal`. |

`ServerErrorBanner` exists as a component but is **not** mounted on the homepage. Offline hosts use `ServerOfflineBanner`.

---

## 3. Single-Server Scenarios

### 3.0 — No servers configured

**Condition:** `activeServerIds.length === 0`

| UI element | State |
|------------|-------|
| Header | Search / filter / settings. No status control. |
| Connectivity | `NoServersWelcome`. No banners, no toast. |
| Sessions list | Replaced by the welcome card. |
| Loading overlay | Hidden (`sessionsDone` is immediately `true` with no servers to paginate). |
| FAB | Rendered; press shows `sessions:fab.noServerHint` (not a silent no-op). |
| ServersStatusModal (if opened) | Shows “No servers configured” empty state text. |

---

### 3.1 — Server: Connecting

**Condition:** WS=`connecting`, fetch=`ok` (default, no request completed yet)

| UI element | State |
|------------|-------|
| Header | Search / filter / settings. No status control. |
| Connectivity | `ServerStateMessage` info toast after 2s (“Connecting to [server]…”). No per-host banner. |
| Sessions list | Empty until the first page returns. |
| Loading overlay | Visible if there is no cached data. |
| FAB | Pressable → `/browse` once WS is up enough to not trip `connectionError`. |
| ServersStatusModal | Amber dot, label **“Connecting…”** |

---

### 3.2 — Server: Connected, sessions loading

**Condition:** WS=`connected`, fetch=`ok`, sessions not done

| UI element | State |
|------------|-------|
| Header | No status control. Single-server background refresh may show a header spinner. |
| Connectivity | None. |
| Sessions list | Cached rows if any; otherwise empty under the overlay. |
| Loading overlay | **Visible** only when `!hasCachedData`. Warm cache uses `SyncCachedNotice` / header spinner instead. |
| FAB | Rendered and pressable. |
| ServersStatusModal | Green dot, **“Connected”** |

---

### 3.3 — Server: Connected, sessions fully loaded

**Condition:** WS=`connected`, fetch=`ok`, `sessionsDone=true`

| UI element | State |
|------------|-------|
| Header | No status control. |
| Connectivity | None. |
| Sessions list | All sessions visible and sorted. |
| Loading overlay | **Hidden** |
| FAB | Rendered and pressable. |
| ServersStatusModal | Green dot, **“Connected”** |

This is the nominal “all good” state.

---

### 3.4 — Server: Disconnected (clean)

**Condition:** WS=`disconnected`, fetch=`ok`

| UI element | State |
|------------|-------|
| Header | No status control. |
| Connectivity | `ServerStateMessage` warning toast (“Disconnected from [server]…”). No `ServerOfflineBanner` (fetch is still `ok`). |
| Sessions list | Previously fetched sessions remain visible (cached). |
| Loading overlay | Hidden if sessions were already loaded before disconnect. |
| FAB | Pressable; if `connectionError` is set, `ServerErrorModal` instead of Browse. |
| ServersStatusModal | Red dot, **“Disconnected”** |

---

### 3.5 — Server: Fetch error while WS connected

**Condition:** WS=`connected`, fetch=`error`

| UI element | State |
|------------|-------|
| Header | No status control. |
| Connectivity | `ServerOfflineBanner` + `ServerStateMessage` error toast. If this is the only active server and `sessionsDone`, the list is replaced by the all-offline `EmptyState` (banners are not shown). |
| Sessions list | Last successfully fetched sessions remain (stale), unless all-offline empty state. |
| Loading overlay | Hidden once pagination has failed or completed. |
| FAB | Pressable; unreachable hosts open `ServerErrorModal`. |
| ServersStatusModal | Amber dot, **“Fetch failed”** + error detail text. |

---

### 3.6 — Server: Unreachable

**Condition:** WS=`disconnected`, fetch=`error`

| UI element | State |
|------------|-------|
| Header | No status control. |
| Connectivity | Same as 3.5: banner + error toast, or all-offline `EmptyState` when this is the only active server and fetches have finished. |
| Sessions list | Last cached sessions (or empty on first boot / all-offline empty state). |
| Loading overlay | Hidden. |
| FAB | Pressable; Browse is blocked by `ServerErrorModal`. |
| ServersStatusModal | Red dot, **“Unreachable”** + error detail text. |

---

### 3.7 — Server: Warming up

**Condition:** fetch=`warming_up` (WS typically `connected`)

| UI element | State |
|------------|-------|
| Header | No status control. |
| Connectivity | `ServerWarmingBanner` + `ServerIndexingBanner` + `ServerStateMessage` info toast after 2s (indexing / building history). |
| Sessions list | Live session cards stay; conversation history for that host becomes skeleton rows (`warmingServerIds`). |
| Loading overlay | Follows the cache/fetching rule in §5. |
| FAB | Rendered and pressable. |
| ServersStatusModal | Row follows WS; fetch is not `error`. |

---

## 4. Two-Server Scenarios

Notation: `[WS/fetch]` per server, e.g. `[connected/ok]`. Both servers are in `activeServerIds` and visible unless noted.

### 4.1 — Both connected + ok

**Condition:** Server A `[connected/ok]`, Server B `[connected/ok]`, both visible

| UI element | State |
|------------|-------|
| Header | No status control. |
| Connectivity | None. |
| Sessions list | Sessions from A and B, interleaved by sort order. |
| Loading overlay | Visible until there is cached data **or** both servers finish; hidden once `hasCachedData` or `sessionsDone`. |
| FAB | Tapping opens `NewSessionServerPicker`. |
| ServersStatusModal | Both rows: green dot, **“Connected”** |

---

### 4.2 — One connected, one connecting

**Condition:** Server A `[connected/ok]`, Server B `[connecting/ok]`

| UI element | State |
|------------|-------|
| Header | No status control. |
| Connectivity | Info toast after 2s (“Connecting to [B]…”). No banner. |
| Sessions list | Server A’s sessions visible; Server B’s arrive once WS connects and pages load. |
| Loading overlay | Visible only while there is no cached data and something is still fetching. |
| FAB | Multi-server picker (both are active). |
| ServersStatusModal | A: green “Connected”; B: amber “Connecting…” |

---

### 4.3 — One connected, one disconnected

**Condition:** Server A `[connected/ok]`, Server B `[disconnected/ok]`

| UI element | State |
|------------|-------|
| Header | No status control. |
| Connectivity | Warning toast for B. No offline banner (B’s fetch is still `ok`). |
| Sessions list | Server A sessions live; Server B sessions stale/cached. |
| Loading overlay | Hidden if both previously completed pagination. |
| FAB | Multi-server picker. |
| ServersStatusModal | A: green “Connected”; B: red “Disconnected” |

---

### 4.4 — One connected, one unreachable

**Condition:** Server A `[connected/ok]`, Server B `[disconnected/error]`

| UI element | State |
|------------|-------|
| Header | No status control. |
| Connectivity | `ServerOfflineBanner` for B + warning toast (“[B] is unreachable…”). List stays (A is healthy), so this is **not** `allServersFailed`. |
| Sessions list | Server A sessions live; Server B sessions stale (or empty on first boot). |
| Loading overlay | Hidden. |
| FAB | Multi-server picker; picking B opens `ServerErrorModal`. |
| ServersStatusModal | A: green “Connected”; B: red “Unreachable” + error text. |

---

### 4.5 — Both unreachable

**Condition:** Server A `[disconnected/error]`, Server B `[disconnected/error]`

| UI element | State |
|------------|-------|
| Header | No status control. |
| Connectivity | Once `sessionsDone`, `allServersFailed` **EmptyState** (Details → modal, Retry). Per-host banners are not shown because the list header is not mounted. |
| Sessions list | Replaced by the empty state. |
| Loading overlay | Hidden. |
| FAB | Still rendered; picking a host opens `ServerErrorModal`. |
| ServersStatusModal | A: red “Unreachable”; B: red “Unreachable” |

---

### 4.6 — One connected + ok, one hidden

**Condition:** Server A `[connected/ok]` visible, Server B `[connected/ok]` hidden (filtered out)

| UI element | State |
|------------|-------|
| Header | No status control. |
| Connectivity | None. |
| Sessions list | Only Server A’s sessions (B filtered out by `displayedServerIds`). |
| Loading overlay | Hidden servers are still paginated; overlay only if there is no cached data. |
| FAB | Multi-server picker for both A and B (picker uses `activeServerIds`). |
| ServersStatusModal | Both rows: green “Connected” |

Hiding a server does not remove it from `activeServerIds`. Both are still paginated. A hidden server can still be picked in the FAB picker.

---

### 4.7 — One connecting, one hidden (connected)

**Condition:** Server A `[connecting/ok]` visible, Server B `[connected/ok]` hidden

| UI element | State |
|------------|-------|
| Header | No status control. |
| Connectivity | Info toast after 2s for A. |
| Sessions list | No sessions yet from A; B’s sessions filtered out. |
| Loading overlay | Visible if there is no cached data. |
| FAB | Multi-server picker. |
| ServersStatusModal | A: amber “Connecting…”; B: green “Connected” |

---

### 4.8 — One unreachable (visible), one hidden (connected)

**Condition:** Server A `[disconnected/error]` visible, Server B `[connected/ok]` hidden

| UI element | State |
|------------|-------|
| Header | No status control. |
| Connectivity | `ServerOfflineBanner` for A + warning toast. Not `allServersFailed` (B’s fetch is `ok`). |
| Sessions list | Server A stale/empty sessions only (B hidden). |
| Loading overlay | Hidden if A previously completed or failed pagination. |
| FAB | Multi-server picker for both A and B. |
| ServersStatusModal | A: red “Unreachable”; B: green “Connected” |

---

### 4.9 — One connected + ok, one fetch-failed while connected

**Condition:** Server A `[connected/ok]`, Server B `[connected/error]`

| UI element | State |
|------------|-------|
| Header | No status control. |
| Connectivity | `ServerOfflineBanner` for B + warning toast. |
| Sessions list | Server A sessions live; Server B stale. |
| Loading overlay | Hidden or retrying depending on pagination state. |
| FAB | Multi-server picker; picking B opens `ServerErrorModal`. |
| ServersStatusModal | A: green “Connected”; B: amber “Fetch failed” + error detail. |

---

### 4.10 — Both connected + fetch-failed

**Condition:** Server A `[connected/error]`, Server B `[connected/error]`

| UI element | State |
|------------|-------|
| Header | No status control. |
| Connectivity | `allServersFailed` EmptyState once `sessionsDone`. |
| Sessions list | Replaced by the empty state. |
| Loading overlay | Hidden. |
| FAB | Multi-server picker; Browse blocked per host. |
| ServersStatusModal | A: amber “Fetch failed”; B: amber “Fetch failed”. |

---

### 4.11 — Both disconnected (no error)

**Condition:** Server A `[disconnected/ok]`, Server B `[disconnected/ok]`

| UI element | State |
|------------|-------|
| Header | No status control. |
| Connectivity | Warning toast (“Disconnected from all servers…”). No offline banners (fetch still `ok`). Not `allServersFailed`. |
| Sessions list | Both stale cached sessions. |
| Loading overlay | Hidden. |
| FAB | Multi-server picker. |
| ServersStatusModal | A: red “Disconnected”; B: red “Disconnected” |

---

### 4.12 — Three-server edge: one connected, one unreachable, one hidden

**Condition:** Server A `[connected/ok]` visible, Server B `[disconnected/error]` visible, Server C `[connected/ok]` hidden

| UI element | State |
|------------|-------|
| Header | No status control. |
| Connectivity | `ServerOfflineBanner` for B + warning toast. Not `allServersFailed` (A and C fetch `ok`). |
| Sessions list | A sessions (live), B sessions (stale/empty) — C hidden. |
| Loading overlay | Hidden if A, B, C done paginating. |
| FAB | Three-server picker (all three in `activeServerIds`). |
| ServersStatusModal | A: green; B: red “Unreachable”; C: green. |

---

## 5. Loading Overlay Scenarios

`LoadingOverlay` in `app/index.tsx` is gated by `showLoadingModal = !hasCachedData && isStillFetching`. It is **not** `SessionsLoadingOverlay`, and it does **not** appear on every `!sessionsDone` — a warm cache skips the scrim.

### 5.1 — First boot, no cache

**Condition:** App launched for the first time, no persisted React Query cache

- Overlay appears (testID `sessions-loading-overlay`) with spinner + sessions progress
- Caption is “Fetching” / “Fetching N servers in parallel”, not a per-host label
- Progress row fills as `loaded` / `total` arrive

---

### 5.2 — Cache hit on launch

**Condition:** App re-launched, React Query cache is warm

- Cached sessions render immediately
- Overlay stays hidden
- Single-server background refresh: header spinner and/or `SyncCachedNotice`

---

### 5.3 — Manual pull-to-refresh

**Condition:** User pulls down on the sessions list

- `RefreshControl` spinner in the list
- Overlay does **not** cover a warm list (`hasCachedData` is true)

---

### 5.4 — Multi-server sequential pagination

**Condition:** Two+ servers configured, sessions paginate across them

- Overlay visible only while there is no cached data
- In-flight caption uses the count of servers currently fetching, not the current host’s label

---

### 5.5 — Pagination with hidden server

**Condition:** Server B is hidden (`displayedServerIds` excludes it) but in `activeServerIds`

- Eager session fetch still paginates B
- Overlay (when shown) does not name B; B’s rows are filtered out of the list

---

### 5.6 — Pagination complete

**Condition:** All servers’ sessions fetched, `sessionsDone = true`

- Overlay hidden
- Sessions list is fully populated and scrollable
- Normal operation resumes

---

## 6. Currently Implemented UI vs Remaining Gaps

### Summary: what each scenario proactively shows

| Scenario | Proactive signal | On-demand (`ServersStatusModal`) |
|----------|------------------|----------------------------------|
| All connected + loaded | Nothing (clean state) | All rows green “Connected” |
| Any server connecting | Info toast after 2s | Amber “Connecting…” per connecting server |
| Any server disconnected (fetch still ok) | Warning toast | Red “Disconnected” |
| Any fetch error | `ServerOfflineBanner` and/or all-offline empty state + error/warning toast | “Fetch failed” / “Unreachable” + error text |
| Any `warming_up` | `ServerWarmingBanner` + `ServerIndexingBanner` + indexing toast; history skeletons on Now | Modal row follows WS |
| Sessions loading, no cache | Full-screen `LoadingOverlay` | N/A |
| No servers configured | `NoServersWelcome` | Modal empty-state text |

### Remaining UX gaps

| Gap | Scenario(s) | Description |
|-----|-------------|-------------|
| **FAB still offers dead hosts** | 3.4, 3.5, 3.6, 4.5 | Picker still lists unreachable servers; the failure is `ServerErrorModal` after pick rather than disabling the row. |
| **Stale rows without a per-row marker** | 3.4, 3.5, 3.6, 4.5, 4.10, 4.11 | Cached sessions from a failed host stay in the list. The signal is the banner/toast/empty state, not a chip on the row. |
| **Hidden-server fetch still counts** | 5.5 | Hidden servers are still paginated even though their rows never appear. |
| **No reconnecting word in the modal** | Post-disconnect reconnect | After disconnect + reconnect, the modal stays on connecting/disconnected until WS is `connected` **and** a fetch succeeds. |

Closed (do not re-open as gaps):

- Header cloud / bell / coloured dot — removed on purpose. Status is banners + toast + modal.
- Silent FAB on no servers — toast on press; `NoServersWelcome` for a fresh install.
- “No banners” — `ServerOfflineBanner`, `ServerWarmingBanner`, `ServerUnsupportedBanner`, and `ServerIndexingBanner` all mount from the homepage list header.

---

## 7. Message Categorization — Info / Warning / Error

Severity definitions used below:

- **Info** — background state the user may want to know but requires no immediate action. Non-blocking, dismissible, low urgency.
- **Warning** — degraded state where the app still works partially or with stale data. User should be aware but can continue.
- **Error** — fully broken state where the user cannot accomplish their goal. Action is required (or at minimum clearly expected).
- **None** — nominal state; no message needed.

`ServerStateMessage` maps these onto toast level. Per-host `error` fetch also paints `ServerOfflineBanner` when the list is visible.

### Single-server

| Scenario | Severity | Suggested message |
|----------|----------|-------------------|
| **3.0** No servers configured | **Info** | `NoServersWelcome` — add a server. |
| **3.1** Server connecting | **Info** | “Connecting to [server]…” — toast after 2s; auto-irrelevant once connected. |
| **3.2** Connected, sessions loading | **None** | Overlay / sync notice already communicate this. |
| **3.3** Connected, sessions loaded | **None** | Nominal. |
| **3.4** Server disconnected (clean) | **Warning** | “Disconnected from [server]. Showing cached sessions.” |
| **3.5** Connected WS + fetch error | **Warning** / **Error** | Banner + toast; all-offline empty state when this is the only server. |
| **3.6** Server unreachable | **Error** | Banner + toast, or all-offline empty state. |
| **3.7** Warming up | **Info** | Warming banner + “building history” toast. |

### Two-server (and N-server generalizations)

| Scenario | Severity | Suggested message |
|----------|----------|-------------------|
| **4.1** Both connected + ok | **None** | Nominal. |
| **4.2** One connected, one connecting | **Info** | “Connecting to [B]…” |
| **4.3** One connected, one disconnected | **Warning** | “Disconnected from [B]. Showing cached sessions.” |
| **4.4** One connected, one unreachable | **Warning** | “[B] is unreachable. Some sessions may be missing.” + banner on B. |
| **4.5** Both unreachable | **Error** | All-offline empty state. |
| **4.6** One connected, one hidden | **None** | Hidden is an intentional user choice. |
| **4.7** One connecting, one hidden (connected) | **Info** | “Connecting to [A]…” |
| **4.8** One unreachable (visible), one hidden (healthy) | **Warning** | “[A] is unreachable…” — healthy server is hidden so the view is degraded. |
| **4.9** One connected + ok, one fetch-failed | **Warning** | Banner on B + refresh-failed toast. |
| **4.10** Both connected + fetch-failed | **Error** | All-offline empty state. |
| **4.11** Both disconnected (no error) | **Warning** | “Disconnected from all servers. Showing cached sessions.” |
| **4.12** Three-server: one connected, one unreachable, one hidden | **Warning** | “[B] is unreachable. Some sessions may be missing.” |

### Loading overlay

| Scenario | Severity | Message approach |
|----------|----------|-----------------|
| **5.1** First boot, no cache | **None** | Overlay already communicates loading. |
| **5.2** Cache hit on launch | **None** | Cached data renders immediately; background refresh is quiet. |
| **5.3** Pull-to-refresh | **None** | `RefreshControl` is sufficient. |
| **5.4** Multi-server sequential pagination | **None** | Overlay only without cache. |
| **5.5** Pagination with hidden server | **Info** | Overlay no longer names the hidden host. |
| **5.6** Pagination complete | **None** | No message needed. |

### Message placement guidance

| Placement | When to use |
|-----------|-------------|
| **Inline banner (list header)** | Persistent per-host fetch failure, warmup, or unsupported version while other hosts still render. |
| **Home toast (`ServerStateMessage`)** | Connecting, disconnected, unreachable, refresh-failed, indexing — with Retry / Details on warning and error. |
| **All-offline empty state** | Every active server’s fetch status is `error` and sessions are done. |
| **Welcome card** | No servers configured. |
| **FAB toast** | Press with zero servers. |
| **`ServersStatusModal`** | Drill-down: per-server dots, labels, error text. Not a header button. |
