# Landing `land/integration-prep` onto `main` in reviewable slices

> **Status: EXECUTED. All three slices are on `main`.** Landed 2026-08-01 as `#497` (slice A,
> merged `8eeaa823`), `#498` (slice B, 9 commits `aaef4af7`…`dcc8c096`) and `#499` (slice C, 13
> commits). Zero conflicts in all three. The final tree comparison against the frozen prep
> snapshot came back with nine differing files, every one classified EXPECTED — no drift, nothing
> unexplained. The run log, with the full conflict ledger and per-slice verification output, is at
> `../tb-mobile-landing-run/RUN-LOG.md`.
>
> What follows is now a **record of a completed operation**, kept because the same shape recurs.
> Sections below written in the imperative are the procedure as executed, corrected where the run
> proved them wrong. `land/integration-prep`, `backup/prep-landing-2026-08-01` and the
> `archive/prep-*` tags are retained deliberately — after `9cf00d99`, the branch is the only
> remaining witness to what this content was supposed to be.
>
> **Do not trust any commit count or SHA written here.** Every number moves — `main` takes a
> version bump on every ship, and prep is still a live merge target. Re-measure immediately
> before acting:
> ```bash
> $G rev-list --left-right --count origin/main...origin/land/integration-prep
> ```
> On 2026-08-01 that read `1 108`, not the `0 92` an earlier revision of this document claimed.
> The left-hand number is not always 0 and the right-hand number does **not** only shrink.
> The source branch has been renamed to `archive/26-07-2026.18-44-integration` and is frozen; it
> survives only as a historical reference. References to the archived name below are historical,
> not instructions to act on it.

## Context

All mobile work for two weeks landed on the integration branch
`archive/26-07-2026.18-44-integration` rather than on `main`, mostly by direct push rather than
through PRs. During a triage of 38 open PRs every single one reported "not on main" — their
content had reached the integration branch and stopped there.

That divergence produced the recurring problems this work surfaced: PRs sitting red for days
against a base that had already absorbed their content, PRs whose diffs silently regressed
version numbers because their branch point predated a bump, and 23 PRs that turned out to be
fully redundant.

The goal is to get the remaining work onto `main` as reviewable, independently-green PRs, so
`main` regains bisectability and release granularity and the integration branch stops being a
parallel trunk.

**Deliberately out of scope:** any change to app behaviour. This is a history/merge operation
only. If a slice needs a code fix to go green, that fix is part of the slice.

---

## What `9cf00d99` already cost

`9cf00d99` — titled `chore(ios): bump build number to 182 [skip-ci] (#458)`, body "Automated
version bump after successful ios upload" — is **298 files, +20248 / −3252**. It merged to
`main` on 2026-07-31 with CI skipped and none of the swept content reviewed.

It is not a version bump. It landed the bulk of the integration branch on `main` in one opaque,
unbisectable commit — precisely the outcome this whole operation exists to prevent. **No amount
of slicing now un-does it.** Slicing buys bisectability only for what remains.

What remains is small:

```bash
$G diff --stat origin/main origin/land/integration-prep
# 72 files changed, 2509 insertions(+), 1225 deletions(-)
```

Identical with or without the version files excluded. The headline commit count overstates the
reviewable work by a wide margin, and every cost/benefit argument below is stated against the
72-file remainder rather than against 108 commits.

---

## Measured facts

Measured 2026-08-01 against `origin/main` (`30454c1a`) and
`origin/land/integration-prep` (`a14f248a`). Re-measure before acting.

