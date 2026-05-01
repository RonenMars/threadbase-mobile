# CardShell — Unified Card Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing `Card` component to own all shared visual tokens (including `padding`, `gap`, and `marginBottom`) and migrate `SessionCard` and `ProjectHubCard` to use it as their base.

**Architecture:** Update `components/ui/Card.tsx` to add `marginBottom`, `gap`, and a `style` passthrough. Migrate `SessionCard` to use `<Card variant="warning">` and remove its local card styles. Migrate `ProjectHubCard` to use `<Card style={{ overflow: 'hidden' }}>`, aligning its internal padding and gap to match.

**Tech Stack:** React Native, TypeScript, expo-router

---

### Task 1: Update `Card` to own `marginBottom` and `gap`

**Files:**
- Modify: `components/ui/Card.tsx`

The current `Card` is missing `marginBottom: spacing.sm` and `gap: spacing.xs`. Add them to the base style, and ensure the `style` prop is already passed through (it is — confirm no change needed there).

- [ ] **Step 1: Read the current file**

Confirm current contents match what we saw earlier:
```
backgroundColor: dark.bg.card
borderRadius: radius.md
padding: spacing.md
borderWidth: 1
borderColor: dark.border
```
No `marginBottom`, no `gap`.

- [ ] **Step 2: Add `marginBottom` and `gap` to the base style**

Replace the `styles.card` definition in `components/ui/Card.tsx`:

```typescript
const styles = StyleSheet.create({
  card: {
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: dark.border,
    marginBottom: spacing.sm,
  },
})
```

No other changes to the file.

- [ ] **Step 3: Run the test suite to confirm nothing breaks**

```bash
npx jest --testPathPattern="Badge|EmptyState|SessionCard|ToolCard" --no-coverage
```

Expected: all previously passing tests still pass. (No Card-specific tests exist yet — we add them in Task 2.)

- [ ] **Step 4: Commit**

```bash
git add components/ui/Card.tsx
git commit -m "feat: add marginBottom and gap to Card base style"
```

---

### Task 2: Add a `Card` rendering test

**Files:**
- Create: `__tests__/integration/components/Card.test.tsx`

- [ ] **Step 1: Write the test**

```typescript
import React from 'react'
import { Text } from 'react-native'
import { render } from '@testing-library/react-native'
import { Card } from '@/components/ui/Card'

describe('Card', () => {
  it('renders children', () => {
    const { getByText } = render(<Card><Text>hello</Text></Card>)
    expect(getByText('hello')).toBeTruthy()
  })

  it('applies warning variant', () => {
    const { getByTestId } = render(
      <Card variant="warning" testID="card"><Text>x</Text></Card>
    )
    const card = getByTestId('card')
    expect(card.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ borderColor: '#d29922' }),
      ])
    )
  })
})
```

- [ ] **Step 2: Add `testID` prop to `Card` so the test can query it**

Update `components/ui/Card.tsx` interface and component:

```typescript
interface CardProps {
  children: React.ReactNode
  style?: ViewStyle
  variant?: 'default' | 'warning' | 'danger'
  testID?: string
}

export function Card({ children, style, variant = 'default', testID }: CardProps) {
  return (
    <View testID={testID} style={[styles.card, variantStyles[variant], style]}>
      {children}
    </View>
  )
}
```

- [ ] **Step 3: Run the new tests**

```bash
npx jest --testPathPattern="components/Card" --no-coverage
```

Expected: 2 tests pass.

- [ ] **Step 4: Commit**

```bash
git add __tests__/integration/components/Card.test.tsx components/ui/Card.tsx
git commit -m "test: add Card component rendering tests"
```

---

### Task 3: Migrate `SessionCard` to use `Card`

**Files:**
- Modify: `components/sessions/SessionCard.tsx`

`SessionCard` currently has inline `StyleSheet` entries `card` and `cardWaiting` that duplicate the visual tokens now owned by `Card`. Replace the outer wrapper with `<Card>` and remove those local styles.

The current structure is:
```
<Animated.View entering={...}>
  <TouchableOpacity style={[styles.card, isWaiting && styles.cardWaiting]} ...>
    ...content...
  </TouchableOpacity>
</Animated.View>
```

The new structure wraps `Card` around the `TouchableOpacity`. `Card` owns the card surface; `TouchableOpacity` owns the press behaviour and sits inside it.

- [ ] **Step 1: Update the import line to include `Card`**

```typescript
import { Card } from '@/components/ui/Card'
```

- [ ] **Step 2: Replace the render output**

```typescript
return (
  <Animated.View entering={isNew ? FadeInDown : undefined}>
    <Card variant={isWaiting ? 'warning' : 'default'}>
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={0.75}
        accessibilityLabel={`Session ${session.projectName}, status ${session.status}, ${formatElapsed(session.elapsedMs)}`}
        accessibilityRole="button"
      >
        <View style={styles.row}>
          <FolderSimple size={16} color={dark.text.secondary} weight="fill" />
          <Text style={styles.projectName} numberOfLines={1}>{session.projectName}</Text>
          {session.branch ? (
            <Badge label={session.branch} />
          ) : null}
          {session.machineName ? (
            <MachineBadge machineName={session.machineName} />
          ) : null}
          {multipleServers ? (
            <ServerBadge serverId={session.serverId} label={session.serverLabel} />
          ) : null}
        </View>

        <View style={styles.statusRow}>
          <SessionStatusBadge status={session.status} />
          <Text style={styles.meta}>{formatElapsed(session.elapsedMs)}</Text>
          <Text style={styles.meta}>{session.promptCount} prompts</Text>
        </View>

        {session.lastOutput ? (
          <Text style={styles.output} numberOfLines={2}>{session.lastOutput}</Text>
        ) : null}
      </TouchableOpacity>
    </Card>
  </Animated.View>
)
```

