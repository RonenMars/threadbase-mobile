# Evidence — repo-health findings, 2026-08-09

**Background for the briefs in this directory.** The original write-up from the Codex active-writer / E2E session, kept whole so the reasoning and measurements behind each task survive. Read it once before starting; the briefs assume it.

Each numbered section below became a brief:

| Section | Brief |
|---|---|
| 1. Scheduled workflow failures | [`01-scheduled-run-notifications.md`](./01-scheduled-run-notifications.md) |
| 2. `dependabot.yml` ignore list | [`02-dependabot-ignore-list.md`](./02-dependabot-ignore-list.md) |
| 3. E2E suite signal | [`03-e2e-suite-signal.md`](./03-e2e-suite-signal.md) |
| 4. Stale release builds | [`04-ensure-release-build-staleness.md`](./04-ensure-release-build-staleness.md) |
| 5. Nested worktrees | [`05-nested-worktree-cleanup.md`](./05-nested-worktree-cleanup.md) |
| 6. The integration branch | [`06-integration-branch-decision.md`](./06-integration-branch-decision.md) — a decision, not a task |

Every item is something that session actually hit, not a general-practice list. Independent of the ADR 0001 follow-ups in `../mobile/` and `../streamer/` — nothing here blocks those, and no existing brief claims any of it.

## 1. Nothing reports a failed scheduled workflow

**Priority: highest.**

The Maestro E2E job failed on **2026-06-01, 2026-07-01 and 2026-08-01** — three consecutive monthly runs — and it surfaced only because someone dispatched it by hand while working on something else.

A scheduled job has no PR to report into, so a red run is written to the Actions tab and nowhere else. The result is worse than having no monthly gate: the job's existence implies coverage that was not there for a quarter.

The plan already exists. `docs/deploy-failure-notifications-plan.md`, last checklist item:

```
- [ ] (Optional) Mirror the same job into `test.yml` if CI-test failures also warrant a push alert.
```

Three silent months is the argument for dropping "optional", at minimum for `schedule`-triggered runs. Scope it to the E2E workflow (`.github/workflows/e2e.yml`) if a full mirror feels heavy — that is the only scheduled job whose failure nobody sees.

**Acceptance:** a failed scheduled E2E run produces a notification through the same path the deploy failures use.

## 2. `dependabot.yml` has no `ignore` list

**Priority: high. Smallest change here — roughly six lines.**

`.github/dependabot.yml` is the stock file: npm, weekly, nothing else. So two structurally unmergeable PRs are re-raised indefinitely:

| PR | Bump | Why it cannot merge |
|----|------|---------------------|
| #557 | `jest` 29 → 30, `@types/jest` 29 → 30 | `jest-expo@57` depends on the jest 29 family (`babel-jest`, `jest-environment-jsdom`, `jest-snapshot` all `^29.2.1`). npm hoists `jest-mock@29` under `jest-runtime@30`, and every suite dies at `resetModules` with `this._moduleMocker.clearMocksOnScope is not a function`. Zero tests run. |
| #291 | `typescript` 6.0.3 → 7.0.2 | `@typescript-eslint/typescript-estree@8.61.0` declares `typescript >=4.8.4 <6.1.0`; TS 7 crashes it at load on `ts.Extension.Cjs`. Note `tsc --noEmit` stays green — this is a lint-toolchain limit, not a source problem. |

