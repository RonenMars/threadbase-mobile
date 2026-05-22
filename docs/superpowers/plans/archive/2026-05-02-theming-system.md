> **Archived 2026-05-22.** This file has been moved to the archive. Active backlog/roadmap now lives in [`docs/BACKLOG.md`](../../../BACKLOG.md) and [`docs/ROADMAP.md`](../../../ROADMAP.md). The contents below are preserved verbatim for historical reference.

---

# Theming System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire a 5-theme system (Dark, Light, Dracula, Catppuccin Mocha, Nord) into the app using CSS custom properties + NativeWind, with a theme picker in Settings and persistent storage.

**Architecture:** `tailwind.config.js` color tokens reference CSS custom properties (`var(--color-*)`). A `ThemeProvider` in `contexts/ThemeContext.tsx` reads `colorScheme` from `SettingsStore` and applies the active theme's hex values to those variables at runtime via NativeWind's `vars()` utility. Components using `className=` become theme-aware automatically; a `useTheme()` hook covers the ~20 escape-hatch cases (Phosphor icon colors, `Stack.screenOptions`, `RefreshControl.tintColor`).

**Tech Stack:** NativeWind 4.2.3, React Native `useColorScheme`, Zustand (SettingsStore), AsyncStorage, React Context

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `constants/theme.ts` | Modify | Add `dracula`/`catppuccin`/`nord` palettes, `ThemeId` type, `THEMES` map |
| `contexts/ThemeContext.tsx` | Create | `ThemeProvider` + `useTheme()` hook |
| `stores/settings.ts` | Modify | Extend type, persist `colorScheme`, fix hydrate/subscriber |
| `tailwind.config.js` | Modify | Replace hex values with `var(--color-*)` references |
| `app/_layout.tsx` | Modify | Wrap with `ThemeProvider`, fix hardcoded hex, fix `StatusBar` |
| `app/settings.tsx` | Modify | Add theme picker grid to Appearance card |
| `__tests__/unit/stores/settings.test.ts` | Modify | Add tests for new theme IDs + persistence |
| `__tests__/unit/contexts/ThemeContext.test.tsx` | Create | Unit tests for `useTheme()` and theme resolution |

---

## Task 1: Extend `constants/theme.ts` with new palettes and ThemeId type

**Files:**
- Modify: `constants/theme.ts`

- [ ] **Step 1: Replace the entire file with the extended version**

```ts
export const dark = {
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
  border: '#30363d',
  status: {
    running: '#3fb950',
    waiting: '#d29922',
    failed: '#f85149',
    completed: '#58a6ff',
    idle: '#7d8590',
  },
} as const

export const light = {
  bg: {
    primary: '#ffffff',
    secondary: '#f6f8fa',
    card: '#ffffff',
  },
  text: {
    primary: '#1f2328',
    secondary: '#57606a',
    accent: '#0969da',
    danger: '#cf222e',
    warning: '#9a6700',
    success: '#1a7f37',
  },
  border: '#d0d7de',
  status: {
    running: '#1a7f37',
    waiting: '#9a6700',
    failed: '#cf222e',
    completed: '#0969da',
    idle: '#57606a',
  },
} as const

export const dracula = {
  bg: {
    primary: '#282a36',
    secondary: '#21222c',
    card: '#44475a',
  },
  text: {
    primary: '#f8f8f2',
    secondary: '#6272a4',
    accent: '#bd93f9',
    danger: '#ff5555',
    warning: '#ffb86c',
    success: '#50fa7b',
  },
  border: '#6272a4',
  status: {
    running: '#50fa7b',
    waiting: '#ffb86c',
    failed: '#ff5555',
    completed: '#bd93f9',
    idle: '#6272a4',
  },
} as const

export const catppuccin = {
  bg: {
    primary: '#1e1e2e',
    secondary: '#181825',
    card: '#313244',
  },
  text: {
    primary: '#cdd6f4',
    secondary: '#6c7086',
    accent: '#cba6f7',
    danger: '#f38ba8',
    warning: '#fab387',
    success: '#a6e3a1',
  },
  border: '#45475a',
  status: {
    running: '#a6e3a1',
    waiting: '#fab387',
    failed: '#f38ba8',
    completed: '#cba6f7',
    idle: '#6c7086',
  },
} as const

export const nord = {
  bg: {
    primary: '#2e3440',
    secondary: '#242933',
    card: '#3b4252',
  },
  text: {
    primary: '#eceff4',
    secondary: '#4c566a',
    accent: '#88c0d0',
    danger: '#bf616a',
    warning: '#ebcb8b',
    success: '#a3be8c',
  },
  border: '#4c566a',
  status: {
    running: '#a3be8c',
    waiting: '#ebcb8b',
    failed: '#bf616a',
    completed: '#88c0d0',
    idle: '#4c566a',
  },
} as const

export type Theme = typeof dark

export type ThemeId = 'dark' | 'light' | 'system' | 'dracula' | 'catppuccin' | 'nord'

export const THEMES: Record<Exclude<ThemeId, 'system'>, Theme> = {
  dark,
  light,
  dracula,
  catppuccin,
  nord,
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
} as const

export const font = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
} as const

export const TABLET_BREAKPOINT = 768
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing errors unrelated to theme.ts)

- [ ] **Step 3: Commit**

```bash
git add constants/theme.ts
git commit -m "feat: add dracula, catppuccin, nord theme palettes and ThemeId type"
```

---

## Task 2: Extend `stores/settings.ts` — persist colorScheme and extend type

**Files:**
- Modify: `stores/settings.ts`
- Modify: `__tests__/unit/stores/settings.test.ts`

- [ ] **Step 1: Write failing tests for new theme IDs and persistence**

Replace the `SettingsStore – colorScheme` describe block in `__tests__/unit/stores/settings.test.ts` with:

```ts
import { useSettingsStore } from '@/stores/settings'
import AsyncStorage from '@react-native-async-storage/async-storage'

