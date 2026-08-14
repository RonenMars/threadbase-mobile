Implement Phase 1a (iOS) and Phase 2 (Android) of Feature 12 — Live Activities / Dynamic Island — in this repo (tb-mobile).

## Your runbook

Read `docs/superpowers/plans/2026-07-25-live-activities-two-phase-runbook.md` in full before writing any code. It is the spec: it carries verified file:line references, seven resolved decisions, a task list, and a PR split. Follow it. Where this prompt and the runbook disagree, this prompt wins.

Note the runbook's citations were verified against `integration-merge-354-355-376`, NOT `main` — the two have diverged. Re-verify any line number before relying on it.

## Setup — do this first

Create a worktree from `integration-merge-354-355-376` (NOT main, NOT the current branch):

    /opt/homebrew/bin/git worktree add ~/dev/ai-tools/tb-mobile-worktrees/feat-live-activities -b feat/live-activity-ios-target integration-merge-354-355-376

Work inside that worktree for everything that follows. Use the absolute git binary `/opt/homebrew/bin/git` — a shell function shadows `git` on this machine.

A worktree at `~/dev/ai-tools/tb-mobile-worktrees/docs-live-activities-runbook` may already exist holding the runbook doc. Do not disturb it; read the runbook from your own worktree.

## Scope — 5 stacked PRs

**Stack every PR on the previous one.** PR N+1 branches from PR N's branch, and its GitHub base is PR N's branch — not `integration-merge-354-355-376`, not `main`. Only PR 1 targets the integration branch.

| PR | Branch | Base | Title |
|----|--------|------|-------|
| 1 | `feat/live-activity-ios-target` | `integration-merge-354-355-376` | `chore(ios): add expo-widgets and live activity target` |
| 2 | `feat/live-activity-contract` | PR 1 | `feat(live-activity): add shared content-state contract and reconciler helpers` |
| 3 | `feat/live-activity-ios-render` | PR 2 | `feat(ios): render session live activity on lock screen and dynamic island` |
| 4 | `fix/cold-start-deep-links` | PR 3 | `fix(routing): handle cold-start deep links into sessions` |
| 5 | `feat/live-activity-android` | PR 4 | `feat(android): promote running sessions to an ongoing notification` |

PR 5 here is the runbook's PR 7 (Android). The runbook's PRs 5–6 are the APNs/renewal work — that is Prompt 2 (streamer) plus a follow-up, and is explicitly OUT OF SCOPE for you. Stop after PR 5.

## Work autonomously

Do not stop for permission between tasks or PRs. Run the full sequence — implement, test, lint, typecheck, commit, push, open PR, move to the next — without checking in.

**Committing:** repo rules normally require showing a staged diff and awaiting approval. For this run you have standing approval to commit and push to feature branches, and to open PRs. You do NOT have approval to merge anything, force-push, or push to `main`/`integration-merge-354-355-376` directly.

**Stop and ask me only if:**
- Task 1's spike fails (see below) — the fallback is a real architectural fork.
- A repo rule and the runbook genuinely conflict with no clean resolution.
- You'd need to introduce `any`/`unknown` at a type boundary (repo rule: ask, never default to it).
- A decision would change the shape of the shared contract in `types/live-activity.ts`, since the streamer prompt consumes it.
- Something is structurally wrong with the plan — a cited API doesn't exist, a file has moved, an approach can't work.

Trivial judgment calls — naming, file placement, test structure, lint fixes, retries — are yours. Make them and keep going.

## Task 1 is a hard-timeboxed spike — treat it as a gate

`expo-widgets` is documented for CNG (Continuous Native Generation), but this repo commits hand-maintained `ios/`/`android/` dirs and CLAUDE.md mandates `expo prebuild --no-clean`. Whether the plugin injects a widget-extension target into the existing committed `project.pbxproj` is undocumented and unverified.

Timebox: half a day of effort. All four pass criteria must hold:
1. A second `PBXNativeTarget` with `productType = com.apple.product-type.app-extension` exists in `ios/Threadbase.xcodeproj/project.pbxproj`.
2. The `ios/Podfile` `post_install` SwiftUICore hook (~line 58) is unmodified.
3. `npx expo run:ios` builds and launches.
4. `git diff --stat ios/` is reviewable, not a wholesale regeneration.

If any criterion fails: **stop and report** which one, what you saw, and your recommended fallback (a `plugins/withLiveActivityTarget.js` using `withXcodeProject`, modeled on the existing `plugins/withAndroidReleaseSigning.js`). Do not silently build the fallback — the +1–2 day cost is my call.

If the extension hits the Xcode 26 SwiftUICore link error, apply the inverse of the Podfile hook to the extension target and note it.

## Non-negotiable repo rules

- **Never** push to `main` or to `integration-merge-354-355-376`. Feature branches and PRs only.
- **No AI attribution** anywhere — no `Co-Authored-By` naming an AI, no "Generated with Claude Code", no robot emoji. A git hook rejects these.
- **Conventional commit titles**, imperative mood, lowercase, no trailing period. A hook enforces this.
- **One sentence per line** in every PR body and commit body. Never break a line mid-sentence; let long lines run and let GitHub soft-wrap.
- **Never** comment on, reply to, or react to any GitHub issue or PR.
- **No `any` / `unknown`** in new code without asking me first.
- **No emoji in app UI.** RN screens use Phosphor icons. The widget renders through `@expo/ui/swift-ui` and cannot import Phosphor — use SF Symbols there and leave a comment explaining the split.
- **Comments only when non-trivial.** Never restate what the code says.
- **No inline multi-branch string ternaries in JSX** — extract to a named `const` above the return.
- **`expo prebuild` always with `--no-clean`.** A bare prebuild wipes the hand-maintained native dirs.
- When `package.json` changes: run `pod install` in `ios/` and commit `package.json`, `package-lock.json`, and `ios/Podfile.lock` together.
- Add `widgets/` to `scripts/git-hooks/ci-paths.txt` AND mirror the entry with a one-line reason in `docs/ci-significant-paths.md`.
- Record the native-only blocker in `docs/expo-web-support.md`, and ship a `services/live-activity.web.ts` no-op shim so Expo Web keeps building.
- Run `npx eslint <staged ts/tsx files>` before each commit. Fix errors; warnings may pass.

## Definition of done per PR

Before opening each PR: `npm run test:unit`, `npm run test:integration`, `npm run lint`, `npm run typecheck` all green. If a jest run hangs, use `--runInBand --forceExit` and `pkill -f jest` before retrying.

Do not merge anything. Leave all five PRs open, CI running, stacked in order.

## Deliberate scope boundaries — do not "fix" these

- `minimal` and expanded Dynamic Island layouts stay **system-default** in v1 (Decision 3). Do not hand-style them. Leave a comment saying it's deliberate.
- Phase 1a has **no renewal** past ~8h — `staleDate` greys the surface out honestly. Background renewal is Phase 1b (the streamer prompt). Do not build a foreground-renewal workaround.
- **No "Make live" button** (Decision 1). Promotion is automatic, capped at 3, LRU-evicted.
- Do NOT create `modules/live-activities/`. The roadmap says to; it's stale. `expo-widgets` replaces it.
- Do NOT touch tb-streamer. That's a separate prompt.

Three pre-existing issues you'll notice — **report at the end, do not fix**: the `onAll` docstring/behavior mismatch at `services/ws-client.ts:341`; three duplicated `formatElapsed` implementations; the `notification` WS frame having zero subscribers.

## Report when done

For each PR: number, branch, base branch, PR URL, CI status. Then: the spike outcome, anything you'd flag for review, and the pre-existing issues noted above.
