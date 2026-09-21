# 10 — Floating chat shelf, with saved items stored on the streamer

Brief for a new implementation session.
Source idea: an in-app "chat heads" bubble that is a quick-access shelf for saved chats, adapted here to what Threadbase already has.
Facts below were read from `tb-mobile` main `da55f301` and `tb-streamer` main `a7abfff2` on 2026-09-21; re-check anything you build on.

## Kick-off

One session per PR, each started in its own repo from a fresh terminal (so `TYPESAFE_API_KEY` is in the environment).
Paths below assume this brief is on tb-mobile `main`; until the docs PR merges, replace `tb-mobile/docs` and `tb-mobile/scripts` with `tb-mobile-worktrees/floating-chat-shelf-prep/docs` and `.../scripts`.

**PR A: the shelf.** Start in `~/dev/ai-tools/tb-mobile`:

```
Implement PR A of ~/dev/ai-tools/tb-mobile/docs/followups/mobile/10-floating-chat-shelf.md: read "What exists and must be reused" and "PR A", then this repo's CLAUDE.md, AGENTS.md and CONTEXT.md. PRs B and C are not yours.
First step: write the PR A plan into the doc's "Plan" section, in your worktree, and stop for my approval before writing code.
Before asking me to review, run: node ~/dev/ai-tools/tb-mobile/scripts/jev-check.mjs --criteria ~/dev/ai-tools/tb-mobile/docs/followups/mobile/10-floating-chat-shelf-criteria.json, and look at every CHECK row yourself.
Rules that never bend: a sibling worktree (../tb-mobile-worktrees/<slug>), the repo's checks green before any commit, staged diff and message shown and my typed yes before every commit, no push or PR without my say-so, no new dependencies.
```

**PR B: saved items on the streamer.** Start in `~/dev/ai-tools/tb-streamer` (independent of A, can run in parallel):

```
Implement PR B of ~/dev/ai-tools/tb-mobile/docs/followups/mobile/10-floating-chat-shelf.md: read "PR B" (and "What exists" for the mobile side it serves), then this repo's CLAUDE.md and AGENTS.md. PRs A and C are not yours; never edit tb-mobile.
First step: write the PR B plan (migration, table, key scheme, routes, capability entry, /api/info flag, tests) and stop for my approval before writing code.
Before asking me to review, run: node ~/dev/ai-tools/tb-mobile/scripts/jev-check.mjs --criteria ~/dev/ai-tools/tb-mobile/docs/followups/mobile/10-floating-chat-shelf-streamer-criteria.json, and look at every CHECK row yourself.
Rules that never bend: a sibling worktree (../tb-streamer-worktrees/<slug>), npm run lint && npm test green before any commit, staged diff and message shown and my typed yes before every commit, no push or PR without my say-so, no real hostnames or keys, no new dependencies.
```

**PR C: sync.** Start in `~/dev/ai-tools/tb-mobile`, only after A is merged and B is released:

```
Implement PR C of ~/dev/ai-tools/tb-mobile/docs/followups/mobile/10-floating-chat-shelf.md: read "What exists and must be reused" and "PR C", check PR B's merged API in ~/dev/ai-tools/tb-streamer, then this repo's CLAUDE.md, AGENTS.md and CONTEXT.md.
First step: write the PR C plan into the doc's "Plan" section, in your worktree, and stop for my approval before writing code.
Before asking me to review, run: node ~/dev/ai-tools/tb-mobile/scripts/jev-check.mjs --criteria ~/dev/ai-tools/tb-mobile/docs/followups/mobile/10-floating-chat-shelf-sync-criteria.json, and look at every CHECK row yourself.
Rules that never bend: a sibling worktree (../tb-mobile-worktrees/<slug>), the repo's checks green before any commit, staged diff and message shown and my typed yes before every commit, no push or PR without my say-so, no new dependencies.
```

## What exists and must be reused

