# Conflict resolutions — rebasing `land/integration-prep` onto `main`

**Status:** live procedure for one rebase. Delete once `land/integration-prep` is on `main`.
**Discovered:** 2026-08-01, against `main` at `8bb3ec96`, branch at `d343bd5b` (merge-base `ff8bd0ba`).

## Why this file exists

Rebasing the branch's 115 commits directly hits conflicts on **commit 1 of 115** and keeps hitting them, because ~90% of the branch's work is already on `main` by content — landed through the integration route rather than these commits. Replaying them re-adds files `main` already has, so git raises `add/add` on files that are **byte-identical on both sides**.

Squashing the branch to a single commit first collapses that into **one** conflict set of 18 files. Those resolutions are recorded below so the real 115-commit rebase can apply the same decision every time the same file comes up, instead of re-deciding under fatigue.

Measured before starting:

| | |
|---|---|
| What a rebase replays (`origin/main...land/integration-prep`) | 308 files, 21,613 insertions |
| What actually differs (`origin/main land/integration-prep`) | 37 files, 1,232 insertions |
| Conflicts when replaying 115 commits | commit 1 of 115, 10 files, and continuing |
| Conflicts when replaying 1 squashed commit | 18 files, once |

## The rule

`main` wins for anything `main` changed *after* the branch diverged (2026-08-01 work). The branch wins for its own new features. Neither side wins by default — check which side is the deliberate later change.

## Resolutions

### Keep `main` (ours)

| File | Hunks | Why |
|---|---|---|
| `CLAUDE.md` | 2 | `main` carries the rewritten Podfile.lock section (#469) and the corrected `### Base branch` rule (#474). The branch has the superseded text: the old one-paragraph pod note, and the base-branch rule pointing at `integration-merge-354-355-376`, a branch that does not exist. |
| `docs/troubleshooting.md` | 1 | `main` adds the whole "CI signals" section (#473/#474). The branch has nothing there — the conflict is pure addition on one side. |
| `docs/runbooks/README.md` | 1 | `main`'s row marks the PR-landing runbook superseded; the branch's row still advertises it as live. |
| `docs/runbooks/2026-07-22-land-open-prs.md` | whole file | `main` replaced the 241-line runbook with a 45-line tombstone (#473). Base is 0 lines (add/add), so there is no auto-merged content to preserve and `git checkout --ours` is safe here. |
| `app.json` | 1 | `buildNumber`: base 181, `main` 186, branch 182. Take the higher — `main` has shipped builds since the branch diverged. |
| `KICKOFF-landing-runbook.md` | modify/delete | **`git rm` it.** `main` deleted the file (#474); the branch appended to it (`ecdfb797`). A modify/delete resolves *toward the modification* by default, silently resurrecting a file that was deliberately removed. Delete it explicitly. |

### Keep the branch (theirs)

| File | Hunks | Why |
|---|---|---|
| `locales/{ar,en,he,ru}/settings.json` | 1 each | `helpSupport`: the branch relabels it "Email our support" (#462, `841afeea`, on the branch only — confirmed with `git branch -a --contains`). `main` still has the old "Help & Support". Keep the trailing comma; both sides add `serverHealth`/`pairedDevices` after it. |
| `package.json` | 1 | `test:e2e:mock`: the branch's flow list is a strict superset — it has `main`'s `session_lifecycle` + `server_drag_reorder` **plus** the new `07_conversation_scroll_gaps`. |
| `components/onboarding/steps/ConnectStep.tsx` | 2 | Branch replaces a hardcoded `mailto:ronenmars@gmail.com` with `SUPPORT_EMAIL` from `services/feedback-transport`. Note hunk 1: `main` *removed* two base imports and the branch *replaced* them — taking the branch side yields only the `SUPPORT_EMAIL` import, which is correct. |
| `components/pair/PairScannerModal.tsx` | 2 | Same hardcoded-email → `SUPPORT_EMAIL` change. |
| `components/conversation/ConversationHistoryList.tsx` | 1 | Branch wraps the seen/animate id walk in `useMemo(…, [messages])` so the O(messages) scan runs on data change instead of every re-render. This is the scroll-gap fix — the branch's actual new work. |
| `scripts/archive-and-upload.sh` | 1 | `SENTRY_RELEASE` → `threadbase-mobile-ios@…`. **Must match `services/safe-metadata.ts`**, which merges cleanly from the branch and emits the platform-scoped name (`d343bd5b`, "scope them per platform"). Taking `main`'s unscoped `threadbase-mobile@…` here would silently re-break the release/source-map binding this branch exists to fix. |
| `scripts/bundle-and-upload-android.sh` | 1 | Same, `threadbase-mobile-android@…`. |
| `.github/workflows/deploy.yml` | 2 | Branch adds `EXPO_PUBLIC_SUPPORT_EMAIL` / `EXPO_PUBLIC_FEEDBACK_EMAIL` to both ship steps; `main` has neither. Purely additive. |
| `LANDING-integration-to-main.md` | whole file | Branch version is 305 lines vs `main`'s 252 and is the later edit (`b1a2cd7d`, "correct landing-runbook drift against current branch state"). Base is 0 lines. |
| `docs/sentry-releases-investigation.md` | whole file | Branch is 362 lines vs `main`'s 250 and differs by +113/−1 — effectively a superset, written by the Sentry work on this branch. Base is 0 lines. |

## Two traps this rebase actually sprang

**`git checkout --theirs` is whole-file.** `.github/workflows/deploy.yml` and `package.json` each have conflicted hunks *and* auto-merged changes from `main` (the `reset-podfile-lock-path-noise.sh` wiring, and the `dev:reset` → `bundle exec` fix). Resolving those two files with a whole-file checkout silently discards `main`'s contribution. Resolve hunk-by-hunk; only use whole-file checkout where the base is 0 lines, i.e. a true add/add.

**`node_modules` is not ignored when it is a symlink.** `.gitignore` line 1 is `node_modules/` — the trailing slash matches directories only. A convenience symlink in a scratch worktree slips past it, and `git add -A` commits it as a `120000` entry. Add `node_modules` (no slash) to `.git/info/exclude`, or stage explicit paths. Verified this did **not** reach `main` in #469/#471/#473/#474.

## Verification on the resolved tree

Run all of these after the real rebase; they were green on the squashed rebase:

```
npx tsc --noEmit                 # exit 0
npx eslint "**/*.{ts,tsx}"       # 0 errors (5 pre-existing warnings, same as main)
npm run test:i18n                # 3 suites, 55 passed
npm run test:unit                # 101 suites, 957 passed
npm run test:integration         # 40 suites, 253 passed
npx jest --config jest.config.scripts.js --testPathIgnorePatterns "/node_modules/"   # 7 suites, 59 passed
```

The `--testPathIgnorePatterns` override is needed only in a worktree under `.worktrees/`, which the scripts config otherwise excludes — see [`../troubleshooting.md`](../troubleshooting.md) → "Jest test suites".

Final shape: `main` + one commit, 25 files changed, 921 insertions, 127 deletions.
