# 05 — Fifteen worktrees nested inside the repo

**Priority: medium. Pure cleanup, local only — no PR.**

## State of play

43 worktrees exist. **15 live under `tb-mobile/.worktrees/`**, most untouched since 2026-07-24.

`CLAUDE.md` forbids this explicitly, with the reasoning attached: a nested worktree is a full second copy of the tree, so every repo-root tool walks into it and treats those files as part of *this* project. The documented incident is jest discovering a copied `__tests__/` and reporting failures from a stale branch that do not exist in the working tree.

`package.json`'s jest config does ignore `<rootDir>/.worktrees/`, so jest specifically is covered today. That is one tool out of several — ESLint, TypeScript, Metro and `git grep` all still descend into them, and each copy is a full checkout on disk.

## The work

```bash
git worktree list                     # review before removing anything
git worktree remove <path>            # for each finished one
git worktree prune                    # clears entries whose directory is gone
```

**Review before removing.** Some worktrees hold uncommitted work — that is the whole reason a few of them still exist. Check `git status` in each before it goes, and leave anything dirty alone; report it rather than deciding for its owner.

New worktrees belong outside the repo:

```bash
git worktree add ../tb-mobile-worktrees/<slug> -b <type>/<slug> origin/main
```

## Done when

- No worktree remains under the repo root.
- The July-dated worktrees are gone, except any holding uncommitted work — list those and say why they were kept.
- `git worktree list` is a set someone can read.