- **Saved items are the existing favorites.** `stores/quickAccess.ts` holds `FavoriteItem` (`dir`, `session`, `conversation`, `project-chat`) with canonical ids from `buildFavoriteId(serverId, type, ...)`, joined by `::`.
  - The store persists to AsyncStorage key `threadbase_quick_access` via `subscribe`, and `hydrate()` runs from `app/_layout.tsx`.
  - Actions: `pinItem`, `unpinItem`, `reorderFavorites`.
  - Legacy ids must never be re-keyed.
  - Do not create a second saved-chats store.
- **Known bypass.** `app/conversation/[id].tsx` (about :388 and :423-445) pins with a direct `setState` plus a manual AsyncStorage write and its own rollback. Route it through the store actions in PR A; PR C's sync depends on every write passing through the store.
- **Root overlay slot.** In `app/_layout.tsx`, `<AlertHost />` and `<NavigationLockOverlay />` sit after `ThemedStack` (about :627-629). That is inside `GestureHandlerRootView`, `DirectionRoot`, `KeyboardProvider`, `SafeAreaProvider`, `AuthGate` and `BiometricLockGate`. The shelf goes there. There is no portal or `BottomSheetModalProvider`.
- **Badge: count what needs the user, not unread messages.** Threadbase has no unread messages. Count saved sessions whose `deriveSessionPresentation(session).tier === 'needsYou'` (`lib/sessionPresentation.ts`; `countByTier` in `lib/sessionFilters.ts`).
  - Session data comes from React Query (`useEagerSessions` / `useSessions` in `hooks/useSession.ts`), updated over WebSocket.
  - There is no global "needs you" selector yet, so add one small hook.
- **Navigation.**
  - Conversation: `conversationHref(id, serverId)` from `lib/conversationHref.ts`.
  - Session: `useNavLockStore.getState().lock()`, then push `/session/${id}?server=${serverId}`, as `components/quick-access/QuickAccessStrip.tsx` does.
  - Use the favorite's `sessionId` when present. Otherwise take the last `::` part, and check `fix/favorite-session-open` for the id-parsing fix.
- **UI building blocks already installed:** `react-native-gesture-handler` 3.2, `react-native-reanimated` 4.5, `@gorhom/bottom-sheet` 5, `zustand` 5, `phosphor-react-native`.
  - Reduce motion: `useReduceMotion` from `hooks/useAccessibilitySettings.ts`, which FAB and Toast use.
  - Direction: `useAppDirection()` from `lib/rtl.ts`. Direction comes from i18next, never `I18nManager`.
  - Keyboard: `useKeyboardInset` / `useReanimatedKeyboardAnimation` through the app-wide `KeyboardProvider`.
  - Placement: `components/ui/FAB.tsx` shows how to sit above the safe area.

## PR A — the shelf (mobile only, no backend)

**Behaviour:**
- One bubble at the root, visible only when favorites are enabled and at least one saved item exists.
- It is hidden on the pairing, onboarding and biometric-lock screens, and while the keyboard is open. The plan lists the exact screens.
- Drag it with a pan; on release it snaps to the nearest side edge and is clamped to the safe area.
  - Snap with a spring, or instantly when reduce motion is on.
  - The default side is the trailing edge, which is the left in RTL.
  - Remember the last side and height in the existing quickAccess persisted state (add a field; no new key).
- Tap opens a panel listing saved sessions and conversations: label, provider icon, and the server name when more than one server is paired.
  - Items that need the user sort first.
  - Tapping a row closes the panel and navigates.
  - An empty state is included.
- Long-press on a session or conversation screen toggles that screen's item as saved, through `pinItem` / `unpinItem`.
- Badge: the number of saved sessions in the `needsYou` tier, shown as "99+" above 99.

**Constraints (repo rules):**
- Tap and long-press are `Gesture.Tap()` / `Gesture.LongPress()` combined with the pan, not a `Pressable` inside a `GestureDetector`.
- Use `useWindowDimensions`, not a module-level `Dimensions.get`.
- Strings:
  - Every string goes through `t('ns:key')` in en, he, ar and ru.
  - No literal strings, and no inline conditional text in JSX.
  - `npm run test:i18n` must stay green.
