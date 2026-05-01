# PTY Turn Divider — Design Spec

## Goal

Visually separate user input from Claude's responses in the terminal output view. Each time the user sends a message, a styled divider row is injected into the terminal line list after the current stream goes idle, showing what the user typed.

## Visual Design

A full-width row with:
- `rgba(31,111,235,0.10)` background tint
- 3px `#58a6ff` left border
- `YOU` label (small, bold, blue) followed by the input text in `#cdd9e5`
- `numberOfLines={1}` truncation — text is still in the data model if needed later
- No line number gutter (spans full width including the number column)

## Data Model

`lines` in `useTerminalStream` changes from `string[]` to `TerminalLine[]`:

```ts
export type TerminalLine =
  | string
  | { __divider: true; text: string }
```

Plain strings are untouched. The `__divider` discriminant is a single property lookup — no ambiguity with real terminal content.

`TerminalOutput` props update to accept `TerminalLine[]`.

## Injection Logic (`useTerminalStream`)

**New ref:** `pendingDividersRef: React.MutableRefObject<string[]>` — a queue of user inputs waiting to be injected.

**New return value:** `recordSentInput(text: string)` — called by the session screen after `sendInput.mutate(payload)`. Pushes `text` onto the queue.

**Flush on idle:** The existing 1500ms idle timer already calls `setIsStreaming(false)`. Immediately before that call, flush the queue: append a `{ __divider: true, text }` entry to `lines` for each pending item, then clear the queue.

**Flush on stream-start (edge case):** If the user sends input while Claude is not streaming (e.g. session is in `waiting_input` state and no output has arrived yet), the idle timer never fires. To handle this: on receipt of the *first* `terminal_output` event after a non-empty queue, flush the queue before appending the new lines. The divider then appears just before Claude's next response.

**History reload:** On VT reset (history refetch or `clear()`), `pendingDividersRef.current` is emptied so stale dividers don't re-inject.

## Rendering (`TerminalOutput`)

`renderItem` gets a branch at the top:

```ts
if (typeof item !== 'string' && item.__divider) {
  return <DividerRow text={item.text} />
}
return <LineRow line={item} index={index} />
```

`DividerRow` is a `memo`'d component. It does not receive an `index` prop and renders no line number gutter.

`keyExtractor` continues using array index (`String(i)`), prefixed with `d-` for divider entries to make keys visually distinct in dev tools — stable enough for an append-only list.

## Files Changed

| File | Change |
|------|--------|
| `hooks/useTerminalStream.ts` | Add `TerminalLine` type, `pendingDividersRef`, `recordSentInput`, flush logic |
| `components/terminal/TerminalOutput.tsx` | Accept `TerminalLine[]`, add `DividerRow`, branch in `renderItem` |
| `app/session/[id].tsx` | Call `recordSentInput(payload)` after `sendInput.mutate(payload)` |

## Out of Scope

- Collapsible turn blocks (Approach B/full turn structure)
- Suppressing PTY echo of user input
- Persisting divider positions across history reloads
- Jump-to-last-divider navigation