- [ ] **Step 3: Remove `card` and `cardWaiting` from the local `StyleSheet`**

Delete these two entries from the `StyleSheet.create({...})` at the bottom of `SessionCard.tsx`:

```typescript
// DELETE:
card: {
  backgroundColor: dark.bg.card,
  borderRadius: radius.md,
  padding: spacing.md,
  borderWidth: 1,
  borderColor: dark.border,
  gap: spacing.xs,
  marginBottom: spacing.sm,
  minHeight: 44,
},
cardWaiting: {
  borderColor: dark.status.waiting,
},
```

Note: `minHeight: 44` was on `card`. If this visual constraint is still needed, add `style={{ minHeight: 44 }}` to the `<Card>` in step 2. Given the content always renders at ≥44pt naturally, omit it unless visual testing shows a regression.

- [ ] **Step 4: Run existing `SessionCard` tests**

```bash
npx jest --testPathPattern="SessionCard" --no-coverage
```

Expected: all 13 tests pass. The accessibility label test queries by role (`getByRole('button')`) — verify it still finds the `TouchableOpacity` inside `Card`.

- [ ] **Step 5: Commit**

```bash
git add components/sessions/SessionCard.tsx
git commit -m "refactor: migrate SessionCard to use shared Card component"
```

---

### Task 4: Migrate `ProjectHubCard` to use `Card`

**Files:**
- Modify: `components/sessions/hub/ProjectHubCard.tsx`
- Modify: `components/sessions/hub/ProjectHubCard.styles.ts`

`ProjectHubCard`'s outer `<View style={styles.card}>` becomes `<Card style={{ overflow: 'hidden' }}>`. The `card` style entry is removed from `ProjectHubCard.styles.ts`. The `header` style loses its own `padding` and `gap` (inherited from `Card`'s `padding: spacing.md` and `gap: spacing.xs`), but keeps `flexDirection: 'row'` and `alignItems: 'center'`. The `section` style loses `paddingHorizontal` (inherited from `Card`).

- [ ] **Step 1: Add the `Card` import to `ProjectHubCard.tsx`**

```typescript
import { Card } from '@/components/ui/Card'
```

- [ ] **Step 2: Replace the outer `View` with `Card`**

Change:
```typescript
return (
  <View style={styles.card}>
    ...
  </View>
)
```

To:
```typescript
return (
  <Card style={{ overflow: 'hidden' }}>
    ...
  </Card>
)
```

- [ ] **Step 3: Update `ProjectHubCard.styles.ts` — remove `card`, strip padding/gap from `header`, strip paddingHorizontal from `section`**

Replace the full file content:

```typescript
import { StyleSheet } from 'react-native'
import { dark, font, radius, spacing } from '@/constants/theme'

export const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectName: {
    flex: 1,
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '600',
  },
  countBadge: {
    color: dark.text.secondary,
    fontSize: font.xs,
  },
  chevron: {
    color: dark.text.secondary,
    fontSize: font.lg,
    fontWeight: '300',
    lineHeight: font.lg,
    width: 16,
    textAlign: 'center',
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: dark.border,
    paddingBottom: spacing.sm,
  },
  section: {
    paddingTop: spacing.sm,
  },
  sectionLabel: {
    color: dark.text.secondary,
    fontSize: font.xs,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  seeAllRow: {
    paddingVertical: spacing.xs,
  },
  seeAllText: {
    color: dark.text.accent,
    fontSize: font.sm,
  },
})
```

Key changes from original:
- `card` entry removed entirely
- `header`: removed `padding: spacing.md` and `gap: spacing.sm` (Card now provides padding; gap aligns to `xs` via Card)
- `section`: removed `paddingHorizontal: spacing.md` (Card padding covers it)
- `radius` import can be removed if unused — check after this step

- [ ] **Step 4: Check if `radius` is still imported in the styles file**

After removing `card`, `radius` is no longer used in `ProjectHubCard.styles.ts`. Remove it from the import:

```typescript
import { dark, font, spacing } from '@/constants/theme'
```

- [ ] **Step 5: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/sessions/hub/ProjectHubCard.tsx components/sessions/hub/ProjectHubCard.styles.ts
git commit -m "refactor: migrate ProjectHubCard to use shared Card component"
```

---

## Self-Review

**Spec coverage:**
- ✅ `CardShell` (implemented as updated `Card`) owns `backgroundColor`, `borderRadius`, `borderWidth`, `borderColor`, `marginBottom`, `padding`, `gap`
- ✅ `accent='waiting'` → `variant='warning'` maps to `dark.status.waiting` border (already existed, preserved)
- ✅ `style` passthrough for `overflow: 'hidden'` on hub card
- ✅ `SessionCard` migrated, local card styles removed
- ✅ `ProjectHubCard` migrated, `card` style removed, header padding/gap aligned, section paddingHorizontal removed
- ✅ No other files changed

**Placeholder scan:** No TBDs, no vague steps, all code is complete.

**Type consistency:** `Card` props (`variant`, `style`, `testID`, `children`) are defined in Task 2 and used consistently in Tasks 3 and 4. `variant='warning'` is the existing name for the waiting border — used correctly in Task 3.