- Phosphor icons only, no emoji.
- Kebab-case `testID`s: bubble, panel, rows, close, empty state.
- Every new `components/**/*.tsx` gets a colocated `*.stories.tsx`.
- No `any` or `unknown` without asking.
- Tests:
  - Jest for the needs-you count and for panel selection navigating correctly.
  - One Maestro flow (`e2e/`, fixtures in `e2e/fixtures/`) that opens the shelf and selects a saved item, added to `test:e2e:mock`.
- Checks: `npm run lint && npm run typecheck && npm run test:ci && npm run test:i18n`.
- Confirm any `SessionScreen` failure alone, with `--runInBand`, before calling it real or flaky.

**Possible merge conflicts (rebase and check before committing):**
- `app/_layout.tsx`: `feat/alert-host-arbiter`, `feat/notification-prefs-sync`.
- Keyboard: `integration/2026-09-20-keyboard-phase1` and the `fix/*keyboard*` branches.
- Floating controls: `feat/jump-fab-flags-waiting-question`, `fix/jump-button-overlaps-question-card`.
- Favorites: `fix/favorite-session-open`.
- The bubble must not cover the FAB, the jump-to-bottom pill or the question card; say in the plan how it avoids them.

**Criteria:** `docs/followups/mobile/10-floating-chat-shelf-criteria.json`.

## PR B — saved items on the streamer (`tb-streamer`)

**Storage:**
- A new table in **`runtime.db`** (`src/db/runtime-migrations/`, the next number after 005). It is authoritative user data that must survive `cache clear`, so it must not go in `cache.db`.
- Use the existing `runSqliteMigrations` runner.

**Ownership (decided; revisit in the plan only with a reason):**
- The saved list is **per streamer, shared by every device paired with it**, not per device.
- Legacy API-key callers have no `deviceId`, and one person's phones should show the same shelf.
- The mobile app sends only the items whose `serverId` is this server, **with the device-local `serverId` removed from the stored id**, since two phones pair the same streamer under different local ids. The plan must confirm how `serverId` is minted and define the stored key.
  - Canonical ids: strip the `serverId::` prefix.
  - Legacy ids: store them as they are and note the limitation.

**Row fields:**
- `item_key` (primary key), `kind` (`session` | `conversation` | `project-chat`), `label`.
- The kind's ids: `session_id` / `conversation_id` / `chat_type` + `chat_id`, and `project_id`.
- `position`, `updated_at`.
- `dir` favorites stay on the device.

**API:**
- `GET /api/saved-items` returns the items in `position` order.
- `PUT /api/saved-items/:key` upserts one item.
- `DELETE /api/saved-items/:key` removes one.
- `PUT /api/saved-items/order` takes `{ keys: string[] }`.
- Plumbing:
  - Validate bodies with a schema in `src/schemas/`.
  - Register the router in `src/api/app.ts` after `authMiddleware`.
  - Add the prefix to `ROUTE_CAPABILITIES` in `src/services/security/capabilities.ts`; a test enforces this.
  - Add `savedItems: true` to `GET /api/info`.
  - This is an additive wire change, so no mobile compatibility check is needed.
- Tests in `__tests__/`: list, save, re-save the same key (an upsert), reorder, delete, and an invalid body.
- Checks: `npm run lint && npm test` with the `.nvmrc` Node.
- Public repo: no real hostnames or keys, even in fixtures.

**Precedent:** notification prefs. Migration 026, `src/schemas/notification-prefs.schema.ts`, `push.repository.ts`, `__tests__/push-preferences.test.ts`.

**Criteria:** `docs/followups/mobile/10-floating-chat-shelf-streamer-criteria.json`. Run the script from the tb-streamer worktree with the absolute paths in the PR B kick-off.

## PR C — mobile sync (after B is released)

- Add optional `savedItems?: boolean` to `ServerInfo` (`types/api.ts`). Sync only with servers that report it; a failed `/api/info` probe means sync is off (AGENTS.md "Server compatibility").
- **The local list stays the source the UI reads.** AsyncStorage remains the offline copy.
- On connect to a capable server, fetch its list and merge it into the local favorites for that server.
  - First sync, with the server empty and local items present: upload the local items once.
  - After that, the server list wins for that server's items.
