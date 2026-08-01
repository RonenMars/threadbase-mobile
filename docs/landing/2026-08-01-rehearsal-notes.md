# Phase B — Landing rehearsal notes

Local rehearsal of the `land/integration-prep` → `main` landing, run 2026-08-01 against the
three-slice plan approved after Phase A. Nothing was pushed; `origin` stayed read-only
throughout.

Companion to [`PHASE-A-REPORT.md`](./PHASE-A-REPORT.md) and to
`LANDING-integration-to-main.md` on `land/integration-prep`. This file records what the replay
actually did — it does not restate the runbook.

**Result: all three slices landed clean. Zero conflicts. Zero drift. Zero unexplained
differences.** The final trunk differs from the prep snapshot in exactly four files, all
accounted for.

---

## 1. Provenance

| Thing | SHA |
|---|---|
| `backup/prep-rehearsal-2026-08-01` (snapshot of prep) | `a14f248a5a9345e7361240aeeb08d2365119df98` |
| `archive/prep-2026-08-01` (annotated tag, same commit) | `a14f248a5a9345e7361240aeeb08d2365119df98` |
| `origin/main` at trunk start | `30454c1a356a36b31534a6409817d96fb21a4cc1` |
| `rehearsal/main-2026-08-01` initial | `30454c1a356a36b31534a6409817d96fb21a4cc1` |
| fork point `merge-base(main, prep)` | `68439f0471acda72b49c31f6d8d20c264d4099de` |
| `origin/archive/26-07-2026.18-44-integration` | `eb330e71980b234f8557addf930f764b815fbf6c` |

### Trunk checkpoints

| After | Trunk SHA | Commits added | Cumulative vs `origin/main` |
|---|---|---|---|
| slice A | `89766769` | 1 | 11 files, +49 / −11 |
| slice B | `3bd525cc` | 9 | 41 files, +1318 / −157 |
| slice C | `cc9025eb` | 11 | 70 files, +2472 / −1060 |

Slice branches: `rehearsal/slice-B` → `3bd525cc`, `rehearsal/slice-C` → `cc9025eb` (both
fast-forwarded into the trunk, so tip == trunk at that point). Slice A has no branch — it was
committed directly onto the trunk as a single reconciliation commit.

Worktree: `../tb-mobile-worktrees/rehearsal` (sibling, never nested — a nested worktree makes
Jest report phantom failures from a stale branch). Node 24.15.0 per `.nvmrc`. The Phase A
audit worktree was removed before the rehearsal so it could not pollute Jest discovery.

---

## 2. Squash (B2) — **NOT PERFORMED, AND CORRECTLY SO**

The runbook's Step 2 requires squashing the same-subject runs before slicing, so a run cannot
be split across a slice boundary. Under the three-slice plan that requirement is vacuous.

Checked rather than assumed:

```bash
$G log --format='%s' ce45728d..a14f248a | sort | uniq -d
# empty
```

All 16 commits belonging to a same-subject run sit at positions 65–108 counting back from the
branch tip:

```
pos  65, 66, 70, 71   feat(conversation): stabilize live reload, animate new messages, add live pause toggle
pos  93, 100          feat(sessions): add read-only live view for external sessions
pos  94, 104          feat(servers): show warm-up progress for every server
pos  95, 105          fix(cache): handle explicit server warm-up states
pos  96, 106          test(cache): extend modal render timeout in CI
pos  97, 107          fix(cache): clear server state after destructive actions
pos  98, 108          feat(servers): add cache integrity alert resolution
```

Slice B spans positions 12–21 and slice C spans 1–11. Every run lies entirely inside the
former slices 1–7 range, which slice A does not replay commit-by-commit. There is no boundary
for a run to straddle, so there is nothing to squash.

The empty-diff proof the runbook asks for after squashing is not applicable. The equivalent
guarantee for slice A is the Guard A / Guard B pair in §3.

**Nothing resisted, because nothing was attempted.** This is the one runbook step the
three-slice decision deletes outright.

---

## 3. Conflict ledger

