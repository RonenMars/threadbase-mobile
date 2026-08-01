# Landing `land/integration-prep` onto `main` in reviewable slices

> **Status:** Steps 0, 1 and 1a are done. As of 2026-08-01 `land/integration-prep` is a straight `main` + **92** commits (`0 92` on the divergence check) and Step 2 slicing can start.
> Divergence has recurred twice already and will recur again — `main` takes a version-bump commit on every ship. Re-run the divergence check immediately before cutting each slice rather than trusting this line; Step 1a is the procedure, and it is repeatable, not one-time.
> The source branch has been renamed to `archive/26-07-2026.18-44-integration` and is frozen; it survives only as the independent witness for Step 3's reconciliation.
> References below to the archived name are historical (what was measured, where the work came from), not instructions to act on it.

## Context

All mobile work for the last two weeks has been landing on the integration branch
`archive/26-07-2026.18-44-integration` rather than on `main`, mostly by direct push rather than through PRs.
`main` was **111 commits behind** `land/integration-prep` when this work started, and during a triage of 38 open PRs every single one reported "not on main" — their content had reached the integration branch and stopped there.

That divergence is what produced the recurring problems this work surfaced: PRs sitting red for days against a base that had already absorbed their content, PRs whose diffs silently regressed version numbers because their branch point predated a bump, and 23 PRs that turned out to be fully redundant. That same divergence has recurred twice since the prep rebase (see Step 1a) — it is an ongoing risk, not a one-time fix.

The goal is to get that work onto `main` as a sequence of reviewable, independently-green PRs, instead of one opaque merge — so `main` regains bisectability and release granularity, and so the integration branch stops being a parallel trunk. The commit count shrinks on each re-rebase as already-landed work replays empty (111 → 92 by 2026-08-01), so treat the tree as the measure, not the count.

**Deliberately out of scope:** any change to app behaviour. This is a history/merge operation only. If a slice needs a code fix to go green, that fix is part of the slice, not a separate feature.

---

## Measured facts (basis for the plan)

Gathered against `origin/main` and `origin/archive/26-07-2026.18-44-integration`:

| Fact | Value | Consequence |
|---|---|---|
| Commits ahead of `main` | **111** (07-18 → 07-31) | Too many for one reviewable PR |
| Merge commits in range | **0** — perfectly linear | Contiguous slices replay conflict-free |
| `main`-only commits | **0** as of 2026-08-01 (last re-rebase) | `main` *is* an ancestor right now. Regrows on every ship — re-check before slicing (Step 1a) |
| Same-subject commit runs | **9 commits** across 7 subjects | Must be squashed, **not dropped** (see below) |
| Known-red window | *(healed)* — the fix was folded into the breaking commit during the prep rebase | No longer constrains boundary placement |

### Hotspot files — why thematic cherry-picking fails

| File | Commits touching it |
|---|---|
| `app/session/[id].tsx` | 13 |
| `types/api.ts` | 11 |
| `locales/{ar,he,ru}/conversation.json` | 10 each |
| `app/_layout.tsx` | 9 |
| `app/conversation/[id].tsx` | 8 |

These touches interleave across every theme. Grouping commits by feature means a "terminal" PR and a "conversation" PR both edit the same regions at different points in history — producing repeated conflict resolution and trees that never actually existed or were tested.

### The duplicates are iterations, not copies — **still outstanding**

> **Correction — this reverses an earlier recommendation.**
> An earlier draft of this plan said to **drop** the 9 duplicate commits during the prep rebase.
> **That was wrong and would have silently discarded real content.** The instruction below (`fixup`, not `drop`) supersedes it.

None of this squashing has happened yet — all 7 same-subject groups (9 commits total, plus the 4-way conversation run below) are still present, separate, in `land/integration-prep` today.

The 9 commits share subject lines but **not patches**. Re-verified against current SHAs with `git patch-id --stable`:

```
eea821ee vs 2989d62c  DIFFER     feat(servers): add cache integrity alert resolution
e677fcda vs 4beb76bc  DIFFER     fix(cache): clear server state after destructive actions
b2866176 vs 20efc8bf  DIFFER     fix(cache): handle explicit server warm-up states
f4013e06 vs d63cc321  DIFFER     feat(servers): show warm-up progress for every server
623c826d vs 80272f81  DIFFER     feat(sessions): add read-only live view for external sessions
be419a59 vs 4cc8e758  IDENTICAL  test(cache): extend modal render timeout in CI   <- the only true duplicate
```

The four `feat(conversation): stabilize live reload…` commits (`44f2af96`, `eff1dd3a`, `46d87335`, `9e84b0df`) likewise have **four distinct patch-ids**.

