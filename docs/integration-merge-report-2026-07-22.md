# Integration merge report — `integration-dev/v1.0.0-2026-07-22`

**This document is the authoritative merge flow for the currently-open PRs.**
When these branches are merged individually, follow the order and the per-conflict resolutions recorded here rather than re-deriving them.

It is maintained as a **run log**: each snapshot cut appends a numbered run with its merges, conflicts and resolutions, so the history of what was tried and what it cost stays visible.

---

## Run 2 — 2026-07-22, cut from `origin/main` @ `73d9ae5`

Supersedes run 1. All **19** open PRs merged with `--no-ff`; **#291** (`typescript 6.0.3 → 7.0.2`) excluded by request.
24 merge commits for 19 PRs — #355 is based on the 2026-07-20 snapshot, so merging it replays that snapshot's 5 merge commits.

Immutable ref: the `test-dev/v1.0.0-…-2026-07-22` tag cut at this branch's tip. Prefer it over the branch as a `deploy_ref`.

### Merge log

Dependency order first, then chronological. `ok` = auto-merged, no conflict.

| # | Commit | PR | Branch | Result |
|---|--------|----|--------|--------|
| 1 | `717b857` | #339 | `feat/cache-integrity-alert` | ok |
| 2 | `68a5a60` | #341 | `feat/cache-warmup-status` | ok — **conflict from run 1 is gone**, branch was rebased onto #339 since |
| 3 | `684af98` | #343 | `feat/crash-consent-model` | ok |
| 4 | `8041b30` | #345 | `fix/multi-attachment-send` | ok |
| 5 | `50d45d4` | #346 | `fix/abandoned-empty-sessions` | ok |
| 6 | `bd0402a` | #347 | `docs/pre-release-status-2026-07-19` | ok |
| 7 | `0d2b163` | #353 | `dependabot/…/npm_and_yarn-f53f33db58` | ok |
| 8 | `c86b4c2` | #354 | `feat/live-external-sessions` | **conflict A** |
| 9 | `8928ae5` | #355 | `feat/live-external-sessions-integration` | **conflict B** |
| 10 | `9dc57b8` | #356 | `chore/i18n-unused-keys-validation` | ok |
| 11 | `d942e52` | #357 | `fix/servers-remove-dialog-i18n` | **conflict C** |
| 12 | `2719288` | #358 | `docs/pre-release-status-sync-2026-07-22` | **conflict D** |
| 13 | `8cf5805` | #359 | `fix/e2e-grant-speech-recognition` | ok |
| 14 | `30a6e00` | #360 | `feat/onboarding-polish-top5` | **conflict E** + **silent conflict F** |
| 15 | `b94acfb` | #361 | `fix/e2e-browse-and-feat1` | ok |
| 16 | `bdf8e47` | #362 | `fix/onboarding-pair-token-exchange` | **conflict G** (new) |
| 17 | `c2af06b` | #363 | `fix/e2e-drag-reorder-in-suite` | ok |
| 18 | `bd7f90a` | #364 | `feat/onboarding-notifications-step` | **conflict H** (new) |
| 19 | `c875eb3` | #368 | `ci/i18n-parity-gate` | **conflict I** (new) |

### Conflicts and resolutions

**A — #354 × #341, `services/api-client.ts`.**
Both rewrote the same `!response.ok` block: #341 added `warmupState`, #354 hoisted `errBody` and added a 409 `ConversationBusyError` branch.
→ Took the file from #355's tip (`0fb0d42`), which already contains exactly this union.
Precondition re-verified this run: the pre-merge `api-client.ts` was byte-identical to #355's base, so the union applies unchanged.

**B — #355 × everything before it, `app.json` + `locales/{ar,he,ru}/conversation.json`.**
New this run; run 1 conflicted on `CacheAlertModal.test.tsx` instead.
`app.json`: #355's base carries `buildNumber` 165, current `main` is 166.
`conversation.json`: #354 now carries the ar/he/ru `takeOver` translations; #355, based on the older snapshot, does not.
→ Took **ours** for all four — newer build number, and the translations must not be reverted.

**C — #357 × #356, `locales/{ar,en,he,ru}/servers.json`.**
#356 pruned `dialog.removeMessage` and `dialog.removeDismiss` as dead; #357 adds code using `removeMessage`.
→ Union **by actual usage**: restored `removeMessage` (referenced by `ServerListCard.tsx` and `ServersStatusModal.tsx`), left `removeDismiss` pruned — re-checked this run, still unreferenced.

