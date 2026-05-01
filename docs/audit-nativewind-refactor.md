# NativeWind Migration & Structural Refactor — Audit Prompt

## Purpose

This document is a prompt for an AI agent (or human engineer) performing a full audit of `tb-mobile` in preparation for a complete migration from `StyleSheet.create` to NativeWind (Tailwind CSS for React Native), combined with a structural refactor to improve component organization, reusability, and code clarity.

The output of the audit should be a prioritized, actionable spec that feeds directly into a `writing-plans` / `subagent-driven-development` implementation cycle.

---

## Project Context

`tb-mobile` is an Expo (SDK 55) + React Native 0.83 app using:

- **Routing:** Expo Router (file-based, `app/` directory)
- **State:** Zustand stores (`stores/`) + TanStack React Query for server state
- **Styling:** `StyleSheet.create` with token references from `constants/theme.ts` — NativeWind is configured but has **zero className= adoption**
- **Icons:** `phosphor-react-native`
- **Animations:** `react-native-reanimated` v4
- **Lists:** `@shopify/flash-list`
- **Bottom sheets:** `@gorhom/bottom-sheet`

### Existing infrastructure (already done — do not re-configure)
- `nativewind@^4.2.3` installed
- `tailwindcss@^3.4.10` installed
- `metro.config.js` uses `withNativeWind`
- `global.css` has `@tailwind base/components/utilities` directives
- `tailwind.config.js` has custom colors, spacing, and font families matching `constants/theme.ts`
- `babel.config.js` includes NativeWind preset

### Design tokens (source of truth)
`constants/theme.ts` exports:
```
dark / light  →  bg.primary, bg.secondary, bg.card
                 text.primary, text.secondary, text.accent, text.danger, text.warning, text.success
                 border
                 status.running, .waiting, .failed, .completed, .idle
spacing       →  xs=4, sm=8, md=12, lg=16, xl=24, xxl=32
radius        →  sm=6, md=10, lg=16, full=9999
font          →  xs=11, sm=13, base=15, lg=17, xl=20, xxl=24
```
These values are already mapped in `tailwind.config.js` and must remain the source of truth. Do not duplicate or diverge.

---

## What the Audit Must Produce

The audit should deliver a full spec document covering all four areas below. Each section should be specific enough to be handed to a subagent that has never seen this codebase.

---

### Area 1: NativeWind Migration Strategy

**Goal:** Replace every `StyleSheet.create` and inline `style={{}}` with NativeWind `className=` props. After migration, `StyleSheet.create` should only appear for cases that genuinely cannot be expressed as Tailwind utilities (e.g., `transform` with runtime-computed values, `shadowOffset`, platform-specific native props).

**Audit tasks:**

1. **Inventory every styling site:**
   - List all files using `StyleSheet.create` (there are ~63)
   - List all files with inline `style={{}}` objects
   - Flag any dynamic styles (color/size computed at runtime) — these need special treatment

2. **Map token → Tailwind class:**
   - `dark.bg.primary` → `bg-bg-primary`
   - `dark.text.accent` → `text-accent`
   - `spacing.md` → `p-3` / `px-3` / `gap-3` (document the mapping table)
   - `radius.md` → `rounded-[10px]` (or add named radius to tailwind config)
   - All status colors → `text-status-running`, `bg-status-failed`, etc.
   - Font sizes → `text-xs`, `text-sm`, etc. (document the mapping)

3. **Identify NativeWind limitations in this codebase:**
   - Which props in the existing styles are NOT supported by NativeWind (e.g., `shadowOffset`, `elevation`, `textShadowOffset`)?
   - Document what stays as `StyleSheet` and why
   - List any custom utility classes that should be added to `global.css`

4. **Propose a migration order:**
   - Primitives first (`components/ui/`) — Card, Badge, FAB, Skeleton, EmptyState, etc.
   - Then feature components, then screens
   - What's the right batching to minimize merge conflicts?

5. **Dark mode handling:**
   - Currently: components reference `dark.*` constants directly — there is no dynamic theme switching
   - With NativeWind: should we use `dark:` variants + `colorScheme` from settings store, or keep hardcoded dark classes?
   - Recommend an approach and justify it

6. **Dynamic/conditional styling:**
   - The codebase has patterns like `{ color: statusColor(session.status) }` and `{ opacity: isActive ? 1 : 0.5 }`
   - Document how to handle each pattern in NativeWind (e.g., `cn()` helper, ternary className, `style` as escape hatch)
   - Should we add `clsx` or `tailwind-merge` (`twMerge`)? Recommend with justification.

---

### Area 2: Component Structure Refactor

**Goal:** Clean up the component hierarchy to make components smaller, more focused, and more reusable. The current structure is mostly good but has specific problem areas.

**Audit tasks:**

1. **Identify oversized components:**
   - Any component over ~200 lines that mixes layout, logic, and styling?
   - Any screen file that could be decomposed into sub-components?
   - Flag: `app/index.tsx`, `app/session/[id].tsx`, `app/_layout.tsx` (AuthGate is large), any large modal files

