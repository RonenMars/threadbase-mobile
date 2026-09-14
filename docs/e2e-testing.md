# E2E Testing with Maestro

This document describes the E2E (end-to-end) testing setup for tb-mobile using Maestro.

## Overview

We use [Maestro](https://maestro.mobile.dev/) for automated E2E testing on iOS and Android. Tests are written in YAML and interact with the app through testIDs and UI elements.

## Android CI

The `E2E` GitHub Actions workflow defaults to Android and runs on `ubuntu-24.04` with Android API 35 Google APIs `x86_64` `pixel_6` emulators and Maestro CLI 2.8.0.
One job assembles the Release APK and caches it for the exact tested SHA plus the executing workflow revision.
Three parallel emulator jobs download that APK, install it with `adb`, and each run a duration-weighted shard of `test:e2e:mock` through `e2e/run-maestro.js`.
iOS is the same shape on `macos-26`: one arm64-only `xcodebuild` job, then three simulator shards.
Shard assignment uses historical flow seconds from `e2e/mock-suite-durations.json`.
Those estimates are labeled as historical weights in the job summary and are not suite membership.
A `flows=` dispatch stays on one shard in the supplied order.
`npm run test:e2e:mock` remains the sequential local pass and still uses the full `package.json` list.
The workflow disables Sentry source-map upload and uses the committed debug keystore only for this simulator APK, so it does not need production Sentry or signing credentials.

The Android emulator reaches the runner-hosted mock server at `10.0.2.2`, while local iOS runs use `localhost`.
The Android preflight checks emulator readiness and API level.
Explicit `E2E_PLATFORM=android` skips the delayed XCTest crash-report wait in `e2e/run-maestro.js`; iOS and callers that omit the variable still wait.
Manual dispatch also provides `platform=ios` to run the macOS/iOS workflow.

### Binary cache versus compiler cache

The Android APK and iOS `e2e-ios-app.tgz` caches are exact-match only.
Their keys include the tested SHA (`-f ref=`), the executing workflow revision (`--ref` / `github.workflow_sha`), and on iOS the recorded Xcode build number.
They have no `restore-keys`, so a different commit cannot install another revision's app.
A binary cache hit skips Node, CocoaPods, Ccache, DerivedData, and native compilation.

Ccache and DerivedData are a separate layer.
They restore with same-toolchain and architecture prefixes so a new tested SHA can reuse compilation, then save a new snapshot under that SHA.
Do not treat a warm compiler cache as proof that the exact tested binary was reused.

### Reproducing a miss or a hit

`--ref` selects the workflow file.
`-f ref=` selects the tested source.
Actions caches are scoped to the workflow branch, so a warmup and a later dispatch of the same commit must use the same `--ref`.

```bash
# Workflow file and tested source from the same published branch.
gh workflow run E2E --ref "$E2E_WORKFLOW_REF" -f ref="$E2E_TEST_SHA" -f platform=ios
```

A second dispatch of that same pair should hit the binary cache and skip native compilation.
A different tested SHA misses the binary cache.
A workflow-only change (for example a comment in `e2e.yml`) changes `github.workflow_sha` and misses the binary cache while native caches may still restore.

The concurrency group `e2e-${{ inputs.ref || 'schedule' }}` serializes dispatches for the same target, including separate Android and iOS inputs.
Standard hosted runners are free for this public repository, including `macos-26`.
GitHub's documented Free/Pro/Team Mac concurrency maximum is five jobs; three iOS shards plus the iOS build job can fill that budget while other Mac workflows wait.

Lightweight Maestro output under `e2e/_artifacts/maestro-output/` is uploaded per platform and shard on success and failure with one-day retention.
Full screenshots and debug artifacts still upload on failure only.

## Prerequisites

1. **Install Maestro:**
   ```bash
   brew install maestro
   ```

2. **iOS Simulator:** Must be booted before running tests
   ```bash
   xcrun simctl list devices booted
   ```

3. **Build the app:** `npm run ios` skips the Expo Dev Launcher screen (via `launchMode: "most-recent"` in `app.json`) and boots straight into the app
   ```bash
   npm run ios
   ```

## Test Files

### Demo Server Connection Test

**File:** `e2e/demo-server-connect-only.yaml`

**Purpose:** Tests the complete onboarding and session creation flow using the public demo server.

**What it tests:**
1. ✅ Onboarding flow (5 steps: Language → Welcome → Connect → Notifications → Done)
2. ✅ Manual credential entry (clearing pre-filled values)
3. ✅ Demo server connection (URL from `DEMO_SERVER_URL` env var)
4. ✅ Session creation via Browse modal
5. ✅ Sending a message ("What is 2+2?")
6. ✅ Terminal output rendering
7. ✅ Info modal open/close
8. ✅ Navigation back to hub
9. ✅ Finding session in list (first-session-card)
10. ✅ Re-entering session (conversation history view)

**Credentials used:**
- Server URL: from `DEMO_SERVER_URL` in `.env.demo` (gitignored)
- API Token: `tb_public_demo_reviewer_key`

### Mock Server Tests

**File:** `npm run test:e2e:mock`

Runs a suite of tests against a local mock server on port 7071/7072. Tests include:
- `e2e/launch.yaml`
- `e2e/browse.yaml`
- `e2e/bug6_bottom_bar_inset.yaml`
- `e2e/pty_turn_divider.yaml`
- `e2e/feat1_tree_drill_new_session.yaml`
- `e2e/feat2_export_in_info_shelf.yaml`
- `e2e/voice_dictation.yaml`
- `e2e/settings_qr_scanner.yaml`

### Native Liquid Glass visual captures

These are **not** part of `test:e2e:mock`. They capture iOS 26+ Release screenshots
for the native `expo-glass-effect` migration. Operational detail, failure notes,
and regenerate commands live in
[`e2e/visual/native-liquid-glass/README.md`](../e2e/visual/native-liquid-glass/README.md).

| Flow | What it captures |
| --- | --- |
| `e2e/native-liquid-glass-visual.yaml` | First-run language → empty hub → Settings/Nord → Add Server |
| `e2e/native-liquid-glass-settings-themes.yaml` | Settings viewport for every retained dark and light palette |

```bash
node e2e/run-maestro.js test e2e/native-liquid-glass-visual.yaml
node e2e/run-maestro.js test e2e/native-liquid-glass-settings-themes.yaml
```

## Running Tests

### Demo Server Test

**Standard test with HTML report:**
```bash
npm run test:e2e:demo
```
- Generates HTML report in `e2e/_artifacts/demo-report/`
- Saves debug output to `e2e/_artifacts/debug/`
- No live step-by-step output (buffered)

**Live output (watch mode):**
```bash
npm run test:e2e:demo:watch
```
- Shows real-time step-by-step progress with checkmarks
- No HTML report generation
- Best for development/debugging

**Record video with report:**
```bash
npm run test:e2e:demo:record
```
- Records video of test execution
- Generates HTML report and debug output
- Video saved in current directory with timestamp

**Record video with live output:**
```bash
npm run test:e2e:demo:record:watch
```
- Records video with live step-by-step output
- No HTML report
- Best for debugging and demonstrations

### Mock Server Tests

```bash
npm run test:e2e:mock
```

Automatically:
1. Checks for booted iOS simulator
2. Starts mock server on ports 7071/7072
3. Runs all mock test flows
4. Kills mock server on completion

## TestIDs Reference

All interactive elements in the app that need to be tested must have `testID` props. Here are the testIDs used in the demo test:

### Onboarding
- `onboarding-connect-paste-card` - Manual credential entry card
- `onboarding-connect-url-input` - Server URL input field
- `onboarding-connect-token-input` - API token input field
- `onboarding-connect-handshake-cta` - Connect button
- `onboarding-done-cta` - "Enter Threadbase" button (final onboarding step)

### Session Screen
- `session-detail-screen` - Main session screen container
- `message-input` - Message input field
- `send-message-button` - Send message button
- `terminal-output` - Terminal output area
- `session-info-button` - Info button in header

### Navigation
- `screen-header-back-button` - Back button in screen header
- `info-modal-close-button` - Close button in info modal

### Hub/Browse
- `fab-new-session` - Floating action button to create new session
- `browse-first-directory` - First directory in browse list
- `first-session-card` - First session card in sessions list

## Writing Tests

### Basic Structure

```yaml
appId: ${APP_BUNDLE_ID}
---
# Test description
- launchApp:
    clearState: true
    clearKeychain: true

- tapOn:
    id: "my-test-id"

- inputText: "Hello"

- assertVisible:
    text: "Expected text"
```

### Best Practices

1. **Use testIDs over text/coordinates**
   - ✅ `id: "my-button"`
   - ❌ `text: "Click me"` (can break with i18n)
   - ❌ `point: "50%,250"` (fragile to layout changes)

2. **Add waits between interactions**
   ```yaml
   - tapOn:
       id: "button"
   - waitForAnimationToEnd
   ```

3. **Scroll past the keyboard on iOS 26.x**
   ```yaml
   - inputText: "text"
   - swipe:
       start: 50%, 45%
       end: 50%, 25%
       duration: 300
   - waitForAnimationToEnd
   ```

   Maestro's `hideKeyboard` can fail in the iOS 26.x XCTest accessibility path and can coincide with a simulator SpringBoard crash. See [`troubleshooting.md`](./troubleshooting.md) → "SpringBoard crashes in `XCTAutomationSupport` during Maestro". Use `pressKey: Enter` only for a single-line input whose return behavior is safe; it inserts a newline in multiline inputs.

4. **Handle conditional UI (modals, dialogs)**
   ```yaml
   - runFlow:
       when:
         visible:
           text: "Save Password?"
       commands:
         - tapOn:
             text: "Not Now"
   ```

5. **Clear state for fresh runs**
   ```yaml
   - launchApp:
       clearState: true
       clearKeychain: true
   ```

## Adding TestIDs to Components

When adding new interactive elements that need testing:

### React Native Components

```tsx
<TouchableOpacity
  testID="my-unique-test-id"
  onPress={handlePress}
>
  <Text>Click me</Text>
</TouchableOpacity>
```

### Conditional TestIDs

```tsx
<TouchableOpacity
  testID={isFirst ? "first-item" : undefined}
  onPress={handlePress}
>
  {/* ... */}
</TouchableOpacity>
```

### Passing TestID Props

```tsx
interface Props {
  isFirstSession?: boolean
}

export function SessionCard({ session, isFirstSession = false }: Props) {
  return (
    <TouchableOpacity
      testID={isFirstSession ? "first-session-card" : undefined}
      onPress={handlePress}
    >
      {/* ... */}
    </TouchableOpacity>
  )
}
```

Then pass the prop from the parent:

```tsx
<SessionCard 
  session={session} 
  isFirstSession={index === firstSessionIndex} 
/>
```

## Troubleshooting

### Test can't find element

1. **Verify testID exists in built app** (not just source code):
   ```bash
   grep -r "testID=\"my-test-id\"" app components --include="*.tsx"
   ```

2. **Rebuild after adding testIDs:**
   ```bash
   npm run ios
   ```

3. **Check element is actually visible** (not covered by keyboard/modal)

### Keyboard covering elements

```yaml
- swipe:
    start: 50%, 45%
    end: 50%, 25%
    duration: 300
- waitForAnimationToEnd
- tapOn:
    id: "button-under-keyboard"
```

### iOS Password Autofill interfering

```yaml
- runFlow:
    when:
      visible:
        text: "Save Password?"
    commands:
      - tapOn:
          text: "Not Now"
```

### App state not cleared

Make sure both flags are set:
```yaml
- launchApp:
    clearState: true
    clearKeychain: true
```

### No live output in terminal

Use the `:watch` variant:
```bash
npm run test:e2e:demo:watch
```

Or run maestro directly:
```bash
node e2e/run-maestro.js test e2e/demo-server-connect-only.yaml
```

## Debug Output

After a test run, check `e2e/_artifacts/debug/` for:
- `maestro.log` - Detailed step-by-step log
- Screenshots of each step
- Error details if test failed

HTML report (when using standard commands):
- `e2e/_artifacts/demo-report/` - Interactive HTML report with screenshots

## CI/CD Integration

For CI environments, use the standard command which generates reports:

```bash
npm run test:e2e:demo
```

The HTML report and debug artifacts can be uploaded as CI artifacts for review.

## Common Patterns

### Onboarding Flow

```yaml
- launchApp:
    clearState: true
    clearKeychain: true
- tapOn:
    text: "Begin handshake"
- tapOn:
    id: "onboarding-connect-paste-card"
# ... credential entry
- tapOn:
    id: "onboarding-connect-handshake-cta"
- tapOn:
    text: "Skip"  # Notifications
- tapOn:
    id: "onboarding-done-cta"
```

### Creating a Session

```yaml
- tapOn:
    id: "fab-new-session"
- tapOn:
    id: "browse-first-directory"
- tapOn:
    text: "Start Session Here"
```

### Sending a Message

```yaml
- tapOn:
    id: "message-input"
- inputText: "What is 2+2?"
- tapOn:
    id: "send-message-button"
```

### Opening/Closing Modals

```yaml
- tapOn:
    id: "session-info-button"
- assertVisible:
    id: "info-modal-close-button"
- tapOn:
    id: "info-modal-close-button"
- assertNotVisible:
    id: "info-modal-close-button"
```

## Known Issues

1. **Credentials pre-fill race condition:** The `eraseText` command may not always clear pre-filled values immediately. Solution: add `waitForAnimationToEnd` after `eraseText`.

2. **Password manager dialogs:** iOS may show "Save Password?" dialogs. Handle with `runFlow` conditional blocks.

3. **npm output buffering:** npm buffers maestro's live output. Use `:watch` variants or run maestro directly for live feedback.

4. **Unpaired relaunch is not a hub session:** `AuthGate` redirects any route with
   no paired servers to `/onboarding`, even after skip-onboarding wrote
   `threadbase_onboarded`. A second flow that `launchApp`s (with or without
   `clearState`) cannot tap `hub-settings-btn`. The Settings theme gallery walks
   the skip path itself. See
   [`e2e/visual/native-liquid-glass/README.md`](../e2e/visual/native-liquid-glass/README.md).

5. **`takeScreenshot` can beat first paint:** `extendedWaitUntil` on a testID can
   pass while native glass chrome is still blank. Put `waitForAnimationToEnd`
   immediately before each visual capture.

## Future Improvements

- [x] Add Android E2E tests — weekly `E2E` workflow, Android default
- [ ] Expand mock server test coverage
- [ ] Add visual regression testing (capture flows exist; no pixel-diff runner yet — see `e2e/visual/native-liquid-glass/`)
- [x] Integrate with CI/CD pipeline — `.github/workflows/e2e.yml`
- [ ] Add performance testing (startup time, response time)
