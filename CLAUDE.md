# Threadbase Mobile — Claude Instructions

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

**The extracted const must hold `t()` calls, not literals.** Extracting a literal only moves it; it does not translate it, and for a long time it also hid the string from `i18next/no-literal-string`, which used to inspect JSX and nothing else. That is how 138 hardcoded strings accumulated behind a rule that reported none of them — see [`docs/followups/mobile/09-i18n-guardrails.md`](./docs/followups/mobile/09-i18n-guardrails.md).

```tsx
// bad — inline, and untranslated
placeholder={isWakingUp ? (isResume ? 'Picking up…' : 'Starting up…') : 'Send input…'}

// also bad — extracted, still untranslated
const inputPlaceholder = isWakingUp ? 'Starting up…' : 'Send input…'

// good
const inputPlaceholder = isWakingUp
  ? (isResume ? t('composer.resuming') : t('composer.starting'))
  : t('composer.sendInput')
// ...
placeholder={inputPlaceholder}
```

One gap the rule still has: a **module-scope** `const` is not inspected, only function-scope ones. A literal parked at the top of a file stays invisible, so put UI copy in a locale file rather than a module constant.

---

## Keep Translation Keys at the Presentation Boundary

For a finite domain, application state and data carry semantic values, not i18next keys. Resolve the semantic value with an exhaustive switch whose branches call literal `t('namespace:key')` expressions at the nearest presentation boundary.

```tsx
// bad — the analyzer loses the real usage across metadata, state, and props
const options = [{ value: 'newest', labelKey: 'servers:filter.newestFirst' }] as const
const [selected] = useState(options[0])
return <Text>{t(selected.labelKey)}</Text>

// good — state remains semantic and every real key is visible in the AST
function getSortOrderLabel(order: 'newest' | 'oldest', t: TFunction<'servers'>) {
  switch (order) {
    case 'newest':
      return t('filter.newestFirst')
    case 'oldest':
      return t('filter.oldestFirst')
  }
}
```

Apply the same rule to helper return values, component props, arrays, and generic option records. Keep localization out of domain/business helpers; put the exhaustive translation resolver in the nearest UI utility or component and call it during render so language changes remain reactive.

Do not use `preservePatterns`, wildcard preservation, fake or unreachable `t()` calls, comment-only extraction, or a static-usage manifest to compensate for finite-key indirection. Those mechanisms can make stale keys look used. `npm run test:i18n` runs both `i18next-cli status` and `status --unused`, so missing, incomplete, and genuinely unused locale entries must continue to fail CI. See [`docs/followups/mobile/09-i18n-guardrails.md`](./docs/followups/mobile/09-i18n-guardrails.md).

---

## No `unknown` or `any` Without Explicit Permission

Never introduce `unknown` or `any` in new code without the user's explicit approval. If a type boundary genuinely requires one, stop and ask — don't default to it as a workaround for a type error.

Prefer:
- Proper interface/type definitions
- Type guards with `typeof` / `instanceof` narrowing
- Generics

---

## Encryption (E2EE) — Never Fall Back to Plaintext

A server record carrying `serverPublicKey` is **pinned**. Its WebSocket frames and REST bodies are sealed, and no failure may be handled by retrying in the clear. Full notes, including the traps found on hardware: [docs/e2ee-client.md](docs/e2ee-client.md).

Rules that hold regardless of what a screen wants:

