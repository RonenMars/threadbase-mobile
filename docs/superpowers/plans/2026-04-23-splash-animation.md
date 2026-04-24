# Splash Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static dark splash screen with an animated splash showing the Threadbase thread-lines icon drawing in, then dissolving into matrix-style falling digits with a horizontal sweep bar.

**Architecture:** A single `SplashAnimation` component using `react-native-reanimated` renders on top of the app via absolute positioning. `expo-splash-screen` manages the native-to-JS handoff. The component accepts an `onComplete` callback and unmounts itself when the animation finishes.

**Tech Stack:** `react-native-reanimated` (animations), `expo-splash-screen` (native splash control), React Native `View`/`Text` (rendering)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `components/SplashAnimation.tsx` | Create | Full animated splash screen component |
| `app/_layout.tsx` | Modify | Wire up splash screen lifecycle |

---

### Task 1: Create SplashAnimation Component — Static Layout

**Files:**
- Create: `components/SplashAnimation.tsx`

- [ ] **Step 1: Create the component with static (non-animated) thread layout**

This step renders all visual elements at their final positions without any animation, so we can verify the layout looks correct before adding motion.

```tsx
import React from 'react'
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native'
import Animated from 'react-native-reanimated'

const COLORS = {
  bg: '#0d1117',
  blueBright: '#79c0ff',
  blueMid: '#58a6ff',
  blueDim: 'rgba(88,166,255,0.4)',
  orange: '#f0883e',
  text: '#c9d1d9',
} as const

const THREAD_LINES = [
  { widthPct: 0.30, color: COLORS.blueBright, nodeColor: COLORS.blueBright },
  { widthPct: 0.24, color: COLORS.blueMid,    nodeColor: COLORS.blueMid },
  { widthPct: 0.20, color: COLORS.blueMid,    nodeColor: COLORS.blueMid },
  { widthPct: 0.25, color: COLORS.blueDim,    nodeColor: COLORS.blueDim },
  { widthPct: 0.33, color: COLORS.orange,     nodeColor: COLORS.orange },
] as const

const LINE_GAP = 40
const NODE_SIZE = 14
const LINE_HEIGHT = 4
const VERTICAL_LINE_WIDTH = 2

interface Props {
  onComplete: () => void
}

export function SplashAnimation({ onComplete }: Props) {
  const { width: screenWidth } = useWindowDimensions()
  const nodeLeft = screenWidth * 0.25
  const lineLeft = nodeLeft + NODE_SIZE / 2 + 8
  const totalHeight = (THREAD_LINES.length - 1) * LINE_GAP

  return (
    <View style={styles.container}>
      {/* Vertical line */}
      <View
        style={[
          styles.verticalLine,
          {
            left: nodeLeft + NODE_SIZE / 2 - VERTICAL_LINE_WIDTH / 2,
            top: (styles.container as any)?.paddingTop ?? 0,
            height: totalHeight,
          },
        ]}
      />

      {/* Thread lines group */}
      <View style={[styles.threadGroup, { top: '40%' }]}>
        {THREAD_LINES.map((line, i) => (
          <View key={i} style={[styles.threadRow, { height: LINE_GAP }]}>
            {/* Node */}
            <View
              style={[
                styles.node,
                {
                  left: nodeLeft,
                  borderColor: line.nodeColor,
                  backgroundColor: i === 4 ? 'rgba(240,136,62,0.2)' : 'transparent',
                },
              ]}
            />
            {/* Line */}
            <View
              style={[
                styles.line,
                {
                  left: lineLeft,
                  width: screenWidth * line.widthPct,
                  backgroundColor: line.color,
                  shadowColor: line.color,
                },
              ]}
            />
          </View>
        ))}

        {/* Text */}
        <Text style={styles.brandText}>threadbase</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    zIndex: 9999,
  },
  verticalLine: {
    position: 'absolute',
    width: VERTICAL_LINE_WIDTH,
    backgroundColor: COLORS.blueMid,
  },
  threadGroup: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  threadRow: {
    justifyContent: 'center',
  },
  node: {
    position: 'absolute',
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 2,
  },
  line: {
    position: 'absolute',
    height: LINE_HEIGHT,
    borderRadius: LINE_HEIGHT / 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  brandText: {
    fontFamily: 'monospace',
    fontSize: 16,
    color: COLORS.text,
    letterSpacing: 3,
    textAlign: 'center',
    marginTop: 24,
  },
})
```

