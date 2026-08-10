# Threadbase Mobile — Codex Instructions

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

---

## Cursor Cloud specific instructions

The Cursor cloud agent runs on a **headless Linux VM** — there is **no macOS, Xcode, iOS simulator, or Android SDK/emulator**. Plan work around that:

- **Cannot run here:** `npm run ios`, `npm run android`, `expo run:*`, CocoaPods (`bundle exec pod install`), the `ship:*` scripts, and every Maestro E2E flow (`npm run test:e2e:*`). Those all require a Mac or a booted simulator — `e2e/check-sim.js` hard-fails first. Don't attempt them; the native `ios/`/`android/` dirs are committed but not buildable here.
- **The runnable surface is the JS toolchain + Expo Web.** Standard commands (defined in `package.json`, don't duplicate): `npm run lint`, `npm run typecheck`, `npm run test:ci`, `npm run test:scripts`, and the app via **Expo Web** — `npx expo start --web --port 8081`. Lint warnings are allowed; only errors block (see "Lint Before Commit").

**Node version.** Pinned to `.nvmrc` (currently `24.15.0`), installed via `nvm`. The sandbox ships its own `node` on `PATH` (`/exec-daemon/node`, currently v22) that can **shadow** the pinned version in non-login shells. Login/interactive shells (and `tmux`) pick up the pinned Node via a snippet appended to `~/.bashrc`. If `node -v` shows v22 in a given shell, run `source ~/.nvm/nvm.sh && nvm use` (reads `.nvmrc`) before Metro/tests. (Node 22.x also satisfies the repo's stated `>= 22.13` minimum, so most commands work either way.)

**Exercising the core flow on web (no real `tb-streamer`).** The app is a thin client; to reach anything past onboarding it needs a backend. Use the bundled mock streamer: `MOCK_PORTS=7071,7072 node e2e/mock-server.js`. **Gotcha:** the mock server sends **no CORS headers**, so a browser web bundle served from `:8081` cannot call it cross-origin — front it with a tiny CORS-adding reverse proxy (dev-only, keep it outside the repo) and point onboarding at the proxy's URL. Add the server in onboarding (route `/onboarding?mode=add`) with protocol `http`, host = proxy URL, and any non-empty API key **except** the sentinel `wrong-token-000` (which the mock treats as invalid). The session list then populates from fixtures in `e2e/fixtures/`.

**Web is an early spike, not full parity** (see [`docs/expo-web-support.md`](./docs/expo-web-support.md)). Known, expected on web (NOT environment bugs): a dev red-box overlay from `expo-notifications` (`ExpoNotifications.getLastNotificationResponseAsync` via `app/_layout.tsx`) fires on load — dismiss it to use the app; and native-only surfaces (Face ID, camera QR pairing, speech, keyboard-controller, bottom-sheet, the WebSocket-driven live terminal viewer on the session-detail screen) may error or render blank.