- Pin, unpin and reorder:
  - Update locally first, then call the server.
  - On failure, roll back and raise one alert through the existing alert store.
  - No offline write queue in this PR; say so in the PR body.
- Keep ids stable:
  - Never re-key existing favorites.
  - Map a stored key back to the local id by adding this device's `serverId`.
  - `dir` items and items without a `serverId` are never sent.
- **Precedent:** unmerged `feat/notification-prefs-sync` (a hook mounted inside `AuthGate`). Mount the sync hook the same way.
- Tests:
  - First upload.
  - Merge from the server.
  - Rollback on a failed request.
  - No calls when the flag is absent.
- **Criteria:** `docs/followups/mobile/10-floating-chat-shelf-sync-criteria.json`.

## Checking a branch with jev-check

`scripts/jev-check.mjs` asks Jev (TypeSafe) one yes/no question per criterion about the branch's diff, and prints each probability as PASS or CHECK.
It is a pre-review aid: CHECK means look at it yourself, and PASS means likely, not proven. Tests and the repo's checks remain the gate.

```bash
export TYPESAFE_API_KEY=…            # your key; never commit it
node scripts/jev-check.mjs --criteria docs/followups/mobile/10-floating-chat-shelf-criteria.json --dry-run   # sizes only, no call
node scripts/jev-check.mjs --criteria docs/followups/mobile/10-floating-chat-shelf-criteria.json [--base main] [--threshold 0.7] [--strict]
```

- It sends the diff of the matching files, untracked files included, to `api.typesafe.ai`, and nowhere else. It's a local tool; keep it out of CI.
- The model is pinned to `jev-1.13.0`. A run over a PR-sized diff costs a fraction of a cent.
- Edit a criterion's wording when it misfires on code you've checked by hand; that is the tuning loop.

## Plan

(The implementation session writes the plan for each PR here, and stops for approval.)

### PR A — the shelf