- [ ] **Step 2: Wire it into `_layout.tsx` temporarily to verify layout**

In `app/_layout.tsx`, add a temporary import and render to see the static layout:

At the top of the file, add:
```tsx
import { SplashAnimation } from '@/components/SplashAnimation'
```

Inside `RootLayout`, wrap the return to overlay the splash. Replace the existing return with:

```tsx
return (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthGate>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#161b22' },
              headerTintColor: '#e6edf3',
              headerShadowVisible: false,
              contentStyle: { backgroundColor: '#0d1117' },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen
              name="session/[id]"
              options={{ title: 'Session', headerBackTitle: 'Back' }}
            />
            <Stack.Screen
              name="conversation/[id]"
              options={{ title: 'Conversation', headerBackTitle: 'Back' }}
            />
          </Stack>
        </AuthGate>
      </QueryClientProvider>
    </SafeAreaProvider>
    <SplashAnimation onComplete={() => {}} />
  </GestureHandlerRootView>
)
```

- [ ] **Step 3: Run the app and visually verify the static layout**

Run: `npx expo start` and open in iOS Simulator or device.

Expected: Full-screen dark background with 5 horizontal thread lines (4 blue, 1 orange at bottom), circle nodes on the left, a vertical line connecting them, and "threadbase" text below.

- [ ] **Step 4: Commit**

```bash
git add components/SplashAnimation.tsx app/_layout.tsx
git commit -m "feat: add static splash animation layout"
```

---

### Task 2: Add Phase 1+2 Animations — Vertical Line Draw + Thread Lines

**Files:**
- Modify: `components/SplashAnimation.tsx`

- [ ] **Step 1: Add animated shared values and phase 1+2 logic**

Replace the full content of `components/SplashAnimation.tsx` with the animated version. This adds:
- Phase 1: Vertical line height animates from 0 to full
- Phase 2: Each thread line width animates from 0, staggered. Each node scales from 0.