So these are *iterations of the same work carrying a copy-pasted commit message*, not repeated applications of one patch. Only `be419a59`/`4cc8e758` is a genuine duplicate.

**Therefore: squash same-subject runs with `fixup`; never `drop` them.** Squashing preserves the net tree exactly while collapsing the noise. The post-rebase diff check in Step 1 exists specifically to catch this class of mistake. This squash still needs to happen — before Step 2 slicing, so a duplicate run doesn't end up split across two slice boundaries.

Reusable check for any future "is this commit already applied?" question — patch-id compares diffs independently of SHA, author and date:

```bash
pid() { git show "$1" | git patch-id --stable | cut -d' ' -f1; }
[ "$(pid A)" = "$(pid B)" ] && echo IDENTICAL || echo DIFFER
```

### The broken window — **healed**

`app/conversation/[id].tsx` calls `makeSearchStyles(theme)`, and for roughly 25 commits in the pre-rebase history it lost its import — the same defect that kept PRs #421–#423 red.

During the prep rebase this was healed: the import fix was folded into the commit that introduces the break (`feat(conversation): add in-chat search entry on detail screen`, now `b09338cd`) instead of arriving ~25 commits later. Walking every commit in `origin/main..origin/land/integration-prep` that touches the file confirms the window no longer exists:

```
623c826d  import=0 uses=0   (doesn't touch makeSearchStyles yet)
44f2af96  import=0 uses=0
b09338cd  import=1 uses=1   ok — search entry added, import lands with it
46d87335  import=1 uses=1   ok
7c648751  import=1 uses=1   ok
e06629de  import=1 uses=1   ok — "restore in-chat search button and repair locale drift"
527cdb42  import=1 uses=1   ok
09805dde  import=1 uses=1   ok
```

`broken=0` across all 8 commits touching the file. Any slice boundary can now fall anywhere in this range without shipping a red PR.

---

## Strategy

**Contiguous slices of the linear history, merged in order.** Not thematic cherry-picks.

Because the range contains zero merge commits, contiguous ranges replay onto `main` in order with no conflicts by construction, and every boundary is a tree that genuinely existed.

---

## Step 0 — Freeze the integration branch — **DONE**

Commits landed on it as recently as 2026-07-31 (`3900bde9`, `3b708dcf`). A moving target invalidates every boundary mid-flight.

The branch was renamed to `archive/26-07-2026.18-44-integration`, which freezes it by making the old name unresolvable and signalling that nothing should target it. Zero open PRs pointed at it at the time. Land nothing new there; new work branches off `main`, and the slicing source is `land/integration-prep`.

**PR #455 merged first** (`chore/bump-babel-preset-expo-57.0.4`) so it did not become a 107th commit mid-operation.

---

## Step 1 — One-time prep rebase (on a scratch branch) — **DONE, with one carry-over**

Work on `land/integration-prep`, never on the integration branch itself, so the original stays intact as a reference.

