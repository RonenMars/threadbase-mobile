# Threadbase Mobile — Codex Instructions

Optional AI-assistant tooling this repo declares (plugins, MCP servers, and how to install them for Claude Code or Codex): [docs/agents/tooling.md](docs/agents/tooling.md)

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

On iOS 26.x, do not use Maestro's `hideKeyboard`: it can fail in the simulator's XCTest accessibility path. A crash report naming `SpringBoard`, `launchd_sim`, a `com.apple.CoreSimulator.SimDevice.<UDID>` coalition, and `XCTAutomationSupport` is a simulator-automation crash—not a Threadbase app crash or a crash on a connected physical device. Scroll to reveal the next control instead; use `pressKey: Enter` only for single-line inputs whose return behavior is safe. See [`docs/troubleshooting.md`](./docs/troubleshooting.md) → "SpringBoard crashes in `XCTAutomationSupport` during Maestro".

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

`pod install` writes the same bytes to `ios/Podfile.lock` (committed) and `ios/Pods/Manifest.lock` (gitignored), and Xcode's `[CP] Check Pods Manifest.lock` phase diffs the two on every build — a mismatch fails the archive with "The sandbox is not in sync with the Podfile.lock". Anything that rewrites one must rewrite the other.

Four `SPEC CHECKSUM` entries — `ExpoModulesCore`, `ExpoWidgets`, `hermes-engine`, `RNSentry` — hash a podspec generated at install time that bakes in the checkout's absolute path, so they differ per machine, per worktree and per CI runner for the same pod at the same version. `scripts/reset-podfile-lock-path-noise.sh` reverts `ios/Podfile.lock` when the drift is limited to those four lines and resyncs `Manifest.lock` to match; a genuine pod change also moves that pod's version line and is left alone.

The `pre-commit` hook runs that script whenever `ios/Podfile.lock` is staged, so the noise never reaches a commit. The ship and deploy pipelines run it right after `pod install`.

---

## Icons