```tsx
import React, { useEffect } from 'react'
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  runOnJS,
} from 'react-native-reanimated'

const COLORS = {
  bg: '#0d1117',
  blueBright: '#79c0ff',
  blueMid: '#58a6ff',
  blueDim: 'rgba(88,166,255,0.4)',
  orange: '#f0883e',
  text: '#c9d1d9',
} as const

const THREAD_LINES = [
  { widthPct: 0.30, color: COLORS.blueBright, nodeColor: COLORS.blueBright },
  { widthPct: 0.24, color: COLORS.blueMid,    nodeColor: COLORS.blueMid },
  { widthPct: 0.20, color: COLORS.blueMid,    nodeColor: COLORS.blueMid },
  { widthPct: 0.25, color: COLORS.blueDim,    nodeColor: COLORS.blueDim },
  { widthPct: 0.33, color: COLORS.orange,     nodeColor: COLORS.orange },
] as const

const LINE_GAP = 40
const NODE_SIZE = 14
const LINE_HEIGHT = 4
const VERTICAL_LINE_WIDTH = 2

// Timing constants (ms)
const P1_DURATION = 700   // vertical line draw
const P2_START = 700      // when thread lines begin
const P2_STAGGER = 220    // gap between each line
const P2_LINE_DUR = 400   // each line draw duration
const P2_NODE_DUR = 350   // each node pop duration

interface Props {
  onComplete: () => void
}

function ThreadLine({
  index,
  widthPct,
  color,
  nodeColor,
  nodeLeft,
  lineLeft,
  screenWidth,
}: {
  index: number
  widthPct: number
  color: string
  nodeColor: string
  nodeLeft: number
  lineLeft: number
  screenWidth: number
}) {
  const lineWidth = useSharedValue(0)
  const nodeScale = useSharedValue(0)

  useEffect(() => {
    const delay = P2_START + index * P2_STAGGER
    lineWidth.value = withDelay(
      delay,
      withTiming(screenWidth * widthPct, {
        duration: P2_LINE_DUR,
        easing: Easing.out(Easing.cubic),
      })
    )
    nodeScale.value = withDelay(
      delay,
      withSpring(1, { damping: 12, stiffness: 200 })
    )
  }, [])

  const lineStyle = useAnimatedStyle(() => ({
    width: lineWidth.value,
  }))

  const nodeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nodeScale.value }],
  }))

  return (
    <View style={[styles.threadRow, { height: LINE_GAP }]}>
      <Animated.View
        style={[
          styles.node,
          {
            left: nodeLeft,
            borderColor: nodeColor,
            backgroundColor: index === 4 ? 'rgba(240,136,62,0.2)' : 'transparent',
          },
          nodeStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.line,
          {
            left: lineLeft,
            backgroundColor: color,
            shadowColor: color,
          },
          lineStyle,
        ]}
      />
    </View>
  )
}

export function SplashAnimation({ onComplete }: Props) {
  const { width: screenWidth } = useWindowDimensions()
  const nodeLeft = screenWidth * 0.25
  const lineLeft = nodeLeft + NODE_SIZE / 2 + 8
  const totalHeight = (THREAD_LINES.length - 1) * LINE_GAP

  // Phase 1: vertical line
  const vLineHeight = useSharedValue(0)

  useEffect(() => {
    vLineHeight.value = withTiming(totalHeight, {
      duration: P1_DURATION,
      easing: Easing.out(Easing.cubic),
    })
  }, [])

  const vLineStyle = useAnimatedStyle(() => ({
    height: vLineHeight.value,
  }))

  return (
    <View style={styles.container}>
      {/* Vertical line */}
      <Animated.View
        style={[
          styles.verticalLine,
          {
            left: nodeLeft + NODE_SIZE / 2 - VERTICAL_LINE_WIDTH / 2,
          },
          vLineStyle,
        ]}
      />

      {/* Thread lines group */}
      <View style={styles.threadGroup}>
        {THREAD_LINES.map((line, i) => (
          <ThreadLine
            key={i}
            index={i}
            widthPct={line.widthPct}
            color={line.color}
            nodeColor={line.nodeColor}
            nodeLeft={nodeLeft}
            lineLeft={lineLeft}
            screenWidth={screenWidth}
          />
        ))}

        {/* Text (static for now, animated in next task) */}
        <Text style={[styles.brandText, { opacity: 0 }]}>threadbase</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    zIndex: 9999,
  },
  verticalLine: {
    position: 'absolute',
    width: VERTICAL_LINE_WIDTH,
    backgroundColor: COLORS.blueMid,
    top: '40%',
  },
  threadGroup: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '40%',
  },
  threadRow: {
    justifyContent: 'center',
  },
  node: {
    position: 'absolute',
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 2,
  },
  line: {
    position: 'absolute',
    height: LINE_HEIGHT,
    borderRadius: LINE_HEIGHT / 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  brandText: {
    fontFamily: 'monospace',
    fontSize: 16,
    color: COLORS.text,
    letterSpacing: 3,
    textAlign: 'center',
    marginTop: 24,
  },
})
```

- [ ] **Step 2: Run the app and verify phases 1+2**

Run: `npx expo start`

Expected: Vertical line draws down over 0.7s, then 5 thread lines draw left-to-right with staggered timing (~220ms apart), each node pops in with a spring effect.

- [ ] **Step 3: Commit**

```bash
git add components/SplashAnimation.tsx
git commit -m "feat: add phase 1+2 splash animations — vertical line draw and thread lines"
```

---

### Task 3: Add Phase 3+4 — Text Reveal + Vertical Line Exit

**Files:**
- Modify: `components/SplashAnimation.tsx`

- [ ] **Step 1: Add text animation shared values and vertical line exit**

In `SplashAnimation`, add these timing constants after the existing ones:

```tsx
const P3_START = 2000    // text fade-up
const P3_DURATION = 500  // text animation duration
const P4_START = 2500    // vertical line exit
const P4_DURATION = 500  // vertical line exit duration
```

Add shared values for text and vertical line exit inside the `SplashAnimation` component, after the existing `vLineHeight` value:

```tsx
  // Phase 3: text reveal
  const textOpacity = useSharedValue(0)
  const textTranslateY = useSharedValue(8)

  // Phase 4: vertical line exit
  const vLineTranslateY = useSharedValue(0)
  const vLineOpacity = useSharedValue(1)
```

