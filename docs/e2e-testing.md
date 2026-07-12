# E2E Testing with Maestro

This document describes the E2E (end-to-end) testing setup for tb-mobile using Maestro.

## Overview

We use [Maestro](https://maestro.mobile.dev/) for automated E2E testing on iOS and Android. Tests are written in YAML and interact with the app through testIDs and UI elements.

## Prerequisites

1. **Install Maestro:**
   ```bash
   brew install maestro
   ```

2. **iOS Simulator:** Must be booted before running tests
   ```bash
   xcrun simctl list | grep Booted
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
1. ✅ Onboarding flow (4 steps: Welcome → Connect → Notifications → Done)
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

3. **Hide keyboard when needed**
   ```yaml
   - inputText: "text"
   - hideKeyboard
   - waitForAnimationToEnd
   ```

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
- hideKeyboard
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
maestro test e2e/demo-server-connect-only.yaml
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
- hideKeyboard
- waitForAnimationToEnd
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

## Future Improvements

- [ ] Add Android E2E tests
- [ ] Expand mock server test coverage
- [ ] Add visual regression testing
- [ ] Integrate with CI/CD pipeline
- [ ] Add performance testing (startup time, response time)
