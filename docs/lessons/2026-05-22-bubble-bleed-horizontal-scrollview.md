# Bubble bleed: horizontal ScrollView inflates parent height on iOS

**Date:** 2026-05-22
**Branch:** `fix/flashlist-v2-recycling-mvcp`
**Status:** Resolved structurally (no clean JS-level root cause)

## Symptom

In `components/conversation/MessageBubble.tsx`, assistant bubbles whose content contained a fenced code block painted their dark background **150–250 pt past the visible content**, masking subsequent FlashList rows. The bubble's outer `<View>` measured itself ~244 pt taller than the sum of its children's `onLayout`-reported heights + flex gaps. The phantom space was below the last visible child, inside the bubble's content area.

The bug showed up on the very first render in collapsed state. Toggling expand/collapse and scrolling did not change the gap.

## Measurement evidence

For one specific message (containing a `\`\`\` … \`\`\`` block in the collapsed view):

| Layer | `onLayout`-reported height |
|---|---|
| FlashList cell container | 761.66 pt |
| MessageBubble `bubble` View | 761.66 pt |
| `TextBlockBody.wrapper` (`<View style={{ gap: 4 }}>`) | 735.66 pt |
| TextContent[0] (prose before fence) | 198 pt |
| CodeBlock (header + horizontal ScrollView + body) | 107.66 pt |
| TextContent[2] (prose after fence) | 154 pt |
| Expand button | 19.66 pt |
| **Sum of children + 3 × gap(4)** | **491.33 pt** |
| **Wrapper.h − children sum** | **244.33 pt phantom** |

The wrapper has no `flex`, no `height`, no `minHeight` — just `gap: 4`. The bubble sizes to wrapper + 26 pt padding; container sizes to bubble. Nothing in the JS tree explains the 244 pt.

## Hypotheses ruled out

- **Cell recycling / row-height cache.** Forcing fresh remount via `key={message.id}` left the phantom unchanged.
- **`useRecyclingState` not notifying FlashList.** Source-read showed it's built on `useLayoutState` and triggers relayout on every set; toggling expand→collapse produced consistent 761 pt collapsed, 805 pt expanded — no "stuck big" behavior.
- **iOS Text reporting glyph bounds vs. consuming larger frame.** Wrapping each `<TextContent>` in a `<View>` with its own `onLayout` showed View height ≡ Text height. Text is honest.
- **CodeBlock's ScrollView over-allocating.** ScrollView `onLayout.h` = innerText `onLayout.h` = 55.66 pt. The header is 52 pt because the Copy button has `minHeight: 44` (iOS hit-target) — accounted for.
- **Fence truncation producing malformed `parts`.** Simulated against ground-truth message text from the session jsonl: 3 well-formed parts, children render in source order.
- **Multi-Text + gap interaction.** Each part rendered independently still summed to 491 pt.

## What we know

Removing `<CodeBlock>` from the rendered tree (returning `null` for fence parts) made the phantom space disappear. So CodeBlock is the causal trigger. Inside CodeBlock, the only structurally unusual element is `<ScrollView horizontal>` wrapping a `<Text>` — and that's the same pattern the rest of the column-flex parent contains.

We never identified the exact native-layer mechanism. The most likely explanation is some interaction between `UIScrollView`'s `intrinsicContentSize` and the parent's auto-sizing pass that doesn't surface to RN's JS `onLayout` callbacks. The View Hierarchy debugger in Xcode could probably show it; we didn't go that deep.

## The fix

Replace the hand-rolled `<ScrollView horizontal>` + `<Text>` body with [`prism-react-renderer`](https://github.com/FormidableLabs/prism-react-renderer) rendering each line as a wrapped row of token Texts. No horizontal scroll — long lines wrap. The phantom space disappeared immediately. See [Message-bubble CodeBlock refactor](./2026-05-22-message-bubble-codeblock-refactor.md).

## What to do (and not do) next time

- **Do not** wrap `<Text>` in `<ScrollView horizontal>` inside a column-flex parent. Render long monospace lines as wrapped row Views (`flexDirection: 'row', flexWrap: 'wrap'`) instead.
- **If a bubble or card paints background past its visible content**, and `onLayout` logs don't explain the gap: suspect a horizontal ScrollView (or similarly intrinsic-sized native view) in the subtree before chasing more JS-side measurement theories.
- For the full brainstorm record (with every diagnostic step and measurement table), see `docs/superpowers/plans/2026-05-22-flashlist-bubble-bleed-brainstorm.md`.
