> **Archived 2026-05-22.** This file has been moved to the archive. Active backlog/roadmap now lives in [`docs/BACKLOG.md`](../../../BACKLOG.md) and [`docs/ROADMAP.md`](../../../ROADMAP.md). The contents below are preserved verbatim for historical reference.

---

# NativeWind Wave 1 — `components/ui/` Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all 8 `components/ui/` primitives from `StyleSheet.create` to NativeWind `className=` props, install `clsx`, and update the tailwind config to include all missing token mappings.

**Architecture:** Install `clsx` and create `lib/cn.ts`. Expand `tailwind.config.js` with the full token set (text colors, font sizes, radius, accent-subtle). Then migrate each primitive one at a time — remove its `StyleSheet.create` block and replace with `className=` strings. Components with runtime/animated values (`Skeleton`, `ProgressBar`, `FAB`) keep a minimal `StyleSheet` or inline `style=` only for those values. All existing tests must pass after every task.

**Tech Stack:** NativeWind 4.x, Tailwind CSS 3.x, clsx, React Native 0.83, Expo SDK 55, Jest + `@testing-library/react-native`

---

## File Map

| Action | File |
|---|---|
| Create | `lib/cn.ts` |
| Modify | `tailwind.config.js` |
| Modify | `components/ui/Card.tsx` |
| Modify | `components/ui/Badge.tsx` |
| Modify | `components/ui/EmptyState.tsx` |
| Modify | `components/ui/FAB.tsx` |
| Modify | `components/ui/Skeleton.tsx` |
| Modify | `components/ui/LoadingOverlay.tsx` |
| Modify | `components/ui/AvatarMenu.tsx` |
| Modify | `components/ui/ProgressBar.tsx` |
| Modify (tests) | `__tests__/integration/components/Card.test.tsx` |
| Modify (tests) | `__tests__/integration/components/Badge.test.tsx` |

---

## Task 1: Install `clsx` and create `lib/cn.ts`

**Files:**
- Create: `lib/cn.ts`

- [ ] **Step 1: Install clsx**

```bash
npm install clsx
```

Expected: clsx added to `dependencies` in `package.json`.

- [ ] **Step 2: Create `lib/cn.ts`**

```ts
import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]): string {
  return clsx(...inputs)
}
```

- [ ] **Step 3: Verify TypeScript resolves `@/lib/cn`**

```bash
npx tsc --noEmit 2>&1 | grep "lib/cn" || echo "No errors for lib/cn"
```

Expected: no errors mentioning `lib/cn`.

- [ ] **Step 4: Run full test suite to confirm baseline**

```bash
npx jest --passWithNoTests 2>&1 | tail -5
```

Expected: all tests pass (no regressions before we touch components).

- [ ] **Step 5: Commit**

```bash
git add lib/cn.ts package.json package-lock.json
git commit -m "feat: add clsx utility for NativeWind className merging"
```

---

## Task 2: Expand `tailwind.config.js` with full token set

The current config is missing text colors, font sizes, border-radius tokens, and `accent-subtle`. This task adds them all.

**Files:**
- Modify: `tailwind.config.js`