In the existing `useEffect`, add the phase 3+4 animations after the `vLineHeight` animation:

```tsx
    // Phase 3: text
    textOpacity.value = withDelay(
      P3_START,
      withTiming(1, { duration: P3_DURATION, easing: Easing.out(Easing.cubic) })
    )
    textTranslateY.value = withDelay(
      P3_START,
      withTiming(0, { duration: P3_DURATION, easing: Easing.out(Easing.cubic) })
    )

    // Phase 4: vertical line exits downward
    vLineTranslateY.value = withDelay(
      P4_START,
      withTiming(350, { duration: P4_DURATION, easing: Easing.in(Easing.quad) })
    )
    vLineOpacity.value = withDelay(
      P4_START,
      withTiming(0, { duration: P4_DURATION, easing: Easing.in(Easing.quad) })
    )
```

Add animated styles:

```tsx
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }))

  // Update the vertical line style to include exit animation
  const vLineStyle = useAnimatedStyle(() => ({
    height: vLineHeight.value,
    transform: [{ translateY: vLineTranslateY.value }],
    opacity: vLineOpacity.value,
  }))
```

Replace the static `Text` element with an animated one:

```tsx
        <Animated.Text style={[styles.brandText, textStyle]}>
          threadbase
        </Animated.Text>
```

Remove the old `textStyle` that had `opacity: 0`.

- [ ] **Step 2: Run the app and verify phases 3+4**

Run: `npx expo start`

Expected: After thread lines finish drawing (~2s), "threadbase" text fades up. At ~2.5s, the vertical line slides downward off-screen and fades out.

- [ ] **Step 3: Commit**

```bash
git add components/SplashAnimation.tsx
git commit -m "feat: add phase 3+4 — text reveal and vertical line exit"
```

---

### Task 4: Add Phase 5+6 — Matrix Rain + Sweep Bar + Completion

**Files:**
- Modify: `components/SplashAnimation.tsx`

- [ ] **Step 1: Add matrix rain characters and sweep bar**

Add these timing constants:

```tsx
const P5_START = 3000    // matrix rain + sweep bar start
const P5_DURATION = 2000 // matrix rain + sweep bar duration
const FADE_OUT_START = 5000 // final fade out
const FADE_OUT_DUR = 200   // fade out duration
```

Add a helper to generate matrix characters at the top of the file (below COLORS):

```tsx
const DIGITS = '0123456789'

interface MatrixChar {
  id: number
  x: number
  y: number
  char: string
  speed: number    // translateY pixels over duration
  delay: number    // stagger delay in ms
  fadeRate: number  // opacity decay multiplier
  size: number
  color: string
}

function generateMatrixChars(
  screenWidth: number,
  nodeLeft: number,
  lineLeft: number,
): MatrixChar[] {
  const chars: MatrixChar[] = []
  let id = 0
  for (const line of THREAD_LINES) {
    const lineWidth = screenWidth * line.widthPct
    const count = Math.floor(lineWidth / 8)
    for (let c = 0; c < count; c++) {
      chars.push({
        id: id++,
        x: lineLeft + (c / count) * lineWidth,
        y: 0, // relative to thread row — will be positioned by line index
        char: DIGITS[Math.floor(Math.random() * DIGITS.length)],
        speed: 15 + Math.random() * 35,
        delay: Math.random() * 250,
        fadeRate: 0.35 + Math.random() * 0.25,
        size: 8 + Math.random() * 5,
        color: line.color,
      })
    }
  }
  return chars
}
```

Add a `MatrixCharacter` component:

```tsx
function MatrixCharacter({
  char,
  x,
  startY,
  speed,
  delay,
  size,
  color,
  trigger,
}: {
  char: string
  x: number
  startY: number
  speed: number
  delay: number
  size: number
  color: string
  trigger: Animated.SharedValue<number>
}) {
  const animStyle = useAnimatedStyle(() => {
    if (trigger.value === 0) {
      return { opacity: 0 }
    }
    // trigger.value goes 0 -> 1 over P5_DURATION
    const elapsed = trigger.value * P5_DURATION - delay
    if (elapsed < 0) {
      return {
        opacity: 0.9,
        transform: [{ translateY: 0 }],
      }
    }
    const t = elapsed / 1000
    const opacity = Math.max(0, 0.9 - t * (0.35 + (speed / 50) * 0.25))
    return {
      opacity,
      transform: [{ translateY: speed * t }],
    }
  })

  return (
    <Animated.Text
      style={[
        {
          position: 'absolute',
          left: x,
          top: startY,
          fontFamily: 'monospace',
          fontSize: size,
          color: color,
        },
        animStyle,
      ]}
    >
      {char}
    </Animated.Text>
  )
}
```

