# Implementation Brief — Onboarding · Variation B (Novel)

> Hand this file to Claude Code along with the `onboarding/` and `colors_and_type.css` from the Threadbase Design System project. The reference HTML lives at `onboarding/index.html` (artboard "B · Novel"). Source of truth for screen logic: `onboarding/VariationB.jsx`. Source of truth for shared shell + animation keyframes: `onboarding/OnboardingShell.jsx`. Source of truth for tokens: `colors_and_type.css` (CSS vars).

---

## What you're building

A 6-step first-launch onboarding flow for the Threadbase mobile app (React Native / Expo 51 / NativeWind). Terminal-flavored, glow-heavy aesthetic. Single phone screen, swipe gestures + Skip + Back chrome, animated direction-aware step transitions, pager dots at the bottom.

**Steps in order:**
1. **Welcome** — Animated weaving threads behind a glowing app icon. Headline "Pull a thread. Watch it weave." Single primary CTA "Begin handshake".
2. **Value prop** — "Your laptop is the runtime. Your phone is the cockpit." Phone↔Laptop diagram with two animated dashed bezier arcs labelled `prompts ▸` (blue) and `◂ stdout` (amber).
3. **Connect (manual URL + token)** — Mock terminal card with traffic-light dots, two stacked input fields styled as `tb pair --server` / `tb pair --token`. On Submit: simulated handshake log appends line-by-line with colored severity prefixes, ending in `✓ ready`.
4. **Notifications** — Mock iOS push notification preview, then a tap-to-allow card with toggle state and a checkmark dot.
5. **Tour** — 3 concept slides (Kanban, Queue, Terminal), one at a time, with a thin progress bar. Each slide has a 200px illustration + tagline + body. Final CTA "Drop me in".
6. **Done** — Green-glow celebratory state. Pulsing dot + paired status: `paired · work-laptop.local · 7331`.

---

## Stack mapping (web prototype → React Native)

| Prototype concept | RN equivalent |
|---|---|
| `<div style={{flex:1}}>` | `<View style={{flex:1}}>` |
| CSS custom props (`var(--tb-blue-400)`) | NativeWind theme tokens or a `theme.ts` constants file. Map every var in `colors_and_type.css` to a token. |
| `font:"600 14px/1.2 var(--font-sans)"` | `{ fontFamily: 'Inter-SemiBold', fontSize: 14, lineHeight: 17 }` |
| Inline `<svg>` thread paths | `react-native-svg` `<Svg><Path/></Svg>` |
| CSS `@keyframes` (glow, thread-pulse, fade, pop, cursor) | `react-native-reanimated` shared values + `withRepeat(withTiming(...))` |
| `onTouchStart` / `onTouchEnd` swipe | `react-native-gesture-handler` `<PanGestureHandler>` or `<Gesture.Pan()>` driving a Reanimated translateX |
| `localStorage`-style step persistence | `expo-secure-store` for the paired-token, `AsyncStorage` for `hasCompletedOnboarding` |
| Pager dots animated width | Reanimated `withTiming(width === active ? 22 : 6)` |

---

## Files to create

```
src/screens/onboarding/
├─ OnboardingNavigator.tsx        # Stack of 6 screens; controls index, swipe, transitions
├─ OnboardingShell.tsx            # Top chrome (Back/Skip), bottom pager dots, animated container
├─ steps/
│   ├─ WelcomeStep.tsx            # Step 1
│   ├─ ValuePropStep.tsx          # Step 2
│   ├─ ConnectStep.tsx            # Step 3
│   ├─ NotificationsStep.tsx      # Step 4
│   ├─ TourStep.tsx               # Step 5 (internal sub-index 0..2)
│   └─ DoneStep.tsx               # Step 6
├─ components/
│   ├─ PrimaryButton.tsx
│   ├─ GhostButton.tsx
│   ├─ PagerDots.tsx
│   ├─ ThreadField.tsx            # Animated SVG bg used on Welcome and Done
│   └─ TerminalCard.tsx           # Reusable: traffic-light header + monospace body
├─ animations.ts                  # Shared Reanimated helpers (glow, threadPulse, pop)
└─ theme.ts                       # Color + font tokens lifted from colors_and_type.css
```

