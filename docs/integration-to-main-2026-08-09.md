# Integration branch → main, 2026-08-09

Working log for landing every open PR on `main` via the integration branch
`integration/open-prs-291-544-551-553-554-556-557-558-559-560-563-566-567-568-569`
(referred to below as **INT**).

Append conclusions, obstacles and decisions here as the work proceeds.

---

## Step 1 — Backup (done)

`INT` existed in two places that had drifted: the local branch was one commit behind `origin`.

| Ref | SHA | Note |
| --- | --- | --- |
| local `INT` | `da95442e` | behind origin by 1 |
| `origin/INT` | `60aef087` | authoritative — includes `#577` jest/TS revert |

Backups created and pushed to `origin`:

- branch `backup/integration-open-prs-2026-08-09` → `60aef087`
- tag `backup/integration-open-prs-origin-2026-08-09` → `60aef087`
- tag `backup/integration-open-prs-local-2026-08-09` → `da95442e`

Local `INT` was then fast-forwarded to `60aef087` in the worktree
`../tb-mobile-worktrees/integration-2026-08-08-1740-open-prs`.

**Obstacle:** `git tag <name> <sha>` fails on this machine with `fatal: no tag message?` — the shell/git
config forces annotated tags. Always pass `-m`.

---

## Step 2 — Open-PR coverage scan (done)

20 PRs open. Audit run with
`~/.claude/skills/integration-branch-pr-audit/scripts/audit_integration_branch.py --coverage-only`.

Common base of `INT` and `origin/main`: `f115b96d`.

### Already on INT (15, by head ancestry)

`291, 544, 551, 553, 554, 556, 557, 558, 559, 560, 563, 566, 567, 568, 569` — exactly the set the
branch name advertises. No content drift found.

### Missing from INT (5)

