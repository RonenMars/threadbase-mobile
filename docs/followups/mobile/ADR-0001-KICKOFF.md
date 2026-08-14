# Kick-off — Implement ADR 0001 across all three Hub views (hub / tree / classic)

Implementation brief for [ADR 0001](../../adr/0001-hub-data-layer-lazy-pagination.md). Builds on the classic-History prototype in PR #568.

## Goal

Retire the eager conversation full-drain (`useEagerConversations`) across every Hub surface, replacing it with lazy loading that respects each view's structure. Confirm on-device that `ProjectsHub` settles to ~1 render per real data change (down from the ~6/sec loop this work started from).

## The core tension (why this is not one pattern)

The three views have different data shapes, so "paginate the list" does not apply uniformly.

| View | Component | Structure | Natural loading model |
|------|-----------|-----------|-----------------------|
| **Classic** | `ConversationList` / `ClassicSessionsList` | Flat list of all items | **Row pagination** — infinite scroll (the PR #568 prototype). Direct fit. |
| **Tree** | `TreeSessionsList` → `buildTree(sessions, conversations)` | Grouped by directory | **Group-first, expand-to-load** — the tree cannot be built without all items, so do not fetch them until a directory is expanded. |
| **Hub** | `ProjectHubList` | Grouped by project / directory | Same as tree — group-first, expand-to-load. |

Row pagination on a grouped view is wrong: `buildTree` / `compactTree` need the full set to place items under directories, so lazily appending a flat page would scatter items into a half-built tree.

## Proposed direction (validate before building)

1. **Split the two data classes — they have opposite constraints.**
   - **Sessions** (small, must always be complete): keep eager. Live sessions must sort to the top regardless of scroll, which pagination would break, and sessions are cheap (single-digit counts on real servers). Do not paginate them.
   - **Conversations** (large, the actual pain — 600+ on a real server): this is what goes lazy.
2. **Classic History → row pagination.** Extend the PR #568 prototype: verify scroll-to-load, empty/error states, pull-to-refresh, and search coexistence. This surface is essentially done in prototype form.
3. **Tree / Hub → group-first, expand-to-load conversations.**
   - Render the directory/project structure immediately from the (eager) sessions plus a cheap group list — evaluate `/api/projects` as that source.
   - Fetch a directory's/project's conversations lazily on expand, via `/api/conversations?project=<path>&limit=&offset=` (already supported) with a per-group `useInfiniteQuery` keyed by `(serverId, projectPath)`.
   - Mirrors how a file explorer loads a folder's contents on open.

## Open questions to resolve FIRST (do not code until answered)

- Does `/api/projects` return each project's conversation count and a last-activity timestamp, so collapsed groups can render and sort without fetching their items? If not, is there a cheap aggregate, or does the backend need a small addition?
- Does `/api/conversations?project=` support the same sort/filter the Hub applies globally, so a group's page is ordered correctly?
- How do collapsed groups show a meaningful preview/count without their items loaded, and what is the expand → load → render skeleton?
- Multi-server: groups are per-`(serverId, projectPath)`. Confirm the tree already partitions by server (`TreeSessionsList` does `sessions.filter(s => s.serverId === serverId)`), so per-group queries slot in cleanly.
- Search: `/api/search` is already separate and flat — keep it bypassing the grouped path, as classic search does today.

## Deliverables

- A per-group conversations hook (e.g. `useProjectConversations(serverId, projectPath)` on `useInfiniteQuery`) and a group-list source for tree/hub.
- `TreeSessionsList` / `ProjectHubList` fetching conversations on directory expand, not up front.
- Classic History finalized from the PR #568 prototype; sessions left eager everywhere.
- `useEagerConversations` deleted once all three surfaces are migrated (ADR step 2).
- Then ADR steps 3–4 (conversation cache-patch replacing the #565 debounce; colocating sync/status/progress subscriptions out of the Hub root) as separate PRs.

## Verify (mandatory — this whole effort exists because the fix must be measured)

- Instrument with `useRenderTally` / `useWhyRender` (`lib/openTrace.ts`) and read `.expo/dev/logs/start.log`.
- The flag lives in `.env.local` (`EXPO_PUBLIC_OPEN_TRACE=1`), not a shell export; force-fresh the dev client by reinstalling. Both traps are documented in [`docs/troubleshooting.md`](../../troubleshooting.md) → "Measuring the wrong thing".
- Test against the two real servers (one with 600+ conversations). Success = the Hub does not eager-drain, grouped views load a directory only on expand, live sessions still surface to the top, and the `[render]` count settles to ~1 per real data change.

## Constraints

- Follow `CLAUDE.md`: branch-per-change + PR, no `unknown` / `any` without approval, Phosphor icons only, no AI attribution, commit approval.
- Ship per the ADR migration order, one surface per PR — each independently measurable.
- Base off `main`; PR #568 (prototype) may merge first, or rebase onto it.
