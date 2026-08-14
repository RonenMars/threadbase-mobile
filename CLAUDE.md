# Threadbase Mobile — Claude Instructions

## E2E Testing (Maestro)

Maestro flows live in `e2e/`. Run the full mock suite with:

```bash
npm run test:e2e:mock
```

This checks for a booted iOS simulator, ensures a Release build is installed (building one if needed), starts `e2e/mock-server.js` on ports 7071 and 7072, runs the mock-suite flows, then kills the server.
The authoritative flow list is the `test:e2e:mock` script in `package.json` — read it there rather than duplicating it here.

**Prerequisites (one-time):** `brew install maestro` + `npm run ios` to get the app on the sim.

When adding new Maestro flows:
- Use `testID` props (not text) for elements without stable visible text — see `e2e/browse.yaml` for examples
- Add new flows to the relevant `test:e2e:*` script in `package.json`
- Fixtures are in `e2e/fixtures/` — extend them if the new flow needs additional data

---

## Jest — Confirm Suite Failures in Isolation

The `SessionScreen.*` suites are heavy enough that jest's parallel workers oversubscribe some machines, so a batch run can report failures that aren't real. Verify them serially:

```bash
npx jest --ci --runInBand --testPathPattern "SessionScreen"
```

**Never classify a batch failure without re-running that suite alone** — a load artifact and a genuine defect are indistinguishable in batch output. Passes alone → artifact. Fails alone → real, fix it. Both mistakes are easy: during the 2026-07-22 integration snapshot four genuinely broken suites were nearly dismissed as flakes, while two others really were artifacts.

The load-sensitive suites, the `.claude/` worktree gotcha (`npx jest` finds **0 tests** there), and their fixes are documented in [`docs/troubleshooting.md`](./docs/troubleshooting.md) → "Jest test suites".

---

## Worktrees — Always Outside the Repo Root

Create every git worktree **outside** the repo, as a sibling directory:

```bash
git worktree add ../tb-mobile-worktrees/<branch-slug> <branch>
```

Never nest one under the repo root (`.worktrees/`, `tb-mobile-worktrees/`, or anywhere inside the checkout).

**Why:** a nested worktree is a full second copy of the tree, so every repo-root tool walks into it and treats those files as part of *this* project. Jest is the one that bites — it discovers the copied `__tests__/` and reports failures from a stale branch that don't exist in your working tree. On 2026-08-01 that produced two phantom `safe-metadata` failures whose "fix" would have been to break working code. `jest.config`'s `testPathIgnorePatterns` only lists `<rootDir>/.worktrees/`, so any other nested path is unguarded — and the same applies to ESLint, TypeScript, Metro and `git grep`.

Keeping them siblings also means `rm -rf` on a worktree can never touch the real checkout.

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

## Native Dependencies After Package Changes

Whenever `package.json` or `package-lock.json` changes:

1. Run `bundle exec pod install` from the `ios/` directory — never a bare `pod install`.
2. Commit `package.json`, `package-lock.json`, and `ios/Podfile.lock` together.

**Always `bundle exec`.** The `Gemfile` pins CocoaPods to 1.16.2 so local installs match `pod install --deployment` in deploy CI. A Homebrew CocoaPods on `PATH` shadows that pin, and a bare `pod install` run against it rewrites the `COCOAPODS:` line in `ios/Podfile.lock`, which then flips back the next time CI or a `bundle exec` user regenerates it.

**Four checksums are path-dependent and are not yours to commit.** `ExpoModulesCore`, `ExpoWidgets` and `hermes-engine` generate their podspecs at install time and bake the checkout's absolute path into them (`HERMES_CLI_PATH`, the precompiled `ExpoModulesCore` tarball `file://` URL, the `ExpoWidgets` bundle copy script), and `RNSentry` behaves the same way. A pod's `SPEC CHECKSUM` is the SHA1 of its generated podspec, so those four values differ for every worktree, every machine and every CI runner — `bundle exec` does not stabilise them. Committing them is what makes `ios/Podfile.lock` ping-pong between whoever ran `pod install` last, and is the usual source of `ExpoWidgets`/`hermes-engine` checksum conflicts on rebases.

