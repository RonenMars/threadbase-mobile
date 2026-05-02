# Theming System Design

**Date:** 2026-05-02
**Status:** Approved — ready for implementation planning
**Scope:** 5-theme system (Dark, Light, Dracula, Catppuccin Mocha, Nord) via CSS custom properties + NativeWind, with theme picker in Settings

---

## 1. Overview

Replace the single hardcoded `dark` theme with a runtime-switchable 5-theme system. The mechanism is CSS custom properties: `tailwind.config.js` defines color tokens as `var(--color-*)` references, and a `ThemeProvider` applies the active theme's hex values to those variables at runtime. Every component using `className=` becomes theme-aware automatically — no per-component changes required.

Theme selection is persisted via the existing `SettingsStore` (AsyncStorage). A `useTheme()` hook provides the raw `Theme` object as an escape hatch for the ~20 cases where CSS classes can't be used (Phosphor icon colors, Animated values, `Stack.screenOptions`).

---

## 2. Theme Palettes

All palettes use official colors from their respective design systems.

### Dark (existing default)
| Token | Value |
|---|---|
| bg.primary | `#0d1117` |
| bg.secondary | `#161b22` |
| bg.card | `#21262d` |
| text.primary | `#e6edf3` |
| text.secondary | `#7d8590` |
| text.accent | `#58a6ff` |
| text.danger | `#f85149` |
| text.warning | `#d29922` |
| text.success | `#3fb950` |
| border | `#30363d` |
| status.running | `#3fb950` |
| status.waiting | `#d29922` |
| status.failed | `#f85149` |
| status.completed | `#58a6ff` |
| status.idle | `#7d8590` |

### Light
| Token | Value |
|---|---|
| bg.primary | `#ffffff` |
| bg.secondary | `#f6f8fa` |
| bg.card | `#ffffff` |
| text.primary | `#1f2328` |
| text.secondary | `#57606a` |
| text.accent | `#0969da` |
| text.danger | `#cf222e` |
| text.warning | `#9a6700` |
| text.success | `#1a7f37` |
| border | `#d0d7de` |
| status.running | `#1a7f37` |
| status.waiting | `#9a6700` |
| status.failed | `#cf222e` |
| status.completed | `#0969da` |
| status.idle | `#57606a` |

### Dracula
| Token | Value | Source |
|---|---|---|
| bg.primary | `#282a36` | Background |
| bg.secondary | `#21222c` | Darker bg for secondary surfaces |
| bg.card | `#44475a` | Current Line |
| text.primary | `#f8f8f2` | Foreground |
| text.secondary | `#6272a4` | Comment |
| text.accent | `#bd93f9` | Purple |
| text.danger | `#ff5555` | Red |
| text.warning | `#ffb86c` | Orange |
| text.success | `#50fa7b` | Green |
| border | `#6272a4` | Comment (used as subtle border) |
| status.running | `#50fa7b` | Green |
| status.waiting | `#ffb86c` | Orange |
| status.failed | `#ff5555` | Red |
| status.completed | `#bd93f9` | Purple |
| status.idle | `#6272a4` | Comment |

### Catppuccin Mocha
| Token | Value | Source |
|---|---|---|
| bg.primary | `#1e1e2e` | Base |
| bg.secondary | `#181825` | Mantle |
| bg.card | `#313244` | Surface0 |
| text.primary | `#cdd6f4` | Text |
| text.secondary | `#6c7086` | Overlay0 |
| text.accent | `#cba6f7` | Mauve |
| text.danger | `#f38ba8` | Red |
| text.warning | `#fab387` | Peach |
| text.success | `#a6e3a1` | Green |
| border | `#45475a` | Surface1 |
| status.running | `#a6e3a1` | Green |
| status.waiting | `#fab387` | Peach |
| status.failed | `#f38ba8` | Red |
| status.completed | `#cba6f7` | Mauve |
| status.idle | `#6c7086` | Overlay0 |

### Nord
| Token | Value | Source |
|---|---|---|
| bg.primary | `#2e3440` | Nord0 — Polar Night |
| bg.secondary | `#242933` | Darker than Nord0 |
| bg.card | `#3b4252` | Nord1 |
| text.primary | `#eceff4` | Nord6 — Snow Storm |
| text.secondary | `#4c566a` | Nord3 |
| text.accent | `#88c0d0` | Nord8 — Frost |
| text.danger | `#bf616a` | Nord11 — Aurora Red |
| text.warning | `#ebcb8b` | Nord13 — Aurora Yellow |
| text.success | `#a3be8c` | Nord14 — Aurora Green |
| border | `#4c566a` | Nord3 |
| status.running | `#a3be8c` | Nord14 |
| status.waiting | `#ebcb8b` | Nord13 |
| status.failed | `#bf616a` | Nord11 |
| status.completed | `#88c0d0` | Nord8 |
| status.idle | `#4c566a` | Nord3 |

---

## 3. Architecture

### CSS Variables mechanism

`tailwind.config.js` defines color tokens as CSS custom property references:

```js
colors: {
  bg: {
    primary: 'var(--color-bg-primary)',
    secondary: 'var(--color-bg-secondary)',
    card: 'var(--color-bg-card)',
  },
  text: {
    primary: 'var(--color-text-primary)',
    secondary: 'var(--color-text-secondary)',
    accent: 'var(--color-text-accent)',
    danger: 'var(--color-text-danger)',
    warning: 'var(--color-text-warning)',
    success: 'var(--color-text-success)',
  },
  border: 'var(--color-border)',
  status: {
    running: 'var(--color-status-running)',
    waiting: 'var(--color-status-waiting)',
    failed: 'var(--color-status-failed)',
    completed: 'var(--color-status-completed)',
    idle: 'var(--color-status-idle)',
  },
}
```

