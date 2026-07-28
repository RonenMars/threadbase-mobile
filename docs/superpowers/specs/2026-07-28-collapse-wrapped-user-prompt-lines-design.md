# Collapse wrapped user-prompt lines in the terminal view

## Problem

When Claude Code's CLI echoes a submitted prompt back to the PTY, it wraps long prompts to its own terminal column width, embedding real `\n` bytes at the wrap points. `VirtualTerminal` (`services/virtual-terminal.ts`) is a faithful VT100 emulator: every `\n` byte starts a new grid row (`virtual-terminal.ts:75-79`), with no reflow or word-wrap logic of its own. This is correct behavior for a terminal emulator, but it means a single prompt sentence can render as several short, choppy rows in `TerminalOutput` when the phone's display column count differs from whatever width Claude Code wrapped to.

Confirmed via the raw JSONL history: the underlying user message is one unbroken string (no `\n` characters) — the break is introduced by Claude Code's own CLI rendering, not by the streamer or by tb-mobile's parsing.

This is a display-only problem: nothing downstream (echo-matching, transcript copy, message dedup) is semantically broken by the wrapped rows today, aside from one related cosmetic side effect described below.

## Related latent bug

`isUserLine` (`components/terminal/TerminalOutput.tsx:37-42`) marks a row as user-owned only when that single row's text (after stripping the `❯|›|>` prefix) exactly matches an entry in `userMessageTexts` — the ground-truth set of prompt texts the streamer actually wrote to the PTY (`user_message` / `terminal_replay.userMessages` WS events). A wrapped multi-row prompt fails this match on every row, since no individual row's fragment equals the full original string. The fix for the display problem naturally fixes this too, since both need the same "which rows together form one echoed prompt" grouping.

## Goals

- Collapse a run of PTY rows that together reconstruct one echoed user prompt into a single flowing row, matching how the user actually typed it.
- Fix the `isUserLine` highlighting miss for wrapped prompts as a side effect of the same grouping logic.
- Touch nothing else `VirtualTerminal` emits — tool output, file trees, tables, code blocks, box-drawing borders all render exactly as today.
- No behavior change when `userMessageTexts` is empty (older streamers that predate the `user_message` WS event) — current fallback behavior is preserved exactly.

## Non-goals

- No punctuation-based sentence-boundary heuristics. Terminal output includes prose, shell output, trees, and tables; a rule like "no sentence-ending punctuation → join lines" would misjoin genuinely-separate lines (e.g. `$ ls -la` followed by a directory listing). We have the exact ground-truth string already, so heuristics are unnecessary and strictly worse.
- No change to `VirtualTerminal` itself. It stays a general-purpose, faithful terminal emulator; this concern is specific to how `TerminalOutput` chooses to *display* rows it already receives.
- No change to the streamer or WS protocol. `userMessageTexts` already carries what's needed.

## Design

### New helper: `lib/collapseWrappedUserLines.ts`

A pure function, following the existing `lib/parseQuestionBlock.ts` / `lib/terminalChrome.ts` pattern:

```ts
function collapseWrappedUserLines(
  lines: string[],
  userMessageTexts: Set<string> | undefined,
): string[]
```

Behavior:
1. If `userMessageTexts` is undefined or empty, return `lines` unchanged (identity passthrough — preserves current fallback behavior for older streamers).
2. Scan `lines` for a row matching `^[❯›>]\s(.*)$` (the same prefix regex `TerminalOutput` already uses).
3. From that row, greedily accumulate: start with the matched row's text (after the prefix), then join each subsequent raw row with a single space, checking after each addition whether the accumulated string exactly matches (after `.trim()`) an entry in `userMessageTexts`.
4. Cap the lookahead at a fixed bound (20 rows) to avoid a pathological scan; if no match is found within the bound, leave the original rows untouched and continue scanning from the next row.
5. On an exact match, splice the matched run of N rows into a single row: `❯ ` + the ground-truth string from `userMessageTexts`. Continue scanning after the collapsed row.
6. Return the resulting array.

This is a straightforward lookup against known ground truth — no ambiguity, no guessing about sentence structure.

### Wiring into `TerminalOutput`

`components/terminal/TerminalOutput.tsx` computes the collapsed array once:

```ts
const collapsedLines = useMemo(
  () => collapseWrappedUserLines(lines, userMessageTexts),
  [lines, userMessageTexts],
)
```

`collapsedLines` replaces `lines` as the input to every current consumer in this file:
- `FlashList`'s `data` prop (renderItem, so `LineRow`/`LineText`/`isUserLine` all operate on the collapsed row, which now matches `userMessageTexts` exactly — fixing the highlighting bug for free)
- `keys` / `keyExtractor` (`useMemo` over `lines`)
- `copyAll` (joins `lines` with `\n` for clipboard)
- `questionBlock`'s window (`lines.slice(-30)...`)

No other file changes. `VirtualTerminal`, `useTerminalStream`, and the WS/streamer layers are untouched.

## Testing

- Unit tests for `collapseWrappedUserLines` in `__tests__/`:
  - No match found → returns input unchanged.
  - Single-row prompt (no wrapping) → already matches on the first row, returned as-is (one-row "collapse" is a no-op replace).
  - Multi-row wrapped prompt matching a `userMessageTexts` entry → collapses to one row with the ground-truth text.
  - Empty/undefined `userMessageTexts` → identity passthrough.
  - Lookahead bound exceeded (no match within 20 rows) → original rows left untouched.
  - Non-prompt content (tool output, trees, tables) never gets misjoined, since nothing in it starts with the `❯|›|>` prefix, so the scan never engages.
- Existing `TerminalOutput` tests continue to pass; add a case verifying `isUserLine`/highlighting now applies correctly to a previously-wrapped prompt after collapsing.

## Risks

- Greedy matching could theoretically join across a boundary where wrapped continuation rows happen to also start with `❯|›|>` (extremely unlikely in prose, and the exact-match requirement against `userMessageTexts` means a false collapse would need the accumulated string to coincidentally equal a real prompt text — effectively impossible).
- The 20-row lookahead bound is a `ponytail:`-style deliberate cap: extremely long prompts wrapped into more than 20 PTY rows won't collapse. Raise the constant if real-world prompts exceed it.
