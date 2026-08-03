# Troubleshooting Guide

Collected from fixed bugs, incidents, and session notes. Each section describes a symptom, its root cause, and the fix. Use this before digging into source.

---

## Terminal output / session display

### SSH passphrase prompt appears mid-conversation in the terminal view

**When:** A Claude Code session is started (via `POST /api/sessions/start`) on a Mac where the SSH agent is not running or the key is not loaded. The terminal output in the mobile app shows `Enter passphrase for key '/Users/<you>/.ssh/id_ed25519':` interspersed between conversation lines — visible as raw text in the streaming terminal view.

**What it looks like (mobile):** The session shows `Running · X prompts` but the terminal output contains a passphrase prompt mid-stream, e.g.:

```
Enter passphrase for key '/Users/ronenmars/.ssh/id_ed25519':
  Sonnet 4.6 | ~/Desktop/dev/ai-tools/tb-mobile  fix/ship-branch-sync-check ...
```

**Cause:** The SSH agent (`ssh-agent`) is not running or `SSH_AUTH_SOCK` is not set in the environment inherited by the PTY. When Claude Code (or git inside it) tries to authenticate over SSH, it falls through to directly prompting for the key passphrase. This prompt goes to stdout/stderr of the PTY, which tb-streamer captures and streams to the mobile client verbatim — there is no filtering for interactive passphrase prompts.

The underlying cause is usually one of:
- `~/.ssh/config` has `IdentityAgent` pointing to a stale external agent socket that no longer exists.
- The native macOS SSH agent is running (`com.openssh.ssh-agent` via launchd) but `SSH_AUTH_SOCK` is not exported in the shell, so `ssh-add` and PTY-spawned processes can't find it.
- The key exists but was never added to the keychain — so the agent restarts empty on every reboot.

**Fix (one-time, persists across restarts):**

1. Update `~/.ssh/config` to use the native macOS keychain:

```
Host *
  UseKeychain yes
  AddKeysToAgent yes
  IdentityFile ~/.ssh/id_ed25519
```

2. Start the agent and store the passphrase in Keychain:

```sh
eval "$(ssh-agent -s)"
ssh-add --apple-use-keychain ~/.ssh/id_ed25519
```

Enter the passphrase once — it is stored in macOS Keychain and never prompted again.

3. To ensure the agent starts automatically in every new shell, add to `~/.zshrc` (or the appropriate shell config):

```sh
if ! ssh-add -l &>/dev/null; then
  eval "$(ssh-agent -s)" &>/dev/null
fi
```

**Why this appears in the mobile app:** tb-streamer streams raw PTY output to the mobile client without filtering for interactive prompts. The passphrase request is just another line of terminal output. Once the SSH setup is fixed, it won't appear again — there is no mobile-side workaround.

**Related fix in tb-streamer:** see "SSH passphrase prompt leaks into streamed terminal output" in the tb-streamer troubleshooting guide.

---

## Running on a physical device

### `NativeModule.X is null` on a physical Android device (e.g. `RNCNetInfo is null`)

**When:** After adding or upgrading a *native* dependency, you restart Metro and reload the JS on the phone, but the app throws `NativeModule.RNCNetInfo is null` (or similar for any native module).

**Cause:** Native/JS version mismatch. The phone's installed APK predates the native module, while the fresh JS bundle (served over LAN or the `metro.rbv1000.win` tunnel) calls into it. The tunnel and Cloudflare only serve the JS bundle — never the native APK — so this is **not** a Metro or Cloudflare cache issue.

**Fix:** Rebuild the APK and reinstall it on the device (`npx expo run:android`), not clearing a bundle cache. Full walkthrough, plus HyperOS install gotchas, wireless adb, and log-watching: **[dev-on-physical-device-android.md](dev-on-physical-device-android.md)**. For iOS see **[dev-on-physical-device-ios.md](dev-on-physical-device-ios.md)**.

---