> **What actually happened.** The rebase replayed 107 commits onto `main` with **zero conflicts**; `a5766408` was auto-dropped as already applied (it reached `main` as `ff8bd0ba` via #434). Verified afterwards: 0 commits from the archived branch are absent from prep, the whole-tree delta is only `app.json` and `android/app/build.gradle`, and prep carried `main`'s higher values at the time (buildNumber `181`, versionCode `37`).
>
> The broken-window heal (originally planned as this rebase's sub-step 3) **was done**: the `makeSearchStyles` import fix was folded into the commit that introduces the break instead of arriving ~25 commits later. Verified — see "The broken window — healed" above.
>
> **Sub-step 2 (squashing the same-subject runs) was NOT performed.** The 9 same-subject commits across 7 subjects are still separate in prep's history today. See Step 2's duplicates note.

```bash
G=/opt/homebrew/bin/git   # the zsh `git` function shadows the binary; use the absolute path
$G fetch origin
$G checkout -b land/integration-prep origin/archive/26-07-2026.18-44-integration
$G rebase -i origin/main
```

Two things happened in this rebase:

1. **Rebase onto `main`** — resolved the divergence at the time. Conflicts appeared in `app.json` and `android/app/build.gradle`; **took `main`'s higher values** (buildNumber `181`, versionCode `37`). Taking the branch's older numbers is the exact regression trap found in PR #434.
2. **Healed the broken window** — moved the `makeSearchStyles` import fix out of the later fix commit and into the commit that introduces the break, as a `fixup`.

That heal was the high-value move: it converted a hard constraint into a free choice. Without it, slices 3–4 would have been hostage to the red zone and forced to merge as one oversized ~36-commit PR.

**Verify the prep rebase preserved content** — the tree at the end must match the original branch tip except for the version bumps:

```bash
$G diff origin/archive/26-07-2026.18-44-integration land/integration-prep -- . \
  ':!app.json' ':!android/app/build.gradle'
# expect: empty
```

If that diff is non-empty, something was dropped rather than squashed. Stop and investigate before slicing.

---

## Step 1a — Re-rebase before slicing — **repeat before every slice**

Not a one-time step. `main` takes a version-bump commit on every ship, so prep falls behind again within hours. Run this whenever the divergence check reports a non-zero left-hand number.

Last run 2026-08-01: prep rebased onto `main` at `68439f04` (buildNumber `187` / versionCode `39`), landing at `main` + 92 commits with zero conflicts.

Cutting slices from a prep branch that is behind `main` bases every PR on a stale tree, reintroducing the version-regression trap this document warns about (PR #434) the moment a slice touches `app.json`.

To re-rebase:

```bash
$G fetch origin
$G checkout land/integration-prep
$G rebase origin/main
# conflicts, if any, in app.json / android/app/build.gradle: take main's higher
# values — same rule as Step 1. Never assume a number; read main's current one.
$G push --force-with-lease
```

Then re-verify the divergence check in the Verification section reports `0` on the left. The right-hand count shifts between runs as commits already represented on `main` replay empty and drop — 115 became 92 across the 2026-08-01 runs. A shrinking count is expected, not a sign of lost work; the tree is what to check, not the commit count.

If a rebase of the full branch produces conflicts on nearly every commit, do not grind through it — see [`docs/runbooks/2026-08-01-rebase-integration-prep-conflicts.md`](docs/runbooks/2026-08-01-rebase-integration-prep-conflicts.md) for the squash-first technique that reduced ~100 conflict sets to 18, and for the per-file resolutions.

This step recurs by nature — a live `main` moving out from under a long-lived prep branch is the same problem Step 0 froze the *source* branch to avoid. Re-check `$G rev-list --left-right --count origin/main...origin/land/integration-prep` immediately before cutting Step 2's slices, not just once here.

---

## Step 2 — Seven slices

Boundaries chosen at thematic seams. The rebase does not reorder commits, so a slice tip is identified by **subject line**, which survives a rebase — the SHA column from the original draft (`f8c21e49`, `fdd69cd8`, `b311ac6c`, `4f036da6`, `368e8282`, `bb67d2d1`, `0b2e8907`) no longer resolves on `land/integration-prep` and has been replaced below.

| # | Slice tip (subject) | Theme | n |
|---|---|---|---|
| 1 | `test(e2e): grant speech-recognition before Maestro mock suite` | cache integrity + warm-up, Sentry crash consent, external-session live view, i18n gates | 23 |
| 2 | `docs(runbooks): add mobile land-open-prs runbook with session-name follow-up chain [skip-ci]` | onboarding polish + pair-token exchange, e2e hardening, session test mocks | 21 |
| 3 | `docs(runbook): append session-load and slowdown follow-up PR chain [skip-ci]` | JSONL session name, conversation live view, terminal/session perf | 10 |
| 4 | `fix(conversation): restore in-chat search button and repair locale drift` | terminal-conversation rendering (#403), C-series (diagnostics/capabilities/push/devices/backup), browse | 26 |
| 5 | `fix(ios): patch expo-modules-jsi Swift 6 abs() overload ambiguity` | iOS SDK 57.0.8 alignment, dyld gate, Swift 6 `abs()` patch | 3 |
| 6 | `feat(live-activity): render a per-turn Finished state and add the logo` | live activity iOS + Android, terminal history/seq fixes | 12 |
| 7 | `fix(settings): label the support row for what it does (#462)` | terminal UX (question card, wrapped rows, banner dedupe), CI fix, iOS signing/1Password hardening, support-email label | 16 |

Total 111. The ~20 `docs`/`[skip-ci]` commits are not a separate slice — they sit inside whichever range they belong to.

**Slice 6 count revised from ~13 to 12** — re-walking the current history places `feat(terminal): add close button to question card` at the start of slice 7's "question card" theme rather than the end of slice 6, which is one commit earlier than the original estimate. The original count was explicitly a tilde-estimate ("shrink slightly after squashing"), so this is within the stated tolerance.

**Slice 7 grew from ~10 to 16** to absorb content that landed after the original slice table was written — the seven trailing commits below, only four of which are genuinely new (see reasoning after the list):

```
049844ce fix(ci): unblock integration and i18n jobs on the integration base (#454)
4fed7774 fix(session): treat historical sessions as terminal despite prompt history (#456)
a2673e67 fix(ios): run pod install through bundle exec so Podfile.lock stops flip-flopping (#455)
8d8499f1 docs: add runbook for landing the integration branch onto main [skip-ci]
f4d97734 docs: add smartwatch session surfaces to task roadmap [skip-ci]
7574791b fix(ios): source provisioning profiles from 1Password profile items (#459)
841afeea fix(settings): label the support row for what it does (#462)
```

The first three (`#454`, `#456`, `#455`) were already merged into the archived integration branch before the prep rebase and were folded into the original ~10-commit slice 7 estimate — `#454` is literally the "CI fix" the original theme names. The last four (the two `docs` commits, `#459`, `#462`) landed **after** the slice table was written and are genuinely new. Per this document's existing rule, the two `docs` commits ride inside whichever range they belong to rather than getting a slice of their own. The two fixes (`#459`: iOS signing scripts + tests, `#462`: support-email constant + 3 call sites) are small, self-contained, and thematically continuous with slice 7's existing CI/infra/terminal-polish scope — extending slice 7 to absorb all four costs one slightly larger PR rather than opening an eighth slice for content too small to justify its own review/CI cycle.

After the prep rebase, re-identify each tip by subject (SHAs change):

```bash
$G log --oneline origin/main..land/integration-prep | grep 'grant speech-recognition'
```

For each slice `i`, in order:

```bash
$G checkout -b land/slice-$i <tip-sha>
$G push -u origin land/slice-$i
gh pr create --base main --head land/slice-$i --title "<type>(<scope>): <summary>"
```

---

## Step 3 — Merge with **rebase-merge**, not squash

This is a deliberate, documented deviation from the repo's squash-merge convention (`CLAUDE.md` → "Merging PRs").

Squashing slice 1 puts a single commit on `main` that is **not patch-identical** to slice 1's individual commits. Slice 2's rebase then cannot skip them as already-applied, so every later slice inherits conflicts — the stacked-squash trap. Rebase-merge keeps commits patch-identical, so each later slice rebases to a clean no-op for work already landed.

Linear history on `main` is preserved either way; that convention is not violated.

Between slices:

```bash
$G fetch origin && $G rebase origin/main   # already-landed commits drop out as patch-identical
$G push --force-with-lease
```

Merge strictly in order, one at a time, waiting for green — per `CLAUDE.md` → "One PR at a time".

---

## Verification

**Per slice, before pushing** — cheaper than seven rounds of red CI:

```bash
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:i18n
npm run lint
```

Scope jest to the repo root if local worktrees are present, which otherwise pollute results:

```bash
npx jest --ci --roots=$PWD/__tests__ --testPathPattern='__tests__/integration'
```

**Per slice, in CI** — required green before merging: Gate, Setup, Type check, Unit tests, Integration tests, Lint, i18n, Native deps. `E2E maestro (iOS)` reports `skipping` on PRs and is expected.

**End-to-end, once after the final slice** — confirm the app still builds and runs from `main`:

```bash
npm ci
cd ios && bundle exec pod install && cd ..   # bundle exec: Gemfile pins CocoaPods 1.16.2
npx expo run:ios --device "<simulator-udid>"
```

Expect the session hub to render with server groups, session cards and conversation rows.

**Final divergence check** — should report `0  0`:

```bash
$G rev-list --left-right --count origin/main...land/integration-prep
```

---

## Risks

| Risk | Mitigation |
|---|---|
| Squash-vs-drop confusion loses content | Only `be419a59`/`4cc8e758` is patch-identical; everything else is `fixup`. The post-rebase diff check catches any loss. |
| Version regression on `app.json` / `build.gradle` | Take `main`'s (higher) values when re-rebasing (Step 1a) and re-check before each slice PR. Read the live numbers rather than any written here — at 2026-08-01 `main` was buildNumber `187` / versionCode `39`, and it moves on every ship. |
| `land/integration-prep` drifts behind `main` again | Happened twice already (Step 1a). Re-check divergence immediately before cutting each slice, not once at the start. |
| A slice is red despite local checks | Fix forward inside that slice; never merge red. If the fix is large, split the slice rather than carrying it. |
| Integration branch moves mid-operation | Step 0 freeze. |
| `ios/Podfile.lock` churn between slices | Always `bundle exec pod install` (PR #455 fixes the scripts and docs that cause this). |

**Rollback:** nothing is destructive until a slice merges. `land/*` branches are scratch; `archive/26-07-2026.18-44-integration` is never rewritten. If a merged slice proves wrong, revert that one commit range on `main` and re-cut the slice.

---

## Cost note

Much of this content was already reviewed through the PRs closed during triage, so the marginal *review* value is lower than the commit count suggests. The genuine gains are bisectability and release granularity on `main`.

Seven slices ≈ seven rebase + CI + review cycles. A single squash of the healed `land/integration-prep` branch is a defensible alternative at one CI cycle, and Steps 0–1 are prerequisites either way — the decision point is only whether to slice at Step 2.
