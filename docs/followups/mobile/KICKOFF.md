# RUN THIS — paste this whole file into a fresh Claude Code session at the root of tb-mobile

**You are the orchestrator for the tb-mobile ADR 0001 follow-ups. Everything below is your instruction set, not a menu.**

Do this:

1. Read `docs/followups/mobile/00-orchestrator.md` in full — dependency graph, worktree setup, and shared rules including five traps that have already produced wrong-but-plausible results on this work.
2. **Work in a worktree, one per task.** Tasks 01–04 base on `origin/integration/open-prs-291-544-551-553-554-556-557-558-559-560-563-566-567-568-569` (they build on #576); tasks 05+06 and 07 base on `main`, which is independent of the ADR chain. Confirm the integration branch is still the active one first. Worktrees go *outside* the repo root, and `node_modules` must be a real copy (`cp -Rc`), never a symlink — a symlink makes Metro bundle the wrong tree silently.
3. Execute the tasks in the wave order below. Read a task's brief in `docs/followups/mobile/` before starting it; the briefs record findings that cannot be recovered by reading the code.
4. Run a wave's tasks in parallel only if each gets its own worktree. Otherwise run them sequentially in the same order — slower, never wrong.
5. Branch and PR per task per `CLAUDE.md`; commit approval before committing.
6. Report each task's verification command and its **actual output**, not a summary.

```
wave 1:  07  ‖  05+06  ‖  01     (01 needs #576 merged; 05+06 are unblocked on main)
wave 2:  02  ‖  03               (both need 01 merged)
wave 3:  04                      (alone — device exclusive, nothing else building)
```

Constraints behind that order: `app/index.tsx` is contended by 01 and 03, and there is one simulator, needed exclusively by 04 and by 05+06.

Waves 2 and 3 are gated on *merges*, which need review and CI. Completing wave 1 and reporting that you are blocked is the correct outcome, not a stall.

Streamer-side work is a separate set — see `docs/followups/streamer/KICKOFF.md`. Do not do it from this session.

---

## The tasks

Each block is the message for that task — hand it to a subagent, a separate session, or do it yourself.

### 01 — retire the eager drain

> Read `docs/followups/mobile/01-retire-eager-conversations.md` and do it.
>
> Needs PR #576 merged into the integration branch; if it is still open, base on `feat/lazy-project-summary-groups` instead.
>
> You own `app/index.tsx` and `hooks/useConversations.ts` for the duration; no other stream may touch them. The live-sessions-on-top sort contract on `mergedClassicItems` is the part most likely to break silently.

### 02 — conversation cache-patch

> Read `docs/followups/mobile/02-conversation-cache-patch.md` and do it. Only start once task 01 has merged — it deletes one of the caches this patches.
>
> `applySessionUpdateToEagerCache` in `lib/eagerCacheSync.ts` is the working model; mirror it. Delete the #565 debounce once the patch works — keeping both hides a broken patch.

### 03 — colocate the Hub subscriptions

> Read `docs/followups/mobile/03-colocate-hub-subscriptions.md` and do it. Only start once task 01 has merged — you both rewrite the same region of `app/index.tsx`.
>
> The goal is that the root stops subscribing, not that it re-renders more cheaply. `React.memo` on the list roots already exists and is not the fix.

### 04 — render measurement

> Read `docs/followups/mobile/04-render-measurement.md` and do it. Only after 02 and 03 have merged, and only when nothing else is building — you need the simulator exclusively.
>
> This is ADR 0001's actual success criterion and it has never been measured. Verify the trace flag is inlined in the served bundle and that you are not on a cached dev-client bundle *before* recording anything; both traps return a plausible wrong number rather than an error.
>
> If the target is missed, the `[why]` output naming the remaining churn source is the deliverable.

### 05 + 06 — the e2e suite (one stream, owns the simulator)

> Read `docs/followups/mobile/06-mock-suite-remaining-failures.md` and `docs/followups/mobile/05-chat-flow-hidekeyboard.md`, then fix all four remaining mock-suite failures.
>
> Base on `main`. The onboarding repair reached `main` via PR #578, so the suite already gets past onboarding there — #575 is the same fix against the integration branch and is not a prerequisite for you.
>
> All four are confirmed pre-existing — each reproduced in isolation and against a build of the branch base. Fix the flows, not the app; if you find a genuine product bug, stop and report it rather than folding an app change into a test PR.
>
> Before believing any pass, grep the installed `main.jsbundle` for a string you just added: `ensure-release-build.js` silently reuses stale builds and has already caused one suite run to be reported as current when it tested week-old code.

### 07 — pair deep link

> Read `docs/followups/mobile/07-pair-deep-link-route.md` and do it.
>
> `tb pair` prints a `threadbase://pair?...` link that lands on Expo Router's Unmatched Route. The parsing already exists in `services/pair-exchange.ts` and is correct — it is only reachable from in-app paste and QR. Add the route that hands the URI to the same exchange.
>
> Follow `lib/coldStartDeepLink.ts` for the cold-start case rather than inventing a second mechanism, and give expired links a real error state.