`scripts/reset-podfile-lock-path-noise.sh` reverts `ios/Podfile.lock` when those four lines are the *only* drift (a genuine pod change also moves that pod's version line, so it is left alone). The `pre-commit` hook runs it whenever `ios/Podfile.lock` is staged, so the noise never reaches a commit, and the ship and deploy pipelines run it right after `pod install`.

**Never hand-revert the lockfile with `git checkout -- ios/Podfile.lock`.** `pod install` writes the same bytes to `ios/Podfile.lock` and to `ios/Pods/Manifest.lock` (gitignored), and Xcode's `[CP] Check Pods Manifest.lock` phase diffs the two on every build — restoring one without the other fails the archive with `error: The sandbox is not in sync with the Podfile.lock` even though the installed pods are correct. That is what broke deploy runs [31430505715](https://github.com/RonenMars/threadbase-mobile/actions/runs/31430505715) and [31436408481](https://github.com/RonenMars/threadbase-mobile/actions/runs/31436408481) on 2026-08-10. The script keeps both files in step; use it instead.

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

## Rollup / Snapshot Tag Naming

Separate from normal `<type>/<description>` work branches (`feat/…`, `fix/…`, `docs/…`, etc.), this repo also uses **test tags**: lightweight `git tag`s that mark a combination of commits purely for verification, not for their own PR. A tag (not a branch) is used because these mark a point in time rather than an active line of work — they carry no ongoing commits, don't clutter the branch list, and can't accidentally be pushed to. They're deleted once superseded or once the underlying work merges individually.

**Format:**

```
test-<env>/v<version>-<sha>-<date>
```

- `<env>` — what the snapshot is being verified against:
  - `dev` — local/dev-only verification, e.g. combining several open PR branches to integration-test them together before merging individually
  - `pre-release` — staging/TestFlight-track candidate verification
  - `production` — verification against what's shipping (or about to ship) to production
- `v<version>` — the app version from `app.json` / `package.json` at the time the tag was cut
- `<sha>` — short SHA (7 chars) of the commit the tag points to
- `<date>` — ISO date (`YYYY-MM-DD`) the tag was created

**Example:** `test-dev/v1.0.0-bfc800d-2026-07-20` — a dev-only test tag combining several open PRs at app version 1.0.0, pointing at commit `bfc800d` on 2026-07-20.

To validate a build from one of these tags before merging, run the `Deploy` workflow (`.github/workflows/deploy.yml`) with `deploy_ref` set to the tag name — `deploy_ref` accepts any branch, tag, or commit SHA.

---

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

### Base branch

Open PRs against `main`. Rebase onto the latest `origin/main` before merge; squash
title must follow `type(scope): summary`.

---

## GitHub Issues — Format & Labels

**Format and labels: [`threadbase/docs/issue-tracker.md`](https://github.com/RonenMars/threadbase/blob/main/docs/issue-tracker.md).** That file lives in the `threadbase` umbrella repo and is canonical for **every** component repo — never keep a local copy of these rules, invent a variant, or add a label to only one side.

Read it before filing, re-labelling, or re-prioritising. The shape:

```
Title:   P<N>: <what is wrong or what should exist>
Labels:  <one priority> + <one type> + <zero or more areas>
```

- **Exactly one priority** (`P0`–`P3`), repeated as the title prefix, because GitHub wraps labels out of view on narrow screens.
- **Exactly one type** (`bug`, `enhancement`, `documentation`, `question`, `tech-debt`). Areas are free — zero or more.
- **Re-prioritising means editing the title too.** They are two representations of one fact.
- **`## Verified state` is the section that earns the format** — cite a `path/to/file.ts:123`, a PR number, or a quoted log line, and say when it was checked. The convention exists because an audit found trackers listing eight already-merged PRs as open work.
- Cross-repo work is filed in **both** repos, each describing its own half, linked by URL.
- One sentence per line, no AI attribution — same as commits and PR bodies.

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

---

## Expo MCP (`expo-local`)

Expo MCP is configured **globally** (user scope) for both Claude Code and Codex as `expo-local` — there is no per-project install, and nothing in this repo needs to change to use it.

- It talks to a **locally running Expo/Metro dev server at `http://127.0.0.1:8081`**. Start it first (`npm start -- --port 8081`); without it the MCP tools have nothing to attach to.
- Use it for **screenshots, device/app logs, and verifying UI on the simulator or emulator**.
- **Do not use remote tunneling** (`--mcp-server-url` / `@expo/mcp-tunnel`) unless explicitly asked. Local dev server only.

## On-Device Tracing / Dev Client — Two Silent Traps

When measuring or debugging on the simulator with an `EXPO_PUBLIC_*` trace flag (e.g. `EXPO_PUBLIC_OPEN_TRACE=1`), two failure modes look like "the thing I'm tracing never happened" rather than an error. Both are documented with verify-and-fix commands in [`docs/troubleshooting.md`](./docs/troubleshooting.md) → "Measuring the wrong thing":

- **A shell-exported `EXPO_PUBLIC_*` flag does not inline into the bundle.** Expo reads these from `.env` / `.env.local` files, not arbitrary shell exports, so `EXPO_PUBLIC_OPEN_TRACE=1 npx expo start` leaves `ENABLED` false. Put it in `.env.local` (gitignored), restart with `--clear`, and verify by grepping the served `expo-router/entry.bundle`. App `console.log` lands in `.expo/dev/logs/start.log`.
- **The dev client serves a disk-cached bundle.** After a JS change or Metro `--clear`, deep-link / `/reload` / plain `simctl launch` all no-op against the cache — you measure old code. Uninstall + reinstall to force a fresh fetch (this wipes AsyncStorage, so re-pair servers); Fast Refresh handles iteration once you are on the live bundle.

## Server contract — degrade, don't break

The streamer no longer keeps a hand-maintained compatibility list, and it does **not** treat a wire change as blocked by this app (see "Backward compatibility with tb-mobile" in the streamer's `CLAUDE.md`). A server can rename a field, drop an endpoint or emit a status this build has never heard of, and it can do so without asking. This app is the half that absorbs it.

**The rule: a server that moved ahead costs a degraded screen, never a crash.**

- **Treat every response as untrusted input, not as its TypeScript type.** `SessionStatus` in `types/api.ts` is a three-value union (`running` | `waiting_input` | `idle`) — that is what *this build* knows, not what the server may send. Narrow an incoming status through an explicit check and fall back to `idle`; never let an unknown value reach a `switch` that assumes exhaustiveness.
- **A missing optional field renders without it.** No throw, no empty screen, no error toast — omit the affected piece of UI and show the rest.
- **A feature that needs a newer server degrades rather than erroring.** Absent endpoint or capability → hide the entry point, or show one plain line saying the server doesn't support it yet. `GET /api/info` and `GET /api/config/feature-flags` are the capability probes; a server too old to answer reads as "off", which is correct — it is also too old to have the feature.
- **Report, don't repair.** If a response shape looks wrong, surface it to the user and keep the rest of the screen alive. Don't add client-side shims that guess at what the server meant.

None of this is a reason to pin a minimum server version or to ask the streamer to hold a change back.

---

## Agent skills

### Issue tracker

Issues live as GitHub issues on `RonenMars/threadbase-mobile`, via the `gh` CLI; format and label taxonomy stay canonical in the `threadbase` umbrella repo. See `docs/agents/issue-tracker.md`.

### Triage labels

The five triage states use their canonical names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) and are additive to the existing priority/type/area taxonomy. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` at the root (not created yet) plus `docs/adr/`. See `docs/agents/domain.md`.
