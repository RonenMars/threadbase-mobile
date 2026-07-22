# Integration merge report — `integration-dev/v1.0.0-df91938-2026-07-22`

**This document is the authoritative merge flow for the currently-open PRs.**
When these branches are merged individually, follow the order and the per-conflict resolutions recorded here rather than re-deriving them.

Snapshot cut from `origin/main` @ `b7d8bda` on 2026-07-22.
All 14 open PRs merged with `--no-ff`; #291 (`typescript 6.0.3 → 7.0.2`) excluded by request.
Contents: 14 merge commits + 3 fix commits (`c9a78cd`, `d206e24`, `0662707`) + this report.
Pushed to origin as a branch only — no PR, nothing merged into `main`.
The immutable snapshot ref is the `test-dev/v1.0.0-…-2026-07-22` tag cut at this commit; prefer it over the branch as a `deploy_ref`.

---

## Merge order

Dependency order first, then chronological.
The two stacked pairs must keep their relative order; everything else is order-independent except where the conflict table says otherwise.

| # | PR | Branch | Note |
|---|----|--------|------|
| 1 | #339 | `feat/cache-integrity-alert` | base of #341 |
| 2 | #341 | `feat/cache-warmup-status` | stacked on #339 |
| 3 | #343 | `feat/crash-consent-model` | |
| 4 | #345 | `fix/multi-attachment-send` | |
| 5 | #346 | `fix/abandoned-empty-sessions` | |
| 6 | #347 | `docs/pre-release-status-2026-07-19` | superseded by #358 |
| 7 | #353 | `dependabot/npm_and_yarn/npm_and_yarn-f53f33db58` | shell-quote bump |
| 8 | #354 | `feat/live-external-sessions` | |
| 9 | #355 | `feat/live-external-sessions-integration` | same feature as #354, rebased on the previous snapshot |
| 10 | #356 | `chore/i18n-unused-keys-validation` | **see the #356 hazard below** |
| 11 | #357 | `fix/servers-remove-dialog-i18n` | conflicts with #356 |
| 12 | #358 | `docs/pre-release-status-sync-2026-07-22` | supersedes #347 |
| 13 | #359 | `fix/e2e-grant-speech-recognition` | |
| 14 | #360 | `feat/onboarding-polish-top5` | conflicts with #356 |

#354 and #355 are the same feature: #355 is #354 rebased onto the previous snapshot plus a 2-line `api-client.ts` tweak.
#355 supersedes #354. Because #355 is based on the previous snapshot branch, merging it also pulled that snapshot's 5 merge commits into history — 19 merge commits total for 14 PRs.

---

## Conflicts and resolutions

### 1. #341 × #339 — 6 files

`components/servers/CacheAlertModal.tsx`, `services/api-client.ts`, `services/query-client.ts`, `stores/servers.ts`, `types/api.ts`, `__tests__/unit/components/servers/CacheAlertModal.test.tsx`.

**Cause:** #341 was rebased, so it carries *rewritten copies* of #339's commits under different SHAs.
Git therefore saw add/add and content conflicts instead of a clean stack.

**Resolution:** took #341's side throughout — it is a strict evolution of #339.
Cross-checked against the previous snapshot (`8be2e11`), which resolved 5 of the 6 files identically.
The 6th (`CacheAlertModal.test.tsx`) differed there; #341's version is correct because #341 makes resolve fire optimistically, so its relaxed `toHaveBeenCalled()` matches the new behavior and is strictly weaker than the old argument-matching assertion.

### 2. #354 × #341 — `services/api-client.ts`

**Cause:** both rewrote the same `!response.ok` block.
#341 added `warmupState`; #354 hoisted `errBody` out of the `try` and added a 409 `ConversationBusyError` branch.

**Resolution:** took the file from #355's tip (`0fb0d42`), which already contains exactly this union.
Safe because our pre-merge `api-client.ts` was byte-identical to #355's base.

### 3. #355 × #341 — `__tests__/unit/components/servers/CacheAlertModal.test.tsx`

**Cause:** #355 carries the previous snapshot's stricter hand-resolution of the same file.

