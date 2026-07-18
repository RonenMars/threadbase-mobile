# Cache Integrity Alert — Mobile Implementation Plan

**Recommended model/effort:** Sonnet 5, effort **high**. This is well-specified UI + WS/API wiring against a documented server contract (embedded below in full, so this doc is self-contained) — smaller decision space than the server side, but still touches WS dispatch, a Zustand store, two new components, and a real end-to-end resolve flow with error handling.

**Branch:** `feat/cache-integrity-alert`.

**Companion/upstream repo:** `tb-streamer` (`/Users/ronenmars/dev/ai-tools/tb-streamer`). This plan assumes the streamer side ships the contract below — see `docs/superpowers/specs/2026-07-18-cache-integrity-alert-design.md` and `docs/superpowers/plans/2026-07-18-cache-integrity-alert-streamer-plan.md` in that repo if you need more server-side context or the server implementation isn't done yet. **This mobile work can be built and tested against the documented contract independently** (mock the WS messages / REST responses in tests; for manual testing you need a streamer build with PR1 of the streamer plan merged).

## Background

The streamer's SQLite conversation cache can drift from the actual JSONL files on disk (a project directory or `~/.claude/projects` can be deleted, moved, etc.). When that happens the server detects it, freezes any destructive cache pruning, and asks the user what to do. Mobile is one of three surfaces (the others are the menubar tray app and the streamer CLI) that can present this decision to the user — it needs to show a banner or modal, offer four actions, and call back into the server.

## Server contract (authoritative — do not deviate without re-checking the streamer repo)

### WebSocket messages (server-level, no `sessionId`)

```ts
type CacheAlertMessage = {
  type: "cache_alert";
  fingerprint: string;
  severity: "high" | "low";
  missingCount: number;
  totalRows: number;
  detectedAt: string; // ISO timestamp
  sample: { id: string; title?: string }[]; // first 20 of the missing set
};

type CacheAlertResolvedMessage = {
  type: "cache_alert_resolved";
  fingerprint: string;
  action: "prune_all" | "prune_selected" | "ignore" | "reset_rescan";
};
```

Broadcast whenever an alert is raised or its severity changes, and **unicast to a client the moment it connects** if an alert is currently pending — so reconnects and cold starts both see it, not just clients that were already listening when it was raised.

### REST endpoints

`GET /api/cache/alert` → `{ pending: PendingAlert | null }` where:

```ts
type PendingAlert = {
  fingerprint: string;
  severity: "high" | "low";
  detectedAt: string;
  missingCount: number;
  totalRows: number;
  backupPath?: string;
  missing: { id: string; filePath: string; title?: string; tailed: boolean }[]; // full list, capped at 1000 server-side
};
```

`POST /api/cache/alert/resolve`, body:

```ts
type ResolveRequest = {
  fingerprint: string;
  action: "prune_all" | "prune_selected" | "ignore" | "reset_rescan";
  ids?: string[]; // required and non-empty iff action === "prune_selected"
};
```