| PR | Base | Head | Verdict |
| --- | --- | --- | --- |
| 572 | **INT** | `fix/codex-active-writer-mobile` | real content → new PR to main |
| 574 | `main` | `ci/e2e-flow-subset` | real content → cherry-pick into INT |
| 575 | **INT** | `fix/e2e-onboarding-setup-flow` | **already on main** (landed as #578) |
| 576 | **INT** | `feat/lazy-project-summary-groups` | real content → new PR to main |
| 580 | **INT** | `docs/adr-0001-followups` | **already on main** (landed as #579) |

**Conclusion — #575 and #580 are dead.** `origin/main` gained 5 commits since INT forked, two of
which are these PRs' content. Verified by diffing each PR's *own* file set (`gh pr diff --name-only`)
against `origin/main`: byte-identical, zero remaining delta. Their full-tree diff vs main looks huge
only because their heads sit on top of INT.

Both should be **closed as already-merged**, not landed again.

---

## Step 3 — Rebase INT onto main (done)

INT is merge-heavy (15 merge commits from PR branches), so a flat rebase would have replayed
duplicated work. Used `git rebase --rebase-merges origin/main` instead, which preserved the merge
topology. 84 steps.

**One conflict:** `docs/adr/0001-hub-data-layer-lazy-pagination.md`, add/add between main's copy (73
lines, from #579) and #568's earlier copy (52 lines). Main's version is a strict superset — it adds
the "Why step 2 needed a new server endpoint" section written after the fact. **Resolved by keeping
main's version** (`--ours` during rebase).

Git also auto-dropped `0720aae6` (`docs(adr): add implementation kick-off…`) as "patch contents
already upstream" — correct, it landed via #579.

**Verification:** tree diff `backup/integration-open-prs-2026-08-09..HEAD` contains *only* main's
5 new commits' content (e2e.yml/test.yml from #573, the two version bumps, #579 docs, #578
`e2e/setup.yaml`). Nothing from INT was lost.

Result: `59d6e68d`, force-pushed with `--force-with-lease`.

---

## Step 4 — Land the missing PRs (done)

### #574 → cherry-picked into INT

Base was `main`, so it was cherry-picked as-is (2 commits, `.github/workflows/e2e.yml` only):

- `a02bdb23` ci: allow dispatching a subset of Maestro flows
- `ac1eaf02` fix(ci): install CocoaPods before the E2E iOS build

No conflicts. INT head is now **`ac1eaf02`**.

### #572 and #576 → retargeted to main *and* cherry-picked into INT

Both heads were stacked on the *old* INT, so each was first rebased onto the new INT head with
`git rebase --onto ac1eaf02 <old-base>` (1 commit each, no conflicts) and force-pushed:

- `fix/codex-active-writer-mobile` `0294a03f` → `e26b2d1d`
- `feat/lazy-project-summary-groups` `046a01c7` → `34667999`

**First attempt (reverted):** new PRs #581 and #582 were opened from those heads to `main`, meant to
supersede #572/#576. That left the two commits living *only* on top of INT, so no single ref held
everything.

**Final decision:** point #572 and #576 themselves at `main` and land their commits on INT too, so
INT is the complete rollup.

**Obstacle:** GitHub rejects two open PRs sharing the same head *and* base, so #581 and #582 had to
be closed before `gh pr edit 572 --base main` / `gh pr edit 576 --base main` would work. #581/#582
are closed and superseded by the original PRs; their branches were not deleted (they *are* #572's and
#576's branches).

Then cherry-picked onto INT, in dependency order, no conflicts:

- `5c0a3f8d` feat(hub): load grouped views from project summaries (was `34667999`, #576) — 29 files
- `0a4dd2d5` feat(conversation): handle Codex active-writer collisions with fork recovery (was
  `e26b2d1d`, #572) — 12 files, auto-merged `types/api.ts`

INT head is now **`0a4dd2d5`**.

Note the consequence: #572 and #576 are open against `main` with head branches that sit one commit
above the *old* INT head, so their diffs still show the whole INT stack. Their own commits are now
duplicated on INT. Whichever lands first makes the other's diff collapse to just its own change.

---

## Verification of INT

Run in `../tb-mobile-worktrees/integration-2026-08-08-1740-open-prs` after `npm ci`:

| Point | `tsc --noEmit` | `jest --ci` |
| --- | --- | --- |
| after rebase + #574 (`ac1eaf02`) | clean | 155 suites, 1384 passed / 1 skipped |
| after #576 + #572 (`0a4dd2d5`) | clean | 156 suites, 1394 passed / 1 skipped |

The cherry-picks added exactly one new suite (`__tests__/unit/components/sessions/summaryGrouping.test.tsx`)
and one new source file (`hooks/useProjectSummaries.ts`); the other test files they touch
(`conversation-resume-collision.test.tsx`, `useServerGroups.test.tsx`) already existed on INT and were
modified, which is why the suite count rose by 1 and not 3.

**Obstacle:** the worktree's `node_modules` predated the #577 jest/TypeScript revert, so `npm ci` was
required first — a stale worktree `node_modules` verifies the wrong branch's dependency versions.

---

## Post-rebase audit — two false negatives

Re-running the coverage audit after the rebase reports `560` and `568` as *missing*. They are not.
The rebase changed their SHAs, and the content-equivalence check fails because INT layers other PRs'
edits on the same files (`app/index.tsx`, `hooks/useConversations.ts`).

Verified by hand:

- **#560** — `stores/viewPrefs.ts`, `__tests__/unit/stores/viewPrefs.test.ts`, `app/browse.tsx`,
  `app/_layout.tsx` are byte-identical on INT. Only the shared list components differ, and only by
  the other PRs' additions.
- **#568** — INT carries the `useInfiniteQuery` import and the infinite-query pagination; the diff is
  purely #563's throttling layered on top of it.

`572/575/576/580/581/582` also report missing, which is expected — their heads sit *on top of* INT,
so they can never be ancestors of it.

---

## Current state

INT head **`0a4dd2d5`**, rebased on `main` `4d80e984`, green on type-check and jest, and shipped to
TestFlight (build 197) and Play alpha (versionCode 49).

`main` has since moved to `7b7d9250` — the two version bumps that ship produced. INT is now one
`main` commit behind again; rebase before merging.

**INT now contains latest `main` + every open PR's content.** It is the single complete rollup ref.

| PR | Status | Action needed |
| --- | --- | --- |
| 291, 544, 551, 553, 554, 556, 557, 558, 559, 560, 563, 566, 567, 568, 569 | on INT | land via INT |
| 574 | cherry-picked onto INT | close once INT lands, or merge normally |
| 572 | base retargeted to `main`; commit also on INT | land via INT, or merge on its own |
| 576 | base retargeted to `main`; commit also on INT | land via INT, or merge on its own |
| 575 | content already on `main` (#578) | **close** |
| 580 | content already on `main` (#579) | **close** |
| 581, 582 | closed — replaced by retargeting #572/#576 | none |

#575 and #580 are left **open** deliberately — closing them is the repo owner's call, not something
to do silently.

---

## Step 5 — Log copied to the PR-tracking dir (done)

Copied to `~/dev/ai-tools/tb-PRs-follow/mobile/Mobile-INTEGRATION-TO-MAIN-2026-08-09.md`, matching the
`Mobile-*.md` convention already in that folder. That directory lives outside any git repo on purpose —
working notes, never committed.

---

## Step 6 — INT pushed (done)

`origin/INT` == local `INT` == **`0a4dd2d5`**.

---

## Step 7 — Deployment (GitHub, not local)

### Local attempt: blocked

`.env.signing` does not exist in the integration worktree and none of `ASC_KEY_ID`,
`ASC_ISSUER_ID`, `ASC_TEAM_ID`, `ASC_AUTH_KEY_B64` are set, so `ship-ios.sh` has no signing material.
The repo's regeneration path is `scripts/bootstrap-local-signing-op.sh`, which pulls the secrets from
1Password.

`scripts/.env.signing-op` was missing in this worktree (gitignored, so per-worktree) — copied it from
the main checkout. The bootstrap then stopped at:

```
▸ DRY RUN — nothing will be written
Not signed in to op. Run: eval "$(op signin)"
```

**Obstacle — not fixable from here:** `op signin` is interactive and cannot be driven from a
non-interactive shell. Android has the same dependency (the keystore and Play service account come
from the same 1Password bootstrap), so both platforms are blocked on the same step.

Per instruction, no attempt was made to work around it.

To run the local ship later, from the integration worktree:

```
eval "$(op signin)"
./scripts/bootstrap-local-signing-op.sh
source .env.signing
./scripts/ship-ios.sh --target testflight
./scripts/ship-android.sh --track alpha
```

### GitHub fallback: triggered

```
gh workflow run deploy.yml --ref main \
  -f platform=all -f target=testflight -f android_track=alpha \
  -f deploy_ref=integration/open-prs-291-544-551-553-554-556-557-558-559-560-563-566-567-568-569
```

Run: <https://github.com/RonenMars/threadbase-mobile/actions/runs/31307471365> — **both jobs
succeeded.**

| Job | Result | Artifact | Bump PR |
| --- | --- | --- | --- |
| Ship iOS | success | TestFlight **build 197**, tag `ios-v197` | #583 → `5a3e1d2c` |
| Ship Android | success | Play **alpha versionCode 49**, tag `android-v49` | #584 → `7b7d9250` |

`main` advanced to `7b7d9250` — version bumps only.

Note what `deploy_ref` does: the *branch's* code is built and uploaded to TestFlight/Play, but only
the version bump lands on `main` (via an auto-merged PR after a successful upload). INT's actual code
still reaches `main` only when its PRs merge.

### Remaining risks

- No CI has run against the rebased INT or against #572/#576 on their new base.
- `ios/Podfile.lock` was not regenerated after the rebase; if any of the dependency PRs (554, 557,
  558, 559) moved a native pod, run `bundle exec pod install` from `ios/` and
  `scripts/reset-podfile-lock-path-noise.sh` before shipping.
- #572 and #576 duplicate commits that are now also on INT. If INT lands to `main` first, both PRs
  become empty and should be closed rather than merged.