Inside `SplashAnimation`, add shared values for phase 5+6 and the final fade:

```tsx
  // Phase 5: matrix rain trigger (0 -> 1)
  const matrixProgress = useSharedValue(0)

  // Phase 5: dissolve thread lines and nodes
  const dissolveOpacity = useSharedValue(1)

  // Phase 3 text fade out (reuse)
  const textFadeOut = useSharedValue(1)

  // Phase 6: sweep bar
  const barWidth = useSharedValue(0)

  // Final fade
  const containerOpacity = useSharedValue(1)

  // Generate matrix chars
  const matrixChars = React.useMemo(
    () => generateMatrixChars(screenWidth, nodeLeft, lineLeft),
    [screenWidth, nodeLeft, lineLeft]
  )
```

Add phase 5+6 animations to the existing `useEffect`:

```tsx
    // Phase 5: dissolve threads + start matrix
    dissolveOpacity.value = withDelay(
      P5_START,
      withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) })
    )
    textFadeOut.value = withDelay(
      P5_START,
      withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) })
    )
    matrixProgress.value = withDelay(
      P5_START,
      withTiming(1, { duration: P5_DURATION, easing: Easing.linear })
    )

    // Phase 6: sweep bar (simultaneous with matrix)
    barWidth.value = withDelay(
      P5_START,
      withTiming(screenWidth, {
        duration: P5_DURATION,
        easing: Easing.out(Easing.cubic),
      })
    )

    // Final fade out
    containerOpacity.value = withDelay(
      FADE_OUT_START,
      withTiming(0, { duration: FADE_OUT_DUR }, (finished) => {
        if (finished) {
          runOnJS(onComplete)()
        }
      })
    )
```

Add animated styles for dissolve, bar, and container:

```tsx
  const dissolveStyle = useAnimatedStyle(() => ({
    opacity: dissolveOpacity.value,
  }))

  const textAnimStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value * textFadeOut.value,
    transform: [{ translateY: textTranslateY.value }],
  }))

  const barStyle = useAnimatedStyle(() => ({
    width: barWidth.value,
    opacity: barWidth.value > 0 ? 1 : 0,
  }))

  const containerAnimStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }))
```

Update the JSX return — wrap the container in `Animated.View`, wrap thread lines in dissolve layer, add matrix chars and sweep bar:

```tsx
  return (
    <Animated.View style={[styles.container, containerAnimStyle]}>
      {/* Sweep bar at top */}
      <Animated.View style={[styles.sweepBar, barStyle]} />

      {/* Vertical line */}
      <Animated.View
        style={[
          styles.verticalLine,
          {
            left: nodeLeft + NODE_SIZE / 2 - VERTICAL_LINE_WIDTH / 2,
          },
          vLineStyle,
        ]}
      />

      {/* Thread lines group */}
      <View style={styles.threadGroup}>
        {/* Dissolve wrapper for lines + nodes */}
        <Animated.View style={dissolveStyle}>
          {THREAD_LINES.map((line, i) => (
            <ThreadLine
              key={i}
              index={i}
              widthPct={line.widthPct}
              color={line.color}
              nodeColor={line.nodeColor}
              nodeLeft={nodeLeft}
              lineLeft={lineLeft}
              screenWidth={screenWidth}
            />
          ))}
        </Animated.View>

        {/* Text */}
        <Animated.Text style={[styles.brandText, textAnimStyle]}>
          threadbase
        </Animated.Text>

        {/* Matrix characters */}
        {THREAD_LINES.map((line, lineIdx) =>
          matrixChars
            .filter((_, i) => {
              const countPerLine = Math.floor((screenWidth * line.widthPct) / 8)
              const startIdx = THREAD_LINES.slice(0, lineIdx).reduce(
                (sum, l) => sum + Math.floor((screenWidth * l.widthPct) / 8), 0
              )
              return i >= startIdx && i < startIdx + countPerLine
            })
            .map((mc) => (
              <MatrixCharacter
                key={mc.id}
                char={mc.char}
                x={mc.x}
                startY={lineIdx * LINE_GAP}
                speed={mc.speed}
                delay={mc.delay}
                size={mc.size}
                color={mc.color}
                trigger={matrixProgress}
              />
            ))
        )}
      </View>
    </Animated.View>
  )
```

