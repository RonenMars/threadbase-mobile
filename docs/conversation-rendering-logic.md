# Rendering Logic — `components/conversation/`

Audit of how a conversation gets from data to pixels. Two screens drive these
components; everything else is a leaf renderer or a content-type branch.

## Two render paths, one cell renderer

| | Read-only history | Live session |
|---|---|---|
| Screen | `app/conversation/[id].tsx` | `LiveConversationView.tsx` |
| Data | REST only (`useConversation`) | REST history + WS live + optimistic sends |
| List | `FlashList` w/ `getItemType` + skeleton overlay | `FlashList`, no skeleton |
| Footer | none | `ThinkingBubble` (streaming/thinking state) |
| Composer | none (read-only) | `ChatComposer` |
| Shared | **`MessageItem`** renders every row in both | |

`MessageItem` is the single junction — both lists hand it a `Message` and it
fans out to the leaf renderers. Nothing else is shared between the two paths.

---

## Dispatch: `MessageItem` → content renderers

`MessageItem.tsx` is the router. One `Message` holds a `content: MessageContent[]`
array (`types/api.ts:118`):

```
text | thinking | tool_use | tool_result | diff
```

Logic (`MessageItem.tsx:31`):

1. Compute `hasToolOrDiff` = any block is `thinking | tool_use | tool_result | diff`.
2. **Mixed/structured row** (`hasToolOrDiff`): wrap in `styles.toolContainer`, map
   each block — `text` → `MessageBubble` (one block at a time), everything else →
   `renderContent()`.
3. **Plain row**: render the whole message through one `MessageBubble`.
4. Empty content → `null`. Blank text blocks (`!block.text.trim()`) → skipped.
5. `has_images` prepends a localized "contains image" badge.
6. `isLast` tags the final row `testID="conversation-last-message"` (Maestro hook).

`renderContent()` (`MessageItem.tsx:12`) is the type→component table:

| block.type | Component |
|---|---|
| `thinking` | `ThinkingCard` |
| `tool_use` / `tool_result` | `ToolCard` |
| `diff` | `DiffViewer` |
| (`text` handled inline by `MessageItem`, not here) | `MessageBubble` |

`MessageItem` is `React.memo`'d so screen-level state churn during the initial
scroll-settle doesn't re-render every visible row.

---

## Leaf renderers

### `MessageBubble.tsx` — text + inline code
The most involved leaf. Renders a user/assistant bubble (alignment + color by
`role`). Per content block (`ContentBlock`):
- `text` → `TextBlockBody`, which **parses fenced code** out of prose:
  - `parseTextParts()` splits on ` ``` … ``` ` (`MessageBubble.tsx:182`), decodes
    HTML entities, trims fence-adjacent newlines.
  - Each part is `text` (→ `TextContent`, selectable `<Text>`) or `code` (→ `CodeBlock`).
  - `useMemo` on the parse — re-renders don't redo the string work.
- `tool_use` → small `🔧 name` tag (note: the **emoji here pre-dates** the
  Phosphor-only rule; see Observations).

**Code rendering** (`CodeBlock` → `HighlightedCode`):
- Prism (`prism-react-renderer`, `oneDark` theme) tokenizes; `HighlightedCode` is
  `React.memo`'d because tokenization is tens of ms on the JS thread.
- `language === 'diff'` takes a hand-rolled `DiffLines` path (line-prefix coloring)
  instead of Prism.
- Language resolution: explicit fence tag → `LANGUAGE_ALIASES` map; bare fence →
  `guessLanguage()` heuristic (bash/diff/json/markup/tsx/python/markdown/clike,
  most-specific-first).
- Copy-to-clipboard with a 1.5 s "copied" flag + haptic.

`MessageBubble` is `React.memo`'d (message objects are reference-stable for loaded pages).

### `ThinkingCard.tsx` — extended-thinking block
Collapsible card. `useRecyclingState(false, [recycleKey])` for expand state.
Redacted variant (`!thinking && signature`) shows a localized placeholder.

### `ToolCard.tsx` — tool_use / tool_result
Collapsible. Icon from a `TOOL_ICONS` emoji map (Edit/Bash/Read/…). Header shows
name + optional error badge + chevron. Body: pretty-printed JSON input
(`tool_use`) or text content (`tool_result`). `useRecyclingState` for expand.
Only expandable when there's content.

### `DiffViewer.tsx` — structured `diff` block
Renders `DiffHunk[]` (not text). Header: file icon + name + `+added/−removed`
counts + copy-as-patch. Collapsed by default when `totalLines > COLLAPSE_THRESHOLD`
(100) — `useRecyclingState(totalLines <= 100, [recycleKey, totalLines])`. Expanded
view is a **horizontal** `ScrollView` with pinch-to-zoom (reanimated + gesture-handler),
per-line add/del background coloring. Uses the `dark` theme constants directly.

### `MessageSkeletonRow.tsx` — loading placeholder
Pseudo-random skeleton lines (width/count keyed off `index`). Read-only screen only.

### `SlowLoadingBanner.tsx` — slow-load notice
Wraps the shared `Banner` with a Cancel action. Shown over the skeleton when a
load drags. Read-only screen only.

---

## FlashList recycling — the `recycleKey` contract

FlashList recycles cell instances, so a recycled cell carries the previous row's
`useState`. Two mechanisms prevent leaks:

