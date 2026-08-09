# Release backlog — ranked for a public release, 2026-08-09

Every follow-up brief in this directory, in one list, ranked by what it costs at a **public release** rather than by engineering tidiness. That lens reorders things: a silent wrong answer in a path decode outranks an unmeasured render target, and a test harness that can lie outranks both.

Sources: `mobile/` (7 briefs, ADR 0001), `streamer/` (3 briefs), `repo-health/` (6 briefs). Live PR states were re-checked rather than taken from the briefs — several had moved.

**Severity** is what a real user experiences. **Priority** is how much it should gate shipping. They diverge, which is why both are here.

Re-verify before acting; this is a snapshot.

## Ships broken to real users — fix before release

| # | Item | Sev | Pri | Why |
|---|---|---|---|---|
| 1 | [streamer 01](./streamer/01-land-path-decode-fix.md) — project path decode (**PR #461 open**) | **Critical** | **P0** | `dirName.replace(/-/g, "/")` reverses *every* hyphen, so `-Users-me-tb-mobile` decodes to `/Users/me/tb/mobile`. Measured on a real server: **0 conversations returned where 37 exist**. Hits any project with a hyphen inside a path segment — most repos, including this org's. No error surfaces at any layer: the UI shows a correct count on a collapsed group and an empty list on expand. **Confirmed still live on streamer `main`** (`src/handlers/handleListProjects.ts:9`, checked 2026-08-09). |
| 2 | [mobile 07](./mobile/07-pair-deep-link-route.md) — `threadbase://pair` hits "Unmatched Route" | **High** | **P0** | Onboarding tells users to paste the full `threadbase://` link; doing so lands on Expo Router's error screen. A **first-run failure on the documented path** — the worst placement for a public launch. `parsePairUri` and `classifyPairCredential` already handle the URI correctly; only the route is missing. |
| 3 | [streamer 03](./streamer/03-decide-api-projects-source.md) — `/api/projects` cannot see Codex | Medium-High | P1 | A `readdirSync(~/.claude/projects)` scan structurally cannot see Codex rollouts, so a Codex-only project is invisible however the decode is fixed. Severity hinges on whether any consumer remains — mobile moved to `/api/projects/summary` in #576. **Find the consumers before ranking this.** |

## Performance and correctness users feel

| # | Item | Sev | Pri | Why |
|---|---|---|---|---|
| 4 | [mobile 01](./mobile/01-retire-eager-conversations.md) — retire `useEagerConversations` | High | P1 | The last ~13-sequential-page fetch per server per refresh — real battery, data and latency cost on device. Blocks 02 and 03. |
| 5 | [mobile 03](./mobile/03-colocate-hub-subscriptions.md) — colocate Hub subscriptions | High | P1 | `ProjectsHub` re-rendered hundreds of times and never settled; `serverFetchStatus` alone accounted for 57 of 120 commits before #566. Visible jank. |
| 6 | [mobile 02](./mobile/02-conversation-cache-patch.md) — patch the cache instead of invalidating | Medium | P2 | `conversation_updated` frames burst per liveness ping and trigger a re-drain. #566's debounce paces it; this removes the cause. |
| 7 | [mobile 04](./mobile/04-render-measurement.md) — measure the render target | Medium | P2 | ADR 0001's actual criterion — ~1 render per real data change — **has never been measured**. Mechanism evidence exists and is explicitly not the criterion. This is the proof that 4, 5 and 6 worked. |

## Release-process risk — you could ship something you never tested

Not user-facing, but for a public release these are what stand between you and shipping a regression unknowingly.

| # | Item | Sev | Pri | Why |
|---|---|---|---|---|
| 8 | [repo-health 04](./repo-health/04-ensure-release-build-staleness.md) — stale build silently tested | **High** | **P1** | `e2e/ensure-release-build.js` reuses a stale `.app` without failing. One full suite run tested a **week-old build and reported it as current**. Pre-release this invalidates verification itself — you can "test" a build you never built, and every other item's sign-off inherits the doubt. |
| 9 | [repo-health 01](./repo-health/01-scheduled-run-notifications.md) — no alert on scheduled failures | High | P1 | The Maestro job failed 2026-06-01, 07-01 and 08-01 undetected. Going into a public release, the only regression gate has been silently off for a quarter. |
| 10 | [repo-health 03](./repo-health/03-e2e-suite-signal.md) — E2E cannot gate at 11/15 | Medium | P2 | Red is the expected state, so new breakage is indistinguishable from the familiar four. Depends on 8. |
| 11 | [mobile 06](./mobile/06-mock-suite-remaining-failures.md) — three pre-existing suite failures | Medium | P2 | The concrete work behind 10. Fix the flows, not the app — and stop and report if a genuine product bug turns up. |
| 12 | [mobile 05](./mobile/05-chat-flow-hidekeyboard.md) — `05_chat_flow` `hideKeyboard` | Low | P3 | A Maestro 2.6.1 / iOS 26.x platform break, not a flow bug. Note the flow currently fails *earlier*, at `first-session-card`. |

## Hygiene — no release impact

| # | Item | Sev | Pri | Note |
|---|---|---|---|---|
| 13 | [streamer 02](./streamer/02-land-message-count-removal.md) — drop dead `message_count` (**PR #462 open**) | Low value, **real risk** | P3 | The change is minor; the mechanism is not. It drops a column against users' existing `runtime.db`, and SQLite's `DROP COLUMN` support depends on the bundled `better-sqlite3` — a table rebuild may be needed. A bad migration inside a release window is a data problem, not a tidiness one. **Land it well before a release, or defer past it.** |
| 14 | [repo-health 02](./repo-health/02-dependabot-ignore-list.md) — dependabot ignore list | Low | P3 | ~6 lines of YAML. Stops #557 and #291 being re-raised indefinitely. |
| 15 | [repo-health 05](./repo-health/05-nested-worktree-cleanup.md) — 15 nested worktrees | Low | P4 | Local developer environment only. Zero release impact. |
| 16 | [repo-health 06](./repo-health/06-integration-branch-decision.md) — retire the integration branch | Low | P4 | A decision, not a task. Blocks no release, but #575 and #580 stay orphaned until it is answered. |

## If only three things happen before release

**1**, **2** and **8**.

The first two ship visibly broken behaviour to new users along paths the product itself documents. The third means you cannot trust that anything else on this list is actually fixed — including the fixes for 1 and 2.

## Not captured by any brief

- **tb-streamer#463 merged.** The server half of the Codex fork contract is on `main` and answers the idempotency question *the other way* from what mobile assumed. The **Retry affordance deliberately withheld in mobile #572 can now be restored** — cheap while #572 is still open, awkward afterwards.
- **`mobile/07-pair-deep-link-route.md` is titled `# 08`** internally. Cosmetic, but it will confuse anything matching filenames to headings.

## What was re-checked rather than trusted

The briefs were written across two sessions and several of their claims had already moved:

| Claim in a brief | Verified state, 2026-08-09 |
|---|---|
| streamer #461 open | still open; the decode bug is live on streamer `main` |
| streamer #462 open | still open |
| streamer fork half unimplemented | **wrong** — #463 is merged |
| #575 / #576 blocked on the integration branch | #576 re-targeted to `main` and green; #575 orphaned and conflicting |