- [ ] **Step 1: Replace `tailwind.config.js` with the expanded config**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0d1117',
          secondary: '#161b22',
          card: '#21262d',
        },
        text: {
          primary: '#e6edf3',
          secondary: '#7d8590',
          accent: '#58a6ff',
          danger: '#f85149',
          warning: '#d29922',
          success: '#3fb950',
        },
        accent: {
          DEFAULT: '#58a6ff',
          subtle: 'rgba(88,166,255,0.12)',
        },
        border: '#30363d',
        status: {
          running: '#3fb950',
          waiting: '#d29922',
          failed: '#f85149',
          idle: '#7d8590',
          completed: '#58a6ff',
        },
      },
      fontSize: {
        'font-xs':   ['11px', { lineHeight: '15px' }],
        'font-sm':   ['13px', { lineHeight: '18px' }],
        'font-base': ['15px', { lineHeight: '20px' }],
        'font-lg':   ['17px', { lineHeight: '22px' }],
        'font-xl':   ['20px', { lineHeight: '26px' }],
        'font-xxl':  ['24px', { lineHeight: '30px' }],
      },
      borderRadius: {
        'radius-sm': '6px',
        'radius-md': '10px',
        'radius-lg': '16px',
      },
      fontFamily: {
        mono: ['SpaceMono', 'monospace'],
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 2: Run tests to confirm config change doesn't break anything**

```bash
npx jest --passWithNoTests 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.js
git commit -m "feat: expand tailwind config with full token set (text, font, radius, accent-subtle)"
```

---

## Task 3: Migrate `Card.tsx`

`Card` is the simplest component with a variant prop. The `style?` escape-hatch prop stays — callers may still pass runtime styles. The variant border colors map to named status classes.

**Files:**
- Modify: `components/ui/Card.tsx`
- Modify: `__tests__/integration/components/Card.test.tsx`

- [ ] **Step 1: Update the Card test to work with className-based styling**

The existing test asserts on `style` arrays containing `{ borderColor: dark.status.waiting }`. After migration, variant styles come from `className=`, not a `style` prop, so that assertion needs to change. The test should verify the `className` prop contains the right class instead.

Replace `__tests__/integration/components/Card.test.tsx` with:

```tsx
import React from 'react'
import { Text } from 'react-native'
import { render } from '@testing-library/react-native'
import { Card } from '@/components/ui/Card'

describe('Card', () => {
  it('renders children', () => {
    const { getByText } = render(<Card><Text>hello</Text></Card>)
    expect(getByText('hello')).toBeTruthy()
  })

  it('applies warning variant class', () => {
    const { getByTestId } = render(
      <Card variant="warning" testID="card"><Text>x</Text></Card>
    )
    const card = getByTestId('card')
    expect(card.props.className).toContain('border-status-waiting')
  })

  it('applies danger variant class', () => {
    const { getByTestId } = render(
      <Card variant="danger" testID="card"><Text>x</Text></Card>
    )
    const card = getByTestId('card')
    expect(card.props.className).toContain('border-status-failed')
  })

  it('renders with default variant when variant prop is omitted', () => {
    const { getByTestId } = render(
      <Card testID="card"><Text>x</Text></Card>
    )
    expect(getByTestId('card')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails (expected — Card not yet migrated)**

```bash
npx jest Card.test --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `card.props.className` is undefined.

- [ ] **Step 3: Migrate `Card.tsx`**

```tsx
import React from 'react'
import { View } from 'react-native'
import type { ViewStyle } from 'react-native'
import { cn } from '@/lib/cn'

interface CardProps {
  children: React.ReactNode
  style?: ViewStyle
  variant?: 'default' | 'warning' | 'danger'
  testID?: string
}

const VARIANT_CLASS: Record<NonNullable<CardProps['variant']>, string> = {
  default: '',
  warning:  'border-status-waiting',
  danger:   'border-status-failed',
}

export function Card({ children, style, variant = 'default', testID }: CardProps) {
  return (
    <View
      testID={testID}
      className={cn(
        'bg-bg-card rounded-radius-md p-3 border border-border mb-2 gap-1',
        VARIANT_CLASS[variant],
      )}
      style={style}
    >
      {children}
    </View>
  )
}
```

- [ ] **Step 4: Run the Card test to verify it passes**

```bash
npx jest Card.test --no-coverage 2>&1 | tail -10
```

Expected: PASS — 4 tests passing.

- [ ] **Step 5: Run full test suite**

```bash
npx jest --passWithNoTests 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/ui/Card.tsx __tests__/integration/components/Card.test.tsx
git commit -m "feat: migrate Card to NativeWind className"
```

---

## Task 4: Migrate `Badge.tsx`

`Badge` has two dynamic props — `color` (text color) and `bg` (background color) — that are passed as runtime strings by callers (e.g., status colors, server colors). These cannot be Tailwind classes since the values are unknown at build time. They stay as `style=` props on the inner elements. The static structural styles (padding, radius, font size) move to `className=`.

**Files:**
- Modify: `components/ui/Badge.tsx`
- Keep: `__tests__/integration/components/Badge.test.tsx` (no changes needed — tests check text/props, not style objects)

- [ ] **Step 1: Run Badge tests to confirm current baseline**

```bash
npx jest Badge.test --no-coverage 2>&1 | tail -10
```

Expected: PASS — 6 tests passing.

- [ ] **Step 2: Migrate `Badge.tsx`**

```tsx
import React from 'react'
import { Text, View } from 'react-native'
import { dark } from '@/constants/theme'
import { cn } from '@/lib/cn'

interface BadgeProps {
  label: string
  color?: string
  bg?: string
  size?: 'sm' | 'md'
}

export function Badge({ label, color = dark.text.secondary, bg = dark.bg.card, size = 'sm' }: BadgeProps) {
  return (
    <View
      className={cn(
        'rounded-full px-2 self-start',
        size === 'md' ? 'py-1 px-3' : 'py-0',
      )}
      style={{ backgroundColor: bg }}
    >
      <Text
        className={cn(
          'font-medium',
          size === 'md' ? 'text-font-sm' : 'text-font-xs',
        )}
        style={{ color }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  )
}
```

- [ ] **Step 3: Run Badge tests**

```bash
npx jest Badge.test --no-coverage 2>&1 | tail -10
```

Expected: PASS — 6 tests passing.

- [ ] **Step 4: Run full test suite**

```bash
npx jest --passWithNoTests 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/Badge.tsx
git commit -m "feat: migrate Badge to NativeWind className"
```

---

## Task 5: Migrate `EmptyState.tsx`

All styles are static — full migration, no `style=` needed.

**Files:**
- Modify: `components/ui/EmptyState.tsx`

- [ ] **Step 1: Run EmptyState tests to confirm baseline**

```bash
npx jest EmptyState.test --no-coverage 2>&1 | tail -10
```

Expected: PASS — 6 tests passing.

- [ ] **Step 2: Migrate `EmptyState.tsx`**

```tsx
import React from 'react'
import { View, Text } from 'react-native'

interface EmptyStateProps {
  icon?: string
  title: string
  subtitle?: string
}

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center p-6 gap-2">
      {icon ? <Text className="text-[40px] mb-2">{icon}</Text> : null}
      <Text className="text-text-primary text-font-lg font-semibold text-center">{title}</Text>
      {subtitle ? <Text className="text-text-secondary text-font-sm text-center">{subtitle}</Text> : null}
    </View>
  )
}
```

- [ ] **Step 3: Run EmptyState tests**

```bash
npx jest EmptyState.test --no-coverage 2>&1 | tail -10
```

Expected: PASS — 6 tests passing.

- [ ] **Step 4: Run full test suite**

```bash
npx jest --passWithNoTests 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/EmptyState.tsx
git commit -m "feat: migrate EmptyState to NativeWind className"
```

---

## Task 6: Migrate `AvatarMenu.tsx`

All styles are static — full migration.

**Files:**
- Modify: `components/ui/AvatarMenu.tsx`

- [ ] **Step 1: Migrate `AvatarMenu.tsx`**

```tsx
import React from 'react'
import { TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { Gear } from 'phosphor-react-native'
import { dark } from '@/constants/theme'

export function AvatarMenu() {
  const router = useRouter()

  return (
    <TouchableOpacity
      onPress={() => router.push('/settings')}
      className="w-8 h-8 items-center justify-center rounded-lg"
      accessibilityLabel="Settings"
      accessibilityRole="button"
      hitSlop={8}
    >
      <Gear size={22} color={dark.text.secondary} />
    </TouchableOpacity>
  )
}
```

> Note: `Gear`'s `color` prop stays as a token import — `phosphor-react-native` icons don't accept `className`.

- [ ] **Step 2: Run full test suite**

```bash
npx jest --passWithNoTests 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add components/ui/AvatarMenu.tsx
git commit -m "feat: migrate AvatarMenu to NativeWind className"
```

---

## Task 7: Migrate `LoadingOverlay.tsx`

`StyleSheet.absoluteFillObject` expands to `{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }` — NativeWind has `absolute inset-0` for this. The semi-transparent background color (`rgba(13, 17, 23, 0.7)`) is `bg-bg-primary` at ~70% opacity; use an arbitrary value class. `zIndex: 50` maps to `z-50`.

**Files:**
- Modify: `components/ui/LoadingOverlay.tsx`

- [ ] **Step 1: Migrate `LoadingOverlay.tsx`**

```tsx
import React from 'react'
import { View, ActivityIndicator } from 'react-native'
import { dark } from '@/constants/theme'

interface Props {
  visible: boolean
}

export function LoadingOverlay({ visible }: Props) {
  if (!visible) return null
  return (
    <View
      className="absolute inset-0 items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(13, 17, 23, 0.7)' }}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      <ActivityIndicator size="large" color={dark.text.accent} />
    </View>
  )
}
```

> Note: The `rgba(13,17,23,0.7)` background stays as `style=` — it is `bg-bg-primary` at 70% opacity, but NativeWind doesn't support opacity modifiers on custom colors in RN the same way it does on web. The `ActivityIndicator` `color` prop stays as a token import — it is a native prop, not a style.

- [ ] **Step 2: Run full test suite**

```bash
npx jest --passWithNoTests 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add components/ui/LoadingOverlay.tsx
git commit -m "feat: migrate LoadingOverlay to NativeWind className"
```

---

## Task 8: Migrate `FAB.tsx`

`FAB` has `shadowOffset`, `shadowOpacity`, `shadowRadius`, `elevation` — these stay in `StyleSheet`. The `bottom` value is dynamic (`24 + insets.bottom`). Everything else moves to `className=`.

**Files:**
- Modify: `components/ui/FAB.tsx`

- [ ] **Step 1: Migrate `FAB.tsx`**

```tsx
import React from 'react'
import { TouchableOpacity, StyleSheet } from 'react-native'
import { Plus } from 'phosphor-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface Props {
  onPress: () => void
}

export function FAB({ onPress }: Props) {
  const insets = useSafeAreaInsets()
  return (
    <TouchableOpacity
      onPress={onPress}
      className="absolute right-4 w-14 h-14 rounded-full bg-[#1e7a3a] items-center justify-center"
      style={[styles.shadow, { bottom: 24 + insets.bottom }]}
      activeOpacity={0.85}
      accessibilityLabel="New session"
      accessibilityRole="button"
    >
      <Plus size={24} color="#000" weight="bold" />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
})
```

- [ ] **Step 2: Run full test suite**

```bash
npx jest --passWithNoTests 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add components/ui/FAB.tsx
git commit -m "feat: migrate FAB to NativeWind className (shadow stays StyleSheet)"
```

---

## Task 9: Migrate `Skeleton.tsx`

`SkeletonBox` uses `Animated.Value` for opacity — that stays as a `style=` prop. The `width`, `height`, and `borderRadius` props are caller-supplied runtime values — they stay as `style=` too. The only static style (`backgroundColor: dark.border`) moves to `className=`.

**Files:**
- Modify: `components/ui/Skeleton.tsx`

- [ ] **Step 1: Migrate `Skeleton.tsx`**

```tsx
import React, { useEffect, useRef } from 'react'
import { Animated, type DimensionValue, type ViewStyle } from 'react-native'
import { radius } from '@/constants/theme'

type SkeletonBoxProps = {
  width?: DimensionValue
  height?: number
  borderRadius?: number
  style?: ViewStyle
}

export function SkeletonBox({ width = '100%', height = 14, borderRadius: br = radius.sm, style }: SkeletonBoxProps) {
  const anim = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.85, duration: 650, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.35, duration: 650, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [anim])

  return (
    <Animated.View
      className="bg-border"
      style={[{ width, height, borderRadius: br, opacity: anim }, style]}
    />
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx jest --passWithNoTests 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add components/ui/Skeleton.tsx
git commit -m "feat: migrate Skeleton to NativeWind className (animated opacity stays style)"
```

---

## Task 10: Migrate `ProgressBar.tsx`

The animated `width` interpolation stays as `style=` (runtime `Animated.Value`). Static structural and color styles move to `className=`.

**Files:**
- Modify: `components/ui/ProgressBar.tsx`

- [ ] **Step 1: Migrate `ProgressBar.tsx`**

```tsx
import React, { useEffect, useRef } from 'react'
import { View, Text, Animated } from 'react-native'

interface Props {
  loaded: number
  total: number
  label: string
  isCounting?: boolean
}

export function ProgressBar({ loaded, total, label, isCounting = false }: Props) {
  const animWidth = useRef(new Animated.Value(0)).current
  const progress = total > 0 ? Math.min(loaded / total, 1) : 0

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: progress,
      duration: 200,
      useNativeDriver: false,
    }).start()
  }, [progress])

  return (
    <View className="px-3 pt-4 pb-3 gap-2">
      <Text className="text-text-secondary text-font-sm text-center">
        {loaded.toLocaleString()} / {total.toLocaleString()} {label}
      </Text>
      <View className="h-1 bg-bg-card rounded-full overflow-hidden">
        <Animated.View
          className="h-full bg-text-accent rounded-full"
          style={{
            width: animWidth.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          }}
        />
      </View>
    </View>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx jest --passWithNoTests 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add components/ui/ProgressBar.tsx
git commit -m "feat: migrate ProgressBar to NativeWind className (animated width stays style)"
```

---

## Task 11: Final verification

- [ ] **Step 1: Run the full test suite one last time**

```bash
npx jest --passWithNoTests 2>&1 | tail -10
```

Expected: all tests pass, no regressions.

- [ ] **Step 2: Verify no stray `StyleSheet.create` calls remain in `components/ui/`**

```bash
grep -r "StyleSheet.create" components/ui/
```

Expected output — only `FAB.tsx` should remain (for shadow):
```
components/ui/FAB.tsx:  shadow: {
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.