1. **`recycleKey = message.id`** threaded `MessageItem → ToolCard / ThinkingCard /
   DiffViewer`. Each uses `useRecyclingState(initial, [recycleKey])` so expand
   state resets when the cell is reassigned. (`MessageBubble` takes `recycleKey`
   only for parity — it caches nothing.)
2. **`getItemType`** (read-only screen, `[id].tsx:408`) returns `'tool' | 'user' |
   'assistant'` so FlashList only recycles cells of the same shape — without it a
   tool-card cell could bleed under a text row mid-scroll.

> The Jest mock for `@shopify/flash-list` must stub `useRecyclingState`/`useLayoutState`
> as `React.useState`, or ToolCard/ThinkingCard/DiffViewer tests throw. (Project memory.)

---

## Live path: streaming + the thinking bubble

`LiveConversationView.tsx` composes the message list from **three sources** and
renders a streaming footer.

### Message assembly (`LiveConversationView.tsx:79–107`)
```
allMessages = [...historical (REST), ...stillPending (optimistic), ...newLive (WS)]
```
- **Dedup**: live messages filtered against historical by `uuid` (ids never match
  across REST/WS sources).
- **Optimistic sends**: user's bubble shown immediately on send; cleared per-id when
  its text echo lands in the streamed set (matched on trimmed text).
- **Ordering** is deliberate — optimistic user bubble sits *before* live WS messages
  so the user's send always precedes the assistant reply, even if the WS reply beats
  the REST echo.

### Thinking-bubble lifecycle (`LiveConversationView.tsx:128–145`)
State machine: `hidden → thinking → fading → hidden`.
- `isAgentThinking` = session `running` (or pending sends exist) **and** last message
  isn't an assistant reply.
- Session status kept fresh via a WS `session_update` subscription writing the
  query cache (no polling).
- On done, bubble fades (`thinking → fading`), `onFadeOutComplete` → `hidden`.

### `ThinkingBubble.tsx`
- Shows up to the last 60 PTY lines (`stripAnsi` + non-blank filter) in a
  monospace scroll, plus an animated three-dot pulse while `isStreaming` (or before
  any lines arrive).
- Fade-out driven by an `Animated.Value` (350 ms) → `onFadeOutComplete`.
- Auto-scrolls to the newest PTY line.

### `LivePtyPlaceholder` (inline in `LiveConversationView`)
`ListEmptyComponent` for fresh/`waiting_input` sessions that have no JSONL yet —
streams raw PTY (last 200 lines, `stripAnsi`) until the first real bubble lands,
then yields.

### Auto-scroll
Two effects `scrollToEnd` on `allMessages.length` change and on entering `thinking`.

---

## Question cards

`ThinkingBubble` can render an
interactive `QuestionCard` (`components/terminal/`) from **two sources**:

| Source | Path | Answer mechanism |
|---|---|---|
| Structured (`activeQuestion`) | WS `question` msg → `useActiveQuestion` | `onAnswer(toolUseId, {q: label})` → POST |
| PTY scrape (`questionBlock`) | `parseQuestionBlock(last 30 lines)` | arrow-key keystrokes via `onSendKeys` |

- Structured takes precedence over PTY when both exist (`ThinkingBubble.tsx:125`).
- Flag **off**: structured questions degrade to plain text lines inside the bubble
  (so the user still sees what's being asked); PTY parsing is skipped entirely.
- `QuestionCard` shows header/question/options as radio rows; PTY blocks resync the
  highlight as the terminal cursor moves (`source === 'pty'` + `selectedIndex`).

---

## Read-only path: skeleton gating

`app/conversation/[id].tsx` (history view) layers loading carefully:
- **Cold load** (no cached data): skeleton-only `FlatList` screen.
- **Warm/settling**: real `FlashList` underneath + a non-interactive skeleton
  *overlay* gated by `isGated = useMinDisplayTime(isReady, 400, id)` — 400 ms
  anti-flicker floor; `isReady` needs both the fetch landed **and** first layout done.
- `handleContentSizeChange` re-pins to bottom on each growth until a 150 ms settle
  (or a 500 ms hard cap) flips `firstLayoutDone`; stops once the user drags.
- `maintainVisibleContentPosition` anchors the bottom natively during streaming/
  pagination, so JS scroll calls stop after the initial settle (avoids jumps).
- Empty conversations flip `firstLayoutDone` immediately (no `onContentSizeChange`).
- 404 ≠ gone: may be a live session with no JSONL yet → redirect to live view.

---

## Observations (not acted on)

- **Emojis in UI** violate the Phosphor-only rule in three leaf renderers:
  `MessageBubble` `🔧` tool tag (`:237`), `ToolCard` `TOOL_ICONS` map (`:9`),
  `DiffViewer` file icons + the `📘/🐹/📝/📄` picker (`:66`). Pre-existing.
- **`DiffViewer` wraps code in a horizontal `ScrollView`** (`:88`) — exactly the
  bubble-bleed pattern flagged in project memory (horizontal ScrollView + Text in a
  column-flex parent inflates measured height on iOS). It's inside its own bordered
  container so impact is contained, but worth noting.
- Two separate diff renderers exist: `DiffViewer` (structured `diff` blocks) and
  `MessageBubble`'s `DiffLines` (fenced ` ```diff ` in prose). Different inputs,
  similar output — not obviously consolidatable.
