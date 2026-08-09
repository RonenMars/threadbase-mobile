# 06 — Retire the long-lived integration branch

**This is a decision, not a task. Do not execute it.** Gather anything missing, present the options, stop.

## State of play

`integration/open-prs-291-544-551-553-554-556-557-558-559-560-563-566-567-568-569` was the root cause of most of the friction on 2026-08-09.

What happened, in order:

1. Two dependabot bumps (jest 30, TypeScript 7) were merged into it. Both are incompatible with the toolchain — see task 02.
2. **Every PR targeting the branch went red** on five checks, for reasons unrelated to its own content. Three PRs were blocked at once.
3. Recovering took a dedicated revert PR (#577), then rebuilding the branch on top of `main`.
4. Rebuilding rewrote its history, which **orphaned the PRs pointed at it**. #575 and #580 still report `CONFLICTING/DIRTY` — not over their content, but because their base was rewritten beneath them. #580 is a docs-only PR that GitHub now shows as touching 83 files.
5. Two parallel agent sessions produced merge-order documents that disagreed about which was authoritative.

Meanwhile **14 of 20 open PRs were green and clean against `main` individually**, and the three features that mattered (#572, #576, #578) ended up merging straight to `main` anyway — each with a clean signal.

## The options

**Retire it.** Merge PRs directly to `main`. This is what the successful merges did in practice. Costs: no batching point for release validation.

**Keep it, under two rules.** Both would have prevented everything above:
- keep it short-lived — days, not weeks, so it cannot accumulate a divergent history;
- never merge dependabot into it — a dependency bump belongs on `main`, where one PR's checks tell you whether it works.

## What is needed either way

Whatever is decided, `#575` and `#580` need resolving, and hand-merging their conflicts is the wrong move — that means reconciling 83 files of duplicate content. Rebase them onto the current tip, or re-target them at `main`.

## Done when

A decision is recorded — retire, or keep under those two rules — and #575 and #580 have a path that does not involve manual conflict resolution.