**Never use emojis in the app UI.** All icons must come from the [Phosphor Icons](https://phosphoricons.com/) library (`phosphor-react-native`). Use the appropriate Phosphor component (e.g. `<Star />`, `<Clock />`, `<Fire />`, `<GearSix />`, `<PencilSimple />`). This applies to all new code and any code you touch.

---

## Device Builds — Always Through `dev-device.sh`

Anything that builds and installs onto a **physical iOS device** must go through
`scripts/dev-device.sh`. Never call `npx expo run:ios --device` directly, and never add a
new entry point that does.

The reason is signing, not preference. Xcode's *automatic* signing generates a profile
named "iOS Team Provisioning Profile" that carries no App Groups capability, and both
`Threadbase` and `ExpoWidgetsTarget` declare `group.com.ronenmars.threadbase`. Automatic
signing also ignores hand-made profiles, so the only way through is manual signing with a
different provisioning profile *per target* — which cannot be expressed on the `xcodebuild`
command line, because command-line build settings apply to every target at once.

`dev-device.sh` resolves that: it scans the profiles already installed on the machine,
picks a development profile (one with `ProvisionedDevices`) whose app-id matches and which
grants App Groups, and feeds them per target via `XCODE_XCCONFIG_FILE`. It needs no
per-machine configuration.

A path that skips it fails to sign with six errors and `xcodebuild` exits 65 — and the
failure names App Groups, not signing, so it reads as a project misconfiguration rather
than a wrong entry point. `npm run dev:tunnel:native` had exactly this bug: it called
`expo run:ios` itself, so a device build over a tunnel failed while looking like a tunnel
problem. It now delegates, and `dev:tunnel:native:reset` inherits that.

Simulator builds are unaffected — Debug stays on `CODE_SIGN_STYLE = Automatic` in the
committed project, and the profile specifier is inert until `dev-device.sh` supplies UUIDs.

Full diagnosis, including how to create the profiles if none are installed, is in
[`docs/troubleshooting.md`](./docs/troubleshooting.md).

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
- **`--delete-branch` only on a leaf.** Deleting A's branch auto-closes every PR based on it: B goes `CLOSED` with `mergedAt=null` — nothing landed — and it cannot be reopened or retargeted while the base branch is gone (`gh pr edit --base main` fails). Check first:

  ```bash
  gh pr list --state open --json number,baseRefName -q '.[] | select(.baseRefName=="<branch>") | .number'
  ```

  Non-empty → merge **without** `--delete-branch`, or retarget the dependents to `main` first. Merging without it leaves the branch alive and GitHub retargets the dependents to `main` on its own. Recovering a PR closed this way means opening a new one from the same branch. This is what closed #786 on 2026-08-20; it was re-opened as #804.
- **CI gate.** Only squash-merge when required checks are green. If CI is red on a flaky/infra failure, re-run it **once**; if the re-run still fails, stop and report — do not merge red.
- **Stuck cap.** If any single step hangs for more than ~3–4 minutes (CI not progressing, a rebase that won't resolve cleanly), stop and report rather than waiting indefinitely.

---

## Expo MCP (`expo-local`)

Expo MCP is configured **globally** (user scope) for both Claude Code and Codex as `expo-local` — there is no per-project install, and nothing in this repo needs to change to use it.

- It talks to a **locally running Expo/Metro dev server at `http://127.0.0.1:8081`**. Start it first (`npm start -- --port 8081`); without it the MCP tools have nothing to attach to.
- Use it for **screenshots, device/app logs, and verifying UI on the simulator or emulator**.
- **Do not use remote tunneling** (`--mcp-server-url` / `@expo/mcp-tunnel`) unless explicitly asked. Local dev server only.

## Storybook (Laptop, Vite)

`npm run storybook` opens a component catalog at `http://localhost:6006` via
`@storybook/react-native-web-vite`. It is unrelated to Expo Web (`npx expo start --web`,
which boots the full app) — Storybook mounts one component at a time with no app shell,
no notification/SecureStore/biometric bootstrap, no WebSocket. On-device Storybook is
out of scope and not installed. See [`docs/storybook.md`](./docs/storybook.md).

**A story is mandatory for every new component — not optional.** Any new
`components/**/*.tsx` file needs a matching `*.stories.tsx` in the same commit;
`scripts/git-hooks/pre-commit` runs `scripts/check-story-coverage.js` and blocks the
commit if it's missing (exemptions go in `scripts/git-hooks/story-exempt.txt` with a
reason, for the rare component that genuinely can't be storied). When you modify an
**existing** component and adding a story would be small, add it — the hook only warns
on modifications, it doesn't block, so don't treat the warning as permission to skip it.

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

---

## Cursor Cloud specific instructions

The Cursor cloud agent runs on a **headless Linux VM** — there is **no macOS, Xcode, iOS simulator, or Android SDK/emulator**. Plan work around that:

- **Cannot run here:** `npm run ios`, `npm run android`, `expo run:*`, CocoaPods (`bundle exec pod install`), the `ship:*` scripts, and every Maestro E2E flow (`npm run test:e2e:*`). Those all require a Mac or a booted simulator — `e2e/check-sim.js` hard-fails first. Don't attempt them; the native `ios/`/`android/` dirs are committed but not buildable here.
- **The runnable surface is the JS toolchain + Expo Web.** Standard commands (defined in `package.json`, don't duplicate): `npm run lint`, `npm run typecheck`, `npm run test:ci`, `npm run test:scripts`, and the app via **Expo Web** — `npx expo start --web --port 8081`. Lint warnings are allowed; only errors block (see "Lint Before Commit").

**Node version.** Pinned to `.nvmrc` (currently `24.15.0`), installed via `nvm`. The sandbox ships its own `node` on `PATH` (`/exec-daemon/node`, currently v22) that can **shadow** the pinned version in non-login shells. Login/interactive shells (and `tmux`) pick up the pinned Node via a snippet appended to `~/.bashrc`. If `node -v` shows v22 in a given shell, run `source ~/.nvm/nvm.sh && nvm use` (reads `.nvmrc`) before Metro/tests. (Node 22.x also satisfies the repo's stated `>= 22.13` minimum, so most commands work either way.)

**Exercising the core flow on web (no real `tb-streamer`).** The app is a thin client; to reach anything past onboarding it needs a backend. Use the bundled mock streamer: `MOCK_PORTS=7071,7072 node e2e/mock-server.js`. **Gotcha:** the mock server sends **no CORS headers**, so a browser web bundle served from `:8081` cannot call it cross-origin — front it with a tiny CORS-adding reverse proxy (dev-only, keep it outside the repo) and point onboarding at the proxy's URL. Add the server in onboarding (route `/onboarding?mode=add`) with protocol `http`, host = proxy URL, and any non-empty API key **except** the sentinel `wrong-token-000` (which the mock treats as invalid). The session list then populates from fixtures in `e2e/fixtures/`.

**Web is an early spike, not full parity** (see [`docs/expo-web-support.md`](./docs/expo-web-support.md)). Known, expected on web (NOT environment bugs): a dev red-box overlay from `expo-notifications` (`ExpoNotifications.getLastNotificationResponseAsync` via `app/_layout.tsx`) fires on load — dismiss it to use the app; and native-only surfaces (Face ID, camera QR pairing, speech, keyboard-controller, bottom-sheet, the WebSocket-driven live terminal viewer on the session-detail screen) may error or render blank.