- **Classification is the contract.** `retryable` (`services/e2ee/context.ts`) is true for exactly `E2EE_CTX_UNKNOWN` and `E2EE_TRANSIENT`. `E2EE_DEVICE_REVOKED`, `E2EE_HANDSHAKE_FAILED` and the rest are permanent — surface them, never loop on them. A `429` that arrives after a permanent refusal is the server reacting to our own retries; it must not reset the verdict.
- **Binary means binary.** React Native hands sealed frames over as `ArrayBuffer`; convert to `Uint8Array` before unsealing. A string frame on a sealed socket still throws — do not widen the accepted shape to make an error go away.
- **A missing message 2 is a failed pairing.** Not a plaintext success, however tempting the fallback looks. This is the rule that saved a user whose streamer sat behind a Cloudflare Access gate.
- **Contexts are never rekeyed in place.** A new key is a new context. Socket contexts die with the socket; the REST context rolls over on 24h / 1 GiB / every foreground and drains for 10 s.
- **Reconnect loops are not free any more.** Each redial now costs a Noise handshake against a five-per-minute-per-device server limit. Before adding or shortening a timer that reconnects, work out what it costs at idle.

## Lint Before Commit

Before every `git commit`, run ESLint on the files being committed:

```bash
npx eslint <staged-files>
```

Get the staged file list with `git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(ts|tsx|js|jsx)$'`. If there are no JS/TS staged files, skip. Fix any errors before committing — warnings are allowed through.

`i18next/no-literal-string` runs at **`error`**, so a hardcoded user-facing string fails the commit and the CI Lint job. `scripts/git-hooks/pre-commit` reports only that rule's findings on staged files, because an unfiltered run surfaces 266 pre-existing errors from unrelated rules and buries the one line that matters.

If a flagged string is technical rather than copy — a URL fragment, a CLI flag, an enum discriminant — extract it to a const with an `eslint-disable-next-line` and a comment saying why. Do not translate it, and do not add a blanket file exclusion for a file that also holds real copy.

---

## Native Dependencies After Package Changes

Whenever `package.json` or `package-lock.json` changes:

1. Run `bundle exec pod install` from the `ios/` directory — never a bare `pod install`.
2. Commit `package.json`, `package-lock.json`, and `ios/Podfile.lock` together.

**Always `bundle exec`.** The `Gemfile` pins CocoaPods to 1.16.2 so local installs match `pod install --deployment` in deploy CI. A Homebrew CocoaPods on `PATH` shadows that pin, and a bare `pod install` run against it rewrites the `COCOAPODS:` line in `ios/Podfile.lock`, which then flips back the next time CI or a `bundle exec` user regenerates it.

**Four checksums are path-dependent and are not yours to commit.** `ExpoModulesCore`, `ExpoWidgets` and `hermes-engine` generate their podspecs at install time and bake the checkout's absolute path into them (`HERMES_CLI_PATH`, the precompiled `ExpoModulesCore` tarball `file://` URL, the `ExpoWidgets` bundle copy script), and `RNSentry` behaves the same way. A pod's `SPEC CHECKSUM` is the SHA1 of its generated podspec, so those four values differ for every worktree, every machine and every CI runner — `bundle exec` does not stabilise them. Committing them is what makes `ios/Podfile.lock` ping-pong between whoever ran `pod install` last, and is the usual source of `ExpoWidgets`/`hermes-engine` checksum conflicts on rebases.