**D — #358 × #347, `docs/BACKLOG.md` (4 hunks), `docs/ROADMAP.md` (2 hunks).**
→ Took #358; the 2026-07-22 sync supersedes the 2026-07-19 one.
One ROADMAP hunk needs hand-repair: #343 wraps that section in `<details>`, so taking #358's text alone orphans the closing `</details>`. Re-added; tag count verified balanced.

**E — #360 × #356, `locales/{ar,en,he,ru}/onboarding.json`.**
→ Took #360's reworded `manualSectionLabel`; left `connect.footnote` pruned (unreferenced).

**F — #360 × #356, the silent one (no conflict marker).**
#356 deletes `connect.step1` / `step2`, correct against `main`; #360 adds the *usage* (`ConnectStep.tsx`) but inherits the keys from `main` as context lines, so git applies the deletion cleanly.
→ Restored both keys in all 4 locales, byte-identical to `main`'s originals.
**Caught by Type check only** — see the hazard section.

**G — #362 × #360, `ConnectStep.tsx` + 4 onboarding locales.** *(new this run)*
Both rework the manual-pairing step.
`ConnectStep.tsx`: the conflicting import line on #362's side is a strict superset (`splitUrl`, `classifyPairCredential`).
Locales: #362 rewords `manualSectionPasteHint` and adds `manualServerUrl`.
→ Took #362 for every hunk, **except** `manualServerUrl`, which was dropped — see the finding below.

**H — #364 × #360, `components/onboarding/OnboardingNavigator.tsx`.** *(new this run)*
Comment-only. Each PR documents a different aspect of the same `onSkip`, and both remain true.
→ Kept both comment lines. No code difference.

**I — #368 × #363, `package.json`.** *(new this run)*
Adjacent lines: #363 adds `e2e/server_drag_reorder.yaml` to `test:e2e:mock`, #368 inserts `test:i18n` directly above it.
→ Union: kept both.

### Findings raised by this run

**#362 introduces a dead locale key.** `connect.manualServerUrl` is added in all 4 locales but never referenced — verified on #362's own branch, not just in the merge.
It was dropped here to keep the snapshot's dead-key gate green.
Once #356 and #362 are both on `main`, `i18n-unused-keys` will flag it; #362 should either use the key or drop it.

**#362 does not type-check.** `__tests__/unit/hooks/useTBPair.test.ts` uses `globalThis.__DEV__` with no declaration — 3 × `TS2339`.
Pre-existing and already red on #362's own CI (`Type check=FAILURE`); the file is new in #362 and absent from `main`. Not merge-induced.

**#341's run-1 conflict disappeared.** Its branch was rebased onto #339 in the interim, so the 6-file add/add conflict recorded in run 1 no longer occurs. Recorded resolutions are perishable — re-verify preconditions rather than applying blind.

### Verification

Measured at the tip on the same machine, against an `origin/main` baseline.

| Check | Result |
|---|---|
| `npm run test:i18n` | **3/3 suites pass** (`i18n`, `i18n-completeness`, `i18n-unused-keys`) |
| `npm run typecheck` | **3 errors, all #362's** (`useTBPair.test.ts`, `globalThis.__DEV__`) |
| `npx jest --ci` | 9 suites / 23 tests failed, 112 suites / 1124 passed |

Failure breakdown — **no merge-induced failures remain**:

| Failure | Count | Verdict |
|---|---|---|
| `SessionScreen.*` — `useNavigation is not a function` | 7 suites, 21 tests | **#355's own bug.** Only #355 calls `useNavigation`; those suites mock `expo-router` locally without it. Already red on #355's CI. Passes on `main`. |
| `e2e/feedback-flow` — 5s timeout | 1 test | **Not merge-related.** Fails on `main` on this machine (Windows perf). Outside what CI runs. |
| `unit/components/servers/CacheAlertModal` | 1 test | **Flaky under full-suite load.** Passes in isolation (12/12). |

---

## Standing hazard — #356 × #360, carries beyond any snapshot

> When #356 merges to `main` and you rebase #360 onto it, git will apply #356's deletion into #360's base and the keys vanish again, exactly as they did in the integration merge.
> There is no way to express the fix on #360 today, since the keys are already present.
> Options: merge #360 before #356, or re-add the keys to #360 as part of the rebase.

### Ordering does not solve it — verified

