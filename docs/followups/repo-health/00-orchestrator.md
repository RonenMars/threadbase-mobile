# tb-mobile — orchestrator for the repo-health follow-ups

Six items from the Codex active-writer / E2E session of 2026-08-09. Each is something that session hit, not a general-practice list. Full reasoning and measurements are in [`EVIDENCE.md`](./EVIDENCE.md); the briefs assume you have read it.

Unrelated to the ADR 0001 follow-ups in `../mobile/` and `../streamer/` — nothing here blocks those, and no existing brief claims any of it.

## Where the work happens

**Every task works in a worktree, based on `main`.** None of these depend on the integration branch — and task 06 is the question of whether that branch should exist at all.

```bash
git worktree add ../tb-mobile-worktrees/<slug> -b <type>/<slug> origin/main
```

Worktrees go **outside** the repo root. Task 05 exists because fifteen of them did not.

## Waves

| Wave | Tasks | Why grouped |
|---|---|---|
| 1 | [02](./02-dependabot-ignore-list.md), [05](./05-nested-worktree-cleanup.md) | Trivial and independent. 02 is ~6 lines of YAML; 05 is local cleanup with no PR. |
| 2 | [01](./01-scheduled-run-notifications.md), [04](./04-ensure-release-build-staleness.md) | Independent of each other and of wave 1. Both touch CI/harness, neither touches app code. |
| 3 | [03](./03-e2e-suite-signal.md) | Needs a working E2E build to confirm the pass set, so it follows 04. |
| — | [06](./06-integration-branch-decision.md) | **A decision. Do not execute.** Present options and stop. |

Ordering between waves 1 and 2 is convenience, not dependency — 03 after 04 is the only real edge.

## Shared rules

- **One PR per task**, conventional title, no AI attribution (`CLAUDE.md`).
- **Docs-only changes get `[skip-ci]`** automatically from the commit-msg hook, because `docs/` is not in `scripts/git-hooks/ci-paths.txt`. Expect no checks on those; that is correct, not a failure.
- **Report actual command output.** Every trap below produced a plausible summary that was wrong.

## Traps that have already produced wrong results here

These are not hypothetical. Each one cost real time on 2026-08-09, and none of them errored — they returned confident, plausible, wrong answers.

1. **A borrowed `node_modules` verifies the wrong dependency versions.** A fresh worktree has none, and `cp -al` from another checkout installs *that* branch's resolved versions, not the lockfile's. This produced a green local run of 155 suites / 1390 tests that CI then contradicted outright. Print what loaded before trusting a result:
   ```bash
   node -e "console.log(require('./node_modules/jest/package.json').version)"
   ```
2. **The Bash tool is zsh; Actions `run:` steps are bash.** Unquoted list expansion word-splits in bash and does not in zsh, so CI shell logic checked locally returns a false failure. Exercise it with an explicit `/bin/bash script.sh`.
3. **zsh parameter modifiers eat git paths.** `git show "$B:e2e/setup.yaml"` expands `:e` as the extension modifier and returns nothing; `grep -c` then scores the empty result as `0`, which reads as a real measurement. Always brace: `"${B}:e2e/setup.yaml"`.
4. **`e2e/ensure-release-build.js` silently reuses a stale `.app`.** One full suite run tested a week-old build and reported it as current. This is the subject of task 04; until it is fixed, verify by hand:
   ```bash
   grep -ac "<string you just added>" \
     "$(xcrun simctl get_app_container <udid> com.ronenmars.threadbase)/main.jsbundle"
   ```
5. **A fresh worktree makes jest hang** on watchman's crawl — no output, 0% CPU, looks like a slow suite. Run with `--watchman=false`. See `docs/troubleshooting.md`.

## State when these were written

- `main` @ `4d80e984`; integration branch @ `0a4dd2d5`, rebuilt on top of `main`.
- 20 PRs open; 14 green and clean against `main`.
- #557 (jest 30) and #291 (typescript 7) open and red for the reasons in task 02.
- The Maestro E2E job had failed its last three scheduled runs — 2026-06-01, 07-01, 08-01 — undetected.

Current PR-tracking snapshots are mirrored in [`../pr-tracking/`](../pr-tracking/README.md). Treat them as stale by default; re-derive before acting.