### `Cannot find native module 'ExpoDevice'` + `RNGestureHandlerModule.installUIRuntimeBindings is not a function` on iOS

**When:** On a dev build (Metro), opening the session screen logs `Cannot find native module 'ExpoDevice'` and repeated `RNGestureHandlerModule.installUIRuntimeBindings` / `setGestureHandlerConfig` → `undefined is not a function` (from `react-native-gesture-handler/src/v3/…`). Gestures and animations behave oddly and the screen may load slowly.

**Cause:** The same native/JS skew as the Android case above — the iOS dev-client binary running on the simulator/device predates native modules the fresh JS bundle expects (`expo-device`, and the gesture-handler v3 / Reanimated-4 worklets UI-runtime bindings). `package.json`, `node_modules`, and `ios/Podfile.lock` are all internally consistent; only the *installed binary* is stale. The `installUIRuntimeBindings`/`setGestureHandlerConfig` errors are caught by React Native's microtask shim (logged, not fatal) — they do **not** block the JS thread.

**Fix:** Rebuild and reinstall the iOS dev client (`npx expo run:ios`) — a JS reload is not enough, and this is not a Metro/Watchman cache issue. See **[dev-on-physical-device-ios.md](dev-on-physical-device-ios.md)**.

---

### `Provisioning Profile "iOS Team Provisioning Profile" does not support the App Groups capability`

**When:** `npm run dev:device` (or a bare `npx expo run:ios --device`) fails during "Planning build" with six errors — the app and `ExpoWidgetsTarget` both rejecting `group.com.ronenmars.threadbase` — and `xcodebuild` exits 65. Release builds and TestFlight ships are unaffected.

**Cause:** Xcode's *automatic* signing generates a profile named "iOS Team Provisioning Profile" that does not carry App Groups, and both targets require it. Enabling the capability on the App ID is not enough: automatic signing regenerates its own profile every build and ignores hand-made ones, so the fix has to be manual signing with an explicit profile per target.

That in turn cannot be expressed on the `xcodebuild` command line, because command-line build settings apply to *every* target at once while the app and the widget need different profiles. The project therefore maps them per target via `IOS_PROVISION_PROFILE_UUID` / `IOS_WIDGET_PROVISION_PROFILE_UUID` (`plugins/withLiveActivityTarget.js`), for Debug as well as Release.

**Fix:** you need one development provisioning profile per target, each granting the App Group and including your device. `scripts/dev-device.sh` then discovers them automatically — it scans installed profiles for a development profile (one with `ProvisionedDevices`) whose app-id matches and which grants App Groups — and feeds them to the build through `XCODE_XCCONFIG_FILE`. No per-machine configuration.

If the script reports `signing: automatic — no development profile with App Groups found`, create them. Everything needed is usually already on the account; check first rather than assuming:

```bash
source .env.signing
JWT=$(./scripts/asc-jwt.sh)
curl -sH "Authorization: Bearer $JWT" \
  https://api.appstoreconnect.apple.com/v1/bundleIds/<id>/bundleIdCapabilities   # APP_GROUPS present?
curl -sH "Authorization: Bearer $JWT" https://api.appstoreconnect.apple.com/v1/devices        # device registered?
curl -sH "Authorization: Bearer $JWT" https://api.appstoreconnect.apple.com/v1/certificates   # DEVELOPMENT cert?
```

With those in place, `POST /v1/profiles` with `profileType: IOS_APP_DEVELOPMENT` for each bundle id, referencing the DEVELOPMENT certificate and the devices, then base64-decode `profileContent` into `~/Library/MobileDevice/Provisioning Profiles/<uuid>.mobileprovision`. Verify before rebuilding — a profile missing the group will fail the same way:

```bash
security cms -D -i <profile>.mobileprovision | plutil -p - | grep -A2 application-groups
```

**Note:** Debug stays on `CODE_SIGN_STYLE = Automatic` in the committed project, so a plain simulator build still needs no profiles at all. The specifier is inert until `dev-device.sh` supplies the UUIDs.