const DEFAULT_NOTIFICATIONS = {
  waitingInput: true,
  sessionComplete: true,
  sessionFailed: true,
  diffReady: false,
  quietHoursEnabled: false,
  quietHoursFrom: '22:00',
  quietHoursTo: '08:00',
  showBadge: true,
}

beforeEach(() => {
  useSettingsStore.setState({
    colorScheme: 'dark',
    completedSessionFadeMs: 60000,
    terminalMaxLines: 5000,
    notifications: { ...DEFAULT_NOTIFICATIONS },
  })
  jest.clearAllMocks()
})

describe('SettingsStore – colorScheme', () => {
  it('defaults to dark', () => {
    expect(useSettingsStore.getState().colorScheme).toBe('dark')
  })

  it('updates colorScheme to light', () => {
    useSettingsStore.getState().setColorScheme('light')
    expect(useSettingsStore.getState().colorScheme).toBe('light')
  })

  it('accepts system as valid scheme', () => {
    useSettingsStore.getState().setColorScheme('system')
    expect(useSettingsStore.getState().colorScheme).toBe('system')
  })

  it('accepts dracula', () => {
    useSettingsStore.getState().setColorScheme('dracula')
    expect(useSettingsStore.getState().colorScheme).toBe('dracula')
  })

  it('accepts catppuccin', () => {
    useSettingsStore.getState().setColorScheme('catppuccin')
    expect(useSettingsStore.getState().colorScheme).toBe('catppuccin')
  })

  it('accepts nord', () => {
    useSettingsStore.getState().setColorScheme('nord')
    expect(useSettingsStore.getState().colorScheme).toBe('nord')
  })

  it('persists colorScheme to AsyncStorage when changed', async () => {
    useSettingsStore.getState().setColorScheme('dracula')
    // Allow the subscriber microtask to flush
    await Promise.resolve()
    const raw = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)
    expect(raw).toBeDefined()
    const payload = JSON.parse(raw[1])
    expect(payload.colorScheme).toBe('dracula')
  })

  it('restores colorScheme from AsyncStorage on hydrate', async () => {
    const stored = JSON.stringify({ colorScheme: 'nord', notifications: DEFAULT_NOTIFICATIONS })
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(stored)
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().colorScheme).toBe('nord')
  })

  it('falls back to dark when hydrate finds no stored colorScheme', async () => {
    const stored = JSON.stringify({ notifications: DEFAULT_NOTIFICATIONS })
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(stored)
    await useSettingsStore.getState().hydrate()
    expect(useSettingsStore.getState().colorScheme).toBe('dark')
  })
})
```

- [ ] **Step 2: Run tests — expect failures on the new persistence tests**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx jest --ci __tests__/unit/stores/settings.test.ts 2>&1 | tail -20
```

