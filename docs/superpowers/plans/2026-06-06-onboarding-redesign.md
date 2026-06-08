# Onboarding Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compress onboarding from 8 steps to 4, redesign the manual "Paste Credentials" form to be unambiguous, and replace the in-flow tour carousel with three post-onboarding contextual hints.

**Architecture:** Four phases: (1) strip the navigator to 4 steps + update strings, (2) redesign ConnectStep manual mode with a two-section card layout, (3) build a spotlight TourOverlay component and wire Tour A to the Hub screen, (4) add inline first-show hint banners for Tour B (session detail) and Tour C (new session). Each phase is independently shippable.

**Tech Stack:** React Native (Expo SDK), TypeScript, `react-native-reanimated`, `@react-native-async-storage/async-storage`, `phosphor-react-native` (icons), `@testing-library/react-native` (unit/integration tests), Jest.

---

## File Map

### Phase 1 — Navigator compress + strings

| Action | File |
|--------|------|
| Modify | `components/onboarding/OnboardingNavigator.tsx` |
| Modify | `locales/en/onboarding.json` |
| Modify | `components/onboarding/steps/NotificationsStep.tsx` |
| Modify | `components/onboarding/steps/DoneStep.tsx` |
| Modify | `__tests__/e2e/onboarding-flow.test.tsx` |

### Phase 2 — ConnectStep manual mode redesign

| Action | File |
|--------|------|
| Modify | `components/onboarding/steps/ConnectStep.tsx` |
| Create | `components/onboarding/components/TokenTooltip.tsx` |
| Modify | `locales/en/onboarding.json` |

### Phase 3 — Hub Tour (Tour A)

| Action | File |
|--------|------|
| Create | `components/tour/TourOverlay.tsx` |
| Create | `components/tour/useHubTour.ts` |
| Modify | `app/index.tsx` |
| Modify | `components/ui/FAB.tsx` (add `ref` forwarding for measure) |
| Create | `__tests__/integration/components/TourOverlay.test.tsx` |

### Phase 4 — Inline hints Tours B and C

| Action | File |
|--------|------|
| Create | `components/tour/FirstShowBanner.tsx` |
| Modify | `app/session/[id].tsx` |
| Modify | `components/servers/NewSessionServerPicker.tsx` |
| Create | `__tests__/integration/components/FirstShowBanner.test.tsx` |

---

## Task 1: Strip OnboardingNavigator to 4 steps

**Files:**
- Modify: `components/onboarding/OnboardingNavigator.tsx`

**Context:** The navigator currently renders 8 steps (indices 0–7). We keep WelcomeStep (0), ConnectStep (1), NotificationsStep (2), DoneStep (3). Removed: ThemeStep, ValuePropStep, ServerNameStep, TourStep. The `pendingServerName` state and `handleServerNameSubmit` are also removed because `ServerNameStep` is gone.

- [ ] **Step 1: Write a failing test that the navigator renders exactly 4 steps**

File: `__tests__/e2e/onboarding-flow.test.tsx` — add to the existing `describe('Onboarding – initial render')` block:

```tsx
// Add this import at the top if not already present:
// import OnboardingScreen from '@/app/onboarding'

it('renders the welcome screen as step 1 of 4', () => {
  // This test uses mode='' (first-launch flow, not mode=add)
  // We need to override useLocalSearchParams for this test block.
  // Note: the existing tests in this file use mode='add'.
  // Add a new describe block below the existing ones:
})
```

Add a **new describe block** at the bottom of `__tests__/e2e/onboarding-flow.test.tsx`:

```tsx
describe('Onboarding – first-launch flow', () => {
  beforeEach(() => {
    // Override the mock to simulate first-launch (no mode param)
    jest.resetModules()
  })

  it('shows 4 pager dots when in first-launch mode', () => {
    // We test this by checking TOTAL_STEPS exported from the navigator.
    // Import and assert directly:
    const { TOTAL_STEPS } = require('@/components/onboarding/OnboardingNavigator')
    expect(TOTAL_STEPS).toBe(4)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /path/to/tb-mobile && npx jest "__tests__/e2e/onboarding-flow.test.tsx" --testNamePattern="shows 4 pager dots" -t "shows 4 pager dots" 2>&1 | tail -20
```

Expected: FAIL — `TOTAL_STEPS` is currently `8`, not `4`.

- [ ] **Step 3: Update OnboardingNavigator.tsx**

Replace the entire file content of `components/onboarding/OnboardingNavigator.tsx` with:

```tsx
import React, { useCallback, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { useServersStore } from '@/stores/servers'
import type { PairResult } from '@/hooks/useTBPair'
import { OnboardingShell } from './OnboardingShell'
import { ConnectStep } from './steps/ConnectStep'
import { DoneStep } from './steps/DoneStep'
import { NotificationsStep } from './steps/NotificationsStep'
import { WelcomeStep } from './steps/WelcomeStep'

export const TOTAL_STEPS = 4
export const ONBOARDED_KEY = 'threadbase_onboarded'
const PAIRED_TOKEN_HASH_KEY = 'threadbase_paired_token_hash'

interface Props {
  onDone: () => void
}

function hashToken(token: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

function deriveHost(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname || 'localhost'
  } catch {
    return url.replace(/^https?:\/\//, '').split(/[/:]/)[0] || 'localhost'
  }
}

function derivePort(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.port) return parsed.port
    return parsed.protocol === 'https:' ? '443' : '80'
  } catch {
    return '7331'
  }
}

export function OnboardingNavigator({ onDone }: Props) {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState<1 | -1 | 0>(0)
  const [paired, setPaired] = useState<PairResult | null>(null)
  const addServer = useServersStore((s) => s.addServer)

  const goto = useCallback((next: number) => {
    setIndex((curr) => {
      const clamped = Math.max(0, Math.min(TOTAL_STEPS - 1, next))
      setDirection(clamped >= curr ? 1 : -1)
      return clamped
    })
  }, [])

  const onNext = useCallback(() => {
    setIndex((curr) => {
      if (curr >= TOTAL_STEPS - 1) return curr
      setDirection(1)
      return curr + 1
    })
  }, [])

  const onBack = useCallback(() => {
    setIndex((curr) => {
      if (curr <= 0) return curr
      setDirection(-1)
      return curr - 1
    })
  }, [])

  const onSkip = useCallback(() => {
    goto(TOTAL_STEPS - 1)
  }, [goto])

  const handlePaired = useCallback((result: PairResult) => {
    setPaired(result)
  }, [])

  const handleEnter = useCallback(async () => {
    try {
      if (paired) {
        await addServer(paired.url, paired.apiKey)
        await SecureStore.setItemAsync(
          PAIRED_TOKEN_HASH_KEY,
          hashToken(paired.apiKey),
        )
      }
      await AsyncStorage.setItem(ONBOARDED_KEY, 'true')
    } finally {
      onDone()
    }
  }, [addServer, onDone, paired])

  return (
    <OnboardingShell
      index={index}
      total={TOTAL_STEPS}
      direction={direction}
      onNext={onNext}
      onBack={onBack}
      onSkip={onSkip}
    >
      {index === 0 && <WelcomeStep onNext={onNext} />}
      {index === 1 && (
        <ConnectStep onPaired={handlePaired} onAdvance={onNext} />
      )}
      {index === 2 && <NotificationsStep onNext={onNext} />}
      {index === 3 && (
        <DoneStep
          onEnter={handleEnter}
          serverHost={paired ? deriveHost(paired.url) : undefined}
          serverPort={paired ? derivePort(paired.url) : undefined}
        />
      )}
    </OnboardingShell>
  )
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx jest "__tests__/e2e/onboarding-flow.test.tsx" --testNamePattern="shows 4 pager dots" 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
npx jest 2>&1 | tail -20
```