**Zero conflicts across the entire rehearsal.** Both rebases reported
`Successfully rebased and updated` on the first attempt with no `CONFLICT` line and no dirty
worktree. Nothing was time-boxed, nothing was BLOCKED, no slice went RED.

That is a stronger result than the runbook predicts, and it is a direct consequence of the
cherry-pick decision — see the `fee27061` entry below.

### Slice A — cherry-pick, no rebase

Built by `git checkout ce45728d -- <11 files>` onto the trunk. No replay, so no conflict
surface. Four files from the 15-file net diff were deliberately excluded as regressions of
`main` rather than content:

| Excluded file | What it would have done | Class |
|---|---|---|
| `.github/workflows/test.yml` | reverts `#474`'s gate-comment corrections (+5/−10) | judgement — someone must know `#474` exists |
| `package.json` | reverts `#471`, dropping `bundle exec` and `reset-podfile-lock-path-noise.sh` from `dev:reset` | judgement |
| `KICKOFF-landing-runbook.md` | resurrects (+71/−0) a file `#474` deleted | mechanical — Guard A catches it blind |
| `ios/Podfile.lock` | 4 checksums with no version line moving | mechanical — the repo documents this exact pattern |

Both guards ran and passed:

```
GUARD A  crash-log.txt absent · log-mobile.txt absent · KICKOFF-landing-runbook.md absent
GUARD B  11 files, +49 / −11 vs origin/main; every one of the 11 removed lines is paired
         with a replacement, none is main-only content
```

The 11 removals were inspected line by line: they are the inline `mailto:` literals being
replaced by the `SUPPORT_EMAIL` constant, the four `helpSupport` locale strings being
retitled, and the `SUPPORT_EMAIL` declaration gaining its env override. No content loss.

### Slice B — 10 commits requested, 9 applied

```bash
$G rebase --no-keep-empty --onto rehearsal/main-2026-08-01 ce45728d
# Rebasing (1/9) … Successfully rebased and updated refs/heads/rehearsal/slice-B.
```

Two findings, both mechanical and both repeatable blind:

**`b74387b3` (empty CI-trigger commit) is NOT dropped by a plain rebase.** Phase A asserted
`git rebase` drops it by default. That is **wrong**, and the first rebase attempt proved it —
the commit replayed as `a9c35173` carrying zero files. `git rebase` drops commits that *become*
empty during the replay; a commit that was *already* empty is preserved unless
`--no-keep-empty` is passed. The rebase was redone with that flag and the commit disappeared,
taking the slice from 10 commits to 9.

**`fee27061` self-neutralised, and this is the cherry-pick decision paying off.** On prep it
touches five files; replayed onto the trunk as `dd48c725` it touches **two** —
`LANDING-integration-to-main.md` and the new
`docs/runbooks/2026-08-01-rebase-integration-prep-conflicts.md`. Its restorations of
`test.yml`, `package.json` and its deletion of `KICKOFF-landing-runbook.md` all became no-ops,
because slice A never introduced the regressions they existed to undo. Git resolved this
silently — no conflict, no prompt. Under a nine-slice replay those same three files would have
been regressed by slice 1 and only repaired here, six PRs later.

Post-slice guards:

```
GUARD A  all three files still absent
GUARD B  test.yml unchanged vs main · ios/Podfile.lock unchanged vs main
         package.json +1/−1 — legitimate content (#470 adds
         e2e/07_conversation_scroll_gaps.yaml to the mock suite), not a revert
         dev:reset still carries `bundle exec` and `./scripts/reset-podfile-lock-path-noise.sh`
```

### Slice C — 11 commits, 11 applied

```bash
$G rebase --no-keep-empty --onto rehearsal/main-2026-08-01 eb0c6d79
# Rebasing (1/11) … Successfully rebased and updated refs/heads/rehearsal/slice-C.
```

No conflicts, no empty commits, no guard failures. `npm ci` was re-run after this slice because
`#488`/`#489`/`#490` change `package.json` and `package-lock.json`.

### The rebase invocation the runbook gets wrong

The runbook's Step 2 says:

```bash
$G checkout -b land/slice-$i <tip-sha>
$G rebase rehearsal/main-<today>
```

