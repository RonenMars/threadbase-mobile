# Integration merge report — `integration-dev/v1.0.0-2026-07-22`

> **Historical.** A report on the 2026-07-22 integration run. The integration branch was later bypassed — see [`followups/repo-health/06-integration-branch-decision.md`](./followups/repo-health/06-integration-branch-decision.md).

**This document is the authoritative merge flow for the currently-open PRs.**
When these branches are merged individually, follow the order and the per-conflict resolutions recorded here rather than re-deriving them.

It is maintained as a **run log**: each snapshot cut appends a numbered run with its merges, conflicts and resolutions, so the history of what was tried and what it cost stays visible.

---

## Run 2 — 2026-07-22, cut from `origin/main` @ `73d9ae5`

Supersedes run 1. All **19** open PRs merged with `--no-ff`; **#291** (`typescript 6.0.3 → 7.0.2`) excluded by request.
24 merge commits for 19 PRs — #355 is based on the 2026-07-20 snapshot, so merging it replays that snapshot's 5 merge commits.

**`origin/main` is fully contained** up to `3219d6f`, past the `73d9ae5` this was cut from.
`main` advanced by two CI commits (`54f6f43`, `3219d6f`) mid-run; they arrived transitively when the #372 docs branch — cut from the newer `main` — was merged in, so no separate `main` merge was needed.
`app.json` carries iOS build `166`, matching `main`.

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

**#362 introduced a dead locale key — fixed upstream.** `connect.manualServerUrl` was added in all 4 locales but never referenced, verified on #362's own branch and not only in the merge.
It was dropped during conflict G to keep the snapshot's dead-key gate green, then fixed at source on #362 itself (`4c6a275`, `fix(i18n): drop unused manualServerUrl onboarding key`).
#362's new head was merged back in (`ancestry-only — the tree was already identical`), so the snapshot still contains every open PR at its current head.
Without this, `i18n-unused-keys` would have flagged the key once #356 and #362 were both on `main`.

**#362 did not type-check — fixed upstream.** `__tests__/unit/hooks/useTBPair.test.ts` used `global.__DEV__`, which React Native declares as a bare `const`, not a property of `globalThis` — 3 × `TS2339`.
A `declare global { var __DEV__ }` is not an option: it collides with RN's own `const __DEV__` declaration.
Fixed on #362 with a test-local typed alias (`ec5260f`, `fix(types): type the __DEV__ global alias in useTBPair tests`).

**The `SessionScreen` failures were #346's, not #355's — fixed upstream.**
`useNavigation` was introduced by **#346** (`app/session/[id].tsx`, the Bug-16 `beforeRemove` listener), not #355; #355 only carries it because its base includes #346.
#346's own CI was already red on Integration tests, which confirms the attribution.

Two distinct defects were stacked in those suites, the second only visible once the first was fixed:

1. **`useNavigation` missing from the mocks.** The six local `jest.mock('expo-router', …)` factories replace the module wholesale, dropping the `useNavigation` that `jest.setup.js` provides — and the global stub returned only `setOptions`, with no `addListener` for the `beforeRemove` subscription.
2. **`stopSession` missing from `useSessionActions` mocks.** #346 added `stopSession` to the screen's destructure; four suites' mocks never provided it, so `stopSession.mutate` was undefined.

Fixed on #346 (`b84f18c`, `test(session): mock navigation and stopSession for the session screen`) — `addListener` added to the global stub, `useNavigation` added to six local factories, `stopSession` added to the four mocks that lacked it.

**`SessionScreen.externalGate` was a genuine cross-PR interaction.** The suite is new in #354 and its local `expo-router` mock omits `useNavigation`; the screen only calls `useNavigation` once #346 is present. Neither PR is wrong alone — the failure exists only in the combination.
Fixed on #354 (`25c83b6`, `test(session): mock useNavigation in the external-gate suite`), where the file lives; harmless there on its own.

