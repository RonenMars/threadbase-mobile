# Splash Screen Animation Design

## Overview

Replace the current static dark splash screen with an animated splash that reflects the Threadbase icon identity: glowing thread lines on a dark developer-tool background. The animation uses `react-native-reanimated` for the animated splash component and `expo-splash-screen` to manage the native-to-JS handoff.

## Design Decisions

- **Direction:** Developer tool energy — fast, precise, code-like animations
- **Total duration:** ~5s (including exit transition)
- **Exit transition:** Matrix-style number rain + horizontal sweep bar (simultaneous)
- **Library:** `react-native-reanimated` (already installed) for all animations. No Lottie or additional dependencies.

## Color Palette (from icon)

| Token | Value | Usage |
|---|---|---|
| `bg` | `#0d1117` | Splash background (matches app theme) |
| `blue-bright` | `#79c0ff` | Top thread line, brightest glow |
| `blue-mid` | `#58a6ff` | Middle thread lines, vertical line top |
| `blue-dim` | `#58a6ff66` | Faded lower lines |
| `orange` | `#f0883e` | Bottom thread line, vertical line bottom |
| `text` | `#c9d1d9` | "threadbase" wordmark |

## Animation Sequence

### Phase 1 (0.0s - 0.7s): Vertical Line Draw

A 2px vertical line draws downward from top to bottom of the thread group. Gradient from `blue-mid` at top to `orange` at bottom. Eased out.

### Phase 2 (0.7s - 2.0s): Thread Lines + Nodes

Five horizontal thread lines draw left-to-right sequentially, staggered ~220ms apart. Each line's corresponding circle node scales in from 0 with a slight overshoot. Lines have glow shadows matching their color. Widths vary per line to match the icon (120, 95, 80, 100, 130px proportions).

### Phase 3 (2.0s - 2.5s): Text Reveal

"threadbase" text fades up (translateY + opacity) in monospace font with letter-spacing. Positioned below the thread lines.

### Phase 4 (2.5s - 3.0s): Vertical Line Exit

The vertical line slides out downward (translates off-screen to the bottom) with easeIn timing. Fades to 0 as it exits.

### Phase 5+6 (3.0s - 5.0s): Matrix Rain + Sweep Bar (simultaneous)

These two effects run at the same time:

**Matrix rain:** Thread lines and nodes dissolve. Each line spawns ~12-15 number characters (digits 0-9 only) at the positions along the line. Characters fall slowly downward with varying speeds (15-50 units/s) and fade out over ~1.5-2.5s. Staggered start delays up to 250ms per character.

**Horizontal sweep bar:** A 3px gradient bar (blue-to-orange) sweeps left-to-right across the top of the screen over the full 2 seconds. Glow shadow on the bar.

### Transition to App

After the sweep bar completes, the splash component fades out (200ms) revealing the app underneath. `SplashScreen.hideAsync()` is called at the start of the animation (to hide the native splash), while the animated React component plays on top.

## Architecture

### Files to Create

| File | Purpose |
|---|---|
| `components/SplashAnimation.tsx` | Animated splash screen component using Reanimated |

### Files to Modify

| File | Change |
|---|---|
| `app/_layout.tsx` | Import `expo-splash-screen`, call `SplashScreen.preventAutoHideAsync()`, render `SplashAnimation` on top of app content, hide native splash when animation starts |
| `app.json` | No changes needed (already has correct `splash.backgroundColor`) |

### Component: `SplashAnimation.tsx`

- Full-screen `View` with `StyleSheet.absoluteFill` and `#0d1117` background, rendered above the app
- Uses `react-native-reanimated` shared values and `useAnimatedStyle` for all animations
- Vertical line: animated height, then animated translateY for exit
- Thread lines: 5 instances with staggered `withDelay` + `withTiming` for width animation
- Nodes: 5 circle views with staggered `withDelay` + `withSpring` for scale
- Text: animated opacity + translateY
- Matrix characters: spawned as an array of animated `Text` components with individual translateY + opacity animations
- Sweep bar: animated width from 0 to screen width
- Final fade: animated opacity on the root container, calls `onComplete` callback when done
- Accepts `onComplete: () => void` prop

### Integration in `_layout.tsx`

```
SplashScreen.preventAutoHideAsync()

function RootLayout() {
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    SplashScreen.hideAsync()  // hide native splash immediately, animated component takes over
  }, [])

  return (
    <GestureHandlerRootView>
      {/* ...existing app tree... */}
      {!splashDone && (
        <SplashAnimation onComplete={() => setSplashDone(true)} />
      )}
    </GestureHandlerRootView>
  )
}
```

The animated splash sits on top via absolute positioning. When it completes, it unmounts.

## Constraints

- No new dependencies — use only `react-native-reanimated` and `expo-splash-screen` (both already installed)
- Matrix characters are **digits only** (0-9)
- Background color must match `#0d1117` for seamless native-to-JS transition
- Animation must not block app initialization (AuthGate, server loading, etc. happen underneath)
- Component must clean up properly on unmount

## Success Criteria

1. App launches with dark native splash, transitions seamlessly to animated splash
2. Full animation sequence plays: vertical line draw, thread lines, text, vertical line exit, matrix rain + sweep bar
3. App is usable immediately after animation completes (no extra loading delay)
4. Animation feels smooth at 60fps on both iOS and Android
5. No flash of unstyled content between native splash and animated splash