**A plain `$G rebase <trunk>` is wrong for every slice after the first**, and catastrophically
wrong under the three-slice plan. `merge-base(trunk, eb0c6d79)` is the fork `68439f04`, so a
plain rebase would replay **97** commits, not slice B's 10 — including the entire 1–7 range
that slice A deliberately did not replay. The correct form is:

```bash
$G rebase --no-keep-empty --onto <trunk> <previous-slice-tip> <this-slice-tip>
```

This is not a three-slice-only correction. Under the original nine-slice plan the plain form
happens to work only because each slice's predecessor is already on the trunk as
patch-identical commits; the `--onto` form is correct in both worlds and fails safe.

---

## 4. Verification results

Run in the rehearsal worktree on Node 24.15.0. Jest scoped with `--roots=$PWD/__tests__` so
the repo's 14 nested `.worktrees/` checkouts and 6 sibling worktrees cannot pollute results.

| Check | Slice A | Slice B | Slice C |
|---|---|---|---|
| `npm run typecheck` | **pass** (exit 0) | **pass** (exit 0) | **pass** (exit 0) |
| unit | **101 suites / 956 tests** | 100 pass, **1 FAIL** → artifact, see below | **101 suites / 960 tests** (serial) |
| integration | **41 suites / 255 tests** | **41 suites / 255 tests** | **41 suites / 261 tests** |
| `npm run test:i18n` | **3 suites / 55 pass, 1 skipped** | same | same |
| `npm run lint` | **0 errors, 5 warnings** | same | same |

No slice was marked RED. No verification failure survived investigation.

### The one failure, quoted verbatim

Slice B's batch unit run:

```
FAIL __tests__/unit/stores/sessionNames.test.ts
Test Suites: 1 failed, 100 passed, 101 total
Tests:       951 passed, 951 total
```

Note `951 passed, 951 total` — no individual test failed; the suite failed to load. Per
`CLAUDE.md` → "Jest — Confirm Suite Failures in Isolation", re-run alone:

```
npx jest --ci --runInBand --roots=$PWD/__tests__ --testPathPattern 'sessionNames'

PASS __tests__/unit/stores/sessionNames.test.ts
  sessionNamesStore – getName/setName
    ✓ returns undefined for unknown session
    ✓ stores and retrieves a name
    ✓ stores origin alongside name
    ✓ overwrites existing name
    ✓ mergeFromServer does not overwrite manual names
    ✓ mergeFromServer fills in missing names
Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
```

**Passes alone → load artifact, not a defect.** Confirmed a second time by slice C's serial
run, which passed all 101 suites and 960 tests including this one. `sessionNames.test.ts`
should be added to the load-sensitive list in `docs/troubleshooting.md`; the doc currently
names only the `SessionScreen.*` suites.

The 5 lint warnings are pre-existing on `main` (an `import/first` in a test helper and an
`exhaustive-deps` on an unrelated effect in `app/session/[id].tsx`); warnings are allowed
through per `CLAUDE.md`.

---

## 5. B4 classification

```
$G rev-list --left-right --count rehearsal/main-2026-08-01...backup/prep-rehearsal-2026-08-01
22	108
```

The runbook's stated target is `0  0`. It was never reachable here and the target is wrong for
this plan: slice A collapses 87 commits into 1, so the two histories cannot have equal commit
counts by construction. **The commit counts are not the measure — the tree is.**

```
$G diff --stat rehearsal/main-2026-08-01 backup/prep-rehearsal-2026-08-01

 __tests__/integration/components/SessionScreen.copyTranscript.test.tsx | 141 ---------
 app/session/[id].tsx                                                   |  22 +---
 components/terminal/TerminalOutput.tsx                                 |  31 +++++
 ios/Podfile.lock                                                       |   8 +-
 4 files changed, 37 insertions(+), 165 deletions(-)
```

Four files. Every one classified:

| File | Δ | Class | Evidence |
|---|---|---|---|
| `SessionScreen.copyTranscript.test.tsx` | −141 | **EXPECTED** | exactly `#481`'s `+141/−0` |
| `app/session/[id].tsx` | +2/−20 | **EXPECTED** | exactly `#481`'s `+20/−2` |
| `components/terminal/TerminalOutput.tsx` | +31 | **EXPECTED** | exactly `#481`'s `+0/−31` |
| `ios/Podfile.lock` | +4/−4 | **EXPECTED, but unguarded** | see below |