`git merge-tree` was run on #356 and #360 in **both** directions.
Both produce identical outcomes: `connect.step1` absent from the merged `locales/en/onboarding.json`, and both report exactly **one** conflict marker — the `manualSectionLabel` / `footnote` hunk, *not* the step keys.

So "merge #360 before #356" does **not** help.
Worse, the merge hands you a conflict *in the very file that is silently losing keys*: you resolve the visible hunk, the file looks handled, and the deletion rides along unnoticed. That is exactly how it slipped through in run 1.

The same trap applies to conflict C (#357's `removeMessage`) and now conflict G (#362's locale keys), though those surface as real conflicts rather than silently.

### What does solve it

**Rebase, then re-verify — and merge only on post-rebase green.**
This is already the repo's stated merge rule, and it is sufficient, because **Type check catches this class of bug**: `lib/i18n.types.ts` types `t()` against the locale JSON, so a referenced-but-missing key is a `TS2345` compile error.

The hazard only materialises if a PR is squash-merged on a **stale** green CI run from before the rebase.
For whichever of #356 / #360 goes second:

1. `git fetch origin && git rebase origin/main`
2. Push with `--force-with-lease` and wait for a **fresh** CI run
3. If Type check goes red on `connect.step*`, re-add the keys to the locale files as part of the rebase — do not merge red

GitHub Merge Queue automates precisely this guarantee and is the durable fix if PR volume grows; it is already flagged as the adjacent pattern in `docs/research/2026-07-21-pre-merge-integration-build-strategy.md`.

### The gap Type check cannot cover — closed by PR #368

CI ran only `test:unit` (`__tests__/unit`) and `test:integration` (`__tests__/integration`).
`i18n-completeness` and #356's `i18n-unused-keys` sit at the root of `__tests__/` and therefore never ran on a PR.
That is why #343 and #354 stayed green while adding English-only keys — invisible to CI, and invisible to Type check too (a *missing translation* is not a type error; only a *missing key* is).

**PR #368** adds a `test:i18n` script and an `i18n` CI job alongside Lint and Type check.
Verified by deleting a key from `locales/ar/common.json` and confirming the job goes red.

**After #368 merges, add `i18n` to the required status checks in branch protection**, or it runs without being able to block a merge.

---

## Missing translations — audited and fixed

All open PRs were audited against their own trees; `main` has zero gaps, so every gap was introduced by its PR.
Two were responsible, both fixed on the branch that introduced the keys:

| PR | Namespace | Keys | Fix |
|---|---|---|---|
| #343 | `feedback.json` | `success.viaSentry`, `success.viaEmail` | `393b9ca` — ar/he/ru |
| #354 | `conversation.json` | `resume.takeOver`, `resume.takeOverFailed` | `5b26bf7` — ar/he/ru |

Translations reuse terminology already in the files rather than inventing wording — `الإبلاغ عن الأعطال` / `דיווח קריסות` / `отчётов о сбоях` for crash reporting, and the existing `terminal.json` `overtake` wording (`الاستحواذ` / `השתלט` / `Перехватить`) for take-over.

#355 still reports the same gaps, but it is not a third offender — it is #354 rebased onto the older snapshot, so it inherits both sets and clears once rebased.

---

## Running the suite in a snapshot worktree

A worktree created under `.claude/` is excluded by `testPathIgnorePatterns`, so `npx jest` finds **0 tests** and `npm run test:i18n` looks broken when it is not.
Create snapshot worktrees **outside** `.claude/` (this run used `worktrees/merge-prs-v2`), or pass `--testPathIgnorePatterns "/node_modules/"` to override.
Each worktree needs its own `npm ci` (~3 min, 1292 packages).

---

## Run 1 — 2026-07-22, cut from `origin/main` @ `b7d8bda` (superseded)

14 PRs merged (all open at the time except #291).
Frozen at tag `test-dev/v1.0.0-d6b7cbd-2026-07-22`.

Superseded because `origin/main` advanced by 4 commits (including an iOS build-number bump to 166) and five PRs opened afterwards — #361, #362, #363, #364, #368.

Conflicts A–F above were all first encountered and resolved in run 1; conflict B took a different form (`CacheAlertModal.test.tsx`, resolved by keeping #341's relaxed assertions), and #341 × #339 conflicted across 6 files before that branch was rebased.
Run 1 also carried three fixes cherry-picked back to the PRs they belonged to — `c9a78cd` (step-key restore), `d206e24` / `0662707` (#360's `ParseKeys` typing and stale test copy), all of which are now upstream in the PR branches and arrive here through the normal merges.