**Resolution:** kept ours (#341's relaxed assertions), for the reason given in conflict 1.

### 4. #357 × #356 — `locales/{ar,en,he,ru}/servers.json`

**Cause:** #356 pruned `dialog.removeMessage` and `dialog.removeDismiss` as dead keys; #357 adds code that uses `removeMessage`.

**Resolution:** union *by actual usage*.
Restored `removeMessage` (referenced by `ServerListCard.tsx:67` and `ServersStatusModal.tsx:249`); left `removeDismiss` pruned, as nothing references it.
Confirmed by the `i18n-unused-keys` gate passing afterwards.

### 5. #358 × #347 — `docs/BACKLOG.md` (4 hunks), `docs/ROADMAP.md` (2 hunks)

**Cause:** two status-sync docs PRs describing the same entries at different dates.

**Resolution:** took #358 — the 2026-07-22 sync supersedes the 2026-07-19 one.
One ROADMAP hunk needed hand-repair: #343 had wrapped that section in `<details>`, so taking #358's text alone orphaned the closing `</details>`. Re-added it.

### 6. #360 × #356 — `locales/{ar,en,he,ru}/onboarding.json`

**Cause:** same shape as conflict 4 — #356's dead-key prune against #360's onboarding rework.

**Resolution:** took #360's reworded `manualSectionLabel` ("On your Mac" → "On your computer"); left `connect.footnote` pruned, as nothing references it.

### 7. #360 × #356 — the silent one (no conflict marker)

**Cause:** #356 deleted `connect.step1` and `connect.step2`, correctly — nothing on `main` referenced them.
#360 adds the *usage* (`ConnectStep.tsx:161-162`) but not the keys, because it inherited them from `main` unchanged, so they appear as context lines in its diff rather than additions.
Git applied the deletion cleanly with no conflict. The keys and the code that revives them live in two different PRs, so nothing collided.

Attribution, precisely:

| Piece | Origin |
|---|---|
| `connect.step1` / `step2` keys + all 4 translations | already on `origin/main` |
| `t('connect.step1')` / `t('connect.step2')` usage | added by #360 |
| `connect.step3` key | added by #360 — survived, since #356 never saw it |
| Deletion of `step1` / `step2` | #356, valid at the time |

**Resolution:** commit `c9a78cd` — restored both keys in all 4 locales, byte-identical to `main`'s originals.
This dropped typecheck from 3 errors to 1. At runtime the QR-pairing step would otherwise have rendered two raw key strings.

---

## The #356 hazard — carries beyond this snapshot

This is not snapshot-only. It will recur on `main`:

> When #356 merges to `main` and you rebase #360 onto it, git will apply #356's deletion into #360's base and the keys vanish again, exactly as they did in the integration merge.
> There is no way to express the fix on #360 today, since the keys are already present.
> Options: merge #360 before #356, or re-add the keys to #360 as part of the rebase.

The same trap applies to conflict 4 (#357's `removeMessage`), though that one surfaces as a real conflict rather than silently.

**CI will not catch the silent half.** CI runs only `test:unit` (`__tests__/unit`) and `test:integration` (`__tests__/integration`).
Root-level suites — `__tests__/i18n-completeness.test.ts` and #356's new `__tests__/i18n-unused-keys.test.ts` — never run.
Typecheck *does* catch it, because `lib/i18n.types.ts` types `t()` against the locale JSON.

---

## Final test state of the integration branch

Measured at the tip, against an `origin/main` baseline on the same machine.

**Typecheck: clean.** The one error (`OnboardingShell.tsx:76`) was fixed by `d206e24`, cherry-picked from #360.

**Jest: 9 suites / 28 tests failed**, 111 suites / 1113 tests passed.
Only one group is caused by the merge.

| Failure | Count | Verdict |
|---|---|---|
| `SessionScreen.*` — `useNavigation is not a function` | 7 suites, 21 tests | **#355's own bug.** Only #355 calls `useNavigation`; those suites mock `expo-router` locally without it. #355's CI is already red on Integration tests. Passes on `main`. |
| `i18n-completeness` | 6 tests | **Merge-induced.** ar/he/ru lack `resume.takeOver` + `resume.takeOverFailed` (#354/#355) and `success.viaSentry` + `success.viaEmail` (#343) — all added English-only. Passes on `main`. Left unfixed: writing translations is authoring PR content, not resolving a merge. |
| `conversation-live-view` — appends streamed events | 1 test | **Flaky.** Fails in a full run, passes in isolation. |

Fixed since the first measurement, so no longer failing: `ConnectStepManual` (was #360's stale "On your Mac" assertion, fixed by `0662707`).

Excluded from the run and not a branch defect: `unit/scripts/land-version-bump` (runs under `jest.config.scripts.js`, not the main config) and `e2e/feedback-flow` (5s timeout that fails on `main` on this machine too — Windows perf, and outside what CI runs).

### Running the suite in this worktree

The worktree lives under `.claude/`, which `testPathIgnorePatterns` excludes, so a bare `npx jest` finds 0 tests.

```bash
npx jest --testPathIgnorePatterns "/node_modules/"
```

That also re-enables `__tests__/unit/scripts`, which is normally excluded and fails on Windows — ignore it.
The worktree needs its own `npm ci` (~2 min, 1292 packages).

---

## Fixes landed on #360 (`feat/onboarding-polish-top5`)

Both were committed to #360 and cherry-picked onto this snapshot, so the two refs carry identical content.

| Commit on #360 | Cherry-pick here | Change |
|---|---|---|
| `a4ef30d` | `d206e24` | `OnboardingShell.tsx` — `skipLabelKey?: string` → `skipLabelKey?: ParseKeys<'onboarding'>`, plus `import type { ParseKeys } from 'i18next'`. Clears #360's only typecheck error; both call sites (`'shell.skip'` default, `'shell.pairLater'` from `OnboardingNavigator.tsx:122`) satisfy it unchanged. |
| `93d0fb8` | `0662707` | `ConnectStepManual.test.tsx` — assertion and test name from "On your Mac" to "On your computer", matching #360's own copy change. |

#360 is now green on everything CI gates: typecheck clean, 107 suites pass.
Its two remaining failures are outside CI — `unit/scripts` (own config) and `e2e/feedback-flow` (fails on `main` too).

Restoring `step1`/`step2` on #360 was **not** done, because it is a no-op there — all four locales already carry them.
That fix (`c9a78cd`) exists only on this snapshot, where #356's deletion applied.
See the hazard section above for why #360 still needs attention at rebase time.