Worktree `../tb-mobile-worktrees/floating-chat-shelf`, branch `feat/floating-chat-shelf`, cut from `docs/floating-chat-shelf-prep` so this brief is present.
Once the docs PR merges, a rebase onto `main` drops that commit.
Facts re-checked on `da55f301` on 2026-09-21: the `::`-split fix from `fix/favorite-session-open` is already on `main` (#1128), so the shelf reuses `.pop()` as it is.

**Store (`stores/quickAccess.ts`)**
- Add one persisted field: `shelfPosition: { side: 'left' | 'right'; y: number } | null`, default `null`, plus a `setShelfPosition` action.
  - `side` is physical, so a snapped bubble stays put when the language changes; `null` means "trailing edge", resolved through `useAppDirection()` at render.
  - `y` is a fraction of the window height (0–1), so rotation or a different device re-clamps it instead of placing it off-screen.
  - `hydrate` reads it only when both fields have the right type; anything else stays `null`.
- No new key, no new store, no id re-keying.

**Pin bypass (`app/conversation/[id].tsx`)**
- `toggleFavorite` becomes `unpinItem(favoriteId)` / `pinItem({...same item...})`, then `animateStar()`.
- The direct `setState`, the manual `AsyncStorage.setItem`, the rollback and the `Alert` go, together with the `AsyncStorage` and `QUICK_ACCESS_STORAGE_KEY` imports.
  - The store's `subscribe` already persists, and a store action cannot fail, so there is nothing left to roll back. PR C's rollback is about server calls, not this.
  - `conversation:favorites.errorTitle` / `favorites.updateFailed` become unused; removed from all four locales so `test:i18n --unused` stays green.

**Badge (`lib/savedShelf.ts` + `hooks/useSavedShelf.ts`)**
- Pure helpers in `lib/savedShelf.ts`, all unit-tested:
  - `shelfTarget(fav)`: kind, server and id; the id is `sessionId`/`conversationId`, else `id.split('::').pop()`; `project-chat` uses `chatType`/`chatId`.
  - `indexShelfCache(sessions, conversations)`: maps keyed `serverId::id`.
  - `buildShelfEntries(favorites, cache)`: drops `dir`, keeps the favorites order, stable-moves needs-you items first. Needs-you is `deriveSessionPresentation(session).tier === 'needsYou'`, matched by `serverId` + session id.
  - `countNeedsYou(entries)`, `formatBadgeCount(n)` (`''` for 0, `'99+'` above 99), `labelFromCache(target, cache)`.
- `hooks/useSavedShelf.ts` is the one small "needs you" hook the brief asks for. It reads session data **passively** from the React Query cache: every `['sessions-eager', …]` list, which the Hub keeps fetched and the WebSocket keeps patched (`lib/eagerCacheSync.ts`).
  - It subscribes to the query cache with `useSyncExternalStore`, so it never starts a fetch of its own. Mounting `useEagerSessions` at the root would start a second full paginated fetch for every server.
  - Ceiling: a saved session absent from every cached list (not loaded yet, or filtered out by an active status filter) counts as not needing you, and shows no provider icon. Add a detail-cache lookup if that matters on device.
- No unread counter anywhere.

**Components (`components/shelf/`)**
- `ChatShelf.tsx` — the root overlay. Returns `null` unless `favoritesEnabled && favorites.length > 0`, and on the hidden screens.
  - Hidden screens, by `useSegments()[0]`: `onboarding` and `pair`. The biometric lock needs no rule: `BiometricLockGate` renders its lock screen *instead of* its children (`app/_layout.tsx:388`), so the shelf is not mounted while locked.
  - Hidden while the keyboard is open: opacity and `pointerEvents` follow `useReanimatedKeyboardAnimation().progress`, on the UI thread.
- `ShelfBubble.tsx` — the draggable bubble (phosphor `ChatsCircle`, 52 pt) plus the badge.
  - `Gesture.Race(Gesture.Pan(), Gesture.LongPress(), Gesture.Tap())` on one `GestureDetector`; no `Pressable` inside.
  - On pan end, snap `x` to the nearest side and clamp `y`; `withSpring`, or a direct assignment when `useReduceMotion()` is on. The final side and `y` fraction are written with `setShelfPosition` via `runOnJS`.
  - Sizes from `useWindowDimensions()` and `useSafeAreaInsets()`; nothing at module level.
  - Screen readers cannot perform gesture-handler gestures, so the bubble is `accessible` with role `button`, a `t()` label that includes the badge count, and `accessibilityActions` `activate` (open) and `longpress` (toggle save).
- `ShelfPanel.tsx` — RN `Modal` (transparent, fade; `animationType="none"` under reduce motion), a scrim that closes it, a close button, and a list of rows.
  - Row: label, `ProviderMark` when the provider is known from the cache, a needs-you dot, and the server label when more than one server is paired (`Object.keys(servers).length > 1`).
  - Empty state (only reachable when every saved item is a `dir`) reuses `components/ui/EmptyState`.
  - Pure presentational: gets items and an `onSelect`, so stories and tests need no router.
- `testID`s: `chat-shelf-bubble`, `chat-shelf-badge`, `chat-shelf-panel`, `chat-shelf-close`, `chat-shelf-row-<favorite id>`, `chat-shelf-empty`.
- Stories: `ShelfBubble.stories.tsx` (0, 3, 120 → `99+`; LTR/RTL) and `ShelfPanel.stories.tsx` (mixed items, one server vs two, empty). `ChatShelf.tsx` is a root composition reading router + stores, so it goes in `scripts/git-hooks/story-exempt.txt` with that reason.

**Selecting and toggling**
- `openSavedItem(target, router)` in `lib/savedShelf.ts` (the target comes from `shelfTarget(fav)`), used by the panel's `onSelect` after closing it:
  - `conversation`, and `project-chat` with `chatType: 'conversation'`: `router.push(conversationHref(id, serverId))`.
  - `session`, and `project-chat` with `chatType: 'session'`: `useNavLockStore.getState().lock()`, then `router.push('/session/<id>?server=<serverId>')`.
- Long-press toggles the current screen's item through `pinItem` / `unpinItem`:
  - `useSegments()` + `useGlobalSearchParams<{ id; server }>()`: `session/[id]` (not `session/new`) → `buildFavoriteId(server, 'session', id)`; `conversation/[id]` → `buildFavoriteId(server, 'conversation', id)`. Same ids the screens' stars use, so each star updates live.
  - Label from the cache (session name / conversation title), falling back to the id, as the screens already do.
  - Anywhere else, long-press does nothing. Toggling off the last saved item hides the bubble, which is the specified behaviour.

**Staying off the FAB, the jump pill and the question card**
- Default position: trailing edge at 35 % of the window height, well above the bottom band.
- The drag clamp keeps the bubble between the header (`insets.top + 56`) and a bottom band of `FAB_CLEARANCE` (exported from `components/ui/FAB.tsx`) + composer height (~64 pt) + `insets.bottom`. That band holds the FAB (bottom-right), the composer and the question card's resting position.
- The jump pills are horizontally centred (`alignSelf: 'center'`), and the bubble is always snapped to a side edge, so they never overlap on any width ≥ 320 pt.
- Known limit: a tall question card grows above the band and can sit under the bubble. The user can drag the bubble away, and the position is kept. If that shows up on device, hiding the bubble while `useActiveQuestion` reports a question is a follow-up.

**Root mount (`app/_layout.tsx`)**
- `<ChatShelf />` goes after `<ThemedStack />` and before `<AlertHost />` and `<NavigationLockOverlay />`, so alerts and the nav-lock overlay stay on top of it.

**Strings**
- New `shared:shelf.*` keys in en, he, ar and ru: open label (with count), close, panel title, empty title/subtitle, needs-you label, saved/removed announcements for the long-press. Every one through `t()`, and no conditional text inline in JSX.

**Tests**
- `__tests__/unit/lib/savedShelf.test.ts`: needs-you count (tier match, other-server ids, legacy `srv::id` ids, `dir` ignored), `formatBadgeCount` (0, 1, 99, 100), sort order, provider lookup, and `openSavedItem` (lock + session push, `conversationHref` push).
- `__tests__/unit/hooks/useSavedShelf.test.tsx`: the count follows a cache update, infinite conversation pages are read, and an empty cache starts no fetch.
- `__tests__/integration/components/ChatShelf.test.tsx`: the hidden rules, the badge, row order, selecting a session and a conversation from the panel, the empty state and close, and long-press save/remove (through the bubble's accessibility actions, which call the same handlers as the gestures).
- `__tests__/unit/stores/quickAccess.test.ts`: `shelfPosition` persists under the existing key, and malformed values hydrate to `null`.
- No existing test asserted on the conversation screen's manual AsyncStorage write, so none needed updating.
- Maestro `e2e/chat_shelf.yaml`, added to `test:e2e:mock` (the shard manifest reads that script, so no workflow edit):
  - `setup.yaml` → deep-link `conv-111` → tap the conversation header star (gets `testID="conversation-favorite-toggle"`; the only production change the flow needs) → back to the Hub → tap `chat-shelf-bubble` → assert `chat-shelf-panel` → tap the row → assert `conversation-bottom-bar`.
  - As built: a conversation rather than a session, because leaving a live session raises the leave guard (`leave_session_nav.yaml`). Uses the existing fixtures.

**Checks before any commit**
- `npm run lint && npm run typecheck && npm run test:ci && npm run test:i18n`, plus `npx eslint` on the staged files.
- Any `SessionScreen` failure re-run alone with `--runInBand` before calling it anything.
- Then `jev-check` with the criteria file, and every CHECK row read by hand, before asking for review.
- Rebase check against the branches the brief lists (`feat/alert-host-arbiter`, `feat/notification-prefs-sync` on `app/_layout.tsx`; the keyboard and jump-FAB branches) before committing; report conflicts rather than resolving them on their behalf.

**Not in PR A:** any server call, sync, or `ServerInfo` flag (PR C); reorder inside the panel (the Manage Favorites screen already does it); haptics.

**Decided in review (2026-09-21):** the bubble and the Hub's New Session FAB stay separate.
Merging them (a FAB that carries the badge and opens the shelf on long-press, Hub-only or app-wide) was considered and deferred to a later change; the FAB exists only on the Hub (`app/index.tsx`), so a merge has to settle what the other screens show.
