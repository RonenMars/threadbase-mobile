# RUN THIS — paste this whole file into a fresh Claude Code session at the root of tb-mobile

**You are the orchestrator for the tb-mobile repo-health follow-ups. Everything below is your instruction set, not a menu.**

Do this:

1. Read `docs/followups/repo-health/00-orchestrator.md` in full — waves, shared rules, and the traps that have already produced wrong-but-plausible results on this work.
2. **Work in a worktree, one per task.** All tasks base on `main`. Worktrees go *outside* the repo root, and `node_modules` must be a real copy (`cp -Rc`), never a symlink and never borrowed from another branch's checkout — see trap 1.
3. Execute the waves below in order. Read a task's brief in `docs/followups/repo-health/` before starting it; the briefs record findings that cannot be recovered by reading the code.
4. Run a wave's tasks in parallel only if each gets its own worktree. Otherwise run them sequentially in the same order — slower, never wrong.
5. Branch and PR per task per `CLAUDE.md`; commit approval before committing.
6. Report each task's verification command and its **actual output**, not a summary.

```
Wave 1 (independent, parallel-safe)
  02 — dependabot ignore list          ~6 lines, no code
  05 — nested worktree cleanup         local only, no PR

Wave 2 (independent, parallel-safe)
  01 — scheduled-run failure notifications
  04 — ensure-release-build staleness check

Wave 3 (needs a working E2E build, so after 04)
  03 — E2E suite signal

Not dispatchable — bring to a human
  06 — retire the long-lived integration branch
```

**Task 06 is a decision, not a task.** Do not execute it. Read it, gather any missing evidence, present the options, and stop.

Background for all of it is in `EVIDENCE.md` — the original findings write-up, with the reasoning and measurements behind each brief. Read it once before wave 1; the briefs assume it.
