# Landing `land/integration-prep` onto `main` in reviewable slices

> **Status:** Steps 0 and 1 are done. `land/integration-prep` is the live branch to slice from — it is `main` plus 107 commits, already rebased and pushed.
> The source branch has been renamed to `archive/26-07-2026.18-44-integration` and is frozen; it survives only as the independent witness for Step 3's reconciliation.
> References below to the archived name are historical (what was measured, where the work came from), not instructions to act on it.

## Context

All mobile work for the last two weeks has been landing on the integration branch
`archive/26-07-2026.18-44-integration` rather than on `main`, mostly by direct push rather than through PRs.
`main` is now **106 commits behind**, and during a triage of 38 open PRs every single one reported "not on main" — their content had reached the integration branch and stopped there.

That divergence is what produced the recurring problems this work surfaced: PRs sitting red for days against a base that had already absorbed their content, PRs whose diffs silently regressed version numbers because their branch point predated a bump, and 23 PRs that turned out to be fully redundant.

The goal is to get those 106 commits onto `main` as a sequence of reviewable, independently-green PRs, instead of one opaque merge — so `main` regains bisectability and release granularity, and so the integration branch stops being a parallel trunk.

**Deliberately out of scope:** any change to app behaviour. This is a history/merge operation only. If a slice needs a code fix to go green, that fix is part of the slice, not a separate feature.

---

## Measured facts (basis for the plan)

Gathered against `origin/main` and `origin/archive/26-07-2026.18-44-integration`:

| Fact | Value | Consequence |
|---|---|---|
| Commits ahead of `main` | **106** (07-18 → 07-31) | Too many for one reviewable PR |
| Merge commits in range | **0** — perfectly linear | Contiguous slices replay conflict-free |
| `main`-only commits | **2** (`95490237` build 181, `3ecd31da` versionCode 37) | `main` is *not* an ancestor; cannot fast-forward directly |
| Same-subject commit runs | **9 commits** across 7 subjects | Must be squashed, **not dropped** (see below) |
| Known-red window | `4ec7544c` → `5b325d4d` (~25 commits) | Constrains boundary placement unless healed |

### Hotspot files — why thematic cherry-picking fails

| File | Commits touching it |
|---|---|
| `app/session/[id].tsx` | 13 |
| `types/api.ts` | 11 |
| `locales/{ar,he,ru}/conversation.json` | 10 each |
| `app/_layout.tsx` | 9 |
| `app/conversation/[id].tsx` | 8 |

These touches interleave across every theme. Grouping commits by feature means a "terminal" PR and a "conversation" PR both edit the same regions at different points in history — producing repeated conflict resolution and trees that never actually existed or were tested.

### The duplicates are iterations, not copies

> **Correction — this reverses an earlier recommendation.**
> An earlier draft of this plan said to **drop** the 9 duplicate commits during the prep rebase.
> **That was wrong and would have silently discarded real content.** The instruction below (`fixup`, not `drop`) supersedes it.

The 9 commits share subject lines but **not patches**. Verified with `git patch-id --stable`:

```
76f97204 vs be8e0373  DIFFER     feat(servers): add cache integrity alert resolution
c11e0fbf vs 99f070c0  DIFFER     fix(cache): clear server state after destructive actions
8168ec9f vs 7b46f488  DIFFER     fix(cache): handle explicit server warm-up states
898ec0af vs e46346f9  DIFFER     feat(servers): show warm-up progress for every server
fa112653 vs a6e45d96  DIFFER     feat(sessions): add read-only live view for external sessions
40dfd8a4 vs 1ccabdd7  IDENTICAL  test(cache): extend modal render timeout in CI   <- the only true duplicate
```

The four `feat(conversation): stabilize live reload…` commits (`0da854cd`, `ef6db815`, `4ec7544c`, `3ce8ab6b`) likewise have **four distinct patch-ids**.

So these are *iterations of the same work carrying a copy-pasted commit message*, not repeated applications of one patch. Only `40dfd8a4`/`1ccabdd7` is a genuine duplicate.

**Therefore: squash same-subject runs with `fixup`; never `drop` them.** Squashing preserves the net tree exactly while collapsing the noise. The post-rebase diff check in Step 1 exists specifically to catch this class of mistake.

Reusable check for any future "is this commit already applied?" question — patch-id compares diffs independently of SHA, author and date:

```bash
pid() { git show "$1" | git patch-id --stable | cut -d' ' -f1; }
[ "$(pid A)" = "$(pid B)" ] && echo IDENTICAL || echo DIFFER
```

### The broken window

`app/conversation/[id].tsx` calls `makeSearchStyles(theme)` but loses its import for a stretch of history:

```
84fabef4  import=1 uses=1   ok
78c5b321  import=1 uses=1   ok
4ec7544c  import=0 uses=1   <- BREAKS
…~25 commits…
5b325d4d  import=0 uses=1   <- still broken
4f036da6  import=1 uses=1   <- fixed ("restore in-chat search button and repair locale drift")
```

