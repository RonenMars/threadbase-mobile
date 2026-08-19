# Implement host-pressure Hub banner (tb-mobile only)

Paste this whole file into a new agent session. Work only in a **sibling worktree** of `tb-mobile`. Do not touch `tb-streamer`.

The streamer (separate prompt: `docs/followups/streamer/08-host-pressure-alert.md`) samples host memory / event-loop / load and pushes coarse WS frames when the paired box is starved. This PR is the client half: a Hub banner, same family as `cache_alert`. Not a process manager, not raw CPU graphs, not a poll of `/api/diagnostics`.

Independent of `unsubscribe_session`. Do not fold that work in.

If the streamer PR has already landed, grep `host_pressure` in `../tb-streamer/src/types.ts` and match that shape. Otherwise implement against the frozen contract below.

## Setup — do this first

Worktrees live **outside** the repo root, as siblings. Nested worktrees poison Jest/ESLint/Metro.

```bash
cd ~/dev/ai-tools/tb-mobile
git fetch origin
git worktree add ../tb-mobile-worktrees/feat-host-pressure \
  -b feat/host-pressure origin/main
cd ../tb-mobile-worktrees/feat-host-pressure
cp -Rc ../../tb-mobile/node_modules ./node_modules
```

`node_modules` must be a **real copy, not a symlink**. Metro resolves the project root through a symlink and silently bundles the main checkout. The tell is in `.expo/dev/logs/start.log`: the entry reads `../../tb-mobile/node_modules/expo-router/entry.js` instead of `node_modules/expo-router/entry.js`.

Move the agent root to that worktree. Open one PR against `main`. Do not merge. Do not push to `main`.

## Wire contract (consume this; do not invent a parallel shape)

Additive. Old streamers omit the flag and never send the frames → treat as “unknown” and show nothing. Do not probe `/api/diagnostics` for this.

### `GET /api/info` (ignore except for discovery)

```ts
hostPressure?: true
```

Absent means an older server. Do not hide the banner on that flag alone if a `host_pressure` frame already arrived (the frame is authoritative). Do not show the banner just because the flag is true.

### WS frames

```ts
type HostPressureLevel = 'elevated' | 'critical'
type HostPressureReason = 'memory' | 'event_loop' | 'load' | 'agents'

{
  type: 'host_pressure'
  level: HostPressureLevel
  reasons: HostPressureReason[]
  liveAgents: number
  updatedAt: string
  os?: 'darwin' | 'linux' | 'win32'
}

{
  type: 'host_pressure_cleared'
  updatedAt: string
}
```

Unknown reason strings: skip that reason, still show the banner from `level` + `liveAgents`. Do not throw. Do not use `unknown`/`any` — narrow with an explicit allow-list helper that returns `HostPressureReason[]`.

## Implementation

Mirror `cache_alert`. Do not invent a second alert architecture.

1. Extend `WSMessage` in `services/ws-client.ts` with the two frames.
2. Store per-server pressure on `useServersStore`:

   `hostPressure: Record<string, { level: HostPressureLevel; reasons: HostPressureReason[]; liveAgents: number; updatedAt: string } | null>`

   Set on `host_pressure`. Clear on `host_pressure_cleared` and on disconnect for that `serverId`.
3. Wire listeners in `app/_layout.tsx` next to `cache_alert` via `wsManager.onAll`.
4. Hub banner on `app/index.tsx`, same slot family as `CacheAlertBanner` (below or above it; do not cover session rows). Phosphor `Warning` (regular, amber) plus a `Details` chip matching `ServerStateMessage`. **No emoji.** `testID="host-pressure-banner"`.
5. Copy in `locales/{en,ar,he,ru}/servers.json`. Extract multi-branch strings **above** the JSX return.

Headline names the first resource reason (`memory` / `load` / `event_loop`). Do not put `liveAgents` in the banner unless `reasons` includes `agents` — and even then only in the Details sheet. Both `elevated` and `critical` use the warning chrome; critical is stronger copy, not error-red.

Details opens a modal: what fired, why it can still feel fine, then OS-specific “quit Cursor/Chrome/VMs” (`os` on the frame, else `GET /api/info` `platform`). **No** kill/stop-all from this banner.

## Tests

- `ws-client` dispatches the new types (same style as the existing `cache_alert` tests).
- Store set / clear / disconnect-clears.
- Banner renders for elevated and critical, hidden when null, uses `testID`.
- i18n: keys in all four locales; locale-parity CI must stay green.

```bash
npx eslint <staged ts/tsx>
npx jest --ci --runInBand --testPathPattern "host-pressure|HostPressure|ws-client.test|servers.test"
```

PR title: `feat(servers): warn when the paired host is low on resources`

## Repo rules

- Conventional commits, imperative, lowercase, no trailing period.
- No AI attribution anywhere (commits, PRs, comments).
- One sentence per line in commit/PR bodies.
- Never comment on GitHub PRs/issues.
- No `any` / `unknown` without asking.
- Comments only when non-trivial.
- No inline multi-branch string ternaries in JSX.
- Worktrees stay siblings. Do not nest under the repo.
- Do not hold or stop sessions from this banner.
- Standing approval to commit and push **this feature branch** and open a PR. No merge, no force-push to `main`.

## Stop and ask only if

- You would need `any`/`unknown`.
- `useServersStore` cannot take the new field without a persisted-shape migration you cannot keep additive (then ask — do not persist this alert to AsyncStorage).

Trivial naming/file placement is yours.

## Done when

1. PR is up against `main`.
2. Banner shows on `host_pressure`, hides on clear and on disconnect, four locales updated.
3. PR body states the contract, that old streamers degrade to “no banner”, and that this does not stop agents.
4. Report the PR URL.
