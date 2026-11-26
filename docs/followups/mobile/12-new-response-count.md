# 12 — Count agent replies on the jump-to-latest pill

## Problem

When a turn ends while the reader is scrolled up the transcript, the round blue jump control carried a red "1" badge.
The red dot reads as an error, the "1" was a literal that never counted anything, and the control said nothing about what was waiting below.

## Decisions

- **The count is the agent's replies, not its tool use.**
  A reply is an assistant message, outside a sub-agent chain, with at least one non-blank `text` block.
  Tool calls, tool results, thinking, diffs, user turns and sub-agent output do not count, and a message holding text plus a tool call counts once.
- **The pill appears when the turn ends, not as each reply lands.**
  The existing `wasThinkingRef` thinking-to-idle edge in `LiveConversationView` stays the only trigger.
  The count only changes what the pill says.
- **The baseline is a timestamp.**
  REST ids are index-based and live ids are uuid-based, and older history can load above a reader who has scrolled up, so an id, an index or a list length would drift.
  `awayFromTs` is the timestamp of the newest message when the reader first leaves the tail.
  It is kept while further scroll events fire, and cleared when the reader reaches the end or taps the control.
- **Timestamps are compared as instants.**
  `2026-11-23T01:00:00.500Z` sorts before `2026-11-23T01:00:00Z` as a string, so both sides go through `Date.parse`.
  A message with an empty or unparseable timestamp (an optimistic send before its echo) is never counted and never becomes the baseline.
- **A turn that ended on tool calls alone still reads "New response".**
  The count is clamped to a minimum of one, which keeps today's behaviour for that case.

## Appearance

- Idle: a 40pt circle on `bg.card` with a `border` outline and a `text.primary` caret.
- New response: a 36pt pill on `bg.secondary`, with a `text.accent` icon and label, an accent border at about 55% alpha, and an accent glow.
- Question waiting: the same pill in `status.waiting`.
- One accent per surface, no bounce, sentence case, radius 999, theme tokens only.
- The red `newResponseBadge` styles are removed.
  `chat-new-response-badge` now marks the pill label, and `chat-jump-to-latest` and `chat-question-waiting` stay on the control.

## Copy

`action.newResponse` is a plural key in en, he, ar and ru: "New response" for one, "{{count}} new responses" otherwise, with every CLDR category each locale needs.
`__tests__/i18n-plural-forms.test.ts` pins the exact string for each locale at 0, 1, 2, 3, 11, 21 and 100.

## Verification

- `__tests__/unit/countAgentReplies.test.ts` covers what counts, what does not, the baseline instant, and unusable timestamps.
- The `new response badge` block in `__tests__/integration/components/LiveConversationView.test.tsx` covers the count after a scroll-away, the singular and tool-only labels, a second scroll event while away, a restart after returning to the end, a restart after a tap with no scroll event, and the border tint.
- Each non-trivial changed line was broken once and a test failed for every one.
- Not covered by any test: how the pill looks on a device or simulator.