---

## Token contract (`theme.ts`)

Lift from `colors_and_type.css`. Use these exact keys; the visual review depends on them.

```ts
export const colors = {
  ink0: '#070b11', ink1: '#0c1118', ink2: '#11171f', ink3: '#161d27',
  ink5: '#283242', ink6: '#3a4658',
  fg0: '#e6edf6', fg1: '#cdd5e0', fg2: '#9ba8c0', fg3: '#6b7a93', fg4: '#4a5870',
  blue400: '#63b3ff', blue500: '#3a8fdf',
  amber400: '#f08a24', amber500: '#c46f1a',
  green400: '#4ade80', green500: '#22c55e',
  red400:   '#f87171',
};

export const fonts = {
  sans: 'Inter',
  mono: 'JetBrainsMono',
  // weight variants: 'Inter-Regular' | 'Inter-Medium' | 'Inter-SemiBold' …
};
```

---

## Behavior contract

- **Navigation state** lives in `OnboardingNavigator.tsx`: `index: 0..5`, `direction: -1|0|1`. Swipe left → `index+1`, swipe right → `index-1`. Threshold: 50px horizontal travel.
- **Skip button** (top right) jumps directly to `index = 5`. Hidden on the last step.
- **Back button** (top left) decrements. Hidden on step 0.
- **Step transition**: each step keyed on `index`; entering content fades + slides in 18px from the direction of travel (`ob-in-r` / `ob-in-l` keyframes in `OnboardingShell.jsx`). Reproduce with Reanimated `enteringWith` / `exitingWith`.
- **Persistence**: on completing step 6, write `{ onboarded: true, server, tokenHash }` to secure storage. Don't store the raw token.
- **Connect step** must not actually hit the network in the prototype implementation — gate it behind a `useTBPair()` hook that mocks the latency in dev and calls real handshake in prod.

---

## Per-step spec (read alongside `VariationB.jsx`)

### 1 · Welcome (`WelcomeStep.tsx`)
- Background: `<ThreadField/>` — 7 sinusoidal SVG paths, alternating blue/amber gradients, dashed strokes (`4 6` / `2 8`), each animated with a `threadPulse` (5–7s loop, staggered by 0.3s/path). Opacity 0.55.
- Center stack: 96×96 rounded app icon (radius 22) with cyan glow ring (`rgba(99,179,255,0.4)` → transparent radial), pulsing 2.4s. Icon has a 1px blue inner border + 16px blue drop shadow.
- Eyebrow: `// AMBIENT CODING` in mono 11px, letter-spacing 0.18em, uppercase, `fg3`.
- Headline: 36px / line-height 1.0 / weight 600 / letter-spacing -0.03em. Two lines, second line in `blue400`. Text `pretty`-balanced.
- Body: 14.5px Inter, `fg2`, max-width 280, centered.
- CTA: full-width primary button "Begin handshake".

### 2 · Value Prop (`ValuePropStep.tsx`)
- Eyebrow: `> 01 / WHY` in `amber400` mono.
- Headline: "Your laptop is the runtime." (high-contrast) + "Your phone is the cockpit." (`fg3`). 30px / 1.1 / -0.025em.
- Diagram card (`ink0` bg, `ink5` border, radius 14, 22px vertical padding):
  - Left: 46×74 phone glyph, 1.5px `blue400` border, 4px blue glow, "YOU" caption in `blue400` mono.
  - Right: 78×50 laptop lid + 90×3 base, 1.5px `amber400` border, 4px amber glow, "RUNTIME" caption in `amber400` mono. Inside lid: `claude run` text in 8px amber mono.
  - Middle: two dashed bezier arcs (top blue label `prompts ▸`, bottom amber label `◂ stdout`), each animated `threadPulse` 2.4s, the amber one delayed 1.2s for ping-pong feel.