---

## Native builds / prebuild

### `expo prebuild` wiped the committed native config (SwiftUICore hook, gradle tuning) — SDK 57+

**When:** You run `npx expo prebuild` (or `expo prebuild --platform ios/android`) by hand on this repo after upgrading to Expo SDK 57, and the next build fails — e.g. the Xcode 26 SwiftUICore link error returns, or Android release builds OOM in R8/lint.

**Cause:** Since SDK 57, `expo prebuild` **defaults to `--clean`**: it clears and regenerates `ios/` and `android/` from scratch. This repo checks those directories into git with hand-maintained native config that prebuild does not reproduce:
- `ios/Podfile` post_install — Xcode 26 SwiftUICore linker workaround.
- `android/build.gradle` — bouncycastle version pins (JitPack metadata-timeout workaround).
- `android/gradle.properties` — `-Xmx6144m -XX:MaxMetaspaceSize=2048m` heap tuning for R8/lint.
- `plugins/withAndroidReleaseSigning.js` re-injects the signing block, but is template-shaped for a specific SDK.

**Fix:** Always run `npx expo prebuild --no-clean` on this repo so it patches the existing folders in place instead of regenerating them. If you already ran a clean prebuild, `git checkout -- ios android` to restore the committed config, then `cd ios && bundle exec pod install` (the `bundle exec` keeps CocoaPods on the Gemfile-pinned 1.16.2 — see [`CLAUDE.md`](../CLAUDE.md) → "Native Dependencies After Package Changes").

**Note:** The `ship-ios.sh` / `ship-android.sh` scripts are unaffected — they only prebuild when the native dir is missing (`[[ ! -d ios ]]`), where there is nothing to clean.

---

## Measuring the wrong thing

Every entry below is the same failure mode, and it is the dangerous one: the run **starts, looks healthy, and measures the wrong thing**. Nothing in the output announces the problem, so a profile or a screenshot taken this way is plausible and wrong. Each has a different cause — the bundle comes from the wrong tree, the bundler is a different process than you think, or the profiler is pointed at the debugger instead of the app — so fixing one does not protect you from the others.

### Metro bundles the main repo instead of your worktree

**When:** You create a worktree (per [`CLAUDE.md`](../CLAUDE.md) → "Worktrees — Always Outside the Repo Root"), point its `node_modules` at the main checkout with a symlink to save time, then `npx expo start` from the worktree. The app loads, Metro reports a successful bundle, and none of your changes are in it.

**Cause:** Metro resolves the project root *through* the symlink and lands in the main checkout, so it serves that tree's app code. The only tell is in `.expo/dev/logs/start.log`:

```
# wrong — resolved through the symlink into the main repo
{"_e":"metro:bundling:started", ... "entry":"../../tb-mobile/node_modules/expo-router/entry.js"}

# right — resolved inside the worktree
{"_e":"metro:bundling:started", ... "entry":"node_modules/expo-router/entry.js"}
```

**Fix:** Give the worktree a real `node_modules`. On APFS `cp -Rc` clones it in ~20 s and costs no extra disk:

```bash
cp -Rc ../../tb-mobile/node_modules ./node_modules
```

A symlink is still fine for Jest — only Metro follows it into the wrong root.

### `simctl launch` opens the dev-launcher, not the app

**When:** You install a `Debug-iphonesimulator` build and `xcrun simctl launch com.ronenmars.threadbase`. You get the Expo **dev client**'s server-picker rather than Threadbase, so an automated run that looks started never started.

**Fix:** Deep-link straight to the bundle, taking the LAN host from the launcher row (the dev client records the LAN address, not `localhost`):

```bash
xcrun simctl openurl <SIM_UDID> "threadbase://expo-development-client/?url=http%3A%2F%2F<LAN_IP>%3A8081"
```

### Another Metro already holds the default port — you are served someone else's branch

