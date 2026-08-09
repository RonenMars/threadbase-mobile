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

---

# Part II — fresh integration branch, cut from today's `main`

The rebased INT above (`0a4dd2d5`) is superseded. Rather than keep repairing a branch that has
drifted from `main` and been rewritten twice, a new branch was cut from today's `main` and every open
PR's *current head* merged into it. The old INT is kept untouched as the reference to validate
against.

## Backup of the old INT

| Ref | SHA |
| --- | --- |
| `origin/integration/open-prs-291-544-…-569` (unchanged, still on origin) | `0a4dd2d5` |
| `backup/int-mobile-2026-08-09-fresh` (new, pushed to origin) | `0a4dd2d5` |

The pre-existing `backup/integration-open-prs-2026-08-09` (`60aef087`) is also still on origin.
Nothing was deleted.

## Cut point

```
$ git fetch origin && git rev-parse --short origin/main
7b7d9250
```

`7b7d9250` = `chore(android): bump version code to 49 [skip-ci] (#584)`, 2026-08-09 14:00 +0300.
Matches the snapshot in `docs/fresh-integration-branch-prompt.md`, so `main` had not moved since it
was written.

Worktree: `../tb-mobile-worktrees/int-fresh`, branch **`integration/fresh-2026-08-09`**, `npm ci`
run in it (exit 0 — not a borrowed `node_modules`).

## #568 rebased before merging (it was `CONFLICTING` against `main`)

`gh pr view 568` reported `CONFLICTING/DIRTY`. Rebased onto `origin/main` in its own worktree rather
than resolving inside the integration branch:

- **Conflict:** `docs/adr/0001-hub-data-layer-lazy-pagination.md`, add/add. `main`'s copy is 73 lines,
  #568's is 52. Diffed both blobs directly: the *only* difference is the 21-line section
  "Why step 2 needed a new server endpoint" that `main` has and #568 lacks. `main`'s version is a
  strict superset, so it was kept (`--ours`).
- Git dropped `0720aae6` (`docs(adr): add implementation kick-off…`) as "patch contents already
  upstream" — correct, it landed via #579.

Result: `0720aae6` → **`0e7797d9`**, one commit, 2 files (`app/index.tsx`, `hooks/useConversations.ts`),
force-pushed with `--force-with-lease`. The PR is now `MERGEABLE/CLEAN`.

## Merges — 17 PRs, zero conflicts

Merged in the prescribed order, each at its **current** head SHA:

