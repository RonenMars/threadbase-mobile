# Threadbase Mobile — Codex Instructions

## E2E Testing (Maestro)

Maestro flows live in `e2e/`. Run the full mock suite with:

```bash
npm run test:e2e:mock
```

This checks for a booted iOS simulator, starts `e2e/mock-server.js` on port 7071, runs `03_hub.yaml` + `04_session_detail.yaml`, then kills the server.

**Prerequisites (one-time):** `brew install maestro` + `npm run ios` to get the app on the sim.

When adding new Maestro flows:
- Use `testID` props (not text) for elements without stable visible text — see `e2e/03_hub.yaml` for examples
- Add new flows to the relevant `test:e2e:*` script in `package.json`
- Fixtures are in `e2e/fixtures/` — extend them if the new flow needs additional data

---

## Lint Before Commit

Before every `git commit`, run ESLint on the files being committed:

```bash
npx eslint <staged-files>
```

Get the staged file list with `git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(ts|tsx|js|jsx)$'`. If there are no JS/TS staged files, skip. Fix any errors before committing — warnings are allowed through.

---

## Native Dependencies After Package Changes

Whenever `package.json` or `package-lock.json` changes:

1. Run `pod install` from the `ios/` directory.
2. Commit `package.json`, `package-lock.json`, and `ios/Podfile.lock` together.

---

## Icons

**Never use emojis in the app UI.** All icons must come from the [Phosphor Icons](https://phosphoricons.com/) library (`phosphor-react-native`). Use the appropriate Phosphor component (e.g. `<Star />`, `<Clock />`, `<Fire />`, `<GearSix />`, `<PencilSimple />`). This applies to all new code and any code you touch.

---

## Shipping / Release Pipeline

**Default ship tool: `/expo-local-ship`**

Always use `/expo-local-ship` when the user says "ship", "TestFlight", "build the app", "submit", or anything release-related.

**Always commit `app.json` before shipping:** After bumping the build number (and version if changed), stage and commit `app.json` *before* running the archive/upload step. Never ship with an uncommitted `app.json`.

**Version bumps after a ship:** Local `ship-*` scripts call `scripts/land-version-bump.sh` (dirty-tree commit + push). GitHub Actions Deploy re-derives the bump onto a fresh `origin/main` worktree instead. Both paths land on `main` via `scripts/admin-merge-pr.sh` (open PR + admin squash-merge). `land-version-bump.sh` is a no-op under `CI`/`GITHUB_ACTIONS`. Naming convention:

- **Branch:** `chore/bump-<platform>-version-<N>` — where `<N>` is the new iOS build number or Android version code. E.g. `chore/bump-ios-version-140`, `chore/bump-android-version-20`.
- **Commit (iOS):** `chore(ios): bump build number to <N> [skip-ci]`
- **Commit (Android):** `chore(android): bump version code to <N> [skip-ci]`

The `[skip-ci]` suffix keeps CI from re-triggering on the bump-only commit. Never push the bump straight to `main`. See `docs/deployment.md` → "Version bumps after a ship".

**`/ship-expo-cloud` (EAS cloud builds) is opt-in only:**
- Only invoke it when the user explicitly types `/ship-expo-cloud`
- Before running any EAS build or submit command, stop and ask the user to confirm — do not proceed automatically
- Never trigger it as a side-effect of a "ship" or "commit and ship" request

---

## PR Titles & Branches

Derived from the dominant pattern in PRs created 2026-07-19 → 2026-07-24
(e.g. `#348`–`#394`, `#368`, `#376`, `#378`–`#393`). Prefer this over ad-hoc
formats. Never mention Cursor, Codex, Claude, or other AI tooling in the title,
branch name, body, or commit message.

### Title format

```
type(scope): imperative summary
```

- **type** — one of: `feat`, `fix`, `chore`, `docs`, `test`, `ci`, `perf`, `refactor`
- **scope** — optional but preferred when clear (`session`, `terminal`, `conversation`,
  `onboarding`, `servers`, `ios`, `ci`, `deps`, `e2e`, `i18n`, …)
- **summary** — imperative, lowercase start, no trailing period; describe the
  user-visible or operational change, not the implementation dump

Examples from recent history:

- `feat(conversation): add in-chat search entry on detail screen`
- `fix(terminal): fall back to HTTP output when WS replay is blank`
- `chore(ios): bump build number to 171 [skip-ci]`
- `docs(session): correct hold_session comments to describe grace-timer behavior`
- `test(e2e): wire server drag-reorder into the mock Maestro suite`
- `ci: gate locale parity and dead keys with an i18n job` (scope may be omitted)

Version-bump PRs keep the `[skip-ci]` suffix. Dependabot-style titles stay as
`chore(deps): …`.

Do **not** use bracket-slug titles like `[feat][task-name]` for new PRs — that
was a short-lived experiment and does not match the repo’s established style.

### Branch format

```
type/kebab-case-summary
```

Match the title’s type. Examples: `feat/in-chat-search`,
`fix/terminal-empty-replay-fallback`, `chore/bump-ios-version-171`,
`docs/hold-session-comments`. Never prefix with tool names (`cursor/…`, `cc/…`).

### Base branch (this integration wave)

For work targeting the current integration line, open PRs against
`integration-merge-354-355-376` (not `main`). Rebase onto the latest tip of that
branch before merge. Squash title must still follow `type(scope): summary`.

---

## Merging PRs — Rebase + Squash, Linear History

Keep `main` a straight line — one commit per PR, no merge commits. Every PR follows the same two operations, in this order:

1. **Rebase onto latest `main`** to sync before merging. `git fetch origin && git rebase origin/main`, resolve conflicts preserving the PR's intent, then `git push --force-with-lease` (never plain `--force`, never force-push `main`). This guarantees no merge commit sneaks in.
2. **Squash-merge** the rebased PR: `gh pr merge <N> --squash --delete-branch`. The squash title must be conventional-commit compliant and carry no AI attribution.

Rules:

- **One PR at a time.** Never sync/merge PRs in parallel — rebase one, wait for its CI to go green, squash-merge it, then move to the next. A just-merged PR advances `main`, so the next PR is usually behind and must be rebased again.
- **Dependency order first.** If PR B is stacked on PR A (GitHub shows A's branch as B's base), merge A before B and rebase B onto the updated `main` afterward.
- **CI gate.** Only squash-merge when required checks are green. If CI is red on a flaky/infra failure, re-run it **once**; if the re-run still fails, stop and report — do not merge red.
- **Stuck cap.** If any single step hangs for more than ~3–4 minutes (CI not progressing, a rebase that won't resolve cleanly), stop and report rather than waiting indefinitely.