The first three are `refactor(terminal): move copy-all into the session overflow menu (#481)`,
which `main` has and prep never absorbed. Phase A identified it in advance as legitimately
main-only. The signs invert because the diff runs trunk → prep. Verified against
`git show --numstat 30454c1a` line for line.

**No DRIFT. No UNEXPLAINED.** Nothing was lost and nothing was invented.

`app.json` and `android/app/build.gradle` do not appear in the diff at all — both branches sat
at buildNumber `187` / versionCode `39` for the whole run, so **the version-conflict scenario
the runbook spends most of its risk budget on never occurred**. It remains a real risk on the
next ship; it simply was not exercised here.

### The one thing worth acting on: `RNSentry`

`ios/Podfile.lock` differs in four `SPEC CHECKSUM` values with **no version line moving**:

```
-  ExpoModulesCore: 6abb896a…   +  ExpoModulesCore: 1d8a6b6a…
-  ExpoWidgets:     683ecb15…   +  ExpoWidgets:     64457409…
-  hermes-engine:   82b14fe6…   +  hermes-engine:   9ebc7f0a…
-  RNSentry:        1379dbcb…   +  RNSentry:        7bb2dcf9…
```

Three of the four are the documented path-dependent pods. **`RNSentry` is the fourth, and it is
not covered** — `scripts/reset-podfile-lock-path-noise.sh` line 27 reads:

```
NOISE='^[+-]  (ExpoModulesCore|ExpoWidgets|hermes-engine): [0-9a-f]{40}$'
```

`RNSentry (8.18.0)` is identical on both branches, so by the repo's own heuristic — a genuine
pod change also moves that pod's version line — this is noise the script silently lets through.
That means the `Podfile.lock` ping-pong the script exists to stop can still happen via
`RNSentry`. Classified EXPECTED because it is provably noise, but flagged because the guard
that is supposed to catch it does not. Out of scope for the landing; worth its own one-line PR.

---

## 6. Corrections to `LANDING-integration-to-main.md` the rehearsal proved necessary

These are the corrections the *replay* established, on top of the Phase A audit corrections.

**1 — The rebase invocation is wrong.**

> Wrong (Step 2):
> ```bash
> $G checkout -b land/slice-$i <tip-sha>
> $G rebase rehearsal/main-<today>
> ```

> Correct:
> ```bash
> $G checkout -b land/slice-$i <this-slice-tip>
> $G rebase --no-keep-empty --onto <trunk> <previous-slice-tip>
> ```

A plain `rebase <trunk>` resolves its base to `merge-base(trunk, tip)` — the fork — and replays
97 commits instead of the slice's 9. The `--onto` form is correct under both the nine-slice and
the three-slice plan.

**2 — `--no-keep-empty` is required, and Phase A's claim about it was wrong.**

> Wrong (Phase A report, §3): "`b74387b3` … `git rebase` drops it by default."

> Correct: `git rebase` drops commits that *become* empty during the replay. A commit that was
> already empty at author time is preserved. `b74387b3` survived the first rebase as
> `a9c35173` with zero files and was only removed by re-running with `--no-keep-empty`.

**3 — The final verification target `0  0` is unreachable and should be replaced.**

> Wrong (Verification):
> ```bash
> **Final divergence check** — should report `0  0`:
> $G rev-list --left-right --count origin/main...land/integration-prep
> ```

> Correct: the measured result is `22 108`, and it always will be under any plan where a slice
> collapses commits. Replace the commit-count check with the tree check:
> ```bash
> $G diff --stat <trunk> backup/prep-rehearsal-<date>
> # expect: only main-only commits (today: #481) and ios/Podfile.lock checksum noise
> ```

**4 — Step 1's archive whole-tree check must be deleted, not merely updated.**

> Wrong (Step 1): `$G diff origin/archive/… land/integration-prep -- . ':!app.json' ':!android/app/build.gradle'` … `# expect: empty`