**When:** You `npx expo start` from your worktree and it prints `Port 8081 is running threadbase-mobile in another window` followed by `Skipping dev server`. In non-interactive shells the "use another port instead?" prompt cannot be answered, so **no dev server of yours starts at all** — but the occupied port keeps serving, the app loads, and you are looking at whatever branch that other Metro was launched from.

**Cause:** Concurrent sessions. Worktrees make it normal to have several checkouts, and every one of them defaults to the same port.

**Fix:** Never assume the bundler on the default port is yours. Check which project it belongs to before trusting anything it serves:

```bash
grep -E "Skipping dev server|is running .* in another window" <your metro log>
curl -s localhost:8081/status   # packager-status:running — says nothing about whose
```

Start yours on an explicit free port (`--port 8082`) and point the dev client at that port in the `expo-development-client` deep link above. Leave the other Metro alone unless you know whose it is — it may belong to another session.

### The profiler is recording the debugger UI, not the app

**When:** You open React Native DevTools in a browser tab and then start a recording — and get a plausible profile whose Main track is `rn_fusebox.html`, with browser-extension frames and warmup entries in the 3rd-party table.

**Cause:** Chrome's own profiler was opened *on the DevTools tab*. The subject is the DevTools page, not the Hermes runtime on the device.

**Fix:** Open RN DevTools attached to the device — press `j` in the Metro terminal — and record from that window's Performance panel. Sanity-check the Main track names a frame you recognise from the app before reading any number off it.

**Note:** driving the Hermes profiler over CDP directly does not currently work here. `ws://localhost:<port>/inspector/debug?device=…&page=…` accepts the socket (with `Origin` set to the dev server, else it 401s) and then never answers `Runtime.enable` or `Profiler.enable`, on either a live or a stale page id.

### A repeated `simctl openurl` loop measures a screen stack you built, not the app

**When:** You benchmark a screen by opening it in a loop — `xcrun simctl openurl threadbase://` to get back to the hub, then `xcrun simctl openurl threadbase://conversation/<id>` to open it again — and each successive run is slower than the last.
The first is fast, the sixth takes seconds, and the escalation looks like a leak in the screen under test.