| Fact | Value | Consequence |
|---|---|---|
| Commits ahead of `main` | **108** | The count grew from 92; 16 commits landed on prep after the last re-rebase |
| Merge commits in range | **0** — perfectly linear | Contiguous ranges replay in order |
| `main`-only commits | **1** (`30454c1a`, #481) | `main` is *not* an ancestor. Re-check before every slice |
| Same-subject commit runs | **7 subjects, 16 commits, 9 redundant** | All sit at positions 65–108; see "Squashing is conditional" |
| Patch-identical pairs | **2**, not 1 | `fixup` is still correct for all of them |
| Known-red window | *(healed)* | `broken=0` across all 8 commits touching `app/conversation/[id].tsx` |
| Net remaining surface | **72 files, +2509 / −1225** | The real size of the job |
| Net of the pre-`#462` history | **11 files, +49 / −9** | 87 commits contribute this much; see slice A |

### Hotspot files

| File | Commits touching it |
|---|---|
| `app/session/[id].tsx` | 14 |
| `types/api.ts` | 12 |
| `package.json` | 11 |
| `locales/{ar,he,ru}/conversation.json` | 10 each |
| `app/_layout.tsx` | 9 |
| `app/conversation/[id].tsx` | 8 |
| `__tests__/unit/components/servers/CacheAlertModal.test.tsx` | 8 |

These touches interleave across every theme, which is why thematic cherry-picking of the
*history* fails: a "terminal" PR and a "conversation" PR would both edit the same regions at
different points, producing repeated conflict resolution and trees that never existed.

### The duplicates are iterations, not copies

> **Correction.** An earlier draft said to **drop** the duplicate commits. That was wrong and
> would have silently discarded real content. Use `fixup`, never `drop`.

Re-verified 2026-08-01 with `git patch-id --stable` against current SHAs:

```
5ca2eb70 vs a4a0c502  DIFFER     feat(servers): add cache integrity alert resolution
5b76603d vs d2644a7c  IDENTICAL  fix(cache): clear server state after destructive actions
9960ae96 vs 013e298b  IDENTICAL  test(cache): extend modal render timeout in CI
b0e7442a vs 4ebda0e5  DIFFER     fix(cache): handle explicit server warm-up states
c9ee640e vs 23f81d57  DIFFER     feat(servers): show warm-up progress for every server
a08c6bb3 vs 35a95300  DIFFER     feat(sessions): add read-only live view for external sessions
```

The four `feat(conversation): stabilize live reload…` commits (`2a268ddb`, `08721798`,
`20a6fc64`, `42615334`) have four distinct patch-ids.

**Two pairs are now patch-identical, not one** — an earlier revision recorded
`fix(cache): clear server state after destructive actions` as DIFFER. `fixup` is correct for
every run regardless, and using it uniformly removes the chance of picking the wrong verb.

The runs are **non-contiguous** (positions 93–98 / 104–108, and 65 / 66 / 70 / 71 counting back
from the tip), so `fixup` reorders commits rather than merely folding them.

Reusable check for any "is this commit already applied?" question:

```bash
pid() { git show "$1" | git patch-id --stable | cut -d' ' -f1; }
[ "$(pid A)" = "$(pid B)" ] && echo IDENTICAL || echo DIFFER
```

### The broken window — healed

`app/conversation/[id].tsx` calls `makeSearchStyles(theme)` and lost its import for ~25 commits
in the pre-rebase history — the defect that kept PRs #421–#423 red. The prep rebase folded the
import fix into the commit that introduces the break. Re-walked 2026-08-01:

```
a08c6bb3  import=0 uses=0  ok   feat(sessions): add read-only live view for external sessions
2a268ddb  import=0 uses=0  ok   feat(conversation): stabilize live reload…
540c4e1b  import=1 uses=1  ok   feat(conversation): add in-chat search entry on detail screen
20a6fc64  import=1 uses=1  ok   feat(conversation): stabilize live reload…
43cd6fb3  import=1 uses=1  ok   fix(session): harden lifecycle not-found, reconnect, and e2e coverage
43669bcd  import=1 uses=1  ok   fix(conversation): restore in-chat search button and repair locale drift
51626a1e  import=1 uses=1  ok   feat(conversation): block input with an overlay while a conversation opens
754b51da  import=1 uses=1  ok   feat(conversation): move diff/info into overflow menu, add repo url field
```

`broken=0` across all 8. Any slice boundary can fall anywhere in this range.

---

## Step 0 — Freeze the source — **DONE**

The integration branch was renamed to `archive/26-07-2026.18-44-integration`, which freezes it
by making the old name unresolvable. Zero open PRs pointed at it at the time, and no PR has
merged onto it since — verified 2026-08-01, no freeze violation.

`#454`, `#456` and `#455` were the last three merges onto it, in that order. (An earlier
revision said "#455 merged first". It merged **last**, 26 minutes after `#456`. Its head branch
is `chore/bump-babel-preset-expo-57.0.4`, but the PR itself is the `bundle exec pod install`
fix — the branch name is misleading. The babel bump is `#413`, closed unmerged.)

---

## Step 0b — Prep is NOT frozen. The snapshot is the freeze.

Prep is still a live merge target: **17 PRs have been based on `land/integration-prep`, 15 of
them merged on 2026-08-01 alone.** Freezing it is not the answer — snapshotting it is.

**The snapshot is the freeze.** Take it once, then cut every slice from the snapshot rather
than from the live branch. Prep may keep moving without invalidating a single boundary:

```bash
$G branch backup/prep-landing-$(date +%F) origin/land/integration-prep
$G tag -a archive/prep-$(date +%F) -m "snapshot for the landing" origin/land/integration-prep
```

**Arrivals after the snapshot go through a mirror loop.** Each PR merged into prep after the
snapshot gets its commit(s) cherry-picked onto a branch cut from `main` and opened as its own
PR against `main`, landing in dependency order. Consecutive related commits may share one PR.

**The one convention this requires: no more direct pushes to prep.** A PR-driven mirror loop
cannot see a direct push — there is no PR to mirror. Only two commits have reached prep without
a PR since the re-rebase (`b74387b3`, an empty CI trigger, and `4b309f35`, a docs commit), so
the practice is already nearly extinct and the convention costs almost nothing.

**State its reach honestly.** The mirror loop covers only PR-provenance commits. Of the 108
commits ahead of `main`, **27 carry PR provenance and 81 do not**. The 81 direct-push commits
are the historical bulk and are handled by the slices below, not by the loop.

### PR #457

`#457` is `land/integration-prep → main` — **the integration branch's own PR, not an
alternative to slicing.** **Do not merge it whole mid-slicing** — that lands every remaining
slice in one opaque commit and discards exactly the bisectability this operation exists to
recover.

> **Correction — it does not close itself.** An earlier revision said "when the last slice lands
> it is empty and closes itself". That is wrong, and the real run proved it: after all three
> slices merged, `#457` was still OPEN and still reporting **73 changed files, +3446 / −1126**,
> while the actual tip-to-tip tree diff had drained to nine EXPECTED files.
>
> **A PR's diff is computed against the merge-base, not tip-to-tip.** Every prep commit landed on
> `main` under a *new* SHA — slice A as a fresh cherry-pick commit, B and C as rebased replays —
> so nothing prep points at became reachable from `main`. The merge-base never moved, and GitHub
> keeps rendering the entire historical divergence. It will sit there looking like unlanded work
> forever.
>
> **Close it by hand once the last slice merges**, after confirming the tip-to-tip diff is clean:
> ```bash
> $G diff --stat origin/main origin/land/integration-prep   # expect only the EXPECTED set
> gh pr close 457
> ```
> This generalises: any PR whose content is landed by *replay* rather than by merge must be
> closed manually. Self-closing only happens when the head commits themselves become reachable.

---

## Step 1 — One-time prep rebase — **DONE**

The rebase replayed 107 commits onto `main`; `a5766408` was auto-dropped as already applied (it
reached `main` as `ff8bd0ba` via #434). The broken-window heal was done. Squashing the
same-subject runs was **not** done — see "Squashing is conditional" below, where it turns out
not to be needed.

Conflicts appeared in `app.json` and `android/app/build.gradle`; **`main`'s higher values were
taken.** Taking the branch's older numbers is the regression trap found in PR #434.

> **The archive whole-tree check that used to live here has been deleted.** It read
> `$G diff origin/archive/… land/integration-prep -- . ':!app.json' ':!android/app/build.gradle'`
> and expected empty. It now measures **84 files**: prep is 24 commits of genuinely-new content
> past the archive and has absorbed 18 of `main`'s. It can never return to empty, and running it
> as a gate produces a false alarm every time.
>
> Replace it with a directional check — for each archive commit with no subject twin in prep,
> reverse-apply its patch against a prep worktree and investigate only the failures:
> ```bash
> $G show <archive-sha> | $G apply --check -R   # clean => content is present in prep
> ```
> Run 2026-08-01 over all 23 such commits: 16 reverse-apply cleanly (folded in by `fixup`), 6
> are docs whose target files were rewritten afterwards, and 1 touches a file that exists on
> none of the three tips. **No content was lost.**

---

## Step 1a — Re-rebase before slicing — repeat before every slice

`main` takes a version-bump commit on every ship, so prep falls behind within hours. Run this
whenever the divergence check reports a non-zero left-hand number.

```bash
$G fetch origin
$G checkout land/integration-prep
$G rebase origin/main
$G push --force-with-lease
```

If a full-branch rebase produces conflicts on nearly every commit, do not grind through it — see
[`docs/runbooks/2026-08-01-rebase-integration-prep-conflicts.md`](docs/runbooks/2026-08-01-rebase-integration-prep-conflicts.md)
for the squash-first technique that reduced ~100 conflict sets to 18, and for the per-file
resolutions. **That file currently exists only on `land/integration-prep`.** It must land on
`main` in the same slice as this document or the link breaks on arrival.

### The regression rule is wider than the version files

`fee27061` is the receipt. Replaying the branch reapplied its **older** copies of three files
over `main`'s newer versions and resurrected a fourth that `main` had deleted:
`.github/workflows/test.yml` lost `#474`'s corrections, `package.json` lost `#471`'s
`dev:reset` fix, this document reverted to its pre-correction text, and
`KICKOFF-landing-runbook.md` came back after `#474` removed it. It was caught by hand, not by
any check.

The rule is **not** "take `main`'s higher numbers in the two version files". It is: for **any**
file `main` changed after the divergence point, take `main`'s side unless the branch genuinely
supersedes it. Enforce it with two mechanical guards, run after **every** slice rebases and
before it is pushed.

**Guard A — resurrection.** Files `main` deleted since the fork must stay absent:

```bash
FORK=$($G merge-base origin/main origin/archive/26-07-2026.18-44-integration)
$G diff --diff-filter=D --name-only $FORK origin/main
# today: crash-log.txt, log-mobile.txt
# plus KICKOFF-landing-runbook.md, which #474 deleted after main had gained it
```

**Guard B — revert.** The naive list ("every file `main` touched since the fork") is **302
files** and unusable, because `9cf00d99` alone touched 298 of them. Enumerate `main`'s
*content-bearing* commits instead — excluding version bumps and excluding that sweep. That list
is 21 files today, and all four of `fee27061`'s regressions live in it:

```bash
for c in 30454c1a 8bb3ec96 c818bc04 d3d2741d 15c8c52b 1fd475c8 77190a2b ff8bd0ba; do
  $G show --pretty='' --name-only $c
done | sort -u
```

```
.github/workflows/deploy.yml          .github/workflows/test.yml
CLAUDE.md                             KICKOFF-landing-runbook.md
LANDING-integration-to-main.md        package.json
app/session/[id].tsx                  components/conversation/DiffViewer.tsx
components/terminal/TerminalOutput.tsx
docs/runbooks/2026-07-22-land-open-prs.md   docs/runbooks/README.md
docs/sentry-releases-investigation.md docs/troubleshooting.md
scripts/archive-and-upload.sh         scripts/bundle-and-upload-android.sh
scripts/dev-tunnel-native-reset.sh    scripts/reset-podfile-lock-path-noise.sh
scripts/ship-ios.sh
__tests__/integration/components/SessionScreen.copyTranscript.test.tsx
__tests__/unit/scripts/ios-signing.test.js
__tests__/unit/scripts/reset-podfile-lock-path-noise.test.js
```

For each such file a slice touches, `$G diff origin/main <trunk> -- <file>` must show only
additions on top of `main`'s version. A removed line that `main` currently has is a revert until
proven otherwise.

**Regenerate the list before each slice — but membership is not the check.** The list grows when
`main` touches a file it has not touched before; it stays the same size when `main` touches one
already on it, and that second case *looks* dangerous, because a regenerated-but-identical list
reads as "nothing changed" when the baseline moved underneath it. Always re-diff against `main`'s
*current* content, never against the list alone.

### The enumeration must reach back past the fork — do not narrow it

> **Correction, and the most important one this run produced.** A companion document rewrote the
> enumeration above as:
> ```bash
> $G log --format='' --name-only --no-merges $FORK..origin/main | sort -u
> ```
> and expected it to reproduce the 21-file list. **It does not — it yields 8** — and the
> difference is not cosmetic. Seven of the eight commits hand-listed above are **ancestors of
> `$FORK`**, so a `$FORK..origin/main` range excludes them by construction.

The 15 files that narrower range drops include `package.json`, `.github/workflows/test.yml`,
`.github/workflows/deploy.yml` and `KICKOFF-landing-runbook.md` — **which are precisely the
regressions `fee27061` exists to undo and that slice A excludes by hand.** The guard that is
supposed to catch that class of mistake would have been blind to all of it.

The reason is structural and worth stating once: **prep's history is older than the fork.** A
slice can therefore revert `main` work that landed *before* the divergence point, not only after
it. Any enumeration bounded below by `$FORK` cannot see that class. Enumerate `main`'s
content-bearing commits directly, as the `for c in …` loop above does, and accept that the list
must be curated rather than derived from a range.

**Nothing slipped through on the real run**, but only by luck of composition, and it was checked
rather than assumed. Retroactively re-running the wider 21-file guard across the whole landing
(`$G diff <pre-landing-main> origin/main -- <the 21 files>`) shows every removed line is a
genuine supersession: `package.json` drops `expo-mcp` (`#489`) and rewrites `test:e2e:mock`
(`#470`), the ship scripts move their `SENTRY_RELEASE` exports, `docs/sentry-releases-investigation.md`
loses the real org names by design, and this document supersedes its own earlier text.
`.github/workflows/deploy.yml`, `CLAUDE.md` and `docs/troubleshooting.md` are additions only.
**No file on `main` was reverted.**

### What actually happened to `CLAUDE.md`

`#495` (`fix(ios): add RNSentry to the path-dependent Podfile.lock checksum list`) touches
`CLAUDE.md`, `scripts/reset-podfile-lock-path-noise.sh` and its test, and landed on `main` after
prep had already been cut. `CLAUDE.md` is touched by `309bd80e` in slice B and by `f3487f97` in
slice C, so **both slices carried a copy predating `#495`**.

Guard B was run against `main`'s current content on both, and both came back **additions only** —
`+16 / −0` on slice B, `+10 / −0` on slice C — with `#495`'s four-checksum paragraph intact.

**The mechanism, which was likely but never guaranteed: `git rebase` applies patches, not whole
files.** `309bd80e` adds a "Worktrees" section and `f3487f97` adds an "Expo MCP" section; neither
hunk overlaps `#495`'s, so all three compose. Had any of them edited the same paragraph, the
replay would have carried the stale text and the guard is the only thing that would have caught
it. Run it regardless — a guard that only fires when you already suspect trouble is not a guard.

---

## Step 2 — Three slices

> **This supersedes the seven-slice table.** The seven-slice plan was measured on 2026-08-01
> and does not survive contact with `9cf00d99`. Its tips 1, 2 and 3 no longer resolve at all —
> those commits were folded away by `fixup` during the prep rebase — and, more importantly, its
> first seven slices *individually regress `main`*.

### Why seven slices became one

Measured net contribution of each of the original seven, cumulative against `main`:

| after slice | cumulative trunk vs `main` | marginal |
|---|---|---|
| 1 | 47 files, +200 / −2294 | **−2094 lines** |
| 2 | 53 files, +298 / −2509 | **−117 lines** |
| 3 | 54 files, +386 / −2358 | +239 |
| 4 | 26 files, +177 / −335 | +1814 |
| 5 | 28 files, +154 / −306 | +6 |
| 6 | 21 files, +175 / −388 | −61 |
| 7 | **15 files, +130 / −26** | +317 |

The cumulative column is not monotonic: 47 → 53 → 54 → **26** → 28 → 21 → **15**. Slices 1–3
move the trunk *away* from `main`. After slice 1 the trunk sits 2294 lines below where `main` is
today — `types/api.ts` −83 with zero insertions, `app/session/[id].tsx` −226, each
`settings.json` locale −132. Slice 4 pulls 1814 back. `main` would sit regressed for six
successive PR + rebase + CI cycles.

That is `fee27061`'s failure mode at roughly 500× the scale that was caught by hand, and it
happens because `9cf00d99` put the *final* state of that content on `main` while those commits
carry the *earlier* snapshots.

**All seven together contribute 15 files and +130 / −26**, of which four files are regressions
rather than content. Net: **11 files, +49 / −9 from 87 commits.**

### Why slice A is a cherry-pick, not a replay

Replaying those 87 commits does **not** preserve history for that range — `9cf00d99` already
destroyed it. It *manufactures* one: six successive states on `main` that never existed as
`main` and that a future bisect would walk into. Replaying therefore damages the very property
slicing exists to protect, while costing seven CI cycles and shipping six regressions.

**The cherry-pick is the conservative choice here, not the lossy one.**

### The table

| # | Range | n | Form | Net contribution to `main` |
|---|---|---|---|---|
| **A** | fork → `fix(settings): label the support row for what it does (#462)` | 87 → **1 commit** | cherry-pick of the end state | 11 files, +49 / −9 |
| **B** | that tip → `fix(sentry): pin commit association to HEAD…(#479)` | **9** (10 minus one empty) | replay | 27 files, ≈ +1057 net lines |
| **C** | that tip → branch head | **11** | replay | 29 files, ≈ +251 net lines |

B and C stay separate: they carry the content that genuinely is not on `main`, they are cleanly
separable (27 and 29 distinct files, no overlap), each was already reviewed as a PR against
prep, and they are the only part of this work where bisectability is still recoverable.

Slice A is **not** the "one opaque merge" this document set out to avoid. That merge already
happened, as `9cf00d99`. Slice A is an 11-file, 58-line PR.

### Resolve the boundaries by subject, never by SHA

SHAs do not survive a rebase. Every SHA in this document is a snapshot, not a handle.

```bash
SNAP=$($G rev-parse origin/land/integration-prep)
A_END=$($G log --format=%H --fixed-strings -1 \
        --grep='fix(settings): label the support row for what it does' $SNAP)
B_END=$($G log --format=%H --fixed-strings -1 \
        --grep='fix(sentry): pin commit association to HEAD' $SNAP)
C_END=$SNAP
```

### Slice A's file list

Take the end state of these 11 files from `$A_END`:

```
.env.example
.github/workflows/deploy.yml
__tests__/unit/services/feedback-transport.test.ts
app/settings.tsx
components/onboarding/steps/ConnectStep.tsx
components/pair/PairScannerModal.tsx
locales/{ar,en,he,ru}/settings.json
services/feedback-transport.ts
```

**Deliberately exclude these four** — each reverts or resurrects `main`'s own work:

| Excluded | What it would do |
|---|---|
| `.github/workflows/test.yml` | reverts `#474`'s gate-comment corrections (+5/−10) |
| `package.json` | reverts `#471`, dropping `bundle exec` and `reset-podfile-lock-path-noise.sh` from `dev:reset` |
| `KICKOFF-landing-runbook.md` | resurrects (+71/−0) a file `#474` deleted |
| `ios/Podfile.lock` | 4 checksums with no version line moving — path-dependent noise |

Guard A catches the third blind. The first two are judgement calls: someone must know `#471`
and `#474` exist.

### Squashing is conditional, not mandatory

The squash step exists only to stop a same-subject run being split across a slice boundary.
Check before performing it:

```bash
$G log --format='%s' $A_END..$C_END | sort | uniq -d
```

Empty on 2026-08-01. All 16 run commits sit at positions 65–108, entirely inside the range
slice A no longer replays commit-by-commit, so there is no boundary for a run to straddle.
**Skip the step entirely when this is empty.** If it is ever non-empty, use `fixup` — never
`drop` — and prove nothing was lost with an empty-diff check afterwards.

---

## Step 3 — Merge with **rebase-merge**, not squash

A deliberate, documented deviation from the repo's squash-merge convention
(`CLAUDE.md` → "Merging PRs").

Squashing slice A would put a commit on `main` that is not patch-identical to slice B's
expectations, so B's rebase could not skip already-applied work and C would inherit the
conflicts — the stacked-squash trap. Rebase-merge keeps commits patch-identical.

Linear history on `main` is preserved either way; that convention is not violated.

### Get the rebase invocation right — the runbook used to get this wrong

> **Wrong:**
> ```bash
> $G checkout -b land/slice-$i <tip-sha>
> $G rebase <trunk>
> ```
> A plain `rebase <trunk>` resolves its base to `merge-base(trunk, tip)`, which is the **fork**.
> For slice B that replays **97** commits instead of 9 — including the entire range slice A
> deliberately did not replay.

> **Correct:**
> ```bash
> $G checkout -b land/slice-b $B_END
> $G rebase --no-keep-empty --onto <trunk> $A_END
> ```

`--no-keep-empty` is also load-bearing. `git rebase` drops commits that *become* empty during
the replay; a commit that was **already** empty at author time is preserved. `b74387b3`
(`ci: trigger full suite on rebased prep branch`, zero files) survived the first rehearsal
rebase and was only removed once the flag was added.

Merge strictly in order, one at a time, waiting for green — per `CLAUDE.md` → "One PR at a
time".

### Before any `--delete-branch`, enumerate what depends on that ref

**Rule: before running `gh pr merge --delete-branch` (or deleting any branch on `origin`), list
every dependent of that ref — open PRs that use it as a *base branch* included, not only things
downstream of it in ancestry.**

Two kinds of dependency look alike and behave nothing alike:

- **Ancestry-stacked** — a later branch was cut from this one. Deleting the ref is harmless; the
  commits are reachable from wherever they landed. Re-point the rebase at the merge target:
  ```bash
  $G rebase --no-keep-empty --onto origin/main <previous-slice-tip>
  ```
- **Base-ref-stacked** — an *open PR* declares this branch as its base. **Deleting the ref makes
  GitHub close that PR automatically**, and the closure reads like ordinary cleanup in the log.

This run hit the benign kind: `gh pr merge --delete-branch` removed `land/slice-a` before slice B
needed it as a rebase base. `--onto origin/main $A_END` is the same operation, since the merged
trunk and the deleted branch had identical trees, and nothing was lost.

**The same GitHub behaviour is not benign in the other case, and it has already cost real work.**
An hour earlier, the equivalent landing on the streamer repo deleted a branch that an open PR
declared as its base. GitHub silently closed that PR, its content dropped out of the landing
entirely, and the automation reported success — the failure produced no error, only a missing
PR nobody was looking for. Check first:

```bash
gh pr list --state open --json number,title,baseRefName \
  --jq '.[] | select(.baseRefName == "<branch-about-to-be-deleted>")'
```

If that returns anything, re-target those PRs (`gh pr edit <n> --base main`) **before** merging
the branch away. An empty result is what makes `--delete-branch` safe, and it costs one command
to establish.

---

## Verification

**Per slice, before pushing** — cheaper than three rounds of red CI. Node 24.15.0 per `.nvmrc`:

```bash
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:i18n
npm run lint
```

Scope Jest to the repo root so the nested `.worktrees/` checkouts and any sibling worktrees
cannot pollute results:

```bash
npx jest --ci --roots=$PWD/__tests__ --testPathPattern='__tests__/integration'
```

Run Guard A and Guard B from Step 1a alongside these. They are not optional — `fee27061` exists
because there was no equivalent.

**Per slice, in CI** — required green before merging: Gate, Setup, Type check, Unit tests,
Integration tests, Lint, i18n, Native deps. `E2E maestro (iOS)` reports `skipping` on PRs and is
expected.

**End-to-end, once after the final slice:**

```bash
npm ci
cd ios && bundle exec pod install && cd ..   # bundle exec: Gemfile pins CocoaPods 1.16.2
./scripts/reset-podfile-lock-path-noise.sh
npx expo run:ios --device "<simulator-udid>"
```

Expect the session hub to render with server groups, session cards and conversation rows.

#### On a physical device, that command cannot sign — use `dev:device`

> **Correction.** The block above is correct for a **simulator** only, and the `<simulator-udid>`
> placeholder is the only thing that says so. On a physical device a bare `npx expo run:ios
> --device` fails during "Planning build" with six App Groups errors and `xcodebuild` exit 65 —
> **by design**, not as a regression:
> ```
> Provisioning Profile "iOS Team Provisioning Profile: com.ronenmars.threadbase"
> does not support the App Groups capability.
>   ❌ Threadbase          → group.com.ronenmars.threadbase
>   ❌ ExpoWidgetsTarget   → group.com.ronenmars.threadbase
> ```
> Xcode's automatic signing regenerates its own Team Provisioning Profile on every build and
> ignores hand-made ones, so the profile it produces never carries App Groups. `#480` exists
> precisely to solve this and ships `scripts/dev-device.sh`, which discovers an installed
> development profile per target and injects manual signing through `XCODE_XCCONFIG_FILE`:
> ```bash
> DEVICE_UDID=<device-udid> npm run dev:device
> ```
> `#480` deliberately leaves Debug on `CODE_SIGN_STYLE = Automatic` in the committed project, so
> an unset UUID behaves exactly as before and simulator builds, fresh clones and CI are all
> unaffected. Seeing those six errors means the wrong command was used, not that signing broke.

**Prefer a physical device for this check.** The landing carries `#480` (App Groups signing for
on-device Debug builds), the Live Activity work and the widget target; a simulator exercises none
of them.

#### Serve the bundle from the tree under test, or the check proves nothing

**A Metro already listening on 8081 silently invalidates this whole step.** `expo run:ios` is
non-interactive here, so it answers its own "use port 8082 instead?" prompt with `Skipping dev
server` and the device attaches to whatever is already on 8081. If that is a checkout of a
*different* branch, the app renders that branch's JS while the log reports success.

Verified on 2026-08-01: the device attached to a Metro rooted at the repo root on
`land/integration-prep` and red-screened with a module path that gave it away —
`Unable to resolve module react/jsx-runtime from /Users/ronenmars/dev/ai-tools/tb-mobile/app/session/[id].tsx`.
That server had been running for eight hours while its tree was rewritten underneath it, so its
resolver cache was stale; `react/jsx-runtime.js` was present on disk the whole time.

Check the owner before trusting the result, and confirm the bundle came from the right root:

```bash
lsof -nP -iTCP:8081 -sTCP:LISTEN            # who owns the port
npx expo start --dev-client --clear         # from the worktree under test
# then confirm in the Metro log:  iOS Bundled …ms node_modules/expo-router/entry.js
```

### The final check is a tree diff, not a commit count

> **The old `0  0` target is unreachable and has been removed.** It read
> `$G rev-list --left-right --count origin/main...land/integration-prep` and expected `0 0`.
> Under any plan where a slice collapses commits the two histories cannot have equal counts by
> construction. The 2026-08-01 rehearsal measured `22 108` with a provably correct result.

```bash
$G diff --stat <trunk> backup/prep-landing-<date>
```

Rehearsed result — four files, all accounted for:

```
 __tests__/integration/components/SessionScreen.copyTranscript.test.tsx | 141 ---------
 app/session/[id].tsx                                                   |  22 +---
 components/terminal/TerminalOutput.tsx                                 |  31 +++++
 ios/Podfile.lock                                                       |   8 +-
```

The first three are exactly `#481`, which `main` has and prep never absorbed. The fourth is
`Podfile.lock` checksum noise. Anything else is drift and must be investigated before merging.

---

## Risks

| Risk | Mitigation |
|---|---|
| A slice reverts `main`'s post-divergence work | Guard A + Guard B, every slice, no exceptions. This is what `fee27061` cost. |
| Version regression on `app.json` / `build.gradle` | Take `main`'s (higher) values. Read the live numbers — they moved seven times in the last week. **Still unexercised.** Both branches sat at 187/39 through the rehearsal, and on the real run `main` was ahead at 188/40 but *no slice touched either file*, so no conflict arose. This path has never been tested and must not be treated as proven. |
| Squash-vs-drop confusion loses content | Two pairs are patch-identical; everything else is `fixup`. Never `drop`. |
| Plain `rebase <trunk>` replays the wrong range | Always `rebase --no-keep-empty --onto <trunk> <previous-tip>`. |
| An already-empty commit survives the rebase | `--no-keep-empty`. |
| `land/integration-prep` drifts | The snapshot is the freeze (Step 0b). Cut slices from the snapshot, never the live branch. |
| PR #457 merged whole by accident | Never merge it during slicing. It does **not** close itself — its diff is computed against a merge-base that replay never moves. Close it by hand after the last slice. |
| A branch deleted out from under an open PR that bases on it | Enumerate base-ref dependents before every `--delete-branch`. GitHub closes such PRs silently; this already destroyed a PR's content on the streamer landing. |
| A slice is red despite local checks | Fix forward inside that slice; never merge red. |
| `ios/Podfile.lock` churn | Always `bundle exec pod install`, then `scripts/reset-podfile-lock-path-noise.sh`. The gap this row used to flag — the `NOISE` regex missing `RNSentry` — was closed by `#495`; all four path-dependent checksums are covered on `main` now. |
| A batch Jest failure mistaken for a defect | Re-run the suite alone. `sessionNames.test.ts` failed in batch and passed in isolation during the rehearsal, exactly like the documented `SessionScreen.*` suites. |

**Rollback:** nothing is destructive until a slice merges. `land/*` branches are scratch;
`archive/26-07-2026.18-44-integration` is never rewritten. If a merged slice proves wrong,
revert that commit range on `main` and re-cut the slice.

---

## Cost note

Three slices ≈ three rebase + CI + review cycles, against a remaining surface of **72 files,
+2509 / −1225**.

The marginal *review* value is low — most of this content was reviewed through the PRs closed
during triage, and `9cf00d99` already put the majority of it on `main` unreviewed. The genuine
gain is bisectability and release granularity for what is left.

The asymmetry is what justifies three slices rather than nine: the pre-`#462` history is 87
commits contributing **11 files and +49 / −9**, while the post-`#462` work is 21 commits
contributing the other ~56 files and ~2350 lines. Seven PR cycles to deliver 49 lines, six of
them shipping a regression, is not a trade worth making.

---

## Rehearsal, then the real run

The landing was rehearsed locally on 2026-08-01 against this three-slice plan: all three slices
applied, **zero conflicts**, all five checks green per slice, and the final tree matching the prep
snapshot except for `#481` and `Podfile.lock` noise. The rehearsal notes — provenance SHAs, the
conflict ledger, verbatim verification output, the B4 classification and the exact ordered replay
script for `origin` — are committed at
[`docs/landing/2026-08-01-rehearsal-notes.md`](docs/landing/2026-08-01-rehearsal-notes.md),
alongside the prompts that produced them in the same directory.

**The real run then reproduced the rehearsal almost exactly.** Same boundary SHAs, same slice A
file list, same 10-requested / 9-applied on slice B, same `fee27061` self-neutralisation from five
files to two, and the same verification counts to the test (956 / 255, 957 / 255, 960 / 261).
Slice C ran 13 commits rather than 11 because `#494` and `#496` reached prep after the rehearsal
ended; landing the documents that describe the landing was a deliberate choice, not an oversight.

Where the real run diverged, it diverged in what the *documents* claimed rather than in what the
history did — the Guard B enumeration, `#457`'s self-closing, and the `--delete-branch`
dependency check, all corrected above. The run log with the full ledger is at
`../tb-mobile-landing-run/RUN-LOG.md`.

### Still outstanding

One rehearsal correction remains unapplied: `sessionNames.test.ts` should be added to the
load-sensitive suite list in [`docs/troubleshooting.md`](docs/troubleshooting.md) → "Jest test
suites". It failed in batch and passed in isolation during the rehearsal, exactly like the
`SessionScreen.*` suites already documented, and it did not recur on the real run. That file lives
on `main` and needs its own one-line PR against `main` — it is deliberately not bundled here.