Measured at 84 files. Prep is 24 commits of genuinely-new content past the archive and has
absorbed 18 of `main`'s. It can never return to empty. Replace with the directional
reverse-apply check from the Phase A report §3.

**5 — Add the Guard A / Guard B pair as a mandatory per-slice step.** Both ran three times here
and both caught real things: Guard A is what keeps `KICKOFF-landing-runbook.md` from coming
back, Guard B is what kept `#471` and `#474` from being reverted. The runbook currently has no
equivalent — `fee27061` exists precisely because there was no check.

**6 — Record that the squash step is conditional, not mandatory.** Under the three-slice plan
there is nothing to squash. The runbook should say: check
`log --format='%s' <first-slice-base>..<last-tip> | sort | uniq -d` first, and skip the step
entirely if it is empty.

**7 — Add `sessionNames.test.ts` to the load-sensitive suite list** in
`docs/troubleshooting.md` → "Jest test suites". It failed in batch and passed in isolation,
exactly like the `SessionScreen.*` suites already documented.

**8 — Record why slice A is a cherry-pick, in the runbook itself**, so it does not read as a
shortcut. Replaying the 87 commits does not preserve history for that range — `9cf00d99`
already destroyed it — it *manufactures* one. Those commits would land six successive states on
`main` that are strictly worse than `main` is today (`types/api.ts` −83 with zero insertions,
`app/session/[id].tsx` −244 across the range), states that never existed as `main` and that a
future bisect would walk into. Replaying therefore damages the property slicing exists to
protect, while costing seven CI cycles and shipping six regressions. The cherry-pick is the
conservative choice, not the lossy one.

---

## 7. The replay script for `origin`

Exact ordered commands. Everything above `--- PUSH LINE ---` is local and reversible.