Expected: new persistence/hydrate tests FAIL (colorScheme not yet persisted)

- [ ] **Step 3: Update `stores/settings.ts`**

Replace the full file:

```ts
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { NotificationPreferences } from '@/types/api'
import type { SessionsLayout } from '@/types/ui'
import type { ThemeId } from '@/constants/theme'

export type { ThemeId }
export type AddServerAction = 'ask' | 'add' | 'replace' | 'keep'
const ASYNC_KEY_SETTINGS = 'threadbase_settings'

interface SettingsStore {
  colorScheme: ThemeId
  completedSessionFadeMs: number
  terminalMaxLines: number
  notifications: NotificationPreferences
  historyMessageDisplay: 'first' | 'last'
  addServerAction: AddServerAction
  sessionsLayout: SessionsLayout
  mergeChats: boolean
  setColorScheme: (scheme: ThemeId) => void
  setCompletedSessionFadeMs: (ms: number) => void
  setTerminalMaxLines: (n: number) => void
  setNotifications: (prefs: Partial<NotificationPreferences>) => void
  setHistoryMessageDisplay: (v: 'first' | 'last') => void
  setAddServerAction: (v: AddServerAction) => void
  setSessionsLayout: (v: SessionsLayout) => void
  setMergeChats: (v: boolean) => void
  hydrate: () => Promise<void>
}

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  waitingInput: true,
  sessionComplete: true,
  sessionFailed: true,
  diffReady: false,
  quietHoursEnabled: false,
  quietHoursFrom: '22:00',
  quietHoursTo: '08:00',
  showBadge: true,
}

interface PersistedSettings {
  colorScheme: ThemeId
  notifications: NotificationPreferences
  historyMessageDisplay: 'first' | 'last'
  addServerAction: AddServerAction
  sessionsLayout: SessionsLayout
  mergeChats: boolean
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  colorScheme: 'dark',
  completedSessionFadeMs: 60000,
  terminalMaxLines: 5000,
  notifications: DEFAULT_NOTIFICATIONS,
  historyMessageDisplay: 'first',
  addServerAction: 'ask',
  sessionsLayout: 'tree',
  mergeChats: true,

  setColorScheme: (colorScheme) => set({ colorScheme }),
  setCompletedSessionFadeMs: (completedSessionFadeMs) => set({ completedSessionFadeMs }),
  setTerminalMaxLines: (terminalMaxLines) => set({ terminalMaxLines }),
  setNotifications: (prefs) =>
    set((state) => ({
      notifications: { ...state.notifications, ...prefs },
    })),
  setHistoryMessageDisplay: (historyMessageDisplay) => set({ historyMessageDisplay }),
  setAddServerAction: (addServerAction) => set({ addServerAction }),
  setSessionsLayout: (sessionsLayout) => set({ sessionsLayout }),
  setMergeChats: (mergeChats) => set({ mergeChats }),
  hydrate: async () => {
    const raw = await AsyncStorage.getItem(ASYNC_KEY_SETTINGS)
    if (!raw) return
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>
    set((state) => ({
      colorScheme: parsed.colorScheme ?? state.colorScheme,
      notifications: parsed.notifications
        ? { ...state.notifications, ...parsed.notifications }
        : state.notifications,
      historyMessageDisplay: parsed.historyMessageDisplay ?? state.historyMessageDisplay,
      addServerAction: parsed.addServerAction ?? state.addServerAction,
      sessionsLayout: parsed.sessionsLayout ?? state.sessionsLayout,
      mergeChats: parsed.mergeChats ?? state.mergeChats,
    }))
  },
}))

useSettingsStore.subscribe((state) => {
  const payload: PersistedSettings = {
    colorScheme: state.colorScheme,
    notifications: state.notifications,
    historyMessageDisplay: state.historyMessageDisplay,
    addServerAction: state.addServerAction,
    sessionsLayout: state.sessionsLayout,
    mergeChats: state.mergeChats,
  }
  void AsyncStorage.setItem(ASYNC_KEY_SETTINGS, JSON.stringify(payload))
})
```