Responses:
- `200 { ok: true, action, pruned?: number, backupPath?: string }` — success.
- `200 { ok: true, alreadyResolved: true }` — no alert was pending (another client/surface already resolved it, or it cleared itself). Treat as success, refetch state.
- `409 { error: "fingerprint_mismatch", currentFingerprint: string }` — the alert changed since you fetched it (e.g. `prune_selected` left a remainder that became a new pending alert). Refetch `GET /api/cache/alert` and re-render before letting the user retry.
- `400` — validation error (shouldn't happen if the client builds the request correctly).
- `404` — **old server that doesn't have this endpoint at all.** This is the feature-detection signal — see below.

### `/healthz` (additive field, not the primary integration point for mobile, but useful context)

```ts
{ ok: boolean; version: string; cacheAlert?: { severity; missingCount; fingerprint; detectedAt } }
```

Mobile doesn't poll `/healthz` today (that's the menubar's job) — this is here for completeness; mobile should rely on the WS message + `GET /api/cache/alert`, not add a new healthz poll.

### Backward compatibility

A server that doesn't have this feature yet: WS never sends `cache_alert`/`cache_alert_resolved` (nothing to handle), and `GET /api/cache/alert` / `POST /api/cache/alert/resolve` 404. Mobile must treat a 404 on `GET /api/cache/alert` as "this server doesn't support the feature" and simply show no banner/modal — not an error state.

## Codebase map (verified 2026-07-18)

- **WS dispatch**: `services/ws-client.ts:157-186` — a handler registry keyed by `msg.type`; unknown types are safely ignored (`:178` guards on `if (handlers)`, no default/throw branch). The `WSMessage` union is defined at `services/ws-client.ts:12-36`. Two existing server-level (non-session) message types are the direct precedent: `cache_ready` (`:24`) and `scan_progress` (`:25`).
- **Server-level listener wiring**: `app/_layout.tsx:172-180` registers `wsManager.onAll('cache_ready', ...)` and `wsManager.onAll('scan_progress', ...)` inside an effect keyed on `activeServerIds`; cleanup/unsubscribe happens at `:185-190`. `wsManager.onAll(type, handler)` (`services/ws-client.ts:326`) fires the handler for every connected server and injects `serverId` into the callback — this is the correct place to add `cache_alert` / `cache_alert_resolved` listeners.
- **Reusable "question card" pattern**: `components/terminal/QuestionCard.tsx` renders an options list with cursor-highlight selection — useful as a visual/structural reference for the modal's action list, but it's wired to the session-bound `permission` flow (`hooks/useActiveQuestion.ts`) and is not directly reusable as a component; treat it as a pattern reference, not something to import.
- **API client**: `services/api-client.ts`. `createApiForServer(serverId)` (`:332`) returns `{ get, post, ... }` already carrying the right base URL and auth. Bearer auth header is set once inside `request()` (`:88-93`) — you don't need to handle auth yourself. A 404 response throws `NotFoundError` (`:143`, defined `:21-26`) — this is exactly the feature-detection signal from the contract above; catch it specifically (not a blanket catch-all) so a real 500 or network error doesn't get silently swallowed as "feature not supported."
- **Banner precedent (low severity)**: `components/servers/ServerIndexingBanner.tsx`, rendered on the list screen at `app/index.tsx:356`, driven by `useServersStore` state, returns `null` when inactive. Base component: `components/ui/Banner.tsx`.
- **Modal precedent (high severity)**: `ServersStatusModal`, rendered at `app/index.tsx:471,496`.
- **State home**: `stores/servers.ts` (Zustand, keyed by `serverId`) already holds `isConnected`, `cacheReady`, `scanProgress` with setters like `setCacheReady` (`:259`) — this is the natural home for `cacheAlert` state; don't create a new store.
- **Test layout**: `__tests__/{unit,integration,e2e}/` mirrors `src` paths (tests are not colocated with source). Best existing templates: `__tests__/unit/hooks/useActiveQuestion.test.tsx` (WS message → state reducer shape), `__tests__/unit/services/ws-client.test.ts` (dispatch mechanics), `__tests__/unit/components/terminal/QuestionCard.test.tsx` (option-select interaction), `__tests__/unit/components/sessions/ConnectionBanner.test.tsx` and `__tests__/integration/components/FirstShowBanner.test.tsx` (banner render/visibility logic).

## Implementation steps

### Step 1 — Types + WS wiring

Add the two message types (`CacheAlertMessage`, `CacheAlertResolvedMessage` per the contract above) to the `WSMessage` union in `services/ws-client.ts:12-36`. Add a shared `CacheAlert` type (matching `PendingAlert` from the REST contract, since the WS `sample` is a subset of the same shape — consider whether `CacheAlert` should just be `PendingAlert` with `missing` renamed/omitted, or two distinct types; pick whichever keeps `stores/servers.ts` simplest) to `types/api.ts`.

In `app/_layout.tsx`, beside the existing `cache_ready`/`scan_progress` registration (`:172-180`), add:
- `wsManager.onAll('cache_alert', (serverId, msg) => store.setCacheAlert(serverId, msg))`
- `wsManager.onAll('cache_alert_resolved', (serverId, msg) => store.clearCacheAlert(serverId, msg.fingerprint))`

Add both unsubscribes to the existing cleanup block (`:185-190`).

### Step 2 — Store

In `stores/servers.ts`, add `cacheAlert: Record<string, CacheAlert | null>` (keyed by `serverId`) alongside the existing per-server fields, plus:
- `setCacheAlert(serverId, alert)` — replace wholesale (a new `cache_alert` broadcast always represents the current truth).
- `clearCacheAlert(serverId, fingerprint)` — only clear if the stored alert's fingerprint matches (guards against a stale `resolved` message racing a newer `cache_alert` for a different fingerprint).
- Clear the entry entirely when a server disconnects (find wherever `isConnected` is set to `false` / the server is removed, and reset `cacheAlert` there too — stale alert state from a disconnected server shouldn't linger in the UI).

### Step 3 — API calls

In `services/api-client.ts` (or a new file if the existing one is organized by feature — follow whatever convention is already there for grouping endpoint functions), add:

```ts
async function getCacheAlert(serverId: string): Promise<PendingAlert | null> {
  try {
    const api = createApiForServer(serverId);
    const { pending } = await api.get('/api/cache/alert');
    return pending;
  } catch (e) {
    if (e instanceof NotFoundError) return null; // old server, feature not supported
    throw e; // real error — let the caller handle/log it
  }
}

async function resolveCacheAlert(
  serverId: string,
  body: { fingerprint: string; action: ResolveAction; ids?: string[] },
): Promise<ResolveResult> { /* POST, map 409 to a typed conflict result rather than throwing generically */ }
```

Call `getCacheAlert` once when a server connects / the app comes to the foreground (to catch anything the WS replay-on-connect might have raced with, e.g. app was backgrounded when the unicast arrived) and feed the result through the same `setCacheAlert`/`clearCacheAlert` store setters as the WS path — reuse the reducer logic, don't duplicate it.

### Step 4 — Low-severity banner

New component `components/servers/CacheAlertBanner.tsx`, modeled directly on `ServerIndexingBanner.tsx`'s structure (reads from `useServersStore`, returns `null` when `cacheAlert` is absent or `severity !== "low"`). Copy: something like "N conversation histories are missing on `<server name>`" with a tappable affordance that opens the same resolve modal used for high severity (don't build two separate action UIs). Render it on the list screen (`app/index.tsx`) near where `ServerIndexingBanner` is rendered (`:356`).

### Step 5 — High-severity modal

New component `components/servers/CacheAlertModal.tsx`, modeled on `ServersStatusModal`'s modal-on-the-list-screen wiring (`app/index.tsx:471,496`) for presentation, and on `QuestionCard`'s options-list pattern for the action choices (four buttons: Prune All, Prune Selected, Ignore, Reset & Rescan — `prune_selected` needs a follow-up picker UI using the `missing` array from `GET /api/cache/alert`, keep this as simple as a checkbox list, no need for anything fancy).

Requirements:
- Shows severity-appropriate copy: "N of M conversation histories are missing on `<server>`" plus, for high severity specifically, a one-line hint suggesting a Time Machine (or equivalent) backup check before doing anything destructive.
- The three destructive actions (`prune_all`, `prune_selected`, `reset_rescan`) require an explicit confirm step (a second tap/dialog) — `ignore` does not, since it's non-destructive.
- On success: dismiss, show a toast/snackbar including the `backupPath` if one was returned (so the user knows where their safety net is).
- On `409 fingerprint_mismatch`: don't show a generic error — silently refetch `GET /api/cache/alert`, update the store, and re-render the modal with the new pending state (the user's chosen action may still make sense against the new set, or may not — simplest correct behavior is to just show them the refreshed state and let them re-decide, not to auto-retry their original choice against a different fingerprint).
- Auto-open when a `high` severity alert appears in the store (via a `useEffect` on the relevant screen watching `cacheAlert[activeServerId]`), auto-close if the alert clears out from under it (resolved by another surface).