`scripts/reset-podfile-lock-path-noise.sh` reverts `ios/Podfile.lock` when those four lines are the *only* drift (a genuine pod change also moves that pod's version line, so it is left alone). The `pre-commit` hook runs it whenever `ios/Podfile.lock` is staged, so the noise never reaches a commit, and the ship and deploy pipelines run it right after `pod install`.

**Never hand-revert the lockfile with `git checkout -- ios/Podfile.lock`.** `pod install` writes the same bytes to `ios/Podfile.lock` and to `ios/Pods/Manifest.lock` (gitignored), and Xcode's `[CP] Check Pods Manifest.lock` phase diffs the two on every build — restoring one without the other fails the archive with `error: The sandbox is not in sync with the Podfile.lock` even though the installed pods are correct. That is what broke deploy runs [31430505715](https://github.com/RonenMars/threadbase-mobile/actions/runs/31430505715) and [31436408481](https://github.com/RonenMars/threadbase-mobile/actions/runs/31436408481) on 2026-08-10. The script keeps both files in step; use it instead.

**`ios/Threadbase.xcodeproj/project.pbxproj` is the opposite case — commit it.** `pod install` re-serialises the whole project file through the `xcodeproj` gem, so any entry written by another tool (`expo prebuild`, a hand-edit, an Xcode UI change) comes back rewritten into the gem's canonical form: sections in its own order, dict keys reordered, `isa = "Foo"` unquoted to `isa = Foo`, object IDs sorted within a section. The diff looks alarming and is usually semantically empty — but it is **not** path-dependent noise, and reverting it only means the next person's `pod install` regenerates the same diff. Commit it once and it stops: re-running `pod install` against an already-canonical file is a byte-for-byte no-op. Before committing one, confirm that — run `pod install` a second time and check the file's checksum is unchanged. If the second run keeps moving it, something real changed and the reordering is not the whole story.

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

## Storybook (Laptop, Vite)

`npm run storybook` opens a component catalog at `http://localhost:6006` via
`@storybook/react-native-web-vite` — **not** the same thing as Expo Web above. Storybook
mounts one component at a time (no `app/_layout.tsx`, no notification/SecureStore/
biometric bootstrap, no WebSocket); Expo Web boots the full app. Config lives in
`.storybook/` (Vite-based); on-device Storybook (`@storybook/react-native`, Metro
`withStorybook`) is out of scope and not installed. See
[`docs/storybook.md`](./docs/storybook.md).

Co-locate `Component.stories.tsx` next to the component, CSF3 style. The global decorator
in `.storybook/preview.tsx` wraps every story in the real `ThemeProvider`, driven by a
theme toolbar that writes directly to `useSettingsStore` (no mocking layer) — so stories
using `useTheme()` work unmodified. Don't story screens, navigation, camera, SecureStore,
biometrics, notifications, or the bottom sheet; those need the full app shell.

**A story is mandatory for every new component, not optional.** Any new file under
`components/**/*.tsx` must ship in the same commit as a matching `*.stories.tsx` —
`scripts/git-hooks/pre-commit` runs `scripts/check-story-coverage.js` and **blocks the
commit** if it's missing. If a component genuinely can't be storied (native-API-only,
a screen-sized composition), list its path in `scripts/git-hooks/story-exempt.txt` with
a reason instead of skipping the hook. For an **existing** component you modify, add a
story too when doing so is genuinely small — the hook only warns for modifications, it
doesn't block, because judging "small effort" is a call for whoever's making the change,
not something a hook can decide. Don't let that warning become a reason to skip it by
default.

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

## Simulators and Emulators — Shut Down What You Booted

Any iOS simulator or Android emulator booted during a session (by Maestro, `expo-local`, `simctl`, `emulator`, or a dev-client launch) is shut down before the session ends or hands off — an idle simulator left showing the app against a dead server is a leftover, not a deliverable. For iOS, `xcrun simctl shutdown <UDID>` (or `all`) and quit `Simulator.app` when `xcrun simctl list devices booted` is empty; for Android, `adb -s <serial> emu kill`. Never erase a device as part of teardown. A simulator that was already booted when the session started is left as found — but "found that way" needs a record (the `xcrun simctl list devices booted` output from the start of the session), not the absence of one.

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

## Issue status updates

Any change traceable to an existing issue ends with a status update on that issue — code, docs, tests, config, a revert, or a deletion all count. The issue is the record; a commit message, a PR body, or a chat reply is not a substitute.

- **Completed** — close the issue, with a comment naming what landed and where (PR or commit).
- **Partly completed** — leave it open and comment with what is done, what remains, and anything the remainder now depends on.
- **Not done** — leave it open and comment with why: blocked, superseded, out of scope, or a precondition that has to change first.

Never close an issue that was not actually finished, and never leave finished work with the issue still open. If one change resolves several issues, update each of them.
