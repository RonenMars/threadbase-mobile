# NativeWind Migration & Structural Refactor — Design Spec

> **Date:** 2026-05-01  
> **Scope:** Full audit of `tb-mobile` for NativeWind migration and component structure refactor  
> **Status:** Ready for implementation planning

---

## 1. Token → Tailwind Class Mapping Table

The following table maps every token in `constants/theme.ts` to its NativeWind `className=` equivalent. All tokens are dark-mode only (see [Dark Mode Decision](#dark-mode-decision) below).

### Background Colors

| Token | Value | Tailwind class |
|---|---|---|
| `dark.bg.primary` | `#0d1117` | `bg-bg-primary` |
| `dark.bg.secondary` | `#161b22` | `bg-bg-secondary` |
| `dark.bg.card` | `#21262d` | `bg-bg-card` |

### Text Colors

| Token | Value | Tailwind class |
|---|---|---|
| `dark.text.primary` | `#e6edf3` | `text-text-primary` |
| `dark.text.secondary` | `#7d8590` | `text-text-secondary` |
| `dark.text.accent` | `#58a6ff` | `text-text-accent` |
| `dark.text.danger` | `#f85149` | `text-text-danger` |
| `dark.text.warning` | `#d29922` | `text-text-warning` |
| `dark.text.success` | `#3fb950` | `text-text-success` |

### Border

| Token | Value | Tailwind class |
|---|---|---|
| `dark.border` | `#30363d` | `border-border` |

### Status Colors

| Token | Value | Tailwind class |
|---|---|---|
| `dark.status.running` | `#3fb950` | `text-status-running` / `bg-status-running` |
| `dark.status.waiting` | `#d29922` | `text-status-waiting` / `bg-status-waiting` |
| `dark.status.failed` | `#f85149` | `text-status-failed` / `bg-status-failed` |
| `dark.status.completed` | `#58a6ff` | `text-status-completed` / `bg-status-completed` |
| `dark.status.idle` | `#7d8590` | `text-status-idle` / `bg-status-idle` |

### Spacing

| Token | Value | Tailwind equivalent |
|---|---|---|
| `spacing.xs` | `4` | `p-1` / `px-1` / `gap-1` / `m-1` etc. |
| `spacing.sm` | `8` | `p-2` / `px-2` / `gap-2` / `m-2` etc. |
| `spacing.md` | `12` | `p-3` / `px-3` / `gap-3` / `m-3` etc. |
| `spacing.lg` | `16` | `p-4` / `px-4` / `gap-4` / `m-4` etc. |
| `spacing.xl` | `24` | `p-6` / `px-6` / `gap-6` / `m-6` etc. |
| `spacing.xxl` | `32` | `p-8` / `px-8` / `gap-8` / `m-8` etc. |

> **Note:** Default Tailwind spacing scale uses multiples of 4px. `spacing.md=12` = `p-3` (3×4=12). This works perfectly — add named spacing tokens to tailwind config for clarity (see [Tailwind Config Additions](#2-tailwind-config-additions)).

### Font Sizes

| Token | Value | Tailwind class |
|---|---|---|
| `font.xs` | `11` | `text-[11px]` or add named token `text-font-xs` |
| `font.sm` | `13` | `text-[13px]` or `text-font-sm` |
| `font.base` | `15` | `text-[15px]` or `text-font-base` |
| `font.lg` | `17` | `text-[17px]` or `text-font-lg` |
| `font.xl` | `20` | `text-[20px]` or `text-font-xl` |
| `font.xxl` | `24` | `text-[24px]` or `text-font-xxl` |

> **Recommendation:** Add named font-size tokens to tailwind config (e.g., `fontSize.font-xs`) so components use `text-font-xs` instead of arbitrary `text-[11px]`. This keeps the token as the single source of truth.

### Border Radius

| Token | Value | Tailwind class |
|---|---|---|
| `radius.sm` | `6` | `rounded-[6px]` or `rounded-sm` (add named token) |
| `radius.md` | `10` | `rounded-[10px]` or `rounded-md` (override) |
| `radius.lg` | `16` | `rounded-[16px]` or `rounded-lg` (override) |
| `radius.full` | `9999` | `rounded-full` |

> **Recommendation:** Override the default `rounded-sm/md/lg` values in tailwind config to match the app's radius tokens exactly (see below).

---

## 2. Tailwind Config Additions

The current `tailwind.config.js` is missing several token mappings. The following additions bring it into full parity with `constants/theme.ts`:

```js
// tailwind.config.js — full replacement
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Background
        bg: {
          primary: '#0d1117',
          secondary: '#161b22',
          card: '#21262d',
        },
        // Text (expose all text tokens as top-level classes)
        text: {
          primary: '#e6edf3',
          secondary: '#7d8590',
          accent: '#58a6ff',
          danger: '#f85149',
          warning: '#d29922',
          success: '#3fb950',
        },
        // Border
        border: '#30363d',
        // Status
        status: {
          running: '#3fb950',
          waiting: '#d29922',
          failed: '#f85149',
          idle: '#7d8590',
          completed: '#58a6ff',
        },
      },
      // Named font sizes matching constants/theme.ts font tokens
      fontSize: {
        'font-xs': ['11px', { lineHeight: '15px' }],
        'font-sm': ['13px', { lineHeight: '18px' }],
        'font-base': ['15px', { lineHeight: '20px' }],
        'font-lg': ['17px', { lineHeight: '22px' }],
        'font-xl': ['20px', { lineHeight: '26px' }],
        'font-xxl': ['24px', { lineHeight: '30px' }],
      },
      // Named border radius matching constants/theme.ts radius tokens
      // Override Tailwind defaults to match app tokens exactly
      borderRadius: {
        'radius-sm': '6px',
        'radius-md': '10px',
        'radius-lg': '16px',
        full: '9999px',
      },
      // Named spacing matching constants/theme.ts spacing tokens
      spacing: {
        'spacing-xs': '4px',
        'spacing-sm': '8px',
        'spacing-md': '12px',
        'spacing-lg': '16px',
        'spacing-xl': '24px',
        'spacing-xxl': '32px',
      },
      fontFamily: {
        mono: ['SpaceMono', 'monospace'],
      },
    },
  },
  plugins: [],
}
```

> **Note on existing spacing:** Default Tailwind spacing (p-1=4px, p-2=8px, p-3=12px, p-4=16px, p-6=24px, p-8=32px) already maps cleanly to all `spacing.*` tokens. Named spacing tokens are optional convenience additions but not strictly required — the default scale works.

---

## 3. `global.css` Additions

No custom utility classes are currently needed. The existing `global.css` (4 lines, just `@tailwind` directives) is complete for the initial migration.

After migration, **one addition may be needed** for the semi-transparent active state background color used in multiple places (`rgba(88,166,255,0.12)` — accent at 12% opacity). Add this as a named color in tailwind config rather than a utility:

```js
// In tailwind.config.js colors:
accent: {
  DEFAULT: '#58a6ff',
  subtle: 'rgba(88,166,255,0.12)',  // used for active button states
},
```

Then use `bg-accent-subtle` instead of `style={{ backgroundColor: 'rgba(88,166,255,0.12)' }}`.

No custom `@layer` utilities are needed in `global.css`.

---

## 4. Dark Mode Decision

**Recommendation: Hardcode dark classes. Do not use `dark:` variants.**

### Reasoning

- `constants/theme.ts` defines both `dark` and `light` objects, but **zero components import `light`**. The app is dark-mode only in practice.
- The `light` theme in `theme.ts` exists as dead code — no settings toggle, no `colorScheme` wiring, no use anywhere.
- Using NativeWind's `dark:` variant would require either: (a) wiring `colorScheme` to a settings store value, or (b) relying on the device's system dark/light setting. Neither is the current behavior.
- The tailwind config currently only maps dark palette colors — expanding it for light would require adding light-variant colors too.

**Decision:** Migrate all `dark.*` token references to their hardcoded Tailwind equivalents (e.g., `dark.bg.primary` → `bg-bg-primary`). Leave `light` theme in `constants/theme.ts` untouched. If light mode is ever added, it will require a separate spec.

The hardcoded dark palette approach means className strings like `bg-bg-primary text-text-primary` — which is clear and correct.

---

## 5. Dynamic & Conditional Styling Patterns

### 5.1 Pattern: Conditional style arrays → `cn()` helper

Current pattern (found in 15+ files):
```tsx
style={[styles.headerButton, searchOpen && styles.headerButtonActive]}
```

NativeWind equivalent:
```tsx
className={cn('w-8 h-8 items-center justify-center rounded-lg', searchOpen && 'bg-accent-subtle')}
```

**Recommendation:** Add `clsx` for conditional class merging. It's 228 bytes gzipped and eliminates all style array juggling. Do **not** add `tailwind-merge` — there are no conflicting class scenarios in this codebase's patterns.

```
npm install clsx
```

Create `lib/cn.ts`:
```ts
import { clsx, type ClassValue } from 'clsx'
export function cn(...inputs: ClassValue[]) {
  return clsx(...inputs)
}
```

### 5.2 Pattern: Dynamic icon colors → inline `style` prop (keep as-is)

Current pattern (found in 20+ files):
```tsx
<MagnifyingGlass size={20} color={searchOpen ? dark.text.primary : dark.text.secondary} />
```

`phosphor-react-native` icons accept a `color` prop, not a `className` prop. This cannot be migrated to NativeWind. **Keep as inline `color` prop** — import the constant directly:

```tsx
import { dark } from '@/constants/theme'
<MagnifyingGlass size={20} color={searchOpen ? dark.text.primary : dark.text.secondary} />
```

This is not a regression — it's the correct pattern for icon colors with a third-party component.

### 5.3 Pattern: Animated width/progress → keep as `style` prop

Found in `ServerListCard.tsx` (Animated progress bar width) and `ProgressBar.tsx`:
```tsx
<Animated.View style={{ width: animWidth.interpolate({ inputRange: [0,1], outputRange: ['0%','100%'] }) }} />
```

Runtime-computed `Animated.Value` interpolations **cannot** be expressed as static Tailwind classes. **Keep these as `style={}` props**. This is the correct NativeWind escape hatch.

### 5.4 Pattern: Status colors as runtime values → `style` prop on status badges

Found in `SessionStatusBadge.tsx` and similar:
```tsx
const color = statusColor(session.status)  // returns dark.status.running, etc.
<View style={{ backgroundColor: color }} />
```

**Option A (recommended):** Map status → Tailwind class via lookup:
```tsx
const STATUS_BG: Record<string, string> = {
  running: 'bg-status-running',
  failed: 'bg-status-failed',
  // ...
}
<View className={STATUS_BG[session.status]} />
```

**Option B:** Keep as `style` prop for status dot colors — valid escape hatch when values are truly runtime.

Use Option A where the status string is one of a known enum; use Option B only when the color value is truly dynamic (e.g., computed by user preference).

### 5.5 Pattern: `rgba(...)` semi-transparent colors → named token

The value `rgba(88,166,255,0.12)` appears in at least 3 files. Extract as `accent-subtle` in tailwind config (see Section 3).

### 5.6 Pattern: `StyleSheet.hairlineWidth` → keep as StyleSheet

`StyleSheet.hairlineWidth` is a platform-specific value (~0.33 on retina) with no Tailwind equivalent. **Keep these as `StyleSheet.create` entries.** Wrap them in tiny `StyleSheet.create({ hairline: { borderWidth: StyleSheet.hairlineWidth } })` objects within the same file, or use a shared `hairlineStyle` constant in a `lib/styles.ts` file.

---

## 6. NativeWind "Do Not Migrate" List

The following style properties **cannot** be expressed as Tailwind utilities and must remain in `StyleSheet.create`:

| Property | Files | Reason |
|---|---|---|
| `shadowOffset: { width, height }` | FAB.tsx, ServerListCard.tsx, SplashAnimation.tsx, onboarding steps | No NativeWind equivalent; object value |
| `shadowOpacity` | Same files | No direct equivalent |
| `shadowRadius` (with dynamic color) | ServerListCard.tsx progress glow | Runtime value |
| `elevation` | FAB.tsx, SplashAnimation.tsx, PrimaryButton.tsx | Android-only native prop |
| `StyleSheet.hairlineWidth` | 14 files | Runtime platform value |
| `Animated.Value` interpolations | ServerListCard.tsx, ProgressBar.tsx, TerminalOutput.tsx | Runtime computed |
| `useAnimatedStyle()` return values | Any Reanimated v4 usage | Must be `style=` prop |
| `transform: [{ rotate }]` (runtime) | TreeRow.styles.ts chevron rotation | Runtime computed state |

**Rule of thumb:** If the value is computed at runtime (from state, animation, or platform), it stays in `style=`. If the value is static and maps to a Tailwind token, migrate to `className=`.

---

## 7. Component Migration Checklist

Migration order: primitives first, then feature components, then screens. This minimizes merge conflicts because primitives have no dependencies on other components, and feature components import primitives.

### Wave 1 — `components/ui/` primitives (no dependencies on other components)

| File | Lines | Priority | Notes |
|---|---|---|---|
| `components/ui/Card.tsx` | 36 | 1 | Has tests; start here |
| `components/ui/Badge.tsx` | 40 | 1 | Has tests; dynamic bg/color props need `style=` escape |
| `components/ui/EmptyState.tsx` | 44 | 1 | Has tests |
| `components/ui/FAB.tsx` | 41 | 2 | `shadowOffset`/`elevation` stay as StyleSheet |
| `components/ui/Skeleton.tsx` | 42 | 2 | |
| `components/ui/LoadingOverlay.tsx` | 26 | 2 | |
| `components/ui/AvatarMenu.tsx` | 31 | 2 | |
| `components/ui/ProgressBar.tsx` | 69 | 3 | Animated width stays as `style=` |

### Wave 2 — Session sub-components (depend on Wave 1)

| File | Lines | Priority | Notes |
|---|---|---|---|
| `components/sessions/SessionStatusBadge.tsx` | ~50 | 1 | Animated dot style; status color lookup table |
| `components/sessions/MachineBadge.tsx` | ~30 | 1 | Simple |
| `components/sessions/SearchStyles.ts` | ~51 | 1 | Shared across 3 layouts; delete after migration |
| `components/sessions/SessionCard.tsx` | 155 | 2 | Has tests; imports Card/Badge |
| `components/sessions/classic/ClassicSessionsList.styles.ts` | 9 | 1 | Delete; inline into ClassicSessionsList |
| `components/sessions/classic/ClassicSessionsList.tsx` | 71 | 2 | |
| `components/sessions/hub/SessionRow.styles.ts` | 22 | 1 | Delete |
| `components/sessions/hub/ConvRow.styles.ts` | 29 | 1 | Delete |
| `components/sessions/hub/ProjectHubCard.styles.ts` | 53 | 1 | Delete |
| `components/sessions/hub/ProjectHubList.styles.ts` | 57 | 1 | Delete |
| `components/sessions/hub/ConvRow.tsx` | ~60 | 2 | |
| `components/sessions/hub/SessionRow.tsx` | ~50 | 2 | |
| `components/sessions/hub/ProjectHubCard.tsx` | 117 | 2 | Animated chevron stays as style |
| `components/sessions/hub/ProjectHubList.tsx` | 187 | 3 | |
| `components/sessions/tree/TreeRow.styles.ts` | 71 | 1 | Delete; `hairlineWidth` stays StyleSheet |
| `components/sessions/tree/DrillRow.styles.ts` | 39 | 1 | Delete |
| `components/sessions/tree/DrillView.styles.ts` | 44 | 1 | Delete |
| `components/sessions/tree/ServerRootRow.styles.ts` | 46 | 1 | Delete |
| `components/sessions/tree/TreeSessionsList.styles.ts` | 20 | 1 | Delete |
| `components/sessions/tree/TreeRow.tsx` | ~80 | 2 | `hairlineWidth` stays StyleSheet |
| `components/sessions/tree/DrillRow.tsx` | ~60 | 2 | |
| `components/sessions/tree/DrillView.tsx` | ~80 | 2 | |
| `components/sessions/tree/ServerRootRow.tsx` | ~60 | 2 | |
| `components/sessions/tree/TreeSessionsList.tsx` | 249 | 3 | |

### Wave 3 — Server and Conversation components

| File | Lines | Priority | Notes |
|---|---|---|---|
| `components/servers/ServerBadge.tsx` | ~30 | 1 | |
| `components/servers/NewSessionServerPicker.tsx` | 115 | 2 | |
| `components/servers/DisplayedServersList.tsx` | 127 | 2 | |
| `components/servers/AddServerActionSheet.tsx` | 161 | 2 | |
| `components/servers/ServerStatusModal.tsx` | 207 | 3 | |
| `components/servers/SortSheet.tsx` | 206 | 3 | `hairlineWidth` stays StyleSheet |
| `components/servers/ServerFilterSheet.tsx` | 296 | 3 | |
| `components/servers/ServerErrorModal.tsx` | 195 | 3 | `hairlineWidth` stays StyleSheet |
| `components/servers/ServersManageModal.tsx` | 177 | 3 | `hairlineWidth` stays StyleSheet |
| `components/servers/FilterSortSheet.tsx` | 317 | 3 | `hairlineWidth` stays StyleSheet |
| `components/servers/ServerEditModal.tsx` | 344 | 4 | `hairlineWidth` stays StyleSheet |
| `components/servers/AddServerScreen.tsx` | 444 | 4 | Largest server component |
| `components/servers/ServerListCard.tsx` | 227 | 4 | Animated progress bar stays `style=`; shadow stays StyleSheet |
| `components/conversation/MessageSkeletonRow.tsx` | ~40 | 2 | |
| `components/conversation/ToolCard.tsx` | 114 | 3 | Has tests |
| `components/conversation/DiffViewer.tsx` | 173 | 3 | Animated style stays `style=` |
| `components/conversation/MessageBubble.tsx` | 203 | 3 | Has tests |
| `components/conversation/ConversationList.tsx` | 401 | 4 | Large; Animated scroll buttons stay `style=` |

### Wave 4 — Shared, queue, terminal, pair

| File | Lines | Priority | Notes |
|---|---|---|---|
| `components/shared/InfoModal.tsx` | 130 | 2 | `hairlineWidth`, `letterSpacing` stay StyleSheet |
| `components/shared/SlashCommandBoard.tsx` | 221 | 3 | `hairlineWidth`, `letterSpacing` stay StyleSheet |
| `components/shared/SlashCommandArgModal.tsx` | 226 | 3 | Same |
| `components/queue/PromptQueueSheet.tsx` | 165 | 2 | |
| `components/queue/PlanPreviewSheet.tsx` | 170 | 2 | `lineHeight` stays StyleSheet |
| `components/terminal/TerminalOutput.tsx` | 220 | 3 | Animated jump buttons stay `style=`; `lineHeight` stays StyleSheet |
| `components/pair/PairScannerModal.tsx` | 238 | 3 | |

### Wave 5 — Onboarding (uses separate theme.ts — special handling)

| File | Lines | Priority | Notes |
|---|---|---|---|
| `components/onboarding/components/PagerDots.tsx` | ~40 | 2 | Uses onboarding/theme.ts (keep) |
| `components/onboarding/components/PrimaryButton.tsx` | ~60 | 2 | `shadowOffset`/`elevation` stay StyleSheet |
| `components/onboarding/components/TerminalCard.tsx` | ~50 | 2 | Uses onboarding/theme.ts (keep) |
| `components/onboarding/components/ThreadField.tsx` | 91 | 2 | |
| `components/onboarding/OnboardingShell.tsx` | 126 | 2 | |
| `components/onboarding/OnboardingNavigator.tsx` | 133 | 3 | |
| `components/onboarding/steps/WelcomeStep.tsx` | 134 | 3 | `shadowOffset` stays StyleSheet; animated glow stays `style=` |
| `components/onboarding/steps/NotificationsStep.tsx` | 253 | 3 | |
| `components/onboarding/steps/DoneStep.tsx` | 221 | 3 | `shadowOffset` stays StyleSheet; animated pop stays `style=` |
| `components/onboarding/steps/ValuePropStep.tsx` | 272 | 4 | `shadowOffset` stays StyleSheet |
| `components/onboarding/steps/ConnectStep.tsx` | 372 | 4 | |
| `components/onboarding/steps/TourStep.tsx` | 410 | 4 | Animated cursor stays `style=` |

### Wave 6 — App screens

| File | Lines | Priority | Notes |
|---|---|---|---|
| `app/onboarding.tsx` | 24 | 1 | Minimal wrapper |
| `app/project/[path].tsx` | 155 | 2 | |
| `app/settings.tsx` | 386 | 3 | `hairlineWidth` stays StyleSheet |
| `app/browse.tsx` | 501 | 3 | `hairlineWidth` stays StyleSheet |
| `app/conversation/[id].tsx` | 405 | 3 | |
| `app/index.tsx` | 565 | 4 | Largest screen; `rgba` active states need `accent-subtle` |
| `app/session/[id].tsx` | 645 | 4 | Largest file in codebase |
| `app/_layout.tsx` | 220 | 4 | Hardcoded hex colors in Stack.screenOptions need token imports |

> **`SplashAnimation.tsx` (573 lines):** Exclude from NativeWind migration. It uses heavy Reanimated animations, complex `shadowOffset`/`shadowRadius`/`shadowOpacity` with dynamic colors, and is self-contained. The ROI of migrating it is very low.

---

## 8. Files to Delete After Migration

All `.styles.ts` files can be deleted after their companion component is migrated. None contain logic — they are pure styling.

| File to delete | After migrating |
|---|---|
| `components/sessions/hub/ProjectHubList.styles.ts` | `ProjectHubList.tsx` |
| `components/sessions/hub/ProjectHubCard.styles.ts` | `ProjectHubCard.tsx` |
| `components/sessions/hub/SessionRow.styles.ts` | `SessionRow.tsx` |
| `components/sessions/hub/ConvRow.styles.ts` | `ConvRow.tsx` |
| `components/sessions/classic/ClassicSessionsList.styles.ts` | `ClassicSessionsList.tsx` |
| `components/sessions/tree/TreeRow.styles.ts` | `TreeRow.tsx` |
| `components/sessions/tree/DrillRow.styles.ts` | `DrillRow.tsx` |
| `components/sessions/tree/DrillView.styles.ts` | `DrillView.tsx` |
| `components/sessions/tree/ServerRootRow.styles.ts` | `ServerRootRow.tsx` |
| `components/sessions/tree/TreeSessionsList.styles.ts` | `TreeSessionsList.tsx` |
| `components/sessions/SearchStyles.ts` | All three layout list files |

**Verify before deleting:** Confirm no other file imports from the `.styles.ts` file. In all 10 cases above, only the companion component file imports from it.

---

## 9. Target Directory Structure

The structure below reflects post-refactor state. The main change is the addition of a `lib/` directory and two new `components/ui/` primitives. App screen paths do not change.

```
tb-mobile/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── onboarding.tsx
│   ├── settings.tsx
│   ├── browse.tsx
│   ├── session/[id].tsx
│   ├── conversation/[id].tsx
│   └── project/[path].tsx
│
├── components/
│   ├── ui/
│   │   ├── Badge.tsx
│   │   ├── Card.tsx
│   │   ├── EmptyState.tsx
│   │   ├── FAB.tsx
│   │   ├── LoadingOverlay.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── Skeleton.tsx
│   │   └── AvatarMenu.tsx
│   │
│   ├── sessions/
│   │   ├── SessionCard.tsx
│   │   ├── SessionStatusBadge.tsx
│   │   ├── MachineBadge.tsx
│   │   ├── classic/
│   │   │   └── ClassicSessionsList.tsx          (ClassicSessionsList.styles.ts deleted)
│   │   ├── hub/
│   │   │   ├── ConvRow.tsx                      (ConvRow.styles.ts deleted)
│   │   │   ├── hubUtils.ts
│   │   │   ├── ProjectHubCard.tsx               (ProjectHubCard.styles.ts deleted)
│   │   │   ├── ProjectHubList.tsx               (ProjectHubList.styles.ts deleted)
│   │   │   ├── SessionRow.tsx                   (SessionRow.styles.ts deleted)
│   │   │   ├── types.ts
│   │   │   └── useProjectGroups.ts
│   │   └── tree/
│   │       ├── DrillRow.tsx                     (DrillRow.styles.ts deleted)
│   │       ├── DrillView.tsx                    (DrillView.styles.ts deleted)
│   │       ├── ServerRootRow.tsx                (ServerRootRow.styles.ts deleted)
│   │       ├── TreeRow.tsx                      (TreeRow.styles.ts deleted)
│   │       ├── TreeSessionsList.tsx             (TreeSessionsList.styles.ts deleted)
│   │       ├── treeUtils.ts
│   │       └── types.ts
│   │       (SearchStyles.ts deleted — inlined into each layout)
│   │
│   ├── servers/
│   │   ├── AddServerActionSheet.tsx
│   │   ├── AddServerScreen.tsx
│   │   ├── DisplayedServersList.tsx
│   │   ├── FilterSortSheet.tsx
│   │   ├── NewSessionServerPicker.tsx
│   │   ├── ServerBadge.tsx
│   │   ├── ServerEditModal.tsx
│   │   ├── ServerErrorModal.tsx
│   │   ├── ServerFilterSheet.tsx
│   │   ├── ServerListCard.tsx
│   │   ├── ServersManageModal.tsx
│   │   ├── ServerStatusModal.tsx
│   │   └── SortSheet.tsx
│   │
│   ├── conversation/
│   │   ├── ConversationList.tsx
│   │   ├── DiffViewer.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── MessageSkeletonRow.tsx
│   │   └── ToolCard.tsx
│   │
│   ├── shared/
│   │   ├── InfoModal.tsx
│   │   ├── SlashCommandArgModal.tsx
│   │   └── SlashCommandBoard.tsx
│   │
│   ├── queue/
│   │   ├── PlanPreviewSheet.tsx
│   │   └── PromptQueueSheet.tsx
│   │
│   ├── terminal/
│   │   └── TerminalOutput.tsx
│   │
│   ├── pair/
│   │   └── PairScannerModal.tsx
│   │
│   ├── onboarding/
│   │   ├── animations.ts
│   │   ├── OnboardingNavigator.tsx
│   │   ├── OnboardingShell.tsx
│   │   ├── theme.ts                             (keep — intentional design divergence)
│   │   ├── components/
│   │   │   ├── PagerDots.tsx
│   │   │   ├── PrimaryButton.tsx
│   │   │   ├── TerminalCard.tsx
│   │   │   └── ThreadField.tsx
│   │   └── steps/
│   │       ├── ConnectStep.tsx
│   │       ├── DoneStep.tsx
│   │       ├── NotificationsStep.tsx
│   │       ├── TourStep.tsx
│   │       ├── ValuePropStep.tsx
│   │       └── WelcomeStep.tsx
│   │
│   └── SplashAnimation.tsx                      (excluded from NativeWind migration)
│
├── lib/
│   └── cn.ts                                    (NEW — clsx wrapper)
│
├── hooks/  (unchanged)
├── stores/ (unchanged)
├── services/ (unchanged)
├── types/  (unchanged)
└── constants/
    └── theme.ts                                 (unchanged — source of truth)
```

---

## 10. New Primitive Components to Create

Only one new utility is required for the migration:

### `lib/cn.ts` — className merge helper

**Purpose:** Conditional and merged className strings for NativeWind.

**Props interface:**
```ts
// Not a component — a utility function
import { clsx, type ClassValue } from 'clsx'
export function cn(...inputs: ClassValue[]): string
```

**Usage:**
```tsx
import { cn } from '@/lib/cn'

// Conditional classes
<View className={cn('flex-1 p-3', isActive && 'bg-accent-subtle')} />

// Variant lookup
<Text className={cn('text-font-sm', size === 'lg' && 'text-font-lg')} />
```

**Install:** `npm install clsx`

No other new primitive components are required for the NativeWind migration itself. Component decomposition (e.g., extracting sub-components from large screens) is a separate refactor tracked in Area 2 findings below.

---

## 11. Component Structure Refactor Findings

### 11.1 Oversized Components

These files mix layout, logic, and styling in ways that exceed a single concern:

| File | Lines | Issue |
|---|---|---|
| `app/session/[id].tsx` | 645 | Largest file; mixes session detail layout, terminal stream, input sending, cancel flow, WS connection state |
| `components/SplashAnimation.tsx` | 573 | Self-contained; explicitly exclude from refactor |
| `app/index.tsx` | 565 | Hub screen mixes 3 layout modes (tree/hub/classic), connection status, filter state, FAB, modals — 5 distinct concerns |
| `app/browse.tsx` | 501 | Browse/file picker with search, recent sessions, create session — could extract file list into sub-component |
| `components/servers/AddServerScreen.tsx` | 444 | Form state, validation, QR scan, two flows (URL vs scan) — could extract form into sub-component |
| `components/onboarding/steps/TourStep.tsx` | 410 | 4 distinct tour panels, each with own animation — each panel could be extracted |
| `app/conversation/[id].tsx` | 405 | Conversation view mixing message list, tool expansion, scroll — reasonable to keep as-is |
| `components/conversation/ConversationList.tsx` | 401 | Message list with scroll buttons, load-more, search — scroll behavior could be a hook |
| `components/servers/ServerEditModal.tsx` | 344 | Form with validation and discard confirmation; reasonable size for modal |
| `components/onboarding/steps/ConnectStep.tsx` | 372 | Multi-state connect flow; reasonable given domain complexity |

**Priority decompositions:**
- `app/index.tsx`: Extract `MergedClassicList` (already done as inline function at line 342 — should be a named exported component). Extract `ClassicTabsLayout` as a component. The hub, tree, classic mode switching belongs in a `SessionLayoutSwitcher` component.
- `app/session/[id].tsx`: Extract `SessionInputBar` (input field + send button) as a sub-component. The cancel/action sheet logic should move into `useSessionActions`.

### 11.2 Duplicated Patterns

**"Card with header + body":** Used in `SessionCard`, `ProjectHubCard`, `ConvRow`, `SessionRow`, `MessageBubble` — each implements its own card layout. The existing `Card.tsx` primitive covers the shell; these are feature cards, not primitives. No further unification needed.

**Empty state:** `EmptyState.tsx` exists in `components/ui/`. Check that all screens use it — `app/browse.tsx` and `ConversationList.tsx` should use it instead of ad-hoc empty-state JSX.

**Loading skeleton:** `Skeleton.tsx` exists but `MessageSkeletonRow.tsx` implements its own skeleton. `MessageSkeletonRow` is domain-specific (conversation message shape) so keeping it separate is correct.

**Server picker:** `NewSessionServerPicker.tsx` exists and is used correctly in one place (`app/index.tsx`). Not duplicated.

**Search bar:** `SearchStyles.ts` exports a shared search bar style used across hub, tree, and classic layouts. After NativeWind migration, this shared style file should be deleted and each layout should inline the search bar className strings directly (they are simple enough).

### 11.3 `components/ui/` Completeness

Missing primitives that would reduce duplication:

| Component | Props | Purpose |
|---|---|---|
| None required for NativeWind migration | — | — |

The existing 8 primitives (`Badge`, `Card`, `EmptyState`, `FAB`, `LoadingOverlay`, `ProgressBar`, `Skeleton`, `AvatarMenu`) are complete for the current feature set. Adding `Divider`, `SectionHeader`, `TextInput`, or `IconButton` is pre-optimization — wait until a third use case for each emerges.

### 11.4 Onboarding `theme.ts` Assessment

`components/onboarding/theme.ts` is **intentionally separate** from `constants/theme.ts`:
- Uses a completely different design language: deep navy/ink tones (`ink0-7`), light foreground (`fg0-4`), named semantic color scales (blue400, amber400)
- All 11 onboarding components import from `./theme` — consistent internal usage
- The onboarding UI is visually distinct from the main app — this divergence is intentional product design

**Decision:** Keep `components/onboarding/theme.ts` as-is. Do not merge into `constants/theme.ts`. The onboarding has its own visual identity that is correct to isolate.

### 11.5 Hook Extraction Opportunities

| Hook | Issue | Recommendation |
|---|---|---|
| `useConversations.ts` (400 lines) | Pagination + search + filtering + caching + dedup in one hook | Acceptable as-is; splitting would require a separate spec; do not touch during NativeWind migration |
| `useSession.ts` (131 lines, 3 exports) | Dual-phase eager loading is complex but cohesive | Acceptable as-is |
| `useTerminalStream.ts` (111 lines) | WebSocket stream with cleanup — appropriate complexity | No change needed |

### 11.6 Props Interface Hygiene

**`any` type casts found:**
- `app/index.tsx:53`: `(s as any).mergeChats` — `mergeChats` should be added to the settings store type
- `components/sessions/hub/ProjectHubCard.tsx:102`: `router.push(path as any)` — Expo Router type narrowing issue; acceptable

**No prop interfaces use `: any` directly.** All component props are typed via explicit interfaces.

### 11.7 Render Performance

**Anonymous `renderItem` functions in list components** (defeats memoization when list items are wrapped in `React.memo`):

| File | Issue |
|---|---|
| `components/sessions/classic/ClassicSessionsList.tsx:55` | `renderItem={({ item }) => <SessionCard session={item} />}` |
| `components/sessions/tree/DrillView.tsx:49,67` | `renderItem={({ item }) => <DrillRow item={item} />}` (×2) |
| `components/sessions/tree/TreeSessionsList.tsx:213` | `renderItem={({ item }) => { ... }}` inline |
| `app/index.tsx:397` | `renderItem={({ item }) => ...}` in MergedClassicList |

Fix: extract to `useCallback` or stable function reference. However, this is only an issue if `SessionCard`/`DrillRow` are wrapped in `React.memo`. Currently they are not — so the performance impact is real but the fix would require first adding `React.memo` to cell components. This is a separate optimization, not part of NativeWind migration.

**`FlatList` vs `FlashList`:** `@shopify/flash-list` is installed. Some lists still use `FlatList` (e.g., `ConversationList.tsx`). Migration to `FlashList` is a separate optimization task.

### 11.8 Navigation Pattern

The `server=<id>` query param on every push is consistent across all navigation calls. It's correctly used. No change needed.

### 11.9 Error Surface

`Alert.alert` is used in 15 places for errors:
- Session cancel confirmations: `SessionCard`, `SessionRow` (both layouts)
- Server removal: `ServerListCard`
- Discard confirmation: `ServerEditModal`
- Send input failures: `app/session/[id].tsx` (4 usages)
- Start session failures: `app/browse.tsx` (3 usages)

The `Alert.alert` pattern is acceptable for destructive confirmations (cancel, remove). For error reporting (send failed, start failed), it is not ideal UX — a non-blocking toast would be better. However, this is a UX decision outside the scope of NativeWind migration. **Do not change during migration.** Flag as future work.

---

## 12. Test Coverage Analysis

### 12.1 Current Coverage

**Integration tests (components):**
- Covered: `Badge`, `Card`, `EmptyState`, `SessionCard`, `SessionStatusBadge`, `MessageBubble`, `ToolCard`, `TerminalOutput`, `NewSessionServerPicker`, `BrowseRecents`
- Not covered: `FAB`, `Skeleton`, `ProgressBar`, `LoadingOverlay`, `AvatarMenu`
- Not covered: All hub/tree/classic session list layouts
- Not covered: All server management modals
- Not covered: All onboarding steps

**Unit tests (stores/services):**
- Covered: All 4 Zustand stores, all 5 key services

**E2E tests:**
- Covered: Settings flow, onboarding flow

### 12.2 Migration Regression Risk

| Risk level | Components | Reason |
|---|---|---|
| **High** | `Badge`, `Card`, `SessionStatusBadge` | Have tests + complex dynamic class logic |
| **High** | `SessionCard` | Has tests + conditional styling (warning variant, waiting state) |
| **Medium** | All `.styles.ts` companion components | No tests; visual-only regression hard to catch |
| **Low** | `EmptyState`, `LoadingOverlay`, `Skeleton` | Simple, tested |

### 12.3 Test Strategy for Migration

**Before migrating each Wave:** Add snapshot tests for components with complex conditional styling that lack them.

**Priority snapshot tests to add before Wave 1:**
- `ProgressBar` — animated width is a style prop; static part should snapshot cleanly
- `FAB` — shadow stays as StyleSheet; snapshot verifies no visual regression in the rest

**Before Wave 2:**
- `SessionStatusBadge` — status → class lookup table must produce correct output per status
- `ClassicSessionsList` — render with empty, single, and multiple sessions

**Wave 3-6:** Do not gate on tests — the existing test suite is the regression gate. Run `jest` before and after each Wave PR.

**Minimum viable test gate per PR:**
```bash
npx jest --passWithNoTests
```
All existing tests must pass. No new failures are acceptable.

**Post-migration addition:** After completing each wave, verify the visual output matches pre-migration screenshots. The best approach is before/after screenshots of each component in Storybook or a quick simulator run — not automated snapshot tests alone, since NativeWind generates different style objects than StyleSheet.create even when visually identical.

---

## 13. Summary: Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Dark mode approach | Hardcode dark classes; no `dark:` variants | App is dark-only; no colorScheme wiring exists |
| `clsx` / `tailwind-merge` | Add `clsx` only | No conflicting class scenarios; `tailwind-merge` is overkill |
| `onboarding/theme.ts` | Keep separate | Intentional design divergence; all onboarding components consistently use it |
| `SplashAnimation.tsx` | Exclude from migration | Heavy Reanimated; all dynamic styles; low ROI |
| `.styles.ts` files | Delete after each component migrated | Pure styling; no logic; 10 files total |
| `SearchStyles.ts` | Delete after all three layouts migrated | Shared but trivial; inline into each layout |
| `StyleSheet.hairlineWidth` | Keep as StyleSheet | No Tailwind equivalent; platform-specific value |
| Animated styles | Keep as `style=` prop | Runtime values; NativeWind escape hatch is correct |
| `Alert.alert` for errors | Keep as-is | UX change out of scope; do not touch during migration |
| New primitive components | Only `lib/cn.ts` | No other new primitives needed for migration |
| Font sizes | Add named tokens to tailwind.config.js | Keeps `constants/theme.ts` as single source of truth |
