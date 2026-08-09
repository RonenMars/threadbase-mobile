# tb-mobile — Merge Order (as of 2026-08-09 13:20)

**Rewritten — the previous version's premise no longer held.** It described five PRs queued against the integration branch. Since then #577 merged there, and #572 and #576 were re-targeted onto `main`. The integration branch is no longer the trunk this work flows through.

Rule: one PR at a time — rebase onto the latest base, wait for CI green, squash-merge, then move to the next. A just-merged PR advances the base, so the next is usually behind and must be rebased again.

`main` tip: `4d80e984`. Integration branch tip: `0a4dd2d5`. Companions: `Mobile-OPEN-PRs.md` (full inventory) and `Mobile-LEFTOVERS.md` (open threads).

## The short answer

Everything worth merging now targets `main` and is already green. There is no dependency chain left between them — the ordering below is about blast radius, not about unblocking.

| # | PR | Title | Head | Why here |
|---|----|-------|------|----------|
| 1 | #574 | ci: dispatch a subset of Maestro flows, and fix the E2E iOS build | `92c4e21e` | CI-only, cannot affect the app. Merging *is* the test — a `workflow_dispatch` change is unverifiable until it is on `main`. Landing it first means the E2E dispatch is available while everything else merges. |
| 2 | #572 | feat(conversation): handle Codex active-writer collisions with fork recovery | `e26b2d1d` | Green and clean on `main`. Note its branch already carries #574's two commits (`ac1eaf02`, `a02bdb23`) from the rebase, so merging #574 first keeps the histories consistent. |
| 3 | #576 | feat(hub): load grouped views from project summaries | `34667999` | Largest change (25 files). Green and clean. No overlap with #572 beyond disjoint regions of `types/api.ts`. |

After those, the remaining green PRs (#569, #567, #566, #563, #560, #556, #553, #544 → then #551) are independent of this wave; take them in whatever order suits. #544 must precede #551, which is stacked on it.

## Needs a decision before merging

| PR | State | The question |
|----|-------|--------------|
| #575 | `CONFLICTING/DIRTY` on integration | Its two commits are already on `main` via #578, byte-identical. Resolve the conflict and merge it into the integration branch, or close it as superseded — depends on whether the integration branch still has a future. See `Mobile-LEFTOVERS.md` → "Follow-ups from the #578 port". |
| #580 | `CONFLICTING/DIRTY` on integration | Docs-only. Same underlying question: is the integration branch still a live target? |
| #568 | `CONFLICTING/DIRTY` on `main` | Needs a rebase; unrelated to this wave. |
| #557 | red CI | jest 30 vs `jest-expo@57`. Do not merge. |
| #291 | red CI | TS 7 vs typescript-eslint. Do not merge. |

## The integration branch is now mostly bypassed

`integration/open-prs-291-544-…-569` still exists at `0a4dd2d5` and still holds #577's toolchain revert, but the two feature PRs that depended on it left. Only #575 and #580 still target it, and both conflict.

Worth deciding explicitly rather than by drift: either land those two and retire the branch, or close them and let `main` be the only trunk. Nothing in this order depends on the answer.

## Why #577 mattered (now merged, kept for the record)

Two dependabot bumps folded into the integration branch broke every test job and lint on every PR targeting it:

- **jest 30 vs `jest-expo@57`** — jest-expo pulls the jest 29 family, so `jest-mock@29.7.0` hoists under `jest-runtime@30.4.2` and every suite dies at `resetModules` with `this._moduleMocker.clearMocksOnScope is not a function`. Zero tests run. The `--testPathPattern` → `--testPathPatterns` rename is the error CI shows first and hides this behind it.
- **TypeScript 7 vs typescript-eslint** — `@typescript-eslint/typescript-estree@8.61.0` declares `typescript >=4.8.4 <6.1.0`; TS 7.0.2 crashes it at load on `ts.Extension.Cjs`. `tsc --noEmit` stays green under TS 7 — a lint-toolchain limit, not a source problem.

Both diagnoses are now confirmed independently on `main`: #557 fails Unit/Integration/i18n/E2E jest, #291 fails Lint.

## Overlap map

- `types/api.ts` — #576 (`ServerInfo.projectSummary`, ~line 300) and #572 (`ConversationDetail.provider` comment, ~line 195). Disjoint regions.
- `locales/*` — #576 edits `sessions.json`, #572 edits `conversation.json`. No collision.
- `e2e/` — #572 edits `codex_parity.yaml` + fixture + `feat2_export_in_info_shelf.yaml`, #576 edits `mock-server.js`. No collision.
- `.github/workflows/e2e.yml` — #574 only, and its commits already ride in #572's branch.

## After the merges — E2E verification chain

Once #574 is on `main`, the Maestro suite becomes runnable on demand for the first time:

```
gh workflow run E2E                                   # main, whole suite
gh workflow run E2E -f flows=e2e/codex_parity.yaml    # narrow
gh workflow run E2E -f ref=572                        # a PR's head
```

Two caveats:

- **Four flows are known-failing for unrelated reasons** — `session_lifecycle`, `feedback_flow`, `05_chat_flow`, `06_search_anchor`. A full-suite run stays red; narrowing sidesteps them.
- **#574's CocoaPods fix is unverified.** `expo prebuild --no-clean` skips `pod install` when `ios/` exists, so xcodebuild dies on a missing `Pods-Threadbase.release.xcconfig` — why every scheduled run since at least June 2026 failed at the build step. The fix mirrors `deploy.yml`, but expect the possibility of a second build problem behind the first.

The old warning that "fixing `main` did not fix what a `ref=572` dispatch tests" **no longer applies**: #572 now targets `main` and its branch carries the setup fix.

## Worktrees

| PR | Worktree | Branch |
|----|----------|--------|
| #572 | `~/dev/ai-tools/tb-mobile-worktrees/codex-active-writer-mobile` | `fix/codex-active-writer-mobile` |
| #574 | `~/dev/ai-tools/tb-mobile-worktrees/e2e-dispatch` | `ci/e2e-flow-subset` |
| #576 | `~/dev/ai-tools/tb-mobile-worktrees/pr576-lazy-groups` | `feat/lazy-project-summary-groups` |
| #575 | — not checked out | `fix/e2e-onboarding-setup-flow` |

The `fix-toolchain` (#577) and `e2e-setup-main` (#578) worktrees are gone, both PRs having landed.

Note: the #572 worktree's `node_modules` was hardlinked from the primary checkout rather than installed from its own lockfile. Run `npm ci` there before trusting any test result from it.