```bash
G=/opt/homebrew/bin/git          # the zsh `git` function shadows the binary
DATE=$(date +%F)                  # rehearsal ran with DATE=2026-08-01

# ── 0. Snapshot. This IS the freeze — prep may keep moving after it.
$G fetch origin --prune
$G branch backup/prep-landing-$DATE origin/land/integration-prep
$G tag -a archive/prep-$DATE -m "snapshot of land/integration-prep for the landing" \
       origin/land/integration-prep
SNAP=$($G rev-parse origin/land/integration-prep)

# ── 1. Re-derive the boundaries against the snapshot. Never reuse a written SHA.
A_END=$($G log --format=%H --fixed-strings -1 \
        --grep='fix(settings): label the support row for what it does' $SNAP)   # ce45728d
B_END=$($G log --format=%H --fixed-strings -1 \
        --grep='fix(sentry): pin commit association to HEAD' $SNAP)             # eb0c6d79
C_END=$SNAP                                                                     # a14f248a
FORK=$($G merge-base origin/main $SNAP)                                         # 68439f04

# ── 2. Squash check — skip the step entirely if this is empty.
$G log --format='%s' $A_END..$C_END | sort | uniq -d      # empty on 2026-08-01

# ── 3. Regenerate the guard lists (they grow every time main takes a content commit).
$G diff --diff-filter=D --name-only $FORK origin/main > /tmp/guard-a.txt   # + KICKOFF-landing-runbook.md
$G log --format='' --name-only --no-merges $FORK..origin/main \
  | sort -u | grep -v '^$' > /tmp/guard-b-raw.txt
# then drop app.json / android/app/build.gradle and 9cf00d99's 298-file sweep;
# what remains is the ~21-file content-bearing list.

# ── 4. SLICE A — reconciliation cherry-pick, NOT a replay.
$G worktree add -b land/slice-a ../tb-mobile-worktrees/slice-a origin/main
cd ../tb-mobile-worktrees/slice-a
$G diff --name-only $FORK $A_END        # review all 15; exclude the regressions
$G checkout $A_END -- \
  .env.example \
  .github/workflows/deploy.yml \
  __tests__/unit/services/feedback-transport.test.ts \
  app/settings.tsx \
  components/onboarding/steps/ConnectStep.tsx \
  components/pair/PairScannerModal.tsx \
  locales/ar/settings.json locales/en/settings.json \
  locales/he/settings.json locales/ru/settings.json \
  services/feedback-transport.ts
# DELIBERATELY EXCLUDED — each reverts or resurrects main's own work:
#   .github/workflows/test.yml   (reverts #474)
#   package.json                 (reverts #471)
#   KICKOFF-landing-runbook.md   (resurrects a file #474 deleted)
#   ios/Podfile.lock             (path-dependent checksum noise)

# GUARD A + GUARD B — must both pass before committing.
for f in $(cat /tmp/guard-a.txt) KICKOFF-landing-runbook.md; do
  [ -e "$f" ] && { echo "GUARD A FAIL: $f"; exit 1; }
done
$G diff --cached origin/main | grep -E '^-' | grep -v '^---'
# every removed line must be paired with a replacement; none may be main-only content

npm ci && npm run typecheck && npm run test:unit \
  && npx jest --ci --roots=$PWD/__tests__ --testPathPattern='__tests__/integration' \
  && npm run test:i18n && npm run lint
npx eslint $($G diff --cached --name-only | grep -E '\.(ts|tsx|js|jsx)$')
$G commit      # feat(support): make the support and feedback inboxes env-overridable

# ── 5. SLICE B — 9 commits. Note --onto and --no-keep-empty; both are load-bearing.
$G checkout -b land/slice-b $B_END
$G rebase --no-keep-empty --onto land/slice-a $A_END
#   plain `$G rebase land/slice-a` would replay 97 commits, not 9
#   without --no-keep-empty the empty CI-trigger commit survives
# re-run guards + the five checks

# ── 6. SLICE C — 11 commits.
$G checkout -b land/slice-c $C_END
$G rebase --no-keep-empty --onto land/slice-b $B_END
npm ci        # #488/#489/#490 move package.json and package-lock.json
# re-run guards + the five checks

# ── 7. Final tree check. NOT the commit-count check — that cannot reach 0 0.
$G diff --stat land/slice-c backup/prep-landing-$DATE
# expect only: main-only commits (today #481, 3 files) + ios/Podfile.lock checksum noise

# --- PUSH LINE — everything below touches origin ---

# ── 8. One PR at a time, in order, each merged before the next is opened.
$G push -u origin land/slice-a
gh pr create --base main --head land/slice-a \
  --title "feat(support): make the support and feedback inboxes env-overridable"
# wait for green: Gate, Setup, Type check, Unit tests, Integration tests, Lint, i18n,
# Native deps. `E2E maestro (iOS)` reports `skipping` on PRs and is expected.
gh pr merge --rebase --delete-branch          # rebase-merge, NOT squash — Step 3's reasoning

$G fetch origin && $G checkout land/slice-b && $G rebase origin/main
$G push -u origin land/slice-b
gh pr create --base main --head land/slice-b --title "feat(sentry): enable release health and deploy markers"
gh pr merge --rebase --delete-branch

$G fetch origin && $G checkout land/slice-c && $G rebase origin/main
$G push -u origin land/slice-c
gh pr create --base main --head land/slice-c --title "feat(sessions): surface interrupted status and harden Sentry privacy"
gh pr merge --rebase --delete-branch

# ── 9. Afterwards.
# PR #457 (land/integration-prep → main) drains to empty and closes itself. Do not merge it.
# Anything merged into prep after $SNAP goes through the mirror loop, not a slice.
```

### Known deltas the replay will still carry to `origin`

- `#481` is on `main` and not on prep. Slices B and C rebase onto it cleanly (verified — it
  touches `app/session/[id].tsx` and `TerminalOutput.tsx`, which slice C's `a6ce67ec` and slice
  B's `a9f15ac6` also touch, and no conflict arose).
- `ios/Podfile.lock` will drift by four checksums on any machine that runs `pod install`. Run
  `scripts/reset-podfile-lock-path-noise.sh`, and note it does **not** cover `RNSentry` (§5).
- `app.json` / `android/app/build.gradle` matched throughout this run. They will not on the next
  ship — take `main`'s higher values, and read them live rather than trusting any number
  written down.
