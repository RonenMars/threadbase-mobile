# Brainstorm: FlashList v2 bubble bg painting past visible content (tb-mobile)

I'm working on **tb-mobile** (Threadbase iOS, Expo SDK 55, RN 0.83.6, new architecture, on branch `fix/flashlist-v2-recycling-mvcp`). I recently swapped the conversation-screen list from `FlatList` to **`@shopify/flash-list` v2.0.2**. That fixed a critical bottom-truncation bug. Now there's a remaining visual bug I need your help thinking through.

## Repo

`threadbase-mobile` (this repo)

## The bug

For some assistant `MessageBubble`s — specifically the ones whose text contains a **fenced code block** in the collapsed render — the bubble's `<View>` measures **150–250 pt taller than its visible content**. The bubble's `dark.bg.card` background paints across that extra height, which sits **behind subsequent FlashList cells** (Bash/Tool accordions, user replies, the next assistant bubble). In practice it **partially hides content of rows below** the over-tall bubble, and visually creates a "ghost gray rectangle" extending past the bubble.

Bubbles whose collapsed text has **no code fence** render correctly (yellow debug border hugs content).

## Key files

- `components/conversation/MessageBubble.tsx` — `MessageBubble`, `TextBlockBody`, `CodeBlock`, `TextContent`. The bubble's outer `<View style={[styles.bubble, bubbleAssistant]}>` is where the over-painting happens.
- `app/conversation/[id].tsx` — the FlashList consumer with `getItemType`, `maintainVisibleContentPosition: { autoscrollToBottomThreshold: 0.2, startRenderingFromBottom: true }`, etc.
- `components/conversation/ToolCard.tsx`, `ThinkingCard.tsx`, `DiffViewer.tsx` — all swapped to `useRecyclingState`.

## What we already tried and ruled out