Expected: All previously passing tests still pass. (The `onboarding-flow.test.tsx` add-server tests use `mode='add'` which hits `AddServerScreen`, not the navigator — they should be unaffected.)

- [ ] **Step 6: Commit**

```bash
git add components/onboarding/OnboardingNavigator.tsx __tests__/e2e/onboarding-flow.test.tsx
git commit -m "feat(onboarding): compress to 4 steps, remove theme/value/name/tour steps"
```

---

## Task 2: Update strings — notifications body, DoneStep copy, ConnectStep choose-mode copy

**Files:**
- Modify: `locales/en/onboarding.json`
- Modify: `components/onboarding/steps/NotificationsStep.tsx`
- Modify: `components/onboarding/steps/DoneStep.tsx`

**Context:** Three string changes as specified in the spec:
1. Add `notifications.body` key used by `NotificationsStep`
2. Change ConnectStep choose-mode card label: "Paste credentials" → "Type / paste manually"; body → "Use a URL and token from `tb token --new`."
3. DoneStep unpaired body copy: soften "failure" framing to "deliberate choice"

- [ ] **Step 1: Write a failing test for the notifications body text**

Add to `__tests__/e2e/onboarding-flow.test.tsx` inside the `describe('Onboarding – first-launch flow')` block added in Task 1. Note: testing i18n strings via the existing render tests requires the full navigator. Instead, test the string key exists in the JSON:

```tsx
it('notifications.body key exists in en/onboarding.json', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const strings = require('@/locales/en/onboarding.json')
  expect(strings.notifications.body).toBeTruthy()
  expect(strings.notifications.body).toContain('session')
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest "__tests__/e2e/onboarding-flow.test.tsx" --testNamePattern="notifications.body key" 2>&1 | tail -10
```

Expected: FAIL — key does not exist yet.

- [ ] **Step 3: Update locales/en/onboarding.json**

Add `body` under `notifications`, update `connect` card copy. Change only the specific keys — leave all others untouched:

```json
// In "notifications": add after "allowTitle":
"body": "We'll ping you when a session finishes, hits an error, or needs a quick decision — so you don't have to keep the app open.",

// In "connect": change these two keys:
"pasteCredentials": "Type / paste manually",
"pasteCredentialsBody": "Use a URL and token from tb token --new.",
```

The full updated `notifications` block:
```json
"notifications": {
  "allowTitle": "Push notifications",
  "body": "We'll ping you when a session finishes, hits an error, or needs a quick decision — so you don't have to keep the app open.",
  "continue": "Continue"
}
```

The updated `connect` keys (change only these two lines inside `"connect"`):
```json
"pasteCredentials": "Type / paste manually",
"pasteCredentialsBody": "Use a URL and token from tb token --new.",
```

- [ ] **Step 4: Display `notifications.body` in NotificationsStep**

In `components/onboarding/steps/NotificationsStep.tsx`, add the body text below the `subhead`. Find the existing `subhead` Text element:

```tsx
{/* eslint-disable-next-line i18next/no-literal-string */}
<Text style={styles.subhead}>
  Push fires on plan-ready, tool-confirms, and run failures. That&apos;s it.
</Text>
```

Replace with:

```tsx
{/* eslint-disable-next-line i18next/no-literal-string */}
<Text style={styles.subhead}>
  Push fires on plan-ready, tool-confirms, and run failures. That&apos;s it.
</Text>
<Text style={styles.body}>{t('notifications.body')}</Text>
```

Add `body` to the `StyleSheet.create` call at the bottom of `NotificationsStep.tsx` (after `subhead`):

```tsx
body: {
  color: colors.fg3,
  fontFamily: fonts.sans,
  fontSize: 13,
  lineHeight: 19,
  marginBottom: 18,
},
```

- [ ] **Step 5: Update DoneStep unpaired body copy**

In `components/onboarding/steps/DoneStep.tsx`, find the unpaired body string (line ~104):

```tsx
: 'No runtime paired yet. Hook one up from Settings when you're ready.'}
```

Replace with:

```tsx
: 'Skip it for now — you can connect a runtime from Settings whenever you’re ready.'}
```