**Cause:** the `threadbase://` half. A deep link to the **root** route pushes a *duplicate* hub instead of returning to the existing one, and nothing pops it.
After six iterations the stack holds six live `ProjectsHub` instances, each still subscribed to `sessions-eager` and each re-rendering its full session list on every query and store update.
Leaf routes are fine — an identical URL is deduped, a different `[id]` swaps params on the existing screen, and alternating two leaf patterns holds at depth ≤ 2 ([measured](./conversation-open-profile.md#the-navigation-stacking-candidate-is-dead)). It is specifically returning to the root by URL that accumulates.
The screen you are timing is queued behind all of them.
Nothing errors, every individual screen behaves correctly, and the timings are real measurements of a state no user can reach.
This is what made [`conversation-open-profile.md`](./conversation-open-profile.md) wrong for three sessions.

**Fix:** pop the screen between iterations instead of re-pushing its parent, and assert the live count rather than assuming it.
`useLiveInstanceCount` in [`lib/openTrace.ts`](../lib/openTrace.ts) logs a `[live]` line on every mount and unmount with the running total — if it climbs past 1, stop and fix the harness before reading any number under it.
[`e2e/perf/conversation-open-loop.yaml`](../e2e/perf/conversation-open-loop.yaml) is the working shape: deep-link in, tap the header back button, repeat.

Tapping the header back button unmounts correctly, so that path does not stack. The app's own `router.push` on notification taps, `session_ready` events and cold-start deep links all target `/session/<id>` — a leaf route, which [does not accumulate](./conversation-open-profile.md#the-navigation-stacking-candidate-is-dead). This trap is the harness's, not the app's.

**A harness invariant only covers what you thought to name.** The `[live] == 1` check above is correct, and it passed on a run that was worthless: the machine sat at load 7.5–9.9 across 10 cores, so the simulator's JS thread was starved rather than busy, and any instrument built on timer lateness reports that as app work. The load was not the app and not the server it talks to — it was **the apparatus running the investigation**: several concurrent agent sessions, a terminal rendering their output, a bundler and a simulator on one box (57 `claude` processes, 218 `CoreSimulator` processes, 148 leftover `node`/`vitest`). Count processes rather than trusting load average, which reads as unremarkable right up until one simulator turns out to be 218 of the runnable things. Sample during the window, more than once — a single reading catches a peak and reads it as a level.

**The general form, and the reason this entry exists:** an unattended harness is code, and code nobody tested measures whatever it happens to do rather than what it was meant to do. This rig was a deliberate, sensible choice — scripted `openurl` is the only way to drive repeated opens with nobody watching — and it was specified by the same person who wrote the rule about verifying what you are measuring. That is not a contradiction. The rule is habitually applied to the thing under test, and the apparatus is not usually thought of as being under test. It should be: before comparing runs, give the harness one invariant that must hold on every run (live screen count, open handles, cache size, row count) and check it, because otherwise drift in the rig gets absorbed by whichever hypothesis is current and reads as evidence for it.

---

## Windows dev machine

### `spawn npx ENOENT` when running `npm run dev:metro` / `dev:android:js` on Windows

**When:** Running `npm run dev:metro` (or `dev:android:js`, which wraps the same `scripts/dev-metro.js`) on Windows throws immediately:

```
Error: spawn npx ENOENT
    at ChildProcess._handle.onexit (node:internal/child_process:287:19)
  errno: -4058,
  code: 'ENOENT',
  syscall: 'spawn npx',
```

**Cause:** `scripts/dev-metro.js` calls `spawn('npx', args, {...})` without `shell: true`. Node's `spawn()` talks directly to the Windows `CreateProcess` API and doesn't resolve `.cmd`/`.bat` shims — `npx` on Windows is `npx.cmd`, not a raw executable. `exec()` always goes through `cmd.exe` so it works; bare `spawn()` doesn't unless the shell is explicitly requested.

**Fix (workaround, no code change needed):** Skip the wrapper script and run Expo directly, setting the tunnel URL in the same shell so the child process inherits it:

```powershell
$env:EXPO_PACKAGER_PROXY_URL = "https://<your-tunnel-hostname>"
npx expo start --dev-client
```

### Fresh Windows checkout: `PluginError: Failed to resolve plugin for module "..."` on `expo start`

**When:** On a freshly cloned/pulled Windows checkout, `npx expo start` fails immediately with something like:

```
PluginError: Failed to resolve plugin for module "expo-local-authentication" relative to "<repo>". Do you have node modules installed?
```

even though the package is listed in `package.json` and `package-lock.json`.

**Cause:** The package is missing from `node_modules` despite being present in the lockfile — `npm ls <package>` shows it as absent (`node_modules` had drifted out of sync with the lockfile from an earlier partial/incomplete install).

**Fix:** `npm install` to reconcile `node_modules` with the lockfile, then retry `expo start`.

---

## Jest test suites

### `SessionScreen.*` suites fail in a batch but pass one at a time

**When:** Running the integration suites together — `npx jest`, `npm run test:integration`, or `npx jest --testPathPattern "SessionScreen"` — several `SessionScreen.*` suites fail, but re-running any one of them alone passes. The reported errors are often unrelated to each other and shift between runs.

**Cause:** Those suites each render the full session screen with fake timers, WebSocket stubs and long backstop timeouts, so they are heavy. Jest's default parallel workers oversubscribe the machine and the slower workers miss timing-dependent assertions. This is environmental, not a defect in the code under test.

**Fix:** Verify them serially:

```bash
npx jest --ci --runInBand --testPathPattern "SessionScreen"
```

**The trap runs both ways — do not use this to wave failures away.** A batch failure can be a load artifact *or* a real defect, and they look identical in the batch output. Always confirm by re-running the single suite in isolation:

- Passes alone → load artifact, ignore it.
- Fails alone → real defect, fix it.

During the 2026-07-22 integration snapshot, four genuinely broken suites were nearly dismissed as flakes on this basis, while two others really were load artifacts. Only the isolation re-run distinguished them.

### Suites known to be load-sensitive

These pass in isolation and on a green full run, but can fail under a loaded parallel run. Re-check in isolation before investigating:

| Suite | Typical symptom |
|---|---|
| `__tests__/e2e/feedback-flow.test.tsx` | exceeds the 5 s per-test timeout (also fails on `main`, Windows only) |
| `__tests__/unit/components/servers/CacheAlertModal.test.tsx` | assertion timeouts |
| `__tests__/integration/conversation-live-view.test.tsx` | streamed-event assertions |
| `__tests__/integration/conversation-detail-gating.test.tsx` | render timeouts |
| `__tests__/integration/conversation-search-anchor.test.tsx` | render timeouts |

### `npx jest` reports "No tests found" in a git worktree

**When:** A worktree created under `.claude/` (e.g. `.claude/worktrees/<name>`) reports `No tests found` with `0 matches`, and scripts like `npm run test:i18n` look broken even though they work in the main checkout.

**Cause:** `jest.config`'s `testPathIgnorePatterns` excludes `\\.claude\\`, so every test path inside such a worktree is filtered out. Nothing is wrong with the test or the script.

**Fix:** Create worktrees **outside** `.claude/` — e.g. `worktrees/<name>` alongside the repo. To run in place anyway, override the ignore list:

```bash
npx jest --testPathIgnorePatterns "/node_modules/"
```

Note that the override also re-enables `__tests__/unit/scripts/`, which the main config excludes deliberately (it runs under `jest.config.scripts.js` via `npm run test:scripts`) and which fails on Windows. Ignore those failures.

Each worktree needs its own `npm ci` — jest resolves modules from the worktree root, not the main checkout.

### `npx jest` hangs with no output in a fresh worktree

**When:** The first `npx jest` run in a newly created worktree prints nothing at all — no `PASS`, no `FAIL`, not even a suite header — and stays that way for tens of minutes. `npx jest --listTests` in the same worktree answers instantly, so discovery and module resolution are fine.

**Cause:** watchman. A new worktree is an unknown root, so watchman crawls it from scratch, and jest blocks on that crawl before running anything. The tell is that the jest process sits at **0% CPU** with a couple of seconds of accumulated CPU time — it is waiting, not working:

```bash
ps -o pid,etime,time,%cpu -p $(pgrep -f "[j]est" | tr '\n' ',' | sed 's/,$//')
```

An elapsed time of minutes against a `TIME` of seconds means the crawl, not a slow suite. `--listTests` on the same worktree returns immediately and prints watchman's own recrawl warning, which is what names the culprit.

**0% CPU on its own does not name watchman.** A suite that finished and left an open handle idles exactly the same way, and `--watchman=false` does nothing for it — see the next entry. What separates them is whether jest printed anything before going quiet: no output at all is the crawl, a complete `PASS` / `Tests:` summary followed by silence is an open handle. Check that first, because the two remedies do not overlap.

**Fix:** skip watchman — jest falls back to its own crawler, which is fast enough here:

```bash
npx jest --ci --runInBand --watchman=false --testPathPattern "<suite>"
```

The warning also suggests clearing watchman's state for the path (`watchman watch-del <worktree> ; watchman watch-project <worktree>`); that route is untried here, and `--watchman=false` needs no daemon interaction, which makes it the safer default in a throwaway worktree.

### `npx jest` finishes a passing run and then never exits

**When:** The suite reports `PASS` and a full `Tests:` summary, and then the process just sits there at **0% CPU** — the same tell as the watchman crawl above, which is what makes this one easy to misdiagnose. Left running it looks like a hang, and `--watchman=false` does not help because watchman was never involved. Jest says so itself, below the summary where it is easy to scroll past:

```
Jest did not exit one second after the test run has completed.
```

**Cause:** an open handle — a timer, socket or subscription a test left running. The run is complete and its results are valid; only teardown is stuck. This is not one bad suite: on 2026-08-02, `conversation-detail-gating`, `SessionCard` and `conversation-resume-collision` all did it on an unmodified `main`, while the pure-unit `resumeSession-cache` exited immediately. Assume any integration suite that renders a component can do this.

**Fix:** `--forceExit`. Everything printed above the hang is real, so the run can be trusted:

```bash
npx jest --ci --runInBand --forceExit <suite>
```

`--detectOpenHandles` names the culprit if you want to fix the leak rather than work around it, but it serialises the run, so keep it for diagnosis rather than routine use.

**Why this matters beyond the annoyance:** a batch run that hangs after some suites have already passed is easy to kill and read as "the suite hangs", which is how a passing run gets recorded as a failure. Scroll up before concluding anything — the summary is usually already there.

---

## CI signals

Every entry here is a case where the signal is misleading rather than the code being wrong — CI or `gh` reports something that looks conclusive and is not.

### A green PR whose CI ran nothing (`[skip-ci]`)

**When:** The required checks on a PR go green in seconds instead of minutes, and you take that as proof the merge is safe.

**Cause:** `.github/workflows/test.yml` greps the head commit subject and the PR title for the bracketed `[skip-ci]` tag and skips the heavy step, while still *reporting* every required context as success. It has to report success — a job skipped via a job-level `if:` reports "skipped", which never satisfies a required check and would leave the PR permanently un-mergeable. The `commit-msg` hook adds `[skip-ci]` automatically to any commit touching none of the paths in `scripts/git-hooks/ci-paths.txt`, so this arrives without anyone opting in. See [`ci-significant-paths.md`](./ci-significant-paths.md).

**Fix:** Judge the run, not the badge. A real `Type check` takes minutes; seconds means nothing executed. Before trusting green on a merge that matters, confirm the PR title does not carry `[skip-ci]`. For a push run, check the head commit subject instead. If the relevant title or subject is tagged, remove the tag and trigger a fresh run rather than reasoning about whether the skip was harmless.

**The trap inside the trap (historical):** the gate used to search the commit message **plus the PR title and body**, matched with a literal `grep -F`. So *writing* the bracketed tag anywhere in a PR description skipped that PR's suite — including in a sentence explaining that the suite should not be skipped. This is not hypothetical: PR #474, whose purpose was correcting claims about this gate, skipped its own run that way, and PR #525 had to avoid reproducing the literal tag in its own body for the same reason. The gate was narrowed to only the commit subject and the PR title — never either body — precisely to close that hole, so a PR can now discuss or quote the tag freely in its description without tripping the skip.

### A PR *can* test its own workflow change — `pull_request` runs the head's file

**When:** You change something in `.github/workflows/` and cannot tell whether the PR's own CI run exercised the new version or the one still on `main`. It decides whether the change is verified before merge or only after.

**Cause:** Not a failure — a fact worth knowing, because guessing it wrong in either direction is expensive. A `pull_request` event evaluates the workflow from the **PR head**, not from the base branch. So a workflow edit takes effect on the very PR that introduces it, and you can prove a CI change works before merging it.

**Evidence, rather than the docs:** PR #529 narrowed the `[skip-ci]` gate to the commit subject and PR title. Its own `Gate` step ran while `main` still carried the old three-source version, and the job log shows the *new* script executing, with `PR_BODY` absent from the step's `env:` block entirely:

```
Run commit_subject="${HEAD_COMMIT_MSG%%$'\n'*}"
    haystack="${commit_subject}
    ${PR_TITLE}"
env:
  HEAD_COMMIT_MSG:
  PR_TITLE: fix(ci): scope the skip-ci gate to the commit subject and PR title
```

That version existed only on the PR branch at the time.

**How to check it yourself for any workflow change:** read the job log, not the summary. `gh run view <run-id> --log` prints each `run:` block verbatim along with its resolved `env:`, so you can see which version of the script executed and what inputs it was given. The `env:` block is the stronger signal of the two — an input that is absent cannot be matched, which is a structural guarantee rather than a behavioural one.

**Corollary:** a workflow change that lands unverified did not have to. If a CI edit is worth making, its own PR is the place to prove it.

### A stacked PR looks un-CI'd but isn't

**When:** A PR whose base is another feature branch rather than `main`, where you assume CI didn't really run and verify locally instead.

**Cause:** The opposite of the usual setup. `test.yml`'s `pull_request` trigger has **no `branches:` filter**, so it fires for a PR targeting any base branch. Stacked PRs get the same `Type check` / `Unit tests` / `Integration tests` / `Lint` / `i18n` run as anything targeting `main`.

**Fix:** Trust the checks — but read them, since this depends on the trigger staying unfiltered. If `test.yml` ever gains a `branches:` filter on `pull_request`, this reverts and stacked PRs really would need local verification.

### A non-zero `gh pr merge` says nothing about whether the merge happened

**When:** You squash-merge and `gh` exits non-zero. Both of these occurred on 2026-08-03, hours apart, and they point in **opposite directions**:

| Error | Merge actually… | `gh pr view --json state` |
| --- | --- | --- |
| `failed to run git: fatal: 'main' is already used by worktree at '…/tb-mobile'` | **succeeded** | `MERGED`, with a `mergeCommit` |
| `GraphQL: Base branch was modified. Review and try the merge again.` | **did not happen** | `OPEN`, `mergeCommit: null` |

**Cause:** `gh pr merge --delete-branch` does two things — a GitHub API call, then local cleanup — and returns one status for both. The worktree error is the *second* phase failing after the first succeeded: `--delete-branch` tries to check out the base branch, and `main` is held by the primary worktree, so no other worktree may take it. The remote branch is deleted; only the local switch fails. The base-branch error is the *first* phase failing because `main` moved between your rebase and the merge call.

**Fix:** Confirm against the artefact, never the exit code:

```bash
gh pr view <N> --json state,mergedAt,mergeCommit
```

If it merged, finish the cleanup by hand from the worktree:

```bash
git checkout --detach <merge-sha> && git branch -D <branch>
git fetch origin --prune
```

If it did not, re-fetch, rebase onto the new `origin/main`, wait for the CI re-run the force-push triggers, and merge again.

**Why this entry is a law rather than a caution.** With one instance it reads as "this command sometimes lies in a known direction", which is still actionable by adjusting your reading of it. With two instances pointing opposite ways, the exit status is not biased — it is **uninformative**. That is worse than having no signal, because a status that is right about half the time still looks like evidence, and will be read as evidence under time pressure. The general rule: when a command does two things and returns one status, that status is a summary you cannot invert. Ask the system what state it is in.

---

## iOS Simulator console noise

### `CHHapticPattern` / `CHHapticEngine` "hapticpatternlibrary.plist" errors flooding the log

**When:** Running the app in the iOS Simulator, the console fills with repeated `[CoreHaptics] CHHapticPattern.mm:487 +[CHHapticPattern patternForKey:error:]: Failed to read pattern library data` / `UIKBFeedbackGenerator: Error creating CHHapticPattern` errors whenever a haptic feedback call fires (e.g. `Haptics.impactAsync()`).

**Cause:** The Simulator doesn't ship the `hapticpatternlibrary.plist` that real devices have for the Core Haptics pattern library. Any `UIFeedbackGenerator` call hits this and logs the failure, but it's silently swallowed — no crash, no visible effect on the app. Simulator-only; doesn't happen on a real device (which has the physical Taptic Engine's pattern library).

**Fix:** None needed — don't add app code to suppress it. If it's genuinely annoying during dev, filter it at the terminal/log level instead: pipe `xcodebuild`/`simctl log stream` output through `grep -v CHHapticPattern` locally rather than touching the app.

---