Spacing, font, and radius tokens are **not** theme-dependent and stay as static values.

### ThemeProvider

`contexts/ThemeContext.tsx` wraps the app root. It:
1. Reads `colorScheme` from `useSettingsStore`
2. Resolves `'system'` using React Native's `useColorScheme()` → maps to `'dark'` or `'light'`
3. Looks up the active `Theme` object from `THEMES[resolvedScheme]`
4. Applies CSS custom properties via NativeWind v4's `vars()` utility (imported from `nativewind`) on a wrapping `View` — this sets CSS variables on the native side that Tailwind color tokens reference
5. Provides the active `Theme` object via React context

```tsx
// Usage in components — primary mechanism (80% of components)
<View className="bg-bg-primary" />
<Text className="text-text-accent" />

// Escape hatch — only for values that can't be className=
const theme = useTheme()
<CaretRight color={theme.text.secondary} />
```

### Data flow

```
User taps theme card in Settings
  → setColorScheme('dracula')
  → SettingsStore updates + persists to AsyncStorage
  → ThemeProvider subscription fires
  → CSS vars updated on root View
  → All className= components re-render with Dracula colors
```

---

## 4. File Changes

### Phase 1 — Theming Infrastructure (one PR)

| File | Change |
|---|---|
| `constants/theme.ts` | Add `dracula`, `catppuccin`, `nord` objects; add `ThemeId` type; add `THEMES` map; `dark`/`light`/`Theme` type unchanged |
| `contexts/ThemeContext.tsx` | **New.** `ThemeProvider` + `useTheme()` hook |
| `stores/settings.ts` | Extend `ColorScheme` to `ThemeId`; add `colorScheme` to `PersistedSettings`; wire `hydrate()` + subscriber |
| `tailwind.config.js` | Replace static hex values with `var(--color-*)` references |
| `app/_layout.tsx` | Wrap `RootLayout` with `ThemeProvider`; replace hardcoded hex in `Stack.screenOptions` with `useTheme()`; fix `StatusBar` style |
| `app/settings.tsx` | Add theme picker grid to Appearance section; wire to `setColorScheme()` |

### Phase 2 — NativeWind Migration (Waves 1–6, existing plan)

The existing NativeWind migration plan proceeds unchanged. Because `tailwind.config.js` now uses CSS vars, every component migrated to `className=` automatically becomes theme-aware. No additional theming work is required per component.

Wave summary:
- **Wave 1:** `components/ui/` primitives (8 files)
- **Wave 2:** Session sub-components + all `.styles.ts` deletions (24 files)
- **Wave 3:** Server modals + conversation components (16 files)
- **Wave 4:** Shared modals, queue sheets, terminal, pair scanner (8 files)
- **Wave 5:** Onboarding components (12 files)
- **Wave 6:** App screens (8 files)

Exclusions (unchanged from NativeWind spec):
- `SplashAnimation.tsx` — all-Reanimated, excluded from migration
- `components/onboarding/theme.ts` — intentional design divergence, kept as-is

---

## 5. Settings UI

Theme picker lives inside the existing **Appearance** card in `app/settings.tsx`, between the Layout segmented control and the Merge Chats toggle. No new section or navigation needed.

Layout: 3-column grid of mini theme cards. Each card shows a small color preview (bg/secondary/accent as visual fingerprint) and the theme name. Selected state: accent-colored border + checkmark overlay. Cards use radio behavior (tapping one deselects the others).

The checkmark and selection border color track the active theme's `text.accent` value.

---

## 6. SettingsStore Changes

`colorScheme` was previously **not persisted** (absent from `PersistedSettings`, `hydrate()`, and the subscriber). This is a bug fix bundled into Phase 1.

The `ColorScheme` type in `stores/settings.ts` is renamed to `ThemeId` and extended. The store field name `colorScheme` and setter `setColorScheme` remain unchanged.

```ts
// Before (stores/settings.ts)
colorScheme: 'dark' | 'light' | 'system'

// After
export type ThemeId = 'dark' | 'light' | 'system' | 'dracula' | 'catppuccin' | 'nord'
// field: colorScheme: ThemeId  — same field name, new type
```

`colorScheme` added to `PersistedSettings`, `hydrate()` partial merge, and the AsyncStorage subscriber. Default remains `'dark'`.

---

## 7. `useTheme()` Escape Hatch Consumers

The following locations need `useTheme()` because they pass color values to APIs that don't accept `className=`:

- `app/_layout.tsx` — `Stack.screenOptions` (`headerStyle.backgroundColor`, `headerTintColor`, `contentStyle.backgroundColor`)
- `app/_layout.tsx` — `StatusBar` style (`'light'` vs `'dark'` based on theme brightness)
- All Phosphor icon `color=` props (~20 files, resolved during NativeWind waves)
- `Animated` value interpolations that output color strings
- `RefreshControl` `tintColor` prop

---

## 8. Invariants & Constraints

- `onboarding/theme.ts` is never replaced — it defines a separate intentional aesthetic for the onboarding flow
- `SplashAnimation.tsx` remains excluded from theming
- `spacing`, `font`, and `radius` tokens in `tailwind.config.js` stay as static pixel values — they are not theme-dependent
- `StyleSheet.hairlineWidth` entries stay as `StyleSheet.create` — no Tailwind equivalent
- `Animated` style values stay as `style=` props — runtime values can't be CSS classes
- The `system` theme option always resolves to either `dark` or `light` at runtime; it is never passed directly to `THEMES`
- Default theme is `dark` — unchanged from current behavior; existing users who have never set a theme see no change