2. **Identify duplicated patterns:**
   - Are there repeated "card with header + body" patterns that could use a shared shell?
   - Are there repeated "empty state" treatments beyond `components/ui/EmptyState`?
   - Are there repeated "loading skeleton" patterns?
   - Is the server picker duplicated anywhere?

3. **Review `components/ui/` completeness:**
   - What primitive components are missing that are clearly needed? (e.g., a `Divider`, `SectionHeader`, `TextInput` wrapper, `IconButton`)
   - Which of the onboarding sub-components (`PrimaryButton`, `ThreadField`, `TerminalCard`) should be promoted to `components/ui/`?

4. **`.styles.ts` file assessment:**
   - After NativeWind migration, `.styles.ts` files become unnecessary — confirm which ones can be deleted entirely
   - Are any `.styles.ts` files doing logic (not just styling)? Those logic parts should stay

5. **Onboarding component organization:**
   - `components/onboarding/` has its own `theme.ts` — is this intentional divergence from `constants/theme.ts`? Should it be unified?
   - Should `components/onboarding/components/` be flattened?

6. **Proposed directory structure:**
   - Write out the target directory structure after the refactor (not before)
   - Be specific — show every file and where it lives

---

### Area 3: Code Quality & Clarity

**Goal:** Surface specific patterns that reduce readability or make components harder to maintain, and propose targeted fixes.

**Audit tasks:**

1. **Props and interface hygiene:**
   - Are there components that accept a large `session` or `conversation` object but only use 2-3 fields? Propose prop narrowing.
   - Are there any `any` types hiding in component props?
   - Are prop interfaces defined locally or in `types/`? Is there a consistent convention?

2. **Hook extraction opportunities:**
   - Are there screens or components that contain significant local state + effects that could be a custom hook?
   - Which hooks in `hooks/` are doing too much (fetch + transform + local state)?

3. **Render performance:**
   - Are `FlatList` / `FlashList` cells memoized? Are `keyExtractor` functions stable?
   - Are there anonymous arrow functions being passed as props to list items (defeats memoization)?
   - Flag specific files where this is an issue

4. **Navigation patterns:**
   - The codebase passes `server=<id>` as a query param on every navigation. Is this consistently handled? Should it be in a navigation context or store instead?
   - Are there any screens that re-fetch on every mount that shouldn't?

5. **Error surface:**
   - Errors from session actions (cancel, send input) use `Alert.alert` — is this the right UX primitive?
   - Should there be a shared `useErrorToast` or inline error banner pattern?
   - What happens if a WebSocket message arrives for a server that has been removed?

---

### Area 4: Test Coverage Gaps

**Goal:** Identify which component and logic areas lack test coverage, especially areas that will change during migration.

**Audit tasks:**

1. **Coverage inventory:**
   - List which components in `components/ui/` have tests vs. which don't
   - List which Zustand stores have tests
   - Are there tests for the three session list layouts (classic, hub, tree)?

2. **Migration regression risk:**
   - Which components have the most complex conditional styling that could silently break?
   - Where should snapshot tests be added before migration begins?

3. **Recommend a test strategy for the migration:**
   - Should we add snapshot tests before migrating each component and verify they pass after?
   - What's the minimum viable test gate to run before each PR?

---

## Audit Deliverables

The audit must produce a single spec document at:

```
docs/superpowers/specs/YYYY-MM-DD-nativewind-migration-design.md
```

The spec must include:

1. **Token → Tailwind class mapping table** (complete, every token in `constants/theme.ts`)
2. **Tailwind config additions** needed (radius names, any missing custom values)
3. **`global.css` additions** — any custom utility classes needed
4. **Component migration checklist** — every file that needs changes, in migration order
5. **Target directory structure** — the full tree of `components/` and `app/` after refactor
6. **New primitive components** to create (name, props interface, purpose)
7. **Files to delete** after migration (`.styles.ts` files, etc.)
8. **"Do not migrate" list** — props that stay as `StyleSheet` and why
9. **Test additions** required before and after migration

---

## Constraints

- **Do not change any API contracts.** No changes to `services/`, `stores/`, `hooks/`, or `types/`.
- **Do not change navigation routes.** Screen paths in `app/` stay the same.
- **Do not change `constants/theme.ts`.** It is the token source of truth — only extend `tailwind.config.js` to match it.
- **Preserve all existing tests.** The migration must not break passing tests. New tests are additive.
- **No new dependencies** unless strongly justified. `clsx` or `tailwind-merge` may be acceptable — justify in the spec.
- **Backward compatibility with React Native 0.83 + Expo SDK 55** — check NativeWind docs for any known limitations with this version pair.

---

## How to Perform the Audit

1. Read the full directory tree — do not skip any directory
2. Read `constants/theme.ts` in full
3. Read `tailwind.config.js` in full
4. Read at least one representative file from each of: `components/ui/`, `components/sessions/hub/`, `components/sessions/tree/`, `components/sessions/classic/`, `components/servers/`, `components/onboarding/`, `app/`
5. Run a search for all `StyleSheet.create` usages across the codebase
6. Run a search for all `className=` usages to confirm current adoption level
7. Run a search for `style={{` to find inline styles
8. Run a search for dynamic color references (e.g., `dark.text`, `dark.bg`, `dark.status`)
9. Only after reading the above — write the spec