(Using `’` for the right-curly apostrophe to stay consistent with the existing `paired` body's `you're`.)

- [ ] **Step 6: Run tests**

```bash
npx jest "__tests__/e2e/onboarding-flow.test.tsx" 2>&1 | tail -10
```

Expected: All tests pass including the new `notifications.body key` test.

- [ ] **Step 7: Commit**

```bash
git add locales/en/onboarding.json components/onboarding/steps/NotificationsStep.tsx components/onboarding/steps/DoneStep.tsx __tests__/e2e/onboarding-flow.test.tsx
git commit -m "feat(onboarding): update notifications body, connect card copy, done step framing"
```

---

## Task 3: Redesign ConnectStep manual mode — two-section card

**Files:**
- Modify: `components/onboarding/steps/ConnectStep.tsx`
- Create: `components/onboarding/components/TokenTooltip.tsx`

**Context:** The manual mode currently uses a single TerminalCard with `$ tb pair --server` and `$ tb pair --token` as input labels. Replace with two distinct sections: (1) a command card showing `$ tb token --new` with a copy-to-clipboard button, (2) a plain form with field labels "Server URL" and "Token", plus a `?` icon on Token that shows an inline tooltip. CTA label changes from "Open handshake" to "Connect".

The QR explain mode and choose mode are not changed (except the choose-mode card copy already updated in Task 2).

- [ ] **Step 1: Create TokenTooltip component**

Create `components/onboarding/components/TokenTooltip.tsx`:

```tsx
import React, { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors, fonts } from '../theme'

export function TokenTooltip() {
  const [visible, setVisible] = useState(false)

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        testID="token-tooltip-trigger"
        onPress={() => setVisible((v) => !v)}
        hitSlop={8}
        style={styles.trigger}
      >
        <Text style={styles.icon}>?</Text>
      </TouchableOpacity>
      {visible && (
        <View testID="token-tooltip-body" style={styles.tooltip}>
          <Text style={styles.text}>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            A temporary API key. Run{' '}
            <Text style={styles.code}>tb token --new</Text>
            {' '}on your Mac to generate one.
          </Text>
          <TouchableOpacity onPress={() => setVisible(false)} hitSlop={8}>
            <Text style={styles.dismiss}>Got it</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  trigger: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.fg4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    color: colors.fg4,
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '600',
    lineHeight: 12,
  },
  tooltip: {
    position: 'absolute',
    top: 20,
    right: 0,
    width: 220,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.ink5,
    borderRadius: 8,
    padding: 10,
    zIndex: 10,
  },
  text: {
    color: colors.fg2,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
  code: {
    color: colors.fg1,
    fontFamily: fonts.mono,
    fontSize: 11,
  },
  dismiss: {
    color: colors.blue400,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '500',
  },
})
```

- [ ] **Step 2: Write failing tests for TokenTooltip**

Create `__tests__/integration/components/TokenTooltip.test.tsx`:

```tsx
import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { TokenTooltip } from '@/components/onboarding/components/TokenTooltip'

describe('TokenTooltip', () => {
  it('does not show tooltip body initially', () => {
    const { queryByTestId } = render(<TokenTooltip />)
    expect(queryByTestId('token-tooltip-body')).toBeNull()
  })

  it('shows tooltip body when trigger is pressed', () => {
    const { getByTestId } = render(<TokenTooltip />)
    fireEvent.press(getByTestId('token-tooltip-trigger'))
    expect(getByTestId('token-tooltip-body')).toBeTruthy()
  })

  it('hides tooltip when Got it is pressed', () => {
    const { getByTestId, getByText, queryByTestId } = render(<TokenTooltip />)
    fireEvent.press(getByTestId('token-tooltip-trigger'))
    fireEvent.press(getByText('Got it'))
    expect(queryByTestId('token-tooltip-body')).toBeNull()
  })
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx jest "__tests__/integration/components/TokenTooltip.test.tsx" 2>&1 | tail -10
```

Expected: FAIL — file does not exist yet.

- [ ] **Step 4: Run tests after creating the file — confirm they pass**

```bash
npx jest "__tests__/integration/components/TokenTooltip.test.tsx" 2>&1 | tail -10
```

Expected: PASS (the component was written in Step 1; tests should pass now).

- [ ] **Step 5: Rewrite ConnectStep manual mode**

In `components/onboarding/steps/ConnectStep.tsx`, find the `return` block inside the `if (mode === 'manual')` / final `return` branch (the `KeyboardAvoidingView` block, starting around line 157).

Replace the entire final `return (...)` block (from `return (` down to and including the closing `</KeyboardAvoidingView>`) with:

```tsx
return (
  <KeyboardAvoidingView
    style={styles.root}
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    keyboardVerticalOffset={80}
  >
    <Text style={styles.eyebrow}>{t('connect.eyebrow')}</Text>
    <Text style={styles.headline}>{t('connect.headline')}</Text>

    <TouchableOpacity onPress={() => setMode('qr-explain')} style={styles.linkBtnTop}>
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <Text style={styles.linkText}>Scan a QR instead →</Text>
    </TouchableOpacity>

    {/* Section 1: Desktop command */}
    <TerminalCard>
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <Text style={styles.sectionLabel}>On your Mac</Text>
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <Text style={styles.sectionHint}>Open Terminal and run:</Text>
      <CopyableCommand command="tb token --new" />
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <Text style={[styles.sectionHint, { marginTop: 6 }]}>It prints a URL and a token — paste both below.</Text>
    </TerminalCard>

    {/* Section 2: Paste inputs */}
    <TerminalCard style={{ marginTop: 10 }}>
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <Text style={styles.sectionLabel}>Paste from terminal</Text>

      {/* eslint-disable-next-line i18next/no-literal-string */}
      <Text style={styles.fieldLabel}>Server URL</Text>
      <View style={styles.inputRow}>
        <Text style={styles.prompt}>›</Text>
        <TextInput
          testID="onboarding-connect-url-input"
          value={url}
          onChangeText={setUrl}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
          editable={!busy}
          placeholder="https://your-mac-ip:7331"
          placeholderTextColor={colors.fg4}
        />
      </View>

      <View style={[styles.fieldLabelRow, { marginTop: 10 }]}>
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <Text style={styles.fieldLabel}>Token</Text>
        <TokenTooltip />
      </View>
      <View style={styles.inputRow}>
        <Text style={styles.prompt}>›</Text>
        <TextInput
          testID="onboarding-connect-token-input"
          value={token}
          onChangeText={setToken}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder="paste from terminal"
          placeholderTextColor={colors.fg4}
          style={styles.input}
          editable={!busy}
        />
      </View>

      {log.length > 0 && (
        <View style={styles.logWrap}>
          {log.map((ln, i) => (
            <Animated.View
              key={`${i}-${ln.t}`}
              entering={FadeIn.duration(200)}
              style={styles.logRow}
            >
              <Text style={[styles.logLine, { color: colorForKind(ln.k) }]}>
                <Text style={styles.logIndex}>
                  [{String(i + 1).padStart(2, '0')}]{' '}
                </Text>
                {ln.t}
              </Text>
            </Animated.View>
          ))}
          {phase === 'ok' && (
            <Animated.Text
              entering={FadeIn.duration(200)}
              style={[styles.logLine, { color: colors.green400, marginTop: 4 }]}
            >
              {t('connect.ready')}
            </Animated.Text>
          )}
        </View>
      )}
    </TerminalCard>

    <View style={styles.flex} />

    <PrimaryButton
      testID="onboarding-connect-handshake-cta"
      onPress={handleConnect}
      disabled={!valid || busy}
    >
      {/* eslint-disable-next-line i18next/no-literal-string */}
      {phase === 'idle'
        ? 'Connect'
        : phase === 'ok'
          ? 'Connected'
          : phase === 'err'
            ? 'Retry'
            : '…connecting'}
    </PrimaryButton>
    <View style={{ height: 14 }} />
  </KeyboardAvoidingView>
)
```

Add the `CopyableCommand` component and new styles to the **bottom** of `ConnectStep.tsx`, before the `export`:

```tsx
import Clipboard from '@react-native-clipboard/clipboard'
import { TokenTooltip } from '../components/TokenTooltip'

function CopyableCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    Clipboard.setString(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <TouchableOpacity
      testID="copy-command-btn"
      onPress={handleCopy}
      style={copyStyles.row}
      activeOpacity={0.7}
    >
      <Text style={copyStyles.command}>$ {command}</Text>
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <Text style={copyStyles.badge}>{copied ? '✓ copied' : 'copy'}</Text>
    </TouchableOpacity>
  )
}

const copyStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.ink3,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.ink5,
  },
  command: {
    color: colors.fg1,
    fontFamily: fonts.mono,
    fontSize: 12.5,
    fontWeight: '500',
  },
  badge: {
    color: colors.blue400,
    fontFamily: fonts.mono,
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
})
```

Add these keys to the existing `StyleSheet.create` in `ConnectStep.tsx` (append to the `styles` object):

```tsx
sectionLabel: {
  color: colors.fg3,
  fontFamily: fonts.mono,
  fontSize: 10,
  fontWeight: '600',
  letterSpacing: 1,
  textTransform: 'uppercase' as const,
  marginBottom: 4,
},
sectionHint: {
  color: colors.fg3,
  fontFamily: fonts.sans,
  fontSize: 12,
  lineHeight: 17,
},
fieldLabel: {
  color: colors.fg2,
  fontFamily: fonts.mono,
  fontSize: 11.5,
  fontWeight: '600',
  marginBottom: 2,
},
fieldLabelRow: {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 6,
},
```

Also **remove** the old `commandLabel` and `footnote`/`footnoteText` styles from the `StyleSheet.create` block — they are no longer used. Remove: `commandLabel`, `footnote`, `footnoteText`.

Also remove the `<View style={styles.footnote}>` block (the `// On your desktop, run tb token --new to mint one.` footnote) that currently appears between `</TerminalCard>` and `<View style={styles.flex} />` in the old manual mode.

> **Note on Clipboard:** `@react-native-clipboard/clipboard` is already a standard Expo package. Verify it is installed:
> ```bash
> grep "@react-native-clipboard" package.json
> ```
> If not present, run `npx expo install @react-native-clipboard/clipboard`.

- [ ] **Step 6: Write failing integration tests for the new manual mode**

Add to `__tests__/integration/components/TokenTooltip.test.tsx` OR create a new `ConnectStepManual.test.tsx`. Create `__tests__/integration/components/ConnectStepManual.test.tsx`:

```tsx
import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { ConnectStep } from '@/components/onboarding/steps/ConnectStep'

const mockPair = jest.fn()
jest.mock('@/hooks/useTBPair', () => ({
  useTBPair: () => ({ phase: 'idle', log: [], pair: mockPair }),
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

describe('ConnectStep – manual mode', () => {
  it('shows "Type / paste manually" card in choose mode', () => {
    const { getByText } = render(
      <ConnectStep onPaired={jest.fn()} onAdvance={jest.fn()} />
    )
    expect(getByText('Type / paste manually')).toBeTruthy()
  })

  it('shows "On your Mac" section header in manual mode', () => {
    const { getByText } = render(
      <ConnectStep onPaired={jest.fn()} onAdvance={jest.fn()} />
    )
    fireEvent.press(getByText('Type / paste manually'))
    expect(getByText('On your Mac')).toBeTruthy()
  })

  it('shows copyable tb token --new command in manual mode', () => {
    const { getByText } = render(
      <ConnectStep onPaired={jest.fn()} onAdvance={jest.fn()} />
    )
    fireEvent.press(getByText('Type / paste manually'))
    expect(getByText(/tb token --new/)).toBeTruthy()
  })

  it('shows "Server URL" and "Token" field labels (not faux-shell labels)', () => {
    const { getByText, queryByText } = render(
      <ConnectStep onPaired={jest.fn()} onAdvance={jest.fn()} />
    )
    fireEvent.press(getByText('Type / paste manually'))
    expect(getByText('Server URL')).toBeTruthy()
    expect(getByText('Token')).toBeTruthy()
    expect(queryByText(/\$ tb pair --server/)).toBeNull()
    expect(queryByText(/\$ tb pair --token/)).toBeNull()
  })

  it('CTA shows "Connect" not "Open handshake"', () => {
    const { getByText, queryByText } = render(
      <ConnectStep onPaired={jest.fn()} onAdvance={jest.fn()} />
    )
    fireEvent.press(getByText('Type / paste manually'))
    expect(getByText('Connect')).toBeTruthy()
    expect(queryByText('Open handshake')).toBeNull()
  })
})
```

- [ ] **Step 7: Run the new tests — confirm they fail before implementation**

```bash
npx jest "__tests__/integration/components/ConnectStepManual.test.tsx" 2>&1 | tail -15
```

Expected: FAIL — old labels still present.

- [ ] **Step 8: Run tests after Step 5 implementation — confirm they pass**

```bash
npx jest "__tests__/integration/components/ConnectStepManual.test.tsx" "__tests__/integration/components/TokenTooltip.test.tsx" 2>&1 | tail -15
```

Expected: All 8 tests pass.

- [ ] **Step 9: Run full suite**

```bash
npx jest 2>&1 | tail -20
```

Expected: No regressions.

- [ ] **Step 10: Commit**

```bash
git add components/onboarding/steps/ConnectStep.tsx components/onboarding/components/TokenTooltip.tsx __tests__/integration/components/TokenTooltip.test.tsx __tests__/integration/components/ConnectStepManual.test.tsx
git commit -m "feat(onboarding): redesign manual connect mode — two-section card, plain labels, copyable command"
```

---

## Task 4: Build TourOverlay component (spotlight + tooltip card)

**Files:**
- Create: `components/tour/TourOverlay.tsx`
- Create: `__tests__/integration/components/TourOverlay.test.tsx`

**Context:** `TourOverlay` renders a full-screen semi-transparent backdrop with a "hole" (transparent rect) cut out over a measured target element. A tooltip card appears below (or above if near bottom edge) the hole. It receives the target's measured layout (`{ x, y, width, height }`) and the tooltip text. It is not aware of tour sequences — the caller drives step changes.

- [ ] **Step 1: Write failing tests for TourOverlay**

Create `__tests__/integration/components/TourOverlay.test.tsx`:

```tsx
import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { TourOverlay } from '@/components/tour/TourOverlay'

const TARGET = { x: 20, y: 100, width: 100, height: 50 }

describe('TourOverlay', () => {
  it('renders the tooltip text', () => {
    const { getByText } = render(
      <TourOverlay
        target={TARGET}
        text="Each card is a Claude Code session."
        onGotIt={jest.fn()}
        onSkip={jest.fn()}
      />
    )
    expect(getByText('Each card is a Claude Code session.')).toBeTruthy()
  })

  it('calls onGotIt when Got it is pressed', () => {
    const onGotIt = jest.fn()
    const { getByTestId } = render(
      <TourOverlay
        target={TARGET}
        text="Some tip"
        onGotIt={onGotIt}
        onSkip={jest.fn()}
      />
    )
    fireEvent.press(getByTestId('tour-got-it'))
    expect(onGotIt).toHaveBeenCalledTimes(1)
  })

  it('calls onSkip when Skip tour is pressed', () => {
    const onSkip = jest.fn()
    const { getByTestId } = render(
      <TourOverlay
        target={TARGET}
        text="Some tip"
        onGotIt={jest.fn()}
        onSkip={onSkip}
      />
    )
    fireEvent.press(getByTestId('tour-skip'))
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('shows step indicator when stepLabel is provided', () => {
    const { getByText } = render(
      <TourOverlay
        target={TARGET}
        text="Some tip"
        onGotIt={jest.fn()}
        onSkip={jest.fn()}
        stepLabel="1 / 3"
      />
    )
    expect(getByText('1 / 3')).toBeTruthy()
  })

  it('does not show step indicator when stepLabel is omitted', () => {
    const { queryByTestId } = render(
      <TourOverlay
        target={TARGET}
        text="Some tip"
        onGotIt={jest.fn()}
        onSkip={jest.fn()}
      />
    )
    expect(queryByTestId('tour-step-label')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest "__tests__/integration/components/TourOverlay.test.tsx" 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `components/tour/TourOverlay.tsx`**

```tsx
import React from 'react'
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const BACKDROP = 'rgba(0,0,0,0.72)'
const CARD_BG = '#161f2e'
const CARD_BORDER = '#2a3650'
const TEXT_PRIMARY = '#e6edf3'
const TEXT_SECONDARY = '#8b949e'
const BLUE = '#3b82f6'
const MONO = 'Menlo'

export interface TourTarget {
  x: number
  y: number
  width: number
  height: number
}

interface Props {
  target: TourTarget
  text: string
  onGotIt: () => void
  onSkip: () => void
  stepLabel?: string
}

export function TourOverlay({ target, text, onGotIt, onSkip, stepLabel }: Props) {
  const PADDING = 8
  const holeX = target.x - PADDING
  const holeY = target.y - PADDING
  const holeW = target.width + PADDING * 2
  const holeH = target.height + PADDING * 2

  // Place tooltip below target; flip above if too close to screen bottom
  const tooltipTop = holeY + holeH + 12
  const flipAbove = tooltipTop + 120 > SCREEN_H - 60
  const tooltipY = flipAbove ? holeY - 12 - 120 : tooltipTop

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop — top strip */}
      <View style={[styles.strip, { top: 0, height: Math.max(0, holeY), width: SCREEN_W }]} />
      {/* Backdrop — bottom strip */}
      <View
        style={[
          styles.strip,
          {
            top: holeY + holeH,
            height: Math.max(0, SCREEN_H - holeY - holeH),
            width: SCREEN_W,
          },
        ]}
      />
      {/* Backdrop — left strip */}
      <View
        style={[
          styles.strip,
          { top: holeY, height: holeH, width: Math.max(0, holeX) },
        ]}
      />
      {/* Backdrop — right strip */}
      <View
        style={[
          styles.strip,
          {
            top: holeY,
            left: holeX + holeW,
            height: holeH,
            width: Math.max(0, SCREEN_W - holeX - holeW),
          },
        ]}
      />

      {/* Tooltip card */}
      <View
        style={[
          styles.card,
          { top: tooltipY, left: 16, right: 16 },
          flipAbove && { top: tooltipY },
        ]}
      >
        {stepLabel != null && (
          <Text testID="tour-step-label" style={styles.stepLabel}>
            {stepLabel}
          </Text>
        )}
        <Text style={styles.text}>{text}</Text>
        <View style={styles.actions}>
          <TouchableOpacity testID="tour-skip" onPress={onSkip} hitSlop={8}>
            <Text style={styles.skip}>Skip tour</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="tour-got-it"
            onPress={onGotIt}
            style={styles.gotItBtn}
            activeOpacity={0.75}
          >
            <Text style={styles.gotItText}>Got it →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  strip: {
    position: 'absolute',
    backgroundColor: BACKDROP,
  },
  card: {
    position: 'absolute',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 12,
    padding: 14,
  },
  stepLabel: {
    color: TEXT_SECONDARY,
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  text: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skip: {
    color: TEXT_SECONDARY,
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '500',
  },
  gotItBtn: {
    backgroundColor: BLUE,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  gotItText: {
    color: '#fff',
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: '600',
  },
})
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npx jest "__tests__/integration/components/TourOverlay.test.tsx" 2>&1 | tail -10
```

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/tour/TourOverlay.tsx __tests__/integration/components/TourOverlay.test.tsx
git commit -m "feat(tour): add TourOverlay spotlight component with tooltip card"
```

---

## Task 5: Build useHubTour hook

**Files:**
- Create: `components/tour/useHubTour.ts`

**Context:** Manages the 3-step Hub tour state. Reads/writes AsyncStorage key `threadbase_tour_hub`. Returns current step index, measured targets map, a `registerTarget` callback (called from Hub elements via `onLayout`+`measure`), `advanceStep`, and `skipTour`. Returns `null` once the tour is done or already seen.

- [ ] **Step 1: Write failing tests**

Create `__tests__/unit/hooks/useHubTour.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useHubTour } from '@/components/tour/useHubTour'

const HUB_TOUR_KEY = 'threadbase_tour_hub'

beforeEach(() => {
  jest.clearAllMocks()
  ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
  ;(AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined)
})

describe('useHubTour', () => {
  it('starts at step 0 when tour has not been seen', async () => {
    const { result } = renderHook(() => useHubTour())
    // Wait for async init
    await act(async () => {})
    expect(result.current?.stepIndex).toBe(0)
  })

  it('returns null when tour has already been seen', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue('seen')
    const { result } = renderHook(() => useHubTour())
    await act(async () => {})
    expect(result.current).toBeNull()
  })

  it('advances to step 1 when advanceStep is called', async () => {
    const { result } = renderHook(() => useHubTour())
    await act(async () => {})
    act(() => { result.current?.advanceStep() })
    expect(result.current?.stepIndex).toBe(1)
  })

  it('returns null after all 3 steps are advanced past', async () => {
    const { result } = renderHook(() => useHubTour())
    await act(async () => {})
    act(() => { result.current?.advanceStep() })
    act(() => { result.current?.advanceStep() })
    act(() => { result.current?.advanceStep() }) // past last step
    expect(result.current).toBeNull()
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(HUB_TOUR_KEY, 'seen')
  })

  it('returns null and marks seen when skipTour is called', async () => {
    const { result } = renderHook(() => useHubTour())
    await act(async () => {})
    act(() => { result.current?.skipTour() })
    expect(result.current).toBeNull()
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(HUB_TOUR_KEY, 'seen')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest "__tests__/unit/hooks/useHubTour.test.ts" 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `components/tour/useHubTour.ts`**

```ts
import { useCallback, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { TourTarget } from './TourOverlay'

const HUB_TOUR_KEY = 'threadbase_tour_hub'
const TOTAL_STEPS = 3

export interface HubTourState {
  stepIndex: number
  targets: Partial<Record<HubTourStep, TourTarget>>
  registerTarget: (step: HubTourStep, layout: TourTarget) => void
  advanceStep: () => void
  skipTour: () => void
}

export type HubTourStep = 'sessionCard' | 'laneIndicator' | 'fab'

export function useHubTour(): HubTourState | null {
  const [ready, setReady] = useState(false)
  const [seen, setSeen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [targets, setTargets] = useState<Partial<Record<HubTourStep, TourTarget>>>({})

  useEffect(() => {
    AsyncStorage.getItem(HUB_TOUR_KEY).then((v) => {
      if (v === 'seen') setSeen(true)
      setReady(true)
    })
  }, [])

  const markSeen = useCallback(() => {
    setSeen(true)
    AsyncStorage.setItem(HUB_TOUR_KEY, 'seen')
  }, [])

  const advanceStep = useCallback(() => {
    setStepIndex((i) => {
      const next = i + 1
      if (next >= TOTAL_STEPS) {
        markSeen()
        return next
      }
      return next
    })
  }, [markSeen])

  const skipTour = useCallback(() => {
    markSeen()
  }, [markSeen])

  const registerTarget = useCallback((step: HubTourStep, layout: TourTarget) => {
    setTargets((prev) => ({ ...prev, [step]: layout }))
  }, [])

  if (!ready || seen || stepIndex >= TOTAL_STEPS) return null

  return { stepIndex, targets, registerTarget, advanceStep, skipTour }
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npx jest "__tests__/unit/hooks/useHubTour.test.ts" 2>&1 | tail -10
```

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/tour/useHubTour.ts __tests__/unit/hooks/useHubTour.test.ts
git commit -m "feat(tour): add useHubTour hook — 3-step state machine with AsyncStorage persistence"
```

---

## Task 6: Wire Tour A into the Hub screen

**Files:**
- Modify: `app/index.tsx`
- Modify: `components/ui/FAB.tsx`

**Context:** The Hub screen renders three elements we highlight: (1) a session card (`SessionCard` or `ProjectHubCard`), (2) a lane indicator (the colored strip on the card), and (3) the FAB (`testID="fab-new-session"`). We measure their positions and pass them to `TourOverlay` via `useHubTour`.

For simplicity, we measure the FAB (which has a stable `testID`) and the first visible session card. The lane indicator highlight reuses the session card's target position with a small inset offset — this avoids complex child-ref forwarding for the initial implementation.

- [ ] **Step 1: Add `ref` forwarding and `testID` to FAB for measurement**

In `components/ui/FAB.tsx`, change the `TouchableOpacity` to forward a ref. Replace the component signature and return:

```tsx
import React, { forwardRef } from 'react'
import { TouchableOpacity, StyleSheet, Animated, type View } from 'react-native'
import { Plus } from 'phosphor-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface Props {
  onPress: () => void
}

export const FAB = forwardRef<View, Props>(function FAB({ onPress }, ref) {
  const insets = useSafeAreaInsets()
  const [glowAnim] = React.useState(() => new Animated.Value(0.45))

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.45, duration: 1400, useNativeDriver: true }),
      ])
    ).start()
  }, [glowAnim])

  return (
    <TouchableOpacity
      ref={ref}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityLabel="New session"
      accessibilityRole="button"
      testID="fab-new-session"
      style={[styles.fab, { bottom: 24 + insets.bottom }]}
    >
      <Animated.View style={[styles.glow, { opacity: glowAnim }]} />
      <Plus size={22} color="#e6edf3" weight="bold" />
    </TouchableOpacity>
  )
})
```

Leave the `styles` StyleSheet unchanged.

- [ ] **Step 2: Wire TourOverlay into `app/index.tsx`**

Add these imports near the top of `app/index.tsx` (after existing imports):

```tsx
import { useRef, useCallback } from 'react'
import type { View } from 'react-native'
import { TourOverlay } from '@/components/tour/TourOverlay'
import { useHubTour, type HubTourStep } from '@/components/tour/useHubTour'
```

Inside the Hub screen component (after the existing state declarations), add:

```tsx
const hubTour = useHubTour()
const fabRef = useRef<View>(null)
const firstCardRef = useRef<View>(null)

const measureAndRegister = useCallback(
  (step: HubTourStep, ref: React.RefObject<View | null>) => {
    if (!hubTour || !ref.current) return
    ref.current.measure((_x, _y, width, height, pageX, pageY) => {
      hubTour.registerTarget(step, { x: pageX, y: pageY, width, height })
    })
  },
  [hubTour],
)
```

Pass `ref={fabRef}` to the `<FAB>` element and add an `onLayout` handler:

```tsx
<FAB
  ref={fabRef}
  onPress={handleFABPress}
  onLayout={() => measureAndRegister('fab', fabRef)}
/>
```

Update the `FAB` props interface to accept optional `onLayout`:

In `components/ui/FAB.tsx` Props interface, add:
```tsx
interface Props {
  onPress: () => void
  onLayout?: () => void
}
```
And spread `onLayout` onto the `TouchableOpacity`:
```tsx
<TouchableOpacity
  ref={ref}
  onPress={onPress}
  onLayout={onLayout}
  ...
```

Add the TourOverlay render just before the closing `</SafeAreaView>` tag in `app/index.tsx`:

```tsx
{hubTour && (() => {
  const STEPS = [
    {
      key: 'sessionCard' as HubTourStep,
      text: 'Each card is a Claude Code session running on your Mac. Tap to open it.',
    },
    {
      key: 'laneIndicator' as HubTourStep,
      text: 'The color stripe shows state: blue = running, amber = plan, grey = done.',
    },
    {
      key: 'fab' as HubTourStep,
      text: 'Tap here to start a new session. Your Mac runs the agent; you drive from here.',
    },
  ] as const

  const step = STEPS[hubTour.stepIndex]
  const target = hubTour.targets[step.key]

  if (!target) return null

  return (
    <TourOverlay
      target={target}
      text={step.text}
      stepLabel={`${hubTour.stepIndex + 1} / ${STEPS.length}`}
      onGotIt={hubTour.advanceStep}
      onSkip={hubTour.skipTour}
    />
  )
})()}
```

- [ ] **Step 3: Register session card target**

In `app/index.tsx`, find the `SessionCard` render (or `ProjectHubCard` / `ConvRow` depending on layout). The simplest approach: register the first item via the FlashList `renderItem` callback. Add a one-time registration on the first item:

Inside the `renderItem` for whichever list is active, find the item render call. For the classic layout's `ClassicSessionsList`, pass `firstCardRef` and register on first render:

```tsx
// In the renderItem for sessions, wrap the first card:
// if (index === 0 && firstCardRef.current === null) { ... }
// This is handled per-layout — add to whichever renderItem is active.
```

> **Simplified approach:** Because there are three list variants (tree/hub/classic) and the session card is deep inside FlashList, for Tour step 0 ("sessionCard") use the hub screen container itself as a fallback target — it gives the overlay something to point at even before cards render:

In `app/index.tsx`, find the `<SafeAreaView ... testID="hub-screen">` element. Add `ref={firstCardRef}` and an `onLayout` handler:

```tsx
<SafeAreaView
  ref={firstCardRef}
  style={styles.container}
  edges={['top']}
  testID="hub-screen"
  onLayout={() => {
    // Register hub-screen container as the sessionCard target on first render
    if (hubTour) measureAndRegister('sessionCard', firstCardRef)
  }}
>
```

Also update the `laneIndicator` step to reuse the `sessionCard` target with a small Y offset (since lane indicator is a child of the card):

```tsx
// In STEPS array, laneIndicator fallsback to sessionCard target with offset:
// This is handled in the TourOverlay render — if laneIndicator target is missing,
// use sessionCard target:
const target =
  hubTour.targets[step.key] ??
  (step.key === 'laneIndicator' ? hubTour.targets['sessionCard'] : undefined)
```

Update the TourOverlay render block accordingly (replace `const target = hubTour.targets[step.key]` with the fallback line above).

- [ ] **Step 4: Run the full test suite to check nothing is broken**

```bash
npx jest 2>&1 | tail -20
```

Expected: All existing tests pass. (The Hub screen changes affect runtime behavior, not unit test assertions.)

- [ ] **Step 5: Commit**

```bash
git add app/index.tsx components/ui/FAB.tsx components/tour/useHubTour.ts
git commit -m "feat(tour): wire Tour A hub spotlight into Hub screen and FAB"
```

---

## Task 7: Add inline first-show hint banners (Tours B and C)

**Files:**
- Create: `components/tour/FirstShowBanner.tsx`
- Modify: `app/session/[id].tsx`
- Modify: `components/servers/NewSessionServerPicker.tsx`
- Create: `__tests__/integration/components/FirstShowBanner.test.tsx`

**Context:** Tours B (session detail) and C (new session) use inline banner cards — simpler than a spotlight, sufficient for the information density. `FirstShowBanner` is a reusable dismissible card that reads/writes an AsyncStorage key to show only once.

- [ ] **Step 1: Write failing tests for FirstShowBanner**

Create `__tests__/integration/components/FirstShowBanner.test.tsx`:

```tsx
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { FirstShowBanner } from '@/components/tour/FirstShowBanner'

beforeEach(() => {
  jest.clearAllMocks()
  ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
  ;(AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined)
})

describe('FirstShowBanner', () => {
  it('renders the hint text when not yet dismissed', async () => {
    const { findByText } = render(
      <FirstShowBanner storageKey="test_banner" text="Tap any message to see actions." />
    )
    expect(await findByText('Tap any message to see actions.')).toBeTruthy()
  })

  it('does not render when already dismissed in AsyncStorage', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue('seen')
    const { queryByText } = render(
      <FirstShowBanner storageKey="test_banner" text="Some hint" />
    )
    // Give it time to init
    await waitFor(() => {
      expect(queryByText('Some hint')).toBeNull()
    })
  })

  it('hides the banner and saves seen when dismiss button is pressed', async () => {
    const { findByTestId, queryByText } = render(
      <FirstShowBanner storageKey="test_banner" text="Some hint" />
    )
    const btn = await findByTestId('first-show-banner-dismiss')
    fireEvent.press(btn)
    await waitFor(() => {
      expect(queryByText('Some hint')).toBeNull()
    })
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('test_banner', 'seen')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest "__tests__/integration/components/FirstShowBanner.test.tsx" 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `components/tour/FirstShowBanner.tsx`**

```tsx
import React, { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface Props {
  storageKey: string
  text: string
}

export function FirstShowBanner({ storageKey, text }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(storageKey).then((v) => {
      if (v !== 'seen') setVisible(true)
    })
  }, [storageKey])

  const dismiss = useCallback(() => {
    setVisible(false)
    AsyncStorage.setItem(storageKey, 'seen')
  }, [storageKey])

  if (!visible) return null

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{text}</Text>
      <TouchableOpacity
        testID="first-show-banner-dismiss"
        onPress={dismiss}
        hitSlop={8}
      >
        <Text style={styles.dismiss}>Got it</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.25)',
    borderRadius: 8,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 10,
  },
  text: {
    flex: 1,
    color: '#94aac7',
    fontSize: 12.5,
    lineHeight: 18,
  },
  dismiss: {
    color: '#3b82f6',
    fontFamily: 'Menlo',
    fontSize: 11.5,
    fontWeight: '600',
  },
})
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npx jest "__tests__/integration/components/FirstShowBanner.test.tsx" 2>&1 | tail -10
```

Expected: All 3 tests pass.

- [ ] **Step 5: Add Tour B banner to `app/session/[id].tsx`**

In `app/session/[id].tsx`, add the import:

```tsx
import { FirstShowBanner } from '@/components/tour/FirstShowBanner'
```

Find the point just below the screen header / just above the message list (the location will vary — look for the JSX root element or a `<View>` wrapping the message list). Insert:

```tsx
<FirstShowBanner
  storageKey="threadbase_tour_session"
  text="Tool calls and output stream here in real time. Type a follow-up below while Claude is still working."
/>
```

Place it **above** the message list `<View>` and **below** the screen header.

- [ ] **Step 6: Add Tour C banner to `NewSessionServerPicker`**

In `components/servers/NewSessionServerPicker.tsx`, add the import:

```tsx
import { FirstShowBanner } from '@/components/tour/FirstShowBanner'
```

Find the modal/sheet content root. Insert before the project picker or first interactive element:

```tsx
<FirstShowBanner
  storageKey="threadbase_tour_new_session"
  text="Choose a project (directory on your Mac) and describe your task. Claude starts immediately."
/>
```

- [ ] **Step 7: Run full test suite**

```bash
npx jest 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add components/tour/FirstShowBanner.tsx __tests__/integration/components/FirstShowBanner.test.tsx app/session/[id].tsx components/servers/NewSessionServerPicker.tsx
git commit -m "feat(tour): add FirstShowBanner for session detail and new session contextual hints"
```

---

## Task 8: Add "Restart app tour" to Settings

**Files:**
- Modify: `app/settings.tsx`

**Context:** Users who dismissed tours too quickly need a way to replay them. Settings gets a "Restart app tour" row that clears all three AsyncStorage tour keys.

- [ ] **Step 1: Add the reset function and UI row**

In `app/settings.tsx`, add the import:

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage'
```

Add a handler function inside the component:

```tsx
const handleRestartTour = useCallback(async () => {
  await Promise.all([
    AsyncStorage.removeItem('threadbase_tour_hub'),
    AsyncStorage.removeItem('threadbase_tour_session'),
    AsyncStorage.removeItem('threadbase_tour_new_session'),
  ])
}, [])
```

Find an appropriate section in the Settings screen JSX (e.g., near the "About" or "General" section). Add a pressable row:

```tsx
<Pressable
  testID="settings-restart-tour"
  onPress={handleRestartTour}
  style={styles.row}
>
  <Text style={styles.rowLabel}>Restart app tour</Text>
</Pressable>
```

(Use whatever `styles.row` and `styles.rowLabel` patterns already exist in `app/settings.tsx` to stay consistent with the existing Settings UI.)

- [ ] **Step 2: Run full test suite**

```bash
npx jest 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/settings.tsx
git commit -m "feat(settings): add Restart app tour option to clear tour seen state"
```

---

## Task 9: Verify E2E Maestro flow (if simulator available)

- [ ] **Step 1: Check simulator is booted**

```bash
xcrun simctl list devices booted | grep "Booted"
```

Expected: at least one booted simulator.

- [ ] **Step 2: Run mock E2E suite**

```bash
npm run test:e2e:mock 2>&1 | tail -30
```

Expected: `03_hub.yaml` and `04_session_detail.yaml` both pass. If not, investigate regressions — do not skip.

- [ ] **Step 3: Final commit message if all green**

No new commit needed — this is a verification gate only.

---

## Spec Coverage Self-Review

| Spec Requirement | Task |
|-----------------|------|
| Remove ThemeStep, ValuePropStep, ServerNameStep, TourStep | Task 1 |
| TOTAL_STEPS = 4 | Task 1 |
| Remove `pendingServerName` state | Task 1 |
| Add `notifications.body` copy | Task 2 |
| Update ConnectStep choose-mode card copy | Task 2 |
| Update DoneStep unpaired framing | Task 2 |
| Two-section manual mode card | Task 3 |
| Copyable `tb token --new` command | Task 3 |
| Plain "Server URL" / "Token" labels | Task 3 |
| Remove faux-shell `$ tb pair --server` labels | Task 3 |
| Token tooltip (`?` icon) | Task 3 |
| CTA "Connect" (was "Open handshake") | Task 3 |
| Remove footnote | Task 3 |
| TourOverlay component with spotlight + card | Task 4 |
| useHubTour hook — 3-step, AsyncStorage persistence | Task 5 |
| Hub Tour A wired to FAB + session card | Task 6 |
| FirstShowBanner for Tours B and C | Task 7 |
| Session detail Tour B hint | Task 7 |
| New session Tour C hint | Task 7 |
| Settings "Restart app tour" | Task 8 |
| E2E no regression | Task 9 |