Add the sweep bar style to the `StyleSheet`:

```tsx
  sweepBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 3,
    backgroundColor: COLORS.blueMid,
    shadowColor: COLORS.blueBright,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 4,
    zIndex: 1,
  },
```

- [ ] **Step 2: Run the app and verify the full animation sequence**

Run: `npx expo start`

Expected: Full sequence plays — vertical line draws (0.7s), thread lines draw in staggered (0.7-2.0s), text fades up (2.0-2.5s), vertical line exits downward (2.5-3.0s), then simultaneously: thread lines dissolve into falling digit characters and a sweep bar fills left-to-right (3.0-5.0s). Finally the whole splash fades out and the app appears underneath.

- [ ] **Step 3: Commit**

```bash
git add components/SplashAnimation.tsx
git commit -m "feat: add phase 5+6 — matrix rain, sweep bar, and completion fade"
```

---

### Task 5: Wire Up expo-splash-screen Lifecycle

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add splash screen lifecycle management**

In `app/_layout.tsx`, add the import at the top:

```tsx
import * as SplashScreen from 'expo-splash-screen'
import { useState } from 'react'
import { SplashAnimation } from '@/components/SplashAnimation'
```

Add the prevent call at the module level (outside the component, after the `queryClient` definition):

```tsx
SplashScreen.preventAutoHideAsync()
```

Inside `RootLayout`, add state and effect:

```tsx
export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    SplashScreen.hideAsync()
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthGate>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: '#161b22' },
                headerTintColor: '#e6edf3',
                headerShadowVisible: false,
                contentStyle: { backgroundColor: '#0d1117' },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen
                name="session/[id]"
                options={{ title: 'Session', headerBackTitle: 'Back' }}
              />
              <Stack.Screen
                name="conversation/[id]"
                options={{ title: 'Conversation', headerBackTitle: 'Back' }}
              />
            </Stack>
          </AuthGate>
        </QueryClientProvider>
      </SafeAreaProvider>
      {!splashDone && (
        <SplashAnimation onComplete={() => setSplashDone(true)} />
      )}
    </GestureHandlerRootView>
  )
}
```

Note: `useEffect` is already imported in the file from the existing code.

- [ ] **Step 2: Run the app and verify the full end-to-end flow**

Run: `npx expo start`

Expected:
1. App launches with native dark splash (no flash)
2. Native splash hides, animated splash takes over seamlessly (same background color)
3. Full animation plays (~5s)
4. Splash fades out, app is visible and interactive underneath
5. No flash of unstyled content at any transition point

- [ ] **Step 3: Test on both platforms if possible**

Run on iOS simulator and Android emulator (if available). Verify animation is smooth at 60fps.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: wire up expo-splash-screen lifecycle with animated splash"
```

---

### Task 6: Polish and Tune

**Files:**
- Modify: `components/SplashAnimation.tsx`

- [ ] **Step 1: Test the animation on a real device**

Run: `npx expo start` and test on a physical device via Expo Go or development build.

Verify:
- Animation is smooth (no frame drops)
- Timing feels right (~5s total)
- Matrix digits fall slowly and naturally
- Sweep bar and matrix rain are visually synchronized
- No visual artifacts at start or end

- [ ] **Step 2: Adjust timing if needed**

If the animation feels too fast or slow, adjust the timing constants at the top of `SplashAnimation.tsx`:
- `P1_DURATION` — vertical line draw speed
- `P2_STAGGER` — gap between each thread line
- `P2_LINE_DUR` — individual line draw speed
- `P5_DURATION` — matrix rain + sweep bar duration
- `speed` range in `generateMatrixChars` — how fast digits fall

- [ ] **Step 3: Commit final polish**

```bash
git add components/SplashAnimation.tsx
git commit -m "chore: tune splash animation timing"
```
