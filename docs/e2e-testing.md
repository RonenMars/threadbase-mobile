# E2E Testing with Maestro

This document describes the E2E (end-to-end) testing setup for tb-mobile using Maestro.

## Overview

We use [Maestro](https://maestro.mobile.dev/) for automated E2E testing on iOS and Android. Tests are written in YAML and interact with the app through testIDs and UI elements.

## Android CI

The `E2E` GitHub Actions workflow defaults to Android and runs on `ubuntu-24.04` with one Android API 35
Google APIs `x86_64` `pixel_6` emulator and Maestro CLI 2.8.0. It assembles the Release APK *before*
the emulator boots, caches that APK per checked-out commit SHA, installs it with `adb`, and runs the
suite through `e2e/run-maestro.js`. A second dispatch of the same commit reuses the cached APK and
skips the ~20 minute compile — that is the supported way to split a long suite (one-flow warmup,
then the remaining flows) without paying Gradle twice. The workflow disables Sentry source-map
upload and uses the committed debug keystore only for this simulator APK, so it does not need
production Sentry or signing credentials.

The Android emulator reaches the runner-hosted mock server at `10.0.2.2`, while
local iOS runs use `localhost`. The Android preflight checks emulator readiness
and API level; iOS runs additionally retain the separate XCTest teardown-crash
guard in `e2e/run-maestro.js`. Manual dispatch also provides `platform=ios` to
run the retained macOS/iOS workflow.

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

- [ ] Add Android E2E tests
- [ ] Expand mock server test coverage
- [ ] Add visual regression testing (capture flows exist; no pixel-diff runner yet — see `e2e/visual/native-liquid-glass/`)
- [ ] Integrate with CI/CD pipeline
- [ ] Add performance testing (startup time, response time)
