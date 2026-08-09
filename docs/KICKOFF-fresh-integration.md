# KICKOFF — tb-mobile fresh integration branch

Paste the block below into a fresh Claude Code session at the root of `tb-mobile`.

**Run it on Opus.** This work force-pushes branches and merges PRs, and its validation step exists precisely because the tooling lies: the coverage audit reports six PRs as missing that are present, and the test suites carry pre-existing failures that must be baselined before anything is attributed to a change.

**Before pasting:** be on a branch that has `docs/fresh-integration-branch-prompt.md` — `docs/fresh-integration-prompt`, or `main` once that has merged.

A parallel session owns tb-streamer; the two do not interact and can run at the same time.

---

```text
Read docs/fresh-integration-branch-prompt.md in full before doing anything. Execute Part 1 (tb-mobile), then Part 3, Part 4 and Part 5 for this repo only. Ignore Part 2 — another session owns tb-streamer.

Goal: replace integration/open-prs-291-544-…-569 with a fresh branch cut from today's main, containing every open PR's current head, then land those PRs on main one at a time.

Run `git fetch origin && git rev-parse --short origin/main` immediately before cutting, and state that SHA in your first report. origin/main is a cached ref — a stale one silently produces a branch that is not from today's main.

Back up the old integration branch to origin before you cut anything. Do not delete it — Part 3 validates against it.

Merge order (each PR's CURRENT head, several were rebased recently):
544 → 551 → 553 → 554 → 556 → 558 → 559 → 560 → 563 → 566 → 567 → 568 → 569 → 574 → 576 → 572 → 585
#551 is stacked on #544. #568 is CONFLICTING against main — rebase and push it before merging it here.

Never merge #291 (TypeScript 7) or #557 (jest 30). Both are incompatible with the toolchain and re-break every PR on the branch; #577 already had to revert them once. #575 and #580 have their content on main already via #578/#579 — do not merge them, and ask me before closing them.

Part 3 is a hard gate: do not open PRs or merge anything until the fresh branch is proven to contain everything the old one had. The coverage audit's "missing" list is NOT a verdict — it false-negatives whenever a later PR edited the same files. Hand-verify every reported miss with `gh pr diff <n> --name-only` against the branch. Known false negatives here: #560, #568, #572, #576.

Log every merge into docs/integration-to-main-2026-08-09.md as you go — squash SHA, CI result, anything rebased or resolved, and every obstacle with how you handled it. Match the shape already in that file. Write it as it happens, not at the end.

Work in a worktree outside the repo root, run npm ci in it (never copy node_modules from another checkout), and get commit approval before every commit. Report actual command output, not summaries.
```