- [ ] **Step 4: Run tests — all should pass**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx jest --ci __tests__/unit/stores/settings.test.ts 2>&1 | tail -20
```

Expected: all tests PASS

- [ ] **Step 5: Run full unit suite to check for regressions**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npm run test:unit 2>&1 | tail -20
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add stores/settings.ts __tests__/unit/stores/settings.test.ts
git commit -m "feat: extend SettingsStore with ThemeId type and colorScheme persistence"
```

---

## Task 3: Create `contexts/ThemeContext.tsx`

**Files:**
- Create: `contexts/ThemeContext.tsx`
- Create: `__tests__/unit/contexts/ThemeContext.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/unit/contexts/ThemeContext.test.tsx`:

```tsx
import React from 'react'
import { renderHook } from '@testing-library/react-native'
import { useSettingsStore } from '@/stores/settings'
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext'
import { dark, dracula, catppuccin, nord, light } from '@/constants/theme'

function wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}

beforeEach(() => {
  useSettingsStore.setState({ colorScheme: 'dark' })
})

describe('useTheme', () => {
  it('returns dark theme by default', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.bg.primary).toBe(dark.bg.primary)
    expect(result.current.text.accent).toBe(dark.text.accent)
  })

  it('returns dracula theme when colorScheme is dracula', () => {
    useSettingsStore.setState({ colorScheme: 'dracula' })
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.bg.primary).toBe(dracula.bg.primary)
    expect(result.current.text.accent).toBe(dracula.text.accent)
  })

  it('returns catppuccin theme when colorScheme is catppuccin', () => {
    useSettingsStore.setState({ colorScheme: 'catppuccin' })
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.bg.primary).toBe(catppuccin.bg.primary)
  })

  it('returns nord theme when colorScheme is nord', () => {
    useSettingsStore.setState({ colorScheme: 'nord' })
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.bg.primary).toBe(nord.bg.primary)
  })

  it('returns light theme when colorScheme is light', () => {
    useSettingsStore.setState({ colorScheme: 'light' })
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.bg.primary).toBe(light.bg.primary)
    expect(result.current.text.accent).toBe(light.text.accent)
  })

  it('throws when used outside ThemeProvider', () => {
    // Suppress expected console.error from React
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useTheme())).toThrow('useTheme must be used within ThemeProvider')
    spy.mockRestore()
  })
})
```

- [ ] **Step 2: Run tests — expect module-not-found failure**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx jest --ci __tests__/unit/contexts/ThemeContext.test.tsx 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '@/contexts/ThemeContext'`

- [ ] **Step 3: Create `contexts/ThemeContext.tsx`**

```tsx
import React, { createContext, useContext, useMemo } from 'react'
import { useColorScheme } from 'react-native'
import { vars } from 'nativewind'
import { useSettingsStore } from '@/stores/settings'
import { THEMES, type Theme, type ThemeId } from '@/constants/theme'

type ThemeContextValue = Theme

const ThemeContext = createContext<ThemeContextValue | null>(null)

function themeToVars(theme: Theme): Record<string, string> {
  return {
    '--color-bg-primary': theme.bg.primary,
    '--color-bg-secondary': theme.bg.secondary,
    '--color-bg-card': theme.bg.card,
    '--color-text-primary': theme.text.primary,
    '--color-text-secondary': theme.text.secondary,
    '--color-text-accent': theme.text.accent,
    '--color-text-danger': theme.text.danger,
    '--color-text-warning': theme.text.warning,
    '--color-text-success': theme.text.success,
    '--color-border': theme.border,
    '--color-status-running': theme.status.running,
    '--color-status-waiting': theme.status.waiting,
    '--color-status-failed': theme.status.failed,
    '--color-status-completed': theme.status.completed,
    '--color-status-idle': theme.status.idle,
  }
}