| # | Head | Branch | Result |
| --- | --- | --- | --- |
| 544 | `c48d20f9` | `fix/resumed-terminal-scrollback-disclosure` | merge `606fae1a` — 17 files |
| 551 | `b26bbece` | `fix/back-to-live-session` (stacked on #544) | merge `4944e953` — 16 files |
| 553 | `4b5cc9e3` | `docs/cloud-dev-environment-18a1` | merge `11f6962e` — 1 file |
| 554 | `a574ae99` | `dependabot/npm_and_yarn/…daaefa5395` | merge `841ba7ea` — lockfile only |
| 556 | `9c04478b` | `refactor/session-lifecycle-phase` | merge `b2feab3b` — 14 files |
| 558 | `639afe0a` | `dependabot/…/expo-updates-57.0.11` | merge `656e8695` — 3 files |
| 559 | `fc6f6c2d` | `dependabot/…/eslint-config-expo-57.0.1` | merge `b9202366` — 2 files |
| 560 | `2321a450` | `feat/persist-accordion-collapse-state` | merge `f19714cd` — 8 files |
| 563 | `7a89e3be` | `perf/coalesce-eager-progress` | merge `dac61e96` — 6 files |
| 566 | `e2c96efe` | `fix/hub-render-loop` | merge `e12a2b9d` — 6 files |
| 567 | `0fda9d9a` | `chore/local-signing-op-android` | merge `26cdcc41` — 5 files |
| 568 | `0e7797d9` | `feat/conversations-infinite-query` (rebased above) | merge `f698f1fa` — 2 files |
| 569 | `7127e13c` | `fix/favorite-conversation-navigation` | merge `dccf3c45` — 3 files |
| 574 | `92c4e21e` | `ci/e2e-flow-subset` | merge `637be971` — 1 file |
| 576 | `34667999` | `feat/lazy-project-summary-groups` | **cherry-pick `2b01ee8c`** — 29 files |
| 572 | `e26b2d1d` | `fix/codex-active-writer-mobile` | **cherry-pick `7b04eb6e`** — 12 files |
| 585 | `1b2af601` | `docs/repo-health-followups` | merge `e4f6056c` — 16 files |

Head: **`e4f6056c`**, pushed to `origin/integration/fresh-2026-08-09`.

**Obstacle — #576 and #572 could not be merged.** Both heads sit on the *old* INT (`ac1eaf02`), so
each carries 51 commits relative to `main` and 38 relative to the fresh branch. Merging either would
have re-imported the entire old INT ancestry, including `153d248f Merge remote-tracking branch
'origin/pr/291'` and the #557 jest bump — the two PRs this whole exercise exists to keep out. Their
own single commit was cherry-picked instead:

- #576: `git show 34667999` vs `git show 2b01ee8c` → **identical patch**, byte for byte.
- #572: identical except one `index <blob>..<blob>` line on `types/api.ts`, which auto-merged because
  #556 and #576 had already touched that file. Every hunk is identical; the pre-image hash differs
  only because the base file is further along.

Their PR branches still need rebasing onto `main` before they can merge there — deferred to Part 5,
where `main` will already carry their dependencies.

### Not merged, by instruction

| PR | Reason | Verified how |
| --- | --- | --- |
| **#291** (TypeScript 7) | Outside `@typescript-eslint`'s peer range; crashes the parser | standing exclusion |
| **#557** (jest 30) | `jest-expo@57` pins the jest 29 family | standing exclusion |
| **#575** | content already on `main` via #578 | its two own commits (`0fec4c34`, `83b3bf4e`) touch `e2e/setup.yaml` and `docs/adr/0001-followup-05-chat-flow-hidekeyboard.md` — both byte-identical on `main` |
| **#580** | content already on `main` via #579 | its four own commits (`4bccf093`, `796a1c75`, `b3c8efae`, `9a593846`) touch 16 docs files — all 16 byte-identical on `main` |

**Trap worth recording:** `gh pr diff <n> --name-only` and `gh pr view <n> --json commits` are both
useless for #575/#580/#572/#576. Their base ref is the old INT, so GitHub replays the whole stack —
#575 reports 67 files and 25 commits when it owns 2 files and 2 commits. Reading those lists at face
value produces a confident wrong answer in both directions. Isolate the PR's genuinely-own commits
first, then compare only the files those commits touch.

---

## Part 3 — validation gate

### 3.1 Content diff against the old INT

```
$ git diff origin/integration/open-prs-291-544-…-569 HEAD --stat
 19 files changed, 1209 insertions(+), 9 deletions(-)

$ git diff --diff-filter=D --name-only origin/integration/open-prs-291-544-…-569 HEAD
(no output)
```

**Nothing the old branch had is missing from the fresh one** — zero deleted files. Every delta
accounted for:

| Delta | Category | Explanation |
| --- | --- | --- |
| `app.json` 196→197, `android/app/build.gradle` 48→49 | (a) on `main`, post-dates old INT | the #583/#584 version bumps the 2026-08-09 ship produced |
| `docs/followups/**` — 16 files, +1140 | new PR | #585, which the old INT never carried |
| `package-lock.json` — nested `semver` 7.8.5 → 7.8.4, twice | (b) churn shed | traced with `git log -- package-lock.json`: the 7.8.5 entry was introduced by `59d6e68d`, the #577 jest/TS **revert**, which re-resolved the lock. `origin/main` and the fresh branch both hold 7.8.4. This is the old branch's merge-then-revert residue, and losing it is the point |

### 3.2 Coverage audit

```
$ python3 ~/.claude/skills/integration-branch-pr-audit/scripts/audit_integration_branch.py \
    --branch integration/fresh-2026-08-09 --exclude-pr 291 --exclude-pr 557
```

- `branch.common_base` = `7b7d9250` — the audit confirms the branch forks from today's `main`, not
  from an older base.
- `included_head` (15): `544, 551, 553, 554, 556, 558, 559, 560, 563, 566, 567, 568, 569, 574, 585` —
  every one by head ancestry, no equivalence guessing required.
- `missing` (4): `572, 575, 576, 580`.
- `branch_only_vs_all_prs.unique_non_doc_commits` (2): `2b01ee8c` and `7b04eb6e` — the #576 and #572
  cherry-picks. No orphan content: there is nothing on this branch belonging to no PR.

Every reported miss hand-verified, none of them real:

| PR | Audit says | Reality |
| --- | --- | --- |
| 576 | missing | present as `2b01ee8c`, patch byte-identical to `34667999`. Cannot be an ancestor because it was cherry-picked |
| 572 | missing | present as `7b04eb6e`, hunks identical to `e26b2d1d`; only the `types/api.ts` pre-image hash differs |
| 575 | missing | deliberately excluded — content on `main` (see table above) |
| 580 | missing | deliberately excluded — content on `main` (see table above) |

The false negatives the prompt warned about for **#560 and #568** did not reproduce: both land in
`included_head` here. On the old INT they read as missing because the rebase rewrote their SHAs and
later PRs edited the same files; on a branch built by merging unrewritten heads, ancestry answers
directly.

### 3.3 Build and test

| Check | Result |
| --- | --- |
| `npx tsc --noEmit --pretty false` | exit 0, `grep -c 'error TS'` = **0** |
| `npm run lint` | **0 errors**, 5 warnings (all pre-existing: 1 unused var, 3 `import/first`, 1 `exhaustive-deps`) |

`--pretty false` is deliberate: tsc's default ANSI output makes `grep -c 'error TS'` report 0 even
when there are errors.

```
$ npx jest --ci --runInBand --watchman=false
Test Suites: 156 passed, 156 total
Tests:       1 skipped, 1394 passed, 1395 total
Time:        61.36 s
```

Identical to the old INT's final result (156 suites, 1394 passed / 1 skipped), so the fresh branch
is behaviourally the same tree. Jest then hangs on open handles and has to be killed — pre-existing,
the old INT run did the same. The `144` exit is that `pkill`, not a test failure.

**Obstacle:** the first jest run was lost when the session process restarted. It had been launched as
`npx jest … | tail -40`, so nothing reached disk until the pipeline finished and there were no partial
results to salvage. Re-run with `> file 2>&1` instead — a background run whose output is behind a
`tail` is unobservable while it runs and unrecoverable if it dies.

### Podfile.lock — a real defect found in #558

`package.json` moved, so the prompt calls for `bundle exec pod install`. Reading the existing delta
first showed it should not be re-run — and that #558 carries a lockfile change it should not:

```
$ git diff origin/main HEAD -- ios/Podfile.lock
-  ExpoModulesCore: 6abb896a…      +  ExpoModulesCore: e6e3f223…
-  ExpoWidgets:     683ecb15…      +  ExpoWidgets:     86218eca…
-  hermes-engine:   82b14fe6…      +  hermes-engine:   37d12a36…
-  RNSentry:        1379dbcb…      +  RNSentry:        7bb2dcf9…
-COCOAPODS: 1.16.2                 +COCOAPODS: 1.17.0
```

Those are exactly the four path-dependent SPEC CHECKSUMs `CLAUDE.md` says are not ours to commit,
plus a `COCOAPODS:` line flipped off the `Gemfile`'s 1.16.2 pin — the signature of a bare
`pod install` run against a Homebrew CocoaPods. **No pod actually moved:** `EXUpdates` is unchanged
at `35b9e901…` and no version line in the `PODS:` section differs, so the expo-updates 57.0.9→57.0.11
bump has no native effect at all. The whole hunk is machine noise.

`scripts/reset-podfile-lock-path-noise.sh` does not catch it: it only inspects *uncommitted* drift
against `HEAD`, and it bails out entirely when anything outside its four-checksum pattern changed —
which the `COCOAPODS:` line does.

Running `pod install` here would have overwritten the noise with *this* machine's noise and hidden
the problem. Instead: `ios/Podfile.lock` is reverted to `origin/main`'s copy on #558's branch during
its Part 5 rebase, and the integration branch is left as-is (it is validation-only and retires once
the PRs land).

**Gate verdict: PASSED.** Nothing lost, no orphan content, every audit miss explained, tree green.

---

# Part 4 — re-point the work at `main`

Almost a no-op: every PR that is landing already targets `main`. The two that did not are closed.

| PR | Base | Action |
| --- | --- | --- |
| 544, 553, 554, 556, 558, 559, 560, 563, 566, 567, 568, 569, 574, 585 | `main` | none — already correct |
| 551 | `fix/resumed-terminal-scrollback-disclosure` | correct while #544 is open; retarget to `main` after #544 merges and its branch is deleted |
| 572, 576 | `main` | base is right, **head is wrong** — sits on the old INT. Rebase onto `main` last (see below) |
| 575, 580 | old INT | **closed** — `gh pr close 575 580`, no comment |

## #572 and #576 — must not be merged as they stand

`gh pr view` reports 51 commits and 72/90 files for these two, because their heads sit on the old
INT rather than on `main`. Squash-merging either would land the entire old-INT stack on `main` as a
single commit under an unrelated title, swallowing fifteen other PRs' history. The damage is
structural, not dependency-level — `package.json` on those heads still reads `typescript ~6.0.3`, so
#291 would not actually land, but the history would be unreadable and the other PRs would go from
"open" to "silently already merged under someone else's title".

They are therefore rebased onto `main` **last**, after the other fifteen have landed, so the rebase
target already contains everything they would otherwise drag in. Each must collapse to exactly one
commit (`e26b2d1d` / `34667999`). **Gate: after each rebase, `gh pr view <n> --json commits` must
report 1. If it does not, stop.**

---

# Part 5 — merges to `main`

Rebase onto latest `main` → wait for CI green → squash-merge → next. Logged per PR as it happens.

Starting `main`: `7b7d9250`.

## #544 — `fix(terminal): disclose missing scrollback after resume`

| | |
| --- | --- |
| Squash SHA on `main` | **`2afa1201`** |
| CI | 10/10 pass (Gate, Setup, Type check, Unit, Integration, Lint, i18n, Native deps, E2E jest, Snyk) |
| Rebased | yes — `c48d20f9` → `b76c99af` |

Head was behind `main`, so it was rebased. Its `c48d20f9 Merge branch 'main' into …` merge commit was
dropped by the rebase, collapsing it to its three real commits. Sanity-checked the rebase by diffing
old head against new: the delta is exactly `main`'s newer content (#573's `e2e.yml`, #578's
`e2e/setup.yaml`, #579's docs, the two version bumps) and nothing of #544's own.

**Obstacle — `gh pr merge` cannot merge a stack base.** #551 is stacked on #544, and both

```
$ gh pr merge 544 --squash --delete-branch
GraphQL: This pull request is part of a stack and must be merged using the asynchronous merge REST API.

$ gh api -X PUT .../pulls/544/merge
{"message":"Merging stacked PRs via this endpoint is not supported…","status":"403"}
```

fail. Retargeting #551 away to break the stack is also refused
(`Cannot change the base branch because the pull request is part of a stack`). The endpoint that
works is a different path — `merge-async`, not `merge`:

```
$ gh api -X PUT repos/RonenMars/threadbase-mobile/pulls/544/merge-async \
    -f merge_method=squash -f commit_title='…' -f commit_message='…'
{"status":"pending","details":{"message":"Merge request enqueued.","uuid":"dd135c81-…",
 "merge_method":"squash","expected_head_sha":"b76c99af…"}}
```

It enqueues and returns immediately, so poll `gh pr view <n> --json state,mergeCommit` afterwards
rather than trusting the 200.

**Second obstacle — force-pushing #544 broke #551.** Rebasing the stack *base* left #551
`CONFLICTING/DIRTY`, because its recorded base commit no longer existed. Repaired with
`git rebase --onto b76c99af c48d20f9`, which replays only #551's own commit and drops the
`Merge branch 'fix/resumed-terminal-scrollback-disclosure'` sync commit it carried.

**Trap:** the landing worktree's local `fix/back-to-live-session` was seven commits behind `origin`,
so the first rebase there operated on a stale tip. `git rebase` reported success either way. Always
`git fetch` and rebase from the *origin* ref in a worktree that has been sitting.

## #551 — `fix(conversation): back to live session from resumed history`

| | |
| --- | --- |
| Squash SHA on `main` | **`59823f14`** |
| CI | 9/9 check-runs `completed/success` on head `ad8bc6cb`, plus Snyk |
| Rebased | by GitHub, automatically — `b26bbece` → `ad8bc6cb` |

**GitHub restacks a stacked PR by itself.** The moment #544 merged, #551's base auto-retargeted to
`main` and its head was auto-rebased `b28ce0d1` → `ad8bc6cb`. Diffing GitHub's restack against the
one done locally: **identical trees, zero delta**. So the local rebase was discarded rather than
force-pushed — pushing it would have been a no-op on content while cancelling the CI run already in
flight. For stacked PRs, merge the base and let GitHub restack; only verify the result.

**Obstacle — `gh pr checks` served a stale answer for eight minutes.** It kept reporting
`Integration tests: pending` after `gh run view 31328545660` showed the run `completed` with all nine
jobs `success`. Querying the check-runs API directly settled it:

```
$ gh api repos/RonenMars/threadbase-mobile/commits/ad8bc6cb…/check-runs
Integration tests  completed/success
… all 9 completed/success
```

`gh pr checks` is a cached projection and lags; the per-SHA check-runs endpoint is the truth. Waiting
on the former is how a green PR looks stuck. Subsequent PRs are watched via the check-runs API.

**Obstacle — #551 was a draft.** `merge-async` returned `{"status":"failed","details":{"message":
"Pull request is in draft."}}`, a 400 that `gh pr merge` had masked behind the stack error. There is
no `convert_to_draft` event in its timeline, so it was opened that way rather than demoted by the
restack. `gh pr ready 551`, then merge. Checked the rest up front to avoid a repeat: **#556 is the
only other draft**; every other PR in the queue is `draft=false`.

## #553 — `docs: add cloud dev environment instructions`

| | |
| --- | --- |
| Squash SHA on `main` | **`9525d8ea`** |
| CI | 9/9 + Snyk |
| Rebased | `4b5cc9e3` → `0299bac0` |

The rebase reported `warning: skipped previously applied commit 4b5cc9e3` — that commit is
`fix(ci): raise the e2e jest timeout for cold CI runners (#549)`, already on `main`. Dropping it took
the PR from two files (`AGENTS.md`, `package.json`) to the one it actually owns.

## #554 — `chore(deps): bump the npm_and_yarn group across 1 directory with 2 updates`

| | |
| --- | --- |
| Squash SHA on `main` | **`06b9a434`** |
| CI | 9/9 + Snyk |
| Rebased | `a574ae99` → `6c9109fd` |

From here on the landing worktree operates **detached** (`git checkout --detach origin/<branch>`,
push with `HEAD:refs/heads/<branch>`). Several of these branches are checked out in other worktrees,
and `git checkout <branch>` refuses in that situation. `--force-with-lease` still gets its safety
because the expected SHA is passed explicitly: `--force-with-lease=<branch>:<old-sha>`.

## #556 — `refactor(session): adopt streamer lifecycle for ended vs hold`

| | |
| --- | --- |
| Squash SHA on `main` | **`fd1398b8`** |
| CI | 9/9 + Snyk |
| Rebased | `9c04478b` → `a78b950c`; `gh pr ready 556` (it was the second draft) |

## #558 — `chore(deps): bump expo-updates from 57.0.10 to 57.0.11`

| | |
| --- | --- |
| Squash SHA on `main` | **`08f0e0e8`** |
| CI | 9/9 + Snyk — including `Native deps` |
| Rebased | `639afe0a` → `f2fc7f18`, **one commit deliberately dropped** |

The Podfile.lock defect recorded in Part 3.3 turned out to be cleanly separable: the branch's two
commits split exactly along the fault line.

| Commit | Files |
| --- | --- |
| `9b8b1346` `chore(deps): bump expo-updates…` | `package.json`, `package-lock.json` |
| `639afe0a` `chore(ios): sync pods for integrated dependency updates` | `ios/Podfile.lock` **only** |

So rather than rebase and revert a file, `639afe0a` was dropped outright and `9b8b1346` cherry-picked
onto `main`. `ios/Podfile.lock` on the result is byte-identical to `main`, and **`Native deps` still
passes** — which is the confirmation that the pod-sync commit carried nothing. #558 landed as the
pure dependency bump it always was.

## #559 — `chore(deps-dev): bump eslint-config-expo from 57.0.0 to 57.0.1`

| | |
| --- | --- |
| Squash SHA on `main` | **`5a6e73bf`** |
| CI | 9/9 + Snyk |
| Rebased | `fc6f6c2d` → `b030f436` |

## #560 — `feat(session): persist accordion collapse state across session views`

| | |
| --- | --- |
| Squash SHA on `main` | **`6e9e9faf`** |
| CI | 9/9 + Snyk |
| Rebased | `2321a450` → `a23975a2`, 4 commits replayed, no conflicts |

## #563 — `perf(sessions): coalesce eager-fetch progress and memoize list roots`

| | |
| --- | --- |
| Squash SHA on `main` | **`8b7c73b7`** |
| CI | 9/9 + Snyk |
| Rebased | `7a89e3be` → `c23e4045` |

Rebased cleanly onto a `main` that already carried #560's edits to the same three list components.

## #566 — `fix(sessions): stop the Hub background-refresh re-render loop`

| | |
| --- | --- |
| Squash SHA on `main` | **`50472842`** |
| CI | 9/9 + Snyk |
| Rebased | `e2c96efe` → `ea3c9289`, 2 commits |

## #567 — `chore(signing): bootstrap android keystore and play credentials from 1password`

| | |
| --- | --- |
| Squash SHA on `main` | **`6be9b04f`** |
| CI | 9/9 + Snyk |
| Rebased | `0fda9d9a` → `6c5fc8a8`, 2 commits |

## #568 — `feat(conversation): prototype infinite-query pagination for classic history`

| | |
| --- | --- |
| Squash SHA on `main` | **`6f6b5a6f`** |
| CI | 9/9 + Snyk |
| Rebased | twice — `0720aae6` → `0e7797d9` (Part II, ADR conflict) → `9cfff144` (onto current `main`) |

The second rebase was the one expected to conflict: both its files had since been rewritten by #560,
#563 and #566. It replayed clean.

## #569 — `fix(favorites): open conversations with stored id`

| | |
| --- | --- |
| Squash SHA on `main` | **`18344b6a`** |
| CI | 9/9 + Snyk |
| Rebased | `7127e13c` → `d8466b03` |

## #574 — `ci: dispatch a subset of Maestro flows, and fix the E2E iOS build`

| | |
| --- | --- |
| Squash SHA on `main` | **`659b31f2`** |
| CI | 9/9 + Snyk |
| Rebased | `92c4e21e` → `2645f0b4`, 2 commits |

## #585 — `docs(followups): add the repo-health follow-up set and mirror the PR-tracking notes`

| | |
| --- | --- |
| Squash SHA on `main` | **`fdf439a7`** |
| CI | 9/9 + Snyk |
| Rebased | `1b2af601` → `ccc1be37`, 3 commits, 16 files |

## #576 — `feat(hub): load grouped views from project summaries`

| | |
| --- | --- |
| Squash SHA on `main` | **`a0a85e28`** |
| CI | 9/9 + Snyk |
| Rebased | `34667999` → `aa5a8c21` — **51 commits → 1** |

Held back until every other PR had landed, so the rebase target already contained everything its old
INT base carried. `git rebase --onto origin/main ac1eaf02` replayed its single commit onto `main`
with no conflicts.

**Gate applied before merging**, since a squash of the unrebased head would have put the whole old
INT stack on `main` as one commit under this title:

```
$ gh pr view 576 --json commits -q '.commits | length'
1
$ gh pr view 576 --json files -q '.files | length'
29        # was 90
```

## #572 — `feat(conversation): handle Codex active-writer collisions with fork recovery`

| | |
| --- | --- |
| Squash SHA on `main` | **`419c8087`** |
| CI | 9/9 + Snyk |
| Rebased | `e26b2d1d` → `44ace43d` — **51 commits → 1** |

Same treatment, same gate: `commits` = 1, `files` = 12 (was 72). No conflicts.

---

## Closing verification

Every one of the seventeen merged, none on red, no CI job re-run, and no merge conflict at any point.

```
$ git diff origin/main integration/fresh-2026-08-09 --stat
 ios/Podfile.lock | 10 +++++-----
 1 file changed, 5 insertions(+), 5 deletions(-)

$ git diff --diff-filter=A --name-only origin/main integration/fresh-2026-08-09
(no output)
```

**The integration branch's entire content is on `main`.** Nothing is present on the branch and absent
from `main`, and the single remaining delta is precisely the #558 noise commit that was deliberately
dropped:

```
-  ExpoModulesCore: 6abb896a…      +  ExpoModulesCore: e6e3f223…
-  ExpoWidgets: 683ecb15…          +  ExpoWidgets: 86218eca…
-  hermes-engine: 82b14fe6…        +  hermes-engine: 37d12a36…
-  RNSentry: 1379dbcb…             +  RNSentry: 7bb2dcf9…
-COCOAPODS: 1.16.2                 +COCOAPODS: 1.17.0
```

`main`: `7b7d9250` → **`419c8087`**, 17 squash commits, linear.

`integration/fresh-2026-08-09` has served its purpose and should now be **retired, not maintained** —
it is left pushed at `e4f6056c` pending that call. The old INT and its backups are untouched.

## Left open deliberately

| PR | Why |
| --- | --- |
| **#291** (TypeScript 7) | standing exclusion — outside `@typescript-eslint`'s peer range |
| **#557** (jest 30) | standing exclusion — `jest-expo@57` pins the jest 29 family |
| **#586** `chore(deps): bump undici 6.27.0 → 6.28.0` | **opened by Dependabot during this run**, so it was never in the merge set. Not evaluated |

**Closed, not merged:** #575 and #580 — content already on `main` via #578/#579, verified
byte-identical. Closed on the repo owner's instruction, without a comment.