- Body: 14px `fg2` paragraph below diagram.
- CTA: "Pair my laptop".

### 3 · Connect (`ConnectStep.tsx`) — the signature screen
- Eyebrow: `> 02 / PAIR`.
- Headline: "Connect a runtime." 26px / 1.1 / -0.022em.
- **Terminal card** (`ink0`, radius 12, 12px padding):
  - Header row: 3 traffic-light dots (`red400`, `amber400`, `green400`, 8px each) + `~/threadbase pair` label in `fg4` mono 10px, separated by a 1px `ink5` divider.
  - Two fields rendered as command lines:
    - `$ tb pair --server` (label, `fg3`)
    - `› <input>` (the actual TextInput; transparent bg, mono 12.5px, `fg0`, no border)
    - `$ tb pair --token` (label)
    - `› <secret input>` (password)
  - Below the inputs, when handshake fires, append log lines (animated fade-in, 200ms each) with severity prefixes: `[01]` `dial https://…` (blue), `[02]` `mdns → 192.168.1.42:7331` (`fg3`), `[03]` `tls 1.3 · cert ok · token verifying…` (`fg3`), `[04]` `paired as iphone-15.local` (`green400`), then `✓ ready`.
- Footnote in `fg4` mono: `// On your desktop, run tb token --new to mint one.`
- CTA: "Open handshake" → "…handshake" while busy → auto-advances on success (700ms after `paired`).
- **Validation**: button enabled when `url.startsWith('http')` AND `token.length >= 8`.

### 4 · Notifications (`NotificationsStep.tsx`)
- Eyebrow: `> 03 / NOTIFY`.
- Headline: "Wake me only when it counts."
- Body: "Push fires on plan-ready, tool-confirms, and run failures. That's it."
- **Mock notification preview card**: gradient bg `linear-gradient(180deg, rgba(99,179,255,0.10), rgba(99,179,255,0.02))`, `ink5` border, radius 14. Inside: 32×32 app icon + `THREADBASE` mono label + `now` timestamp + bold title `Plan ready · feat/queue` + body `3 files queued for edit. Tap to review.`
- **Allow card** (toggleable, full-width tap target): 42×42 bell icon container (color flips between `fg3` on `ink3` and `blue400` on transparent-blue) + label "Push notifications" + status caption `TAP TO ALLOW` ↔ `ENABLED · alerts.threadbase.dev` + 18×18 round checkbox (filled `blue500` when on). Border flips between `ink5` and `blue500`.
- CTA: "Continue" or "Skip — I'll watch the kanban".

### 5 · Tour (`TourStep.tsx`)
- Eyebrow: `> 04 / TOUR · 01/03`.
- Right caption: current `tag` (`kanban` / `queue` / `terminal`) in mono 10px `fg3`.
- 200px illustration card (`ink0`, `ink5` border, radius 14) — three variants:
  - **Kanban**: 3 lanes (running/plan/done), each with a small dot (the running one pulses), labelled in mono. 1–2 cards per lane: `ink2` bg with a 2px left border in the lane color, two skeleton bars and a `⎇ feat/q-N` branch label.
  - **Queue**: header `↓ QUEUE · 4 prompts` in mono. 4 list items with a status badge (`now` / `next` / `+2` / `+3`) and a fake task title. Opacity decay 12% per item; the active one has a 2px blue left border.
  - **Terminal**: monospace stdout with bracketed line numbers `[01]…[06]`, colored prefixes (`$` blue, `● tool` amber, `→` `fg3`, `✓` green, `plan` blue), patch stats `+84/-12` in green, a blinking cursor block at the end (`ob-cursor` keyframe).
- Title (22px, -0.02em) + body below.
- 3-segment progress bar (3×1px tracks, fill switches to `blue400` per index).
- CTA: "Next concept" (steps 1–2) → "Drop me in" (step 3).