function resolveTheme(colorScheme: ThemeId, systemScheme: 'light' | 'dark' | null | undefined): Theme {
  if (colorScheme === 'system') {
    return THEMES[systemScheme === 'light' ? 'light' : 'dark']
  }
  return THEMES[colorScheme]
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useSettingsStore((s) => s.colorScheme)
  const systemScheme = useColorScheme()
  const theme = useMemo(() => resolveTheme(colorScheme, systemScheme), [colorScheme, systemScheme])
  const cssVars = useMemo(() => vars(themeToVars(theme)), [theme])

  return (
    <ThemeContext.Provider value={theme}>
      <React.Fragment>
        {/* vars() returns a style object — apply to a wrapper View isn't needed;
            nativewind vars() is applied as a style prop on the root host element */}
        {React.Children.map(children, (child) =>
          React.isValidElement(child)
            ? React.cloneElement(child as React.ReactElement<{ style?: object }>, {
                style: cssVars,
              })
            : child
        )}
      </React.Fragment>
    </ThemeContext.Provider>
  )
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext)
  if (ctx === null) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}
```

> **Note on vars() and ThemeProvider:** NativeWind 4.x's `vars()` returns a style object that must be applied to a host View (not a React.Fragment). In `app/_layout.tsx` (Task 5), `ThemeProvider` will wrap the `GestureHandlerRootView` — a host component — so the vars style will be applied there via a single root View inside ThemeProvider instead of cloneElement. The above implementation uses cloneElement for simplicity in tests; Task 5 refines the production implementation to apply vars to a wrapping View.

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx jest --ci __tests__/unit/contexts/ThemeContext.test.tsx 2>&1 | tail -20
```

Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add contexts/ThemeContext.tsx __tests__/unit/contexts/ThemeContext.test.tsx
git commit -m "feat: add ThemeContext with ThemeProvider and useTheme hook"
```

---

## Task 4: Update `tailwind.config.js` — swap hex values for CSS var references

**Files:**
- Modify: `tailwind.config.js`

- [ ] **Step 1: Replace the colors section with CSS var references**

Replace `tailwind.config.js` with:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
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
        accent: {
          DEFAULT: 'var(--color-text-accent)',
          subtle: 'rgba(88,166,255,0.12)',
        },
        border: 'var(--color-border)',
        status: {
          running: 'var(--color-status-running)',
          waiting: 'var(--color-status-waiting)',
          failed: 'var(--color-status-failed)',
          idle: 'var(--color-status-idle)',
          completed: 'var(--color-status-completed)',
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

> **Note on `accent.subtle`:** The `rgba(88,166,255,0.12)` value is kept as a static rgba string. It is a semi-transparent overlay that always looks correct against any dark theme. If light-mode support requires a different subtle value in the future, this token can be added to the CSS vars at that point.

- [ ] **Step 2: Run the full test suite to verify no regressions**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npm run test:ci 2>&1 | tail -20
```