- ❌ Recycling (we set `maxItemsInRecyclePool={0}`, bug persists)
- ❌ `useRecyclingState` reset on cell reassign (the swap works, but bug persists fresh-mount too)
- ❌ `selectable` prop on `<Text>` (removed, no change)
- ❌ `ScrollView style={{ maxHeight: 300 }}` inside `CodeBlock` (removed, no change)
- ❌ `maintainVisibleContentPosition: { disabled: true }` (no change)
- ❌ Reverting to plain `FlatList` (different bug: the original bottom-truncation returns — but we get a clue: the mismeasurement isn't FlashList-specific, it's somewhere in MessageBubble's measurement)
- ❌ `overflow: 'hidden'` on the FlashList cell wrapper

## Measurement evidence

For one specific message (id `c34aa17a-...-880`, role assistant, `text(514)` with a 1-line code fence inside, 11 lines total):

| Layer | onLayout-reported height |
|---|---|
| FlashList row | 770 pt |
| `MessageBubble.bubble` View | 762 pt |
| `TextBlockBody` View (gap container) | 736 pt |
| Sum of TextBlockBody's children onLayout values | **~494 pt** |
| Visible rendered content (eyeballed) | ~360 pt |

**~240 pt is allocated inside `TextBlockBody` that isn't accounted for by its children's onLayout-reported heights.**

`TextBlockBody`'s children are: `<TextContent>` (a single `<Text>`), `<CodeBlock>` (View with header + horizontal ScrollView + optional toggle), `<TextContent>` again, then a "Show all N lines" `<TouchableOpacity>`. The wrapper is `<View style={{ gap: 4 }}>` — flexbox column with `gap`.

## Current hypotheses I want to grill

1. **iOS `<Text>` measurement quirk** — `<Text>` in a column flex container with `gap` and `lineHeight` set, on iOS, can report `onLayout.height` that differs from the visual rendered glyph bounds. Maybe Text views are silently allocating extra vertical space that's not visible but counts toward the parent's height.

2. **`gap: spacing.xs` on the parent View** behaves differently when one child is a `<View>` (CodeBlock) and others are `<Text>` (TextContent). Maybe the gap is measured against the Text's intrinsic content frame which is bigger than what `onLayout` reports.

3. **Horizontal `<ScrollView>` nested in a column flex parent** allocates space based on its content's vertical metrics in a non-obvious way (separate from `maxHeight`).

4. **Empty trailing newlines in `displayed`** — the collapse logic appends `'\n...'` to the truncated text, and the original text already may end with newlines. Empty lines render at `lineHeight` each. Could there be unexpectedly many at the end?

5. **Something specific to messages with code fences inside the collapsed render** — `parts = displayed.split(/(```...```)/g)` produces 3 items. Each `<TextContent>` is a separate `<Text>` instance. Two separate `<Text>` nodes side-by-side in column flex might each add iOS's internal `UITextView` padding (`textContainerInset`).

6. **Hidden newlines from `decodeEntities`** in either of the surrounding text parts.

## What I want from you

**Brainstorm root-cause hypotheses with me**, ideally:

- Question my assumptions — am I measuring the right things? Is `onLayout` lying somewhere?
- Suggest diagnostic experiments that would *disprove* each hypothesis quickly
- Especially: are there iOS RN measurement quirks specific to `<Text>` rendering inside column flex containers with `gap`, with `lineHeight`, with `selectable`, with text containing fenced code blocks — that you know of?
- Pragmatic workarounds that fix the symptom even if the root cause stays unsolved (e.g. forcing the bubble to shrink-wrap to visible content via some layout trick).

**Don't write code yet.** Walk through the hypotheses with me, propose minimal diagnostics, and we'll converge on a plan together. Be skeptical of my earlier work — I've spent hours and may be biased toward conclusions that aren't supported.

When you're ready to dig, ask me one focused question to start.

---

## Diagnosis session 2026-05-22 — findings (root cause STILL unsolved)

Heavy instrumentation pass against the live "Staged: 7 files, 1,445 insertions..." bubble (session `c34aa17a-...`, message contains `\`\`\`` fenced block in collapsed render). All numbers below are `onLayout` reads from a single render in collapsed state.

### Measurement table

| Layer | onLayout-reported height |
|---|---|
| FlashList cell `container` | 761.66 pt |
| `bubble` View | 761.66 pt |
| `TextBlockBody.wrapper` (`<View style={styles.gap}>`) | 735.66 pt |
| TextContent[0] (with View wrap) | 198 pt (both wrap and Text agree) |
| CodeBlock[1] total | 107.66 pt |
| ├ codeHeader (inferred y=0..52) | 52 pt |
| ├ ScrollView | 55.66 pt |
| └ innerText (inside ScrollView) | 55.66 pt |
| TextContent[2] (with View wrap) | 154 pt (both wrap and Text agree) |
| expandBtn | 19.66 pt |
| Sum of children + 3×gap(4) | **491.33 pt** |
| **Wrapper.h − children sum** | **244.33 pt phantom** |

### Hypotheses tested and ruled out

- ❌ **iOS Text reporting glyph bounds but consuming larger frame.** Wrapping each TextContent in a View with its own onLayout — the wrap and the Text inside report identical heights. Text is honest.
- ❌ **CodeBlock horizontal ScrollView over-allocating vertical space.** ScrollView.h = innerText.h = 55.66pt. ScrollView is honest. (Aside: CodeBlock's codeHeader is 52pt because the Copy button has `minHeight: 44` for iOS hit-target sizing — irrelevant to the bug.)
- ❌ **Code-fence truncation cutting mid-fence to produce malformed parts.** Simulated against ground-truth message text (extracted from `.claude/projects/.../*.jsonl`): `parts.length = 3`, each correctly closed. Children render in source order.
- ❌ **FlashList cell over-allocation from above.** `container.h === bubble.h === wrapper.h + 26pt (padding+border)`. The cell sizes to the bubble; nothing imposes height from above.
- ❌ **FlashList row-height cache pollution from cell recycling.** Adding `key={message.id}` to MessageBubble in `app/conversation/[id].tsx` (forces fresh remount on every reassign) does not change wrapper.h — still 735.66pt. So it's not a recycle artifact.
- ❌ **`useRecyclingState` failing to notify FlashList of size changes.** Source-read confirms `useRecyclingState` is built on top of `useLayoutState` and its setter calls `recyclerViewContext.layout()` (FlashList v2). Empirically: toggling expanded → collapsed produces collapsed.h = 761.66 on first render AND 761.66 after every toggle (perfectly consistent), expanded.h = 805.66 consistently. There's no "stuck big" behavior — the collapsed measurement is *deterministically* 244pt too tall.
- ❌ **Multi-Text + gap interaction quirk.** Each part is independently wrapped in a View; sums still don't match wrapper.

### What we still know nothing about

A `<View style={{ gap: 4 }}>` with 4 documented children whose `onLayout` heights + gaps sum to 491.33pt is somehow reporting itself as 735.66pt. The wrapper has no `flex`, no `height`, no `minHeight`. The parent isn't stretching it (container = wrapper + paddings). No invisible child accounts for the 244pt. Reproducible on first render of any collapsed `TextBlockBody` whose `parts` array contains a fenced code block.

### Things NOT yet tried

- Pragmatic workarounds (`flexShrink: 1` or `alignSelf: 'flex-start'` on `styles.gap`) to fix the symptom without identifying the cause
- Profiling with React DevTools / iOS Xcode View Hierarchy debugger to see the actual native frame tree (which would reveal whether there's a hidden child View we don't know about)
- Removing `selectable` from `<Text>` (untested; iOS `selectable` swaps in a `UITextView` which has its own internal padding via `textContainerInset`)
- Removing the CodeBlock entirely from `parts.map` to test if the phantom space disappears (this would be an experiment 2 from the earlier ladder — never run)
- Testing with `<FlatList>` instead of FlashList to see if phantom persists outside FlashList entirely

### Status

Stopped after ~1h of instrumentation. All `onLayout` evidence is consistent: every child is honest, no parent imposes height, no recycling artifact. The 244pt phantom is genuine and unexplained. Recommended next step: open Xcode and use the View Hierarchy debugger on a frozen frame — that's the only tool that can see beyond what RN's JS-side `onLayout` exposes.