### Step 6 — Tests

- `__tests__/unit/stores/servers.test.ts` (extend) — `setCacheAlert`/`clearCacheAlert` reducer behavior, including the fingerprint-mismatch guard on clear and the disconnect-clears-alert case.
- `__tests__/unit/services/ws-client.test.ts` or a new focused test — dispatch of `cache_alert`/`cache_alert_resolved` reaches registered handlers with `serverId` injected (model on the existing dispatch tests).
- `__tests__/unit/components/servers/CacheAlertBanner.test.tsx` — renders only for low severity + presence, hidden otherwise (model on `ConnectionBanner.test.tsx`).
- `__tests__/unit/components/servers/CacheAlertModal.test.tsx` — each action fires the right API call with the right body, confirm-step gates destructive actions, success path shows the backup path, 409 path refetches and re-renders (model on `QuestionCard.test.tsx` for the option-interaction mechanics).
- `__tests__/integration/...` — an end-to-end resolve flow against a mocked API client covering: normal success, `NotFoundError` on `getCacheAlert` → feature hidden entirely (assert nothing renders), 409 → refetch-and-rerender.

## Completion checklist

- Full test suite green (`npm test` or repo's equivalent — check `package.json`).
- Lint/type-check clean per repo convention.
- Manual test against a local streamer build that has the PR1 server work merged: induce drift (delete a few JSONLs), confirm the banner appears for low severity and the modal auto-opens for high severity, exercise all four actions, confirm a 409 (e.g. by resolving from `curl`/CLI concurrently) surfaces correctly.
- Manual test against an **old** streamer build (pre-this-feature): confirm the app behaves exactly as it does today — no banner, no modal, no errors in the console from the 404s.