**#341's run-1 conflict disappeared.** Its branch was rebased onto #339 in the interim, so the 6-file add/add conflict recorded in run 1 no longer occurs. Recorded resolutions are perishable — re-verify preconditions rather than applying blind.

### Verification

Measured at the tip on the same machine, against an `origin/main` baseline.

| Check | Result |
|---|---|
| `npm run test:i18n` | **3/3 suites pass** (`i18n`, `i18n-completeness`, `i18n-unused-keys`) |
| `npm run typecheck` | **clean** |
| `npx jest --ci` | **121/121 suites pass**, 1147 tests passed, 1 skipped, **0 failed** |

**The snapshot is fully green.** Every failure found during this run was traced to the PR that caused it and fixed at source, then merged back in:

| Was failing | Root cause | Fixed on |
|---|---|---|
| 6 × `SessionScreen.*` | #346 — `useNavigation` / `addListener` missing from mocks, then `stopSession` missing | #346 `b84f18c` |
| `SessionScreen.externalGate` | #354 × #346 interaction — suite's mock omits `useNavigation` | #354 `25c83b6` |
| `typecheck` (3 × TS2339) | #362 — `global.__DEV__` | #362 `ec5260f` |
| `i18n-unused-keys` (would have) | #362 — dead `manualServerUrl` key | #362 `4c6a275` |

Two earlier observations did not reproduce in the final run and needed no fix: `e2e/feedback-flow` (a 5s timeout that also fails on `main` on this machine — Windows perf) and `unit/components/servers/CacheAlertModal` (flaky under full-suite load, 12/12 in isolation). Both pass in the green run above.

Note on measuring: several `SessionScreen` suites are heavy enough that parallel jest workers on this machine produce spurious failures. Use `--runInBand` when verifying them, and re-check any single-suite failure in isolation before treating it as real.

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

Both gotchas below are now documented permanently in [`docs/troubleshooting.md`](./troubleshooting.md) → "Jest test suites" and summarised in `CLAUDE.md` (PR #372), so they survive this snapshot's deletion. Repeated here because they bite on every snapshot run.

**Create the worktree outside `.claude/`.** A worktree under `.claude/` is excluded by `testPathIgnorePatterns`, so `npx jest` finds **0 tests** and `npm run test:i18n` looks broken when it is not.
This run used `worktrees/merge-prs-v2`. To run in place anyway, pass `--testPathIgnorePatterns "/node_modules/"` — but note that also re-enables `__tests__/unit/scripts/`, which the main config excludes deliberately and which fails on Windows.

Each worktree needs its own `npm ci` (~3 min, 1292 packages).

**Verify heavy suites serially, and confirm every failure in isolation.**

```bash
npx jest --ci --runInBand --testPathPattern "SessionScreen"
```

Several `SessionScreen.*` suites are heavy enough that parallel jest workers on this machine produce spurious failures — but a load artifact and a real defect look identical in batch output, so the isolation re-run is what distinguishes them. Passes alone → artifact. Fails alone → real.

This run proved both directions: four genuinely broken suites were nearly dismissed as flakes, while `feedback-flow` and `CacheAlertModal` really were load artifacts and needed no fix.

---

## Run 1 — 2026-07-22, cut from `origin/main` @ `b7d8bda` (superseded)

14 PRs merged (all open at the time except #291).
Frozen at tag `test-dev/v1.0.0-d6b7cbd-2026-07-22`.

Superseded because `origin/main` advanced by 4 commits (including an iOS build-number bump to 166) and five PRs opened afterwards — #361, #362, #363, #364, #368.

Conflicts A–F above were all first encountered and resolved in run 1; conflict B took a different form (`CacheAlertModal.test.tsx`, resolved by keeping #341's relaxed assertions), and #341 × #339 conflicted across 6 files before that branch was rebased.
Run 1 also carried three fixes cherry-picked back to the PRs they belonged to — `c9a78cd` (step-key restore), `d206e24` / `0662707` (#360's `ParseKeys` typing and stale test copy), all of which are now upstream in the PR branches and arrive here through the normal merges.
