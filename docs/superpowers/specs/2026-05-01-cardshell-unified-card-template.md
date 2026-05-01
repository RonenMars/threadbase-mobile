# CardShell — Unified Card Template

**Date:** 2026-05-01
**Status:** Approved for implementation

## Problem

`ProjectHubCard` and `SessionCard` share the same visual identity (dark card surface, border, radius, margin) but duplicate those tokens independently. Their internal padding and gap also diverge — hub card header uses `gap: spacing.sm` (8) while `SessionCard` uses `gap: spacing.xs` (4) — making the two cards feel subtly misaligned. There is no single source of truth for what a "card" looks like in this app.

## Solution

Extract a `CardShell` component in `components/ui/CardShell.tsx` that owns all shared visual tokens including padding and gap. Both `ProjectHubCard` and `SessionCard` restructure their internals to live inside `CardShell`, producing identical balanced spacing from the card edges.

---

## Component: `CardShell`

**File:** `components/ui/CardShell.tsx`

```tsx
interface CardShellProps {
  children: React.ReactNode
  accent?: 'waiting'
  style?: StyleProp<ViewStyle>
}
```

### Styles it owns

| Token | Value |
|---|---|
| `backgroundColor` | `dark.bg.card` |
| `borderRadius` | `radius.md` |
| `borderWidth` | `1` |
| `borderColor` | `dark.border` (overridden by accent) |
| `marginBottom` | `spacing.sm` |
| `padding` | `spacing.md` |
| `gap` | `spacing.xs` |

When `accent === 'waiting'`, `borderColor` becomes `dark.status.waiting`.

The `style` prop is passed through for consumer overrides (e.g. `overflow: 'hidden'`).

---

## Migration

### `SessionCard`

- Wrap the existing outer `Animated.View > TouchableOpacity` so that `CardShell` is the outermost element
- Remove `card` and `cardWaiting` from local `StyleSheet` — those styles move into `CardShell`
- Pass `accent={isWaiting ? 'waiting' : undefined}` to `CardShell`
- Internal `padding` and `gap` on the `TouchableOpacity` removed (inherited from shell)

### `ProjectHubCard`

- Replace outer `<View style={styles.card}>` with `<CardShell style={{ overflow: 'hidden' }}>`
- Remove `card` from `ProjectHubCard.styles.ts`
- Header: remove `padding` and `gap` from `header` style (inherited from shell); keep `flexDirection: 'row'`, `alignItems: 'center'`
- Header gap aligns to `xs` (4) — matches `SessionCard`
- Body section: remove `paddingHorizontal` from `section` style (shell padding now provides horizontal alignment)
- Body separator `borderTopWidth` on `body` is unchanged

---

## Files Changed

| File | Change |
|---|---|
| `components/ui/CardShell.tsx` | New file |
| `components/sessions/SessionCard.tsx` | Use `CardShell`, remove local card styles |
| `components/sessions/hub/ProjectHubCard.tsx` | Use `CardShell`, remove local card style |
| `components/sessions/hub/ProjectHubCard.styles.ts` | Remove `card` style entry |

No other files change.

---

## Non-Goals

- No changes to `SessionRow`, `ConvRow`, or any other component
- No light-mode support added (out of scope)
- No new accent variants beyond `waiting` (can be added later)