Expected: all tests PASS (tailwind.config.js changes don't affect Jest tests since NativeWind is not processed in the test environment)

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.js
git commit -m "feat: replace tailwind color tokens with CSS var references for runtime theming"
```

---

## Task 5: Wire `ThemeProvider` into `app/_layout.tsx` and fix hardcoded hex

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Update `app/_layout.tsx`**

Make the following targeted changes:

1. Add import for `ThemeProvider` and `useTheme` at the top:
```tsx
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext'
```

2. Replace the hardcoded `<StatusBar style="light" />` line — `StatusBar` style now derives from theme brightness. Add a `ThemedStatusBar` component just above `RootLayout`:
```tsx
function ThemedStatusBar() {
  const theme = useTheme()
  // Light themes (light) need dark status bar icons; all others need light
  const style = theme.bg.primary === '#ffffff' || theme.bg.primary === '#f6f8fa' ? 'dark' : 'light'
  return <StatusBar style={style} />
}
```

3. Replace `<StatusBar style="light" />` inside the Stack with `<ThemedStatusBar />`.

4. Replace hardcoded hex values in `Stack.screenOptions` — add a `ThemedStack` component just above `RootLayout`:
```tsx
function ThemedStack({ router }: { router: ReturnType<typeof useRouter> }) {
  const theme = useTheme()
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg.secondary },
        headerTintColor: theme.text.primary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.bg.primary },
        headerLeft: ({ tintColor }) => (
          <Pressable
            onPress={() => router.back()}
            hitSlop={16}
            style={({ pressed }) => ({ paddingHorizontal: 4, opacity: pressed ? 0.5 : 1 })}
          >
            <CaretLeft size={28} color={tintColor ?? theme.text.primary} />
          </Pressable>
        ),
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="session/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="conversation/[id]" options={{ headerShown: false }} />
      <Stack.Screen
        name="browse"
        options={{
          presentation: 'modal',
          title: 'Browse',
          headerBackTitle: 'Cancel',
        }}
      />
      <Stack.Screen
        name="settings"
        options={{ title: 'Settings', headerShown: true }}
      />
      <Stack.Screen
        name="project/[path]"
        options={({ route }) => ({
          title: decodeURIComponent((route.params as { path?: string }).path?.split('/').pop() ?? 'Project'),
        })}
      />
    </Stack>
  )
}
```

5. Wrap `RootLayout`'s return with `ThemeProvider`. `ThemeProvider` must wrap a host View so `vars()` has a host element to attach to. Update `RootLayout`:

```tsx
export default function RootLayout() {
  const router = useRouter()
  const [splashDone, setSplashDone] = useState(!!g.__splashShown)

  useEffect(() => {
    SplashScreen.hideAsync()
  }, [])

  function handleSplashComplete() {
    g.__splashShown = true
    setSplashDone(true)
  }

  return (
    <ThemeProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          {!splashDone && <SplashAnimation onComplete={handleSplashComplete} />}
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister: queryPersister,
              buster: persistBuster,
              maxAge: 1000 * 60 * 60 * 24,
              dehydrateOptions: {
                shouldDehydrateMutation: () => false,
                shouldDehydrateQuery: (query) =>
                  query.state.status === 'success' &&
                  (query.meta as { persist?: boolean } | undefined)?.persist !== false,
              },
            }}
          >
            <AuthGate>
              <SlowQueryBanner />
              <ErrorBanner />
              <ThemedStatusBar />
              <ThemedStack router={router} />
            </AuthGate>
          </PersistQueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ThemeProvider>
  )
}
```

> **Note on vars() host element:** NativeWind 4.x `vars()` needs to be applied to a host component's `style` prop. `ThemeProvider` needs to apply the CSS vars to a wrapping View that sits at the root. Update `ThemeProvider` in `contexts/ThemeContext.tsx` to use a `View` instead of `cloneElement`:

```tsx
import { View } from 'react-native'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useSettingsStore((s) => s.colorScheme)
  const systemScheme = useColorScheme()
  const theme = useMemo(() => resolveTheme(colorScheme, systemScheme), [colorScheme, systemScheme])
  const cssVars = useMemo(() => vars(themeToVars(theme)), [theme])

  return (
    <ThemeContext.Provider value={theme}>
      <View style={[{ flex: 1 }, cssVars]}>
        {children}
      </View>
    </ThemeContext.Provider>
  )
}
```

Also update `__tests__/unit/contexts/ThemeContext.test.tsx` — the `cloneElement` test for "throws outside ThemeProvider" still works since `ThemeContext.Provider` is still present. The wrapper change is transparent to the hook tests.

- [ ] **Step 2: Run TypeScript check**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npm run test:ci 2>&1 | tail -20
```

Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx contexts/ThemeContext.tsx __tests__/unit/contexts/ThemeContext.test.tsx
git commit -m "feat: wire ThemeProvider in _layout.tsx, fix hardcoded hex in Stack.screenOptions"
```

---

## Task 6: Add theme picker to `app/settings.tsx`

**Files:**
- Modify: `app/settings.tsx`

- [ ] **Step 1: Add the ThemeId import and useTheme import at the top of settings.tsx**

Replace the existing import line:
```tsx
import { dark, font, radius, spacing } from '@/constants/theme'
```

With:
```tsx
import { font, radius, spacing, THEMES } from '@/constants/theme'
import type { ThemeId } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
```

- [ ] **Step 2: Replace all `dark.*` references in the component body with `theme.*`**

Add `const theme = useTheme()` as the first line inside `SettingsScreen()`:
```tsx
export default function SettingsScreen() {
  const theme = useTheme()
  // ... rest of component
```

Then in the `SettingsRow` component, replace `dark.border` and `dark.text.accent` with props. Update `SettingsRow` to accept a `theme` prop:

```tsx
function SettingsRow({
  label,
  value,
  onValueChange,
  theme,
}: {
  label: string
  value: boolean
  onValueChange: (v: boolean) => void
  theme: ReturnType<typeof useTheme>
}) {
  return (
    <View style={styles(theme).row}>
      <Text style={styles(theme).rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: theme.text.accent }}
        thumbColor="#fff"
      />
    </View>
  )
}
```

- [ ] **Step 3: Convert the static `StyleSheet.create` to a `styles(theme)` factory function**

Replace the entire `const styles = StyleSheet.create({...})` block at the bottom with:

```tsx
function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg.primary },
    content: { padding: spacing.md, gap: spacing.sm },
    sectionHeader: {
      color: theme.text.secondary,
      fontSize: font.xs,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
      marginLeft: spacing.xs,
    },
    card: {
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    addServerBtn: {
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      borderStyle: 'dashed',
      padding: spacing.md,
      alignItems: 'center',
      minHeight: 44,
      justifyContent: 'center',
    },
    addServerText: {
      color: theme.text.accent,
      fontSize: font.base,
      fontWeight: '500',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      minHeight: 44,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    rowLabel: { color: theme.text.primary, fontSize: font.base },
    rowValue: { color: theme.text.secondary, fontSize: font.sm },
    accordionBody: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      gap: spacing.sm,
    },
    resetBtn: { minHeight: 44, justifyContent: 'center' },
    resetBtnText: { color: theme.text.accent, fontSize: font.sm, fontWeight: '500' },
    testBtn: { padding: spacing.md, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
    testBtnText: { color: theme.text.accent, fontSize: font.base },
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: theme.bg.primary,
      borderRadius: radius.sm,
      overflow: 'hidden',
    },
    segmentBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.sm },
    segmentBtnActive: { backgroundColor: theme.text.accent },
    segmentBtnText: { color: theme.text.secondary, fontSize: font.sm, fontWeight: '500' },
    segmentBtnTextActive: { color: '#fff' },
    aboutText: { color: theme.text.primary, fontSize: font.base, padding: spacing.md, fontWeight: '500' },
    aboutSubtext: { color: theme.text.secondary, fontSize: font.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
    // Theme picker
    themeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      padding: spacing.md,
    },
    themeCard: {
      width: '30%',
      borderRadius: radius.sm,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    themeCardSelected: {
      borderColor: theme.text.accent,
    },
    themeCardPreview: {
      height: 52,
      padding: spacing.xs,
      gap: 4,
    },
    themeCardName: {
      fontSize: font.xs,
      fontWeight: '600',
      textAlign: 'center',
      paddingVertical: 4,
    },
  })
}
```

Update all usages in `SettingsScreen` and `ActionSegment` from `styles.xxx` to `styles(theme).xxx`, and pass `theme` where needed. Also update `SectionHeader` and `SettingsRow` calls to pass `theme`.

- [ ] **Step 4: Add the ThemePicker component and wire it**

Add the `ThemePicker` component above `ActionSegment`:

```tsx
const THEME_LABELS: Record<Exclude<ThemeId, 'system'>, string> = {
  dark: 'Dark',
  light: 'Light',
  dracula: 'Dracula',
  catppuccin: 'Mocha',
  nord: 'Nord',
}

