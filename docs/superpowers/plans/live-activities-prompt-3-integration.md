Integrate and verify Feature 12 — Live Activities — across tb-mobile and tb-streamer. Both halves were built independently and have never run against each other.

## What already exists

**tb-mobile** (worktree `~/dev/ai-tools/tb-mobile-worktrees/feat-live-activities`, stacked on `integration-merge-354-355-376`):
- 5 stacked PRs: expo-widgets target, shared contract, iOS rendering, cold-start deep links, Android ongoing notification.
- Live Activities update over the existing WebSocket. No push. No renewal past ~8h.
- The shared contract lives in `types/live-activity.ts`.

**tb-streamer** (worktree `~/dev/ai-tools/tb-streamer-worktrees/feat-live-activity-push`, stacked on `integration/missing-prs-2026-07-23`):
- 3 stacked PRs: token persistence, direct APNs sender, renewal scheduler.
- Sends ActivityKit pushes but has never been exercised by a real client.

Read `~/dev/ai-tools/tb-mobile/docs/superpowers/plans/2026-07-25-live-activities-two-phase-runbook.md` for the full design, the seven decisions, and the verification checklist. Run this session from the tb-mobile repo; reach into the tb-streamer worktree by absolute path when you need it.

## Step 1 — Contract reconciliation (do this before anything else)

The two halves were written against the same spec but never compiled against each other. A silent mismatch here breaks the surface with no error.

- Compare the mobile `LiveSessionState` in `types/live-activity.ts` against the `content-state` the streamer actually sends.
- Verify field-by-field: names, types, and especially that `startedAt` is **epoch milliseconds on both sides** and that `status` is constrained to `'running' | 'waiting_input'` on both.
- Confirm the payload stays under APNs' 4 KB limit with a realistic 90-character `lastOutput`.
- Confirm the token `kind` values the app sends are exactly the ones the streamer stores.

Any mismatch: fix it in whichever side is wrong per the runbook, as a new stacked PR on that repo's stack. If the runbook itself is ambiguous, **stop and ask me** — the contract is shared and I want to approve a change to it.

## Step 2 — Mobile Phase 1b (the two PRs Prompt 1 deliberately skipped)

Stack these on top of the existing mobile stack (base = the Android PR's branch, the last in that stack):

| PR | Branch | Title |
|----|--------|-------|
| 6 | `feat/live-activity-push-tokens` | `feat(live-activity): capture activitykit push tokens` |
| 7 | `feat/live-activity-renewal` | `feat(live-activity): renew activities past the 8h cap` |

**PR 6:** set `enablePushNotifications: true` in the `expo-widgets` plugin block; capture the app-wide push-to-start token via `addPushToStartTokenListener` and the per-activity token via `instance.getPushToken()`; send both to `/api/push/register` with the correct `kind`. These are NOT Expo tokens — do not route them through `getExpoPushTokenAsync`.

**PR 7:** consume push-delivered updates and renewals; ensure a renewal swap preserves the displayed elapsed time.

Re-run `pod install` and commit `ios/Podfile.lock` with the package changes.

## Step 3 — Credentials (I supply these; stop if absent)

You need an APNs p8 key, key id, team id, and bundle id from me. **Never invent, guess, or commit them.** Configure via environment only. Also confirm with me whether `aps-environment` should move from `development` to `production` — that changes the entitlement and which APNs host you target.

If I haven't given you these, stop here and say so.

## Step 4 — End-to-end verification on a physical device

The simulator does not render the Dynamic Island reliably, and Maestro cannot observe the Lock Screen or Island at all. This is a manual device pass — do not try to automate it.

Run the runbook's §6 Task 8 checklist plus these integration-only cases:

- [ ] A session started with the app **foregrounded** raises a Live Activity within ~1s (WS path).
- [ ] With the app **force-quit**, a status change still updates the surface (push path — this is the thing that only works once both halves are live).
- [ ] Elapsed time ticks with the app force-quit (proves the native timer, not JS).
- [ ] A session crossing the ~8h mark keeps its surface **without the app being opened**, and elapsed time reads continuously across the renewal — **no reset to 0:00**. This is the single most likely failure; verify it deliberately.
- [ ] A session that ends inside the renewal window does NOT resurrect.
- [ ] 4 concurrent sessions → exactly 3 activities; least-recently-updated evicted.
- [ ] Tap from Lock Screen, both warm and **cold start**, lands on the correct session AND the correct server.
- [ ] Multi-server: two servers with live sessions produce correctly attributed surfaces.
- [ ] WS drops but push still flows → surface stays accurate rather than going stale.
- [ ] Revoked notification permission → app functions normally, no crash, no error dialog.
- [ ] Android: promoted chip on 16+, plain ongoing notification below, correct deep link.

Anything that fails: fix it as a new stacked PR on the appropriate repo, then re-verify.

## Step 5 — Merge, in strict order

Only after Step 4 fully passes and every PR's CI is green.

**One PR at a time, dependency order first, never in parallel.** For each: rebase onto the latest base (`/opt/homebrew/bin/git fetch origin && /opt/homebrew/bin/git rebase origin/<base>`), push with `--force-with-lease` (never plain `--force`, never force-push a shared branch), wait for CI to go green, then `gh pr merge <N> --squash --delete-branch`.

Merge the **streamer stack first** — the mobile push path is useless without a server that can send. Then the mobile stack in order.

After each merge the base advances, so the next PR in the stack must be rebased again before merging.

- If CI is red on an obviously flaky/infra failure, re-run **once**. Still red → stop and report. Never merge red.
- If any single step hangs more than ~4 minutes, stop and report rather than waiting.

## Work autonomously

Do not stop between steps. You have standing approval to commit, push feature branches, open PRs, and — once Step 4 passes and CI is green — squash-merge the stacks in the order above.

**Stop and ask me if:**
- The shared contract needs changing (Step 1).
- Credentials are missing or the `aps-environment` decision is unmade (Step 3).
- A device verification fails in a way that implies a design flaw rather than a bug.
- CI is red twice on the same PR.
- Merging would require a force-push to a shared branch or any protection bypass.

## Repo rules (both repos)

- **Never** push directly to `main` or to either integration branch.
- **No AI attribution** in commits, PR bodies, or squash titles. Hooks reject it.
- **Conventional commit titles**; squash titles must also be conventional.
- **One sentence per line** in all GitHub-bound text.
- **Never** comment on, reply to, or react to any GitHub issue or PR.
- No secrets in code, tests, fixtures, logs, docs, or PR bodies.
- `expo prebuild` always `--no-clean`.
- No `any`/`unknown` without asking.

## Report when done

- Every PR across both repos: number, repo, merge status, final squash SHA.
- The device verification checklist with each item marked pass/fail.
- Any behavior that differs from the runbook's stated design.
- Remaining known limitations, and the smartwatch follow-on as a pointer only (`docs/roadmap/tasks/smartwatch-session-surfaces.md`, which lands only when `origin/docs/smartwatch-roadmap` merges).