This is the same defect that kept PRs #421–#423 red. Any slice boundary inside that window ships a red PR.

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

> **What actually happened.** The rebase replayed 107 commits onto `main` with **zero conflicts**; `a5766408` was auto-dropped as already applied (it reached `main` as `ff8bd0ba` via #434). Verified afterwards: 0 commits from the archived branch are absent from prep, the whole-tree delta is only `app.json` and `android/app/build.gradle`, and prep carries `main`'s higher values (buildNumber `181`, versionCode `37`).
>
> **Sub-steps 2 and 3 below were NOT performed.** It was a plain rebase, so the 9 same-subject commits are still separate and **the broken window still exists in prep's history**. Slices 3 and 4 must either absorb that window or it must be healed before they are cut.

```bash
G=/opt/homebrew/bin/git   # the zsh `git` function shadows the binary; use the absolute path
$G fetch origin
$G checkout -b land/integration-prep origin/archive/26-07-2026.18-44-integration
$G rebase -i origin/main
```

Three things happen in this rebase:

1. **Rebase onto `main`** — resolves the 2-commit divergence. Conflicts will appear in `app.json` and `android/app/build.gradle`; **take `main`'s higher values** (buildNumber `181`, versionCode `37`). Taking the branch's older numbers is the exact regression trap found in PR #434.
2. **Squash the same-subject runs** — mark the later copies `fixup` (`f`) under the first of each run. Seven runs, listed above. Net tree unchanged; 9 commits collapse away. **Do not use `drop`.**
3. **Heal the broken window** — move the `makeSearchStyles` import fix out of `4f036da6` and into `4ec7544c` (where the break is introduced), as a `fixup` or a manual edit during that step.

Step 3 is the high-value move: it converts a hard constraint into a free choice. Without it, slices 3–4 are hostage to the red zone and must be merged as one oversized ~36-commit PR.

**Verify the prep rebase preserved content** — the tree at the end must match the original branch tip except for the version bumps:

```bash
$G diff origin/archive/26-07-2026.18-44-integration land/integration-prep -- . \
  ':!app.json' ':!android/app/build.gradle'
# expect: empty
```

If that diff is non-empty, something was dropped rather than squashed. Stop and investigate before slicing.

---

## Step 2 — Seven slices

Boundaries chosen at thematic seams. Counts are from the pre-rebase branch and shrink slightly after squashing.

| # | Slice tip | Theme | ~n |
|---|---|---|---|
| 1 | `f8c21e49` | cache integrity + warm-up, Sentry crash consent, external-session live view, i18n gates | 23 |
| 2 | `fdd69cd8` | onboarding polish + pair-token exchange, e2e hardening, session test mocks | 21 |
| 3 | `b311ac6c` | JSONL session name, conversation live view, terminal/session perf | 10 |
| 4 | `4f036da6` | terminal-conversation rendering (#403), C-series (diagnostics/capabilities/push/devices/backup), browse | 26 |
| 5 | `368e8282` | iOS SDK 57.0.8 alignment, dyld gate, Swift 6 `abs()` patch | 3 |
| 6 | `bb67d2d1` | live activity iOS + Android, terminal history/seq fixes | 13 |
| 7 | `0b2e8907` | terminal UX (question card, wrapped rows, banner dedupe), CI fix | 10 |

Total 106. The ~20 `docs`/`[skip-ci]` commits are not a separate slice — they sit inside whichever range they belong to.

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
| Squash-vs-drop confusion loses content | Only `40dfd8a4`/`1ccabdd7` is patch-identical; everything else is `fixup`. The post-rebase diff check catches any loss. |
| Version regression on `app.json` / `build.gradle` | Take `main`'s values in the prep rebase; re-check before each slice PR. |
| A slice is red despite local checks | Fix forward inside that slice; never merge red. If the fix is large, split the slice rather than carrying it. |
| Integration branch moves mid-operation | Step 0 freeze. |
| `ios/Podfile.lock` churn between slices | Always `bundle exec pod install` (PR #455 fixes the scripts and docs that cause this). |

**Rollback:** nothing is destructive until a slice merges. `land/*` branches are scratch; `archive/26-07-2026.18-44-integration` is never rewritten. If a merged slice proves wrong, revert that one commit range on `main` and re-cut the slice.

---

## Cost note

Much of this content was already reviewed through the PRs closed during triage, so the marginal *review* value is lower than the commit count suggests. The genuine gains are bisectability and release granularity on `main`.

Seven slices ≈ seven rebase + CI + review cycles. A single squash of the healed `land/integration-prep` branch is a defensible alternative at one CI cycle, and Steps 0–1 are prerequisites either way — the decision point is only whether to slice at Step 2.