### 6 · Done (`DoneStep.tsx`)
- Background: subtle radial green glow `rgba(74,222,128,0.5)` → transparent at 50% radius, opacity 0.35.
- Hero: 96×96 wrapper with green radial glow + 64×64 green checkmark circle (`green500` bg, `#0a1424` icon, `green` shadow). Pop-in animation (`ob-pop`).
- Eyebrow: `HANDSHAKE COMPLETE` in `green400` mono.
- Headline: "Thread is live." 32px / 1.05 / -0.025em.
- Body: "Your laptop is listening. Open a session whenever the mood strikes."
- **Status pill** (`ink2`, `ink5` border, radius 10): pulsing 7px `green500` dot + `paired · work-laptop.local · 7331` in mono.
- CTA: "Enter Threadbase" (no arrow icon) → navigates into the main app stack and writes `onboarded:true`.

---

## Animation keyframes to port

Defined in `OnboardingShell.jsx`. Convert each to a Reanimated worklet.

| Keyframe | Use | Reanimated recipe |
|---|---|---|
| `ob-glow` | Pulsing radial glow on icons + green dot | `withRepeat(withSequence(withTiming(1, 1200), withTiming(0.55, 1200)), -1)` |
| `ob-thread-pulse` | Background SVG threads + diagram arcs | `withRepeat(withTiming(120, 4000, Easing.linear), -1, true)` driving `strokeDashoffset` |
| `ob-fade` | Per-card / per-log-line entry | `FadeIn.duration(250)` from `react-native-reanimated` |
| `ob-pop` | Done step checkmark | `withSequence(withTiming(1.08, 220), withTiming(1, 100))` on scale, plus opacity 0→1 |
| `ob-cursor` | Terminal cursor block | `withRepeat(withTiming(0, 500, Easing.steps(2)), -1)` on opacity |
| `ob-in-r` / `ob-in-l` | Step transition | `SlideInRight.duration(350)` / `SlideInLeft` |

---

## Acceptance checklist

- [ ] All 6 steps render in order with correct copy.
- [ ] Swipe left/right + Skip + Back all advance state correctly.
- [ ] Pager dots at bottom: active dot is 22×6, others 6×6, animated 250ms.
- [ ] Welcome thread field has at least 7 paths, alternating blue/amber, dashed.
- [ ] Connect step: simulated handshake appends 4 log lines on a 200/700/1100/1700ms schedule, then auto-advances after 700ms.
- [ ] Connect button disables until URL is `http*` and token length ≥ 8.
- [ ] Notifications: tapping the Allow card flips state, border, icon background, and toggle indicator.
- [ ] Tour: progress bar fills as you advance the inner index 0→2.
- [ ] Done: green dot pulses; checkmark pops in.
- [ ] On Done CTA: writes `onboarded: true` to AsyncStorage and navigates to the kanban screen.
- [ ] No hard-coded colors anywhere — all reference `theme.ts`.
- [ ] No emoji. No purple gradients. Mono is JetBrains Mono everywhere mono is specified.

---

## What NOT to do

- Don't introduce additional steps or "tips" carousels.
- Don't add a QR-code pairing path — manual URL + token only.
- Don't replace the terminal pair screen with a "friendly" form — the terminal aesthetic IS the brand moment.
- Don't animate the icon mark itself spinning/bouncing. Glow only.
- Don't request Camera, Local Network, or Biometric permissions in this flow.
- Don't ship Inter via Google Fonts CDN at runtime — bundle the font files with `expo-font`.

---

## Reference

- Live prototype to compare against: open `onboarding/index.html` in a browser, focus the "B · Novel" artboard.
- Component source: `onboarding/VariationB.jsx`.
- Shell source: `onboarding/OnboardingShell.jsx`.
- Tokens: `colors_and_type.css`.
- App icon asset: `assets/threadbase-icon.svg`.