Both were merged into an integration branch in early August and broke every PR targeting it until they were reverted (#577). The bumps themselves are still open against `main` and still red for exactly these reasons, which is independent confirmation on a second branch.

```yaml
      ignore:
        - dependency-name: "jest"
          versions: ["30.x"]          # jest-expo@57 pins the jest 29 family
        - dependency-name: "@types/jest"
          versions: ["30.x"]
        - dependency-name: "typescript"
          versions: ["7.x"]           # outside @typescript-eslint peer range <6.1.0
```

Lift each entry when the real constraint lifts — jest when Expo ships a jest-30 preset (an SDK upgrade, not a package bump), typescript when `eslint-config-expo` moves to a typescript-eslint that parses TS 7.

**Acceptance:** #557 and #291 closed, and neither reappears on the next weekly run.

## 3. The E2E suite cannot gate anything at 11/15

**Priority: high.**

Four flows fail for known reasons unrelated to any current change:

| flow | fails at |
|---|---|
| `session_lifecycle` | `hub-screen is visible` |
| `feedback_flow` | `settings-help-feedback-row is visible` |
| `05_chat_flow` | `first-session-card is visible` |
| `06_search_anchor` | `conversation-row-conv-search-anchor is visible` |

Red is therefore the expected state, so nobody can tell new breakage from the familiar four. That is why the suite could sit broken at the build step for three months without anyone reading the result — even a green build would have produced a red suite.

Two ways out, either acceptable:

- fix them (mobile follow-up task 06 already covers this), or
- quarantine them explicitly — a `test:e2e:mock:known-good` script, or Maestro tags — so **red means new-red**.

The `flows` input added in #574 lets you dodge them per-run, but that is a workaround for a signal problem, not a fix.

**Acceptance:** a passing run is the normal outcome, and any red run means something changed.

## 4. `e2e/ensure-release-build.js` silently reuses a stale build

**Priority: high — this class of bug is the expensive one.**

Recorded during the ADR 0001 session: *"one full suite run this session tested a week-old `.app` and reported it as current."*

The script does not fail on a stale build — it produces a confident, wrong result. The current workaround is a manual check nobody will remember:

```bash
grep -ac "<string you just added>" \
  "$(xcrun simctl get_app_container <udid> com.ronenmars.threadbase)/main.jsbundle"
```

The script already resolves the `.app` path, so it can compare a build stamp or bundle hash against `HEAD` and rebuild — or at minimum warn loudly — when they diverge.

Worth stating plainly because the session that produced this document hit three more bugs of the same shape: a `node_modules` borrowed from another worktree (verified the wrong dependency versions), bash logic checked under zsh (reported a false failure), and a zsh `:e` modifier eating a git path (returned an empty file, which `grep -c` scored as `0`). **None of them errored. All of them returned a plausible answer to a question nobody asked.** Harness code that can silently answer the wrong question deserves an assertion.

**Acceptance:** running the suite against a stale build either rebuilds or fails, and never reports a pass.

## 5. Fifteen worktrees nested inside the repo

**Priority: medium. Pure cleanup.**

43 worktrees exist; **15 live under `tb-mobile/.worktrees/`**, most untouched since 2026-07-24.

`CLAUDE.md` forbids this explicitly, with the reasoning attached: a nested worktree is a full second copy of the tree, so repo-root tooling walks into it and treats those files as part of this project. The documented incident is jest reporting phantom failures from a stale branch.

`package.json`'s jest config does ignore `<rootDir>/.worktrees/`, so jest specifically is covered. That is one tool — ESLint, TypeScript, Metro and `git grep` all still descend into them.

```bash
git worktree list                     # review first
git worktree remove <path>            # for each finished one
git worktree prune
```

**Acceptance:** no worktree under the repo root, and the July ones removed.

## 6. Retire the long-lived integration branch

**Priority: structural — a decision, not a task.**

This is the root cause of most of the friction on 2026-08-09. The evidence:

- Two dependabot bumps landed in `integration/open-prs-291-544-…-569` and broke **every** PR targeting it, for reasons unrelated to any of those PRs.
- Recovering meant rebuilding the branch on top of `main`.
- #575 and #580 now conflict, because their content reached both branches by another route.
- Two parallel agent sessions produced merge-order documents that disagreed about which was authoritative.
- Meanwhile **14 of 20 open PRs were green and clean against `main` individually.**

The branch is not earning its cost. Merging straight to `main` — what #572, #576 and #578 ended up doing anyway — gave a clean signal every time.

If integration branches stay for release batching, two rules would have prevented all of the above: keep them short-lived, and never merge dependabot into one. A dependency bump belongs on `main`, where a single PR's checks tell you whether it works.

**Acceptance:** an explicit decision recorded — retire it, or keep it under those two rules.

## Smaller things

**One authority for merge order.** `tb-PRs-follow/mobile/` (mirrored at [`../pr-tracking/`](../pr-tracking/README.md)) holds five overlapping documents, and two of them claim to be the source of truth for merge sequencing. Designate one; make the others point at it.

**Cross-repo note links are pinned to a branch.** `pr-tracking/README.md` links the streamer-side notes at `docs/pr-follow/` on `tb-streamer`'s `docs/pr-follow-notes` branch ([tb-streamer#468](https://github.com/RonenMars/threadbase-streamer/pull/468)). Those URLs break when the branch is deleted after merge — repoint them then, or the mirror acquires dead links.

**`docs/adr/0001-followup-05-chat-flow-hidekeyboard.md` is not an ADR.** It is a task prompt — "Hand this to a Claude Code session in `tb-mobile`" — sitting in a directory of architecture decision records. The same content already exists as a proper brief at `docs/followups/mobile/05-chat-flow-hidekeyboard.md`. Anyone browsing `docs/adr/` will be misled about what that directory contains; the copy under `docs/adr/` should move or go.

## What is not recommended

- **Do not fix the jest flags inside a feature PR.** `--testPathPattern` → `--testPathPatterns` is the visible error but not the cause; the runtime mismatch sits behind it, and patching the flag moves the failure one step later while spreading a base-branch fix across unrelated changes.
- **Do not widen the E2E suite before item 3.** More flows against a signal nobody trusts adds cost without adding information.