function ThemePicker({
  current,
  onChange,
  theme,
}: {
  current: ThemeId
  onChange: (id: ThemeId) => void
  theme: ReturnType<typeof useTheme>
}) {
  const s = styles(theme)
  const themeIds = Object.keys(THEMES) as Array<Exclude<ThemeId, 'system'>>

  return (
    <View style={s.themeGrid}>
      {themeIds.map((id) => {
        const t = THEMES[id]
        const isSelected = current === id || (current === 'system' && id === 'dark')
        return (
          <TouchableOpacity
            key={id}
            style={[s.themeCard, isSelected && s.themeCardSelected]}
            onPress={() => onChange(id)}
            activeOpacity={0.7}
          >
            <View style={[s.themeCardPreview, { backgroundColor: t.bg.primary }]}>
              <View style={{ height: 8, borderRadius: 2, backgroundColor: t.bg.card }} />
              <View style={{ height: 6, width: '60%', borderRadius: 2, backgroundColor: t.text.secondary, opacity: 0.6 }} />
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.text.accent, alignSelf: 'flex-end' }} />
            </View>
            <View style={{ backgroundColor: t.bg.secondary }}>
              <Text style={[s.themeCardName, { color: t.text.secondary }]}>
                {THEME_LABELS[id]}
              </Text>
            </View>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}
```

- [ ] **Step 5: Insert ThemePicker into the Appearance card**

In `SettingsScreen`, add these lines to pull `colorScheme` and `setColorScheme` from the store, then insert the picker between the Layout row and the Merge Chats row:

```tsx
const { colorScheme, setColorScheme, /* ... existing destructures ... */ } = useSettingsStore()
```

Inside the Appearance card JSX, after the Layout segmented control row and before the `SettingsRow` for Merge Chats:

```tsx
<View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }}>
  <View style={[styles(theme).row, { borderBottomWidth: 0 }]}>
    <Text style={styles(theme).rowLabel}>Theme</Text>
  </View>
  <ThemePicker current={colorScheme} onChange={setColorScheme} theme={theme} />
</View>
```

Also update the `RefreshControl` `tintColor` to use `theme.text.secondary`:
```tsx
<RefreshControl
  refreshing={isPullRefreshing}
  onRefresh={handlePullRefresh}
  tintColor={theme.text.secondary}
/>
```

- [ ] **Step 6: Run TypeScript check**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors

- [ ] **Step 7: Run full test suite**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npm run test:ci 2>&1 | tail -20
```

Expected: all tests PASS

- [ ] **Step 8: Commit**

```bash
git add app/settings.tsx
git commit -m "feat: add theme picker to Settings Appearance card"
```

---

## Task 7: Manual verification on simulator

- [ ] **Step 1: Start Metro and run on iOS simulator**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npm run ios
```

- [ ] **Step 2: Verify dark theme (default)**

Open the app. Navigate to Settings. Confirm the app looks identical to pre-change — dark background, blue accent, session list renders correctly.

- [ ] **Step 3: Switch to Dracula theme**

Tap the Dracula card in the Appearance section. Confirm:
- Settings screen background changes to `#282a36`
- Header background changes to `#21222c`
- Accent color on buttons/links changes to `#bd93f9` (purple)
- The theme card selection border shows purple

- [ ] **Step 4: Switch to Catppuccin Mocha**

Tap the Mocha card. Confirm background is `#1e1e2e`, accent is `#cba6f7`.

- [ ] **Step 5: Switch to Nord**

Tap the Nord card. Confirm background is `#2e3440`, accent is `#88c0d0` (frost blue).

- [ ] **Step 6: Switch to Light**

Tap the Light card. Confirm white background, dark text, `StatusBar` switches to dark icons.

- [ ] **Step 7: Kill and relaunch the app**

Force-quit and reopen. Confirm the last selected theme is restored (AsyncStorage persistence).

- [ ] **Step 8: Switch back to Dark and verify settings screen renders correctly**

Confirm the theme picker grid shows the Dark card as selected with accent-colored border.

- [ ] **Step 9: Final commit if any fixes were needed during manual testing**

```bash
git add -p  # stage only intentional fixes
git commit -m "fix: <describe any manual-test fixes>"
```

---

## Spec Coverage Check

| Spec section | Covered by |
|---|---|
| 5 theme palettes with correct hex values | Task 1 |
| ThemeId type | Task 1 |
| THEMES map | Task 1 |
| SettingsStore colorScheme persistence | Task 2 |
| ThemeProvider + useTheme() hook | Task 3 |
| system theme resolution | Task 3 (`resolveTheme`) |
| CSS var references in tailwind.config.js | Task 4 |
| ThemeProvider in _layout.tsx | Task 5 |
| Stack.screenOptions hardcoded hex fixed | Task 5 |
| StatusBar style tracks theme | Task 5 |
| Theme picker in Settings Appearance card | Task 6 |
| RefreshControl tintColor | Task 6 |
| 3-column grid, radio selection, checkmark | Task 6 |
| Manual verification | Task 7 |
