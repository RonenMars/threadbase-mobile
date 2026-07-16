# Threadbase Mobile — Claude Instructions

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

## Comments — Non-Trivial Only

Never add comments that restate what the code already says. Only comment when the code is complex, non-obvious, or would surprise a reader without context.

```tsx
// bad — restates the code
const count = items.length // get the length of items

// good — explains the non-obvious why
// FlashList measures items lazily; an explicit key forces re-layout on data swap
<FlashList key={sessionId} ... />
```

---

## No Inline Conditional Text in JSX

Extract multi-branch string expressions from JSX props into a named `const` above the return. Inline ternaries that produce UI strings are hard to read and harder to translate.

```tsx
// bad
placeholder={isWakingUp ? (isResume ? 'Picking up…' : 'Starting up…') : 'Send input…'}

// good
const inputPlaceholder = isWakingUp
  ? (isResume ? 'Picking up…' : 'Starting up…')
  : 'Send input…'
// ...
placeholder={inputPlaceholder}
```

---

## No `unknown` or `any` Without Explicit Permission

Never introduce `unknown` or `any` in new code without the user's explicit approval. If a type boundary genuinely requires one, stop and ask — don't default to it as a workaround for a type error.

Prefer:
- Proper interface/type definitions
- Type guards with `typeof` / `instanceof` narrowing
- Generics

---

## Lint Before Commit

Before every `git commit`, run ESLint on the files being committed:

```bash
npx eslint <staged-files>
```

Get the staged file list with `git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(ts|tsx|js|jsx)$'`. If there are no JS/TS staged files, skip. Fix any errors before committing — warnings are allowed through.

---

## Keep `ci-paths.txt` in Sync

`scripts/git-hooks/ci-paths.txt` is the canonical list of paths that affect **app functionality, tests, or CI**. The `commit-msg` hook appends `[skip-ci]` to any commit that touches **none** of them, so CI skips the heavy jobs. If the list is stale, a real change can be silently mis-tagged `[skip-ci]` and skip CI.

When you add or move something that affects functionality/tests/CI and it isn't already covered by an entry, add it to `ci-paths.txt`:

- A **new top-level source dir** (imported at runtime or by tests) — e.g. a new `widgets/` or `api/` folder.
- A **new root-level config** that feeds build/lint/type/test — e.g. a new `*.config.js`, `jest.config.*`, or `*-env.d.ts`.
- A **new native/deploy input** at the root — e.g. a new ship script dir or lockfile that gates builds.

Then mirror the entry in `docs/ci-significant-paths.md` with a one-line reason (that doc explains *why* each path is on the list). Don't add gitignored paths (e.g. `.env*`) — they can never be staged, so the hook never sees them. See `docs/ci-significant-paths.md` for the full rationale and the deliberate exclusions.

---

## Web Platform (Expo Web)

The app supports an early-spike `web` platform (`npx expo start --web`) reusing the same Expo Router/RN codebase — not a separate project. Status, verified fixes, and the list of known native-only-dependency blockers (SecureStore, biometrics, speech recognition, camera, notifications, keyboard controller, bottom sheet) live in `docs/expo-web-support.md`. Keep that doc updated as blockers are fixed or new ones are found — don't let it drift from actual behavior.

Any `expo-secure-store` usage must go through `services/secure-store.ts` (not the package directly) so the `.web.ts` localStorage shim applies on web via Metro's platform-extension resolution.

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

**`expo prebuild` defaults to `--clean` since SDK 57:** A bare `npx expo prebuild` now wipes and regenerates the committed `ios/` and `android/` directories, discarding the hand-maintained native config (the `ios/Podfile` SwiftUICore/Xcode-26 hook, the bouncycastle pins and `-Xmx` heap tuning in `android/`, etc.). When running prebuild manually on this repo, **always pass `--no-clean`** to patch the existing folders in place. The `ship-*` scripts are unaffected — they only prebuild when the native dir is missing (`[[ ! -d ios ]]`), where there is nothing to clean.

## npm Scripts — Cross-Platform (Windows) Compatibility

`package.json` scripts must work on Windows (`cmd.exe`) as well as macOS/Linux. Never use Unix shell syntax in scripts — `2>/dev/null`, `||  true`, `&&`, `$VAR`, subshells, etc. all break on Windows.

For scripts that need to swallow errors or run shell logic, use a Node.js one-liner:

```json
"prepare": "node -e \"const {execSync}=require('child_process');try{execSync('git config core.hooksPath scripts/git-hooks',{stdio:'ignore'})}catch(e){}\""
```

The same applies when adding any new `scripts` entry that involves error suppression or conditional logic.

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
