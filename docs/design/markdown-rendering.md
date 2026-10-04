# Markdown rendering in the terminal and chat views

Status: in progress on `feat/markdown-rendering` — steps 1 (shared parser) and 2 (terminal adoption) landed; steps 3–4 open.
Date: 2026-10-04.

## Problem

Agent output is markdown. Neither view renders it.

The terminal view shows `## Summary` as the four characters `## Summary`, and so does chat.
A request to "render markdown in the terminal view" reads like the terminal is behind the chat view.
It is, but only by one feature.

### Verified state (2026-10-04)

What each view does with a markdown source string today:

| Feature | Chat (`components/conversation/MessageBubble.tsx`) | Terminal (`components/terminal/TranscriptRow.tsx`) |
|---|---|---|
| Fenced code → highlighted block | Yes — Prism, alias table, guess heuristic, copy button | No — raw ` ``` ` rows inline |
| ` ```diff ` fences | Yes — hand-rolled `DiffLines` | No |
| HTML entity decode | Yes (`decodeEntities`, `MessageBubble.tsx:46`) | No |
| `**bold**` `*em*` `` `code` `` `~~strike~~` | No — literal | No — literal |
| Headings, lists, quotes, rules | No — literal | No — literal |
| Tables | No — literal | No — literal |
| `[text](url)` | No — literal | No — literal |

Chat prose is one `<Text>` holding the raw string (`TextContent`, `MessageBubble.tsx:97-101`).
So the chat view is not a markdown renderer; it is a fence splitter plus a syntax highlighter.

Two details confirm it:

- `guessLanguage` has a `markdown` branch (`MessageBubble.tsx:232`), so a ` ```markdown ` fence gets Prism-*highlighted* as markdown source rather than rendered.
- `utils/messageItemType.ts`'s own comment cites "~3,100pt (markdown-table answers)" as the tall case. The app already pays markdown tables' layout cost as literal text.

## Decision

Build one parser, adopt it in two renderers, terminal first.

The marginal cost of markdown in the terminal is not "catch up to chat" — chat has almost nothing to catch up to.
Building it terminal-only would ship a view that renders headings while chat shows `##`, which is a worse inconsistency than today's.

**Share the parse layer. Never share the render layer.** The two views have opposed styling contracts:

| | Chat | Terminal |
|---|---|---|
| Color | themed (`useThemedStyles`, `theme.text.primary`) | hardcoded GitHub-dark (`#e6edf3`, `#8b949e`, …) |
| Font | proportional, `font.base` / lh 22 | `monospace` 12 / lh 18 |
| Direction | RTL-aware (`rtl.copy`) | LTR-pinned (`ltrContentStyle`) |
| Font scaling | uncapped on prose | `MAX_FONT_SIZE_MULTIPLIER_MONO` |
| Width | `maxWidth: '85%'` bubble | full width, 8pt gutters |

So: one pure parser in `lib/markdown/` (no React Native imports, unit-testable), two thin renderers.
This is the split the repo already uses for `parseQuestionBlock` (pure, `utils/`) plus `QuestionCard` (render).

### No markdown library

`react-native-markdown-display` / `react-native-marked` ship their own `Text` trees and theming.
Both contracts above are non-negotiable in the terminal view, and a library also renders its own
images and links, which breaks the `RenderErrorBoundary` + `rawFallback` contract that every
terminal row is wrapped in. A parser we own is ~300 lines and has no such conflict.

## Sequencing, and why terminal comes first

Three things invert the difficulty you would guess from the two views' current polish.

**1. Search makes chat the harder target.** `TextContent` hands the raw string to `HighlightText`
and uses `onMatchesLayout` → `measureLayout` to report a `y` offset that aims the anchored scroll
(`MessageBubble.tsx:77-95`). Turn prose into nested `<Text>` spans and both the match offsets and
that `y` measurement break. The terminal view has no search of its own — it delegates to chat via
`onSearchResumedConversation`. So the terminal adoption carries none of that work.

**2. Chat's height mitigation is what markdown attacks.** `messageItemType` splits by shape *and*
by length (`LONG_TEXT_CHARS = 1200`) because mixed unmeasured-height averages produced ±10-20k pt
content-size swings and "Maximum update depth exceeded". Markdown makes rows taller and more
variable, aimed straight at that. Expect to re-tune the threshold as part of the chat adoption.

**3. The terminal list already mixes row heights.** `TerminalOutput` interleaves variable-height
transcript messages with uniform 18pt PTY rows, which is why `drawDistance={2000}` is already set
(see the `Shopify/flash-list#2136` note at `TerminalOutput.tsx:448`).

Order:

1. **`lib/markdown/`** — block + inline parser, pure and total. Absorb `parseTextParts` /
   `guessLanguage` / `LANGUAGE_ALIASES` out of `MessageBubble` so only one fence parser exists.
   Re-point `MessageBubble` at it as a no-behavior-change refactor.
2. **`TranscriptRow`** — adopt in the terminal view. No search, no highlight anchors.
3. **`MessageBubble`** — adopt in chat, with the `HighlightText` per-span work and the
   `LONG_TEXT_CHARS` re-tune scoped into it.
4. **SGR colors in `services/virtual-terminal.ts`** — separate, last, and not a markdown change.

## What the parser does not do

Live PTY rows (`kind: 'line'`, `TerminalOutput.tsx:81`) are **never** markdown-parsed.

By the time a byte reaches a PTY row it has been: hard-wrapped at 120 cols by the streamer's
geometry, already rendered by the CLI's own markdown renderer (bold arrives as SGR, bullets as `•`,
borders as box-drawing), and flattened by `stripAnsi`. `**` is rarely even present, and every block
has been cut across row boundaries at an arbitrary column. Parsing that would mangle the TUI chrome
to no benefit.

The real deficiency on that side is that `virtual-terminal.ts:37` lists `m` in `IGNORED_CSI`, so SGR
attributes are discarded. Recovering them means per-cell attributes on `private grid: string[][]`
(`:50`) and span rendering in `LineText`. That is step 4, and it is the change that would make the
live half look right — not markdown.

## Scope of the markdown subset

Supported, because agent output actually emits it:
fenced code, ATX headings `#`–`######`, unordered and ordered list items with nesting depth,
block quotes, thematic breaks, paragraphs; and inline `**strong**`, `__strong__`, `*em*`, `_em_`,
`` `code` ``, `~~strike~~`, `[text](url)`.

Deliberately out of scope for now:

- **Tables.** They fall through as paragraphs (literal pipes). A table block is its own change —
  `messageItemType` already names markdown tables as the pathological height case, so it needs the
  FlashList work from step 3, not a parser tweak.
- **Nested emphasis.** `**bold with *em* inside**` renders the outer span only; the inner markers
  stay literal. Flat spans keep the renderer a single `<Text>` tree. Bold-italic `***x***` and
  `___x___` get their own rule so they resolve to one strong span — without it the lazy `**` match
  left a star inside the bold text and another dangling after it, which reads as a rendering bug
  rather than as an unsupported construct.
- **Reference links, images, HTML blocks, setext headings, footnotes, task lists.**
- **Emphasis spanning a newline.** Every inline rule is newline-bounded, so an unclosed `*` can
  never run away and swallow the rest of a message.

## Rules the implementation must hold

- **The parser is total.** Anything unclassifiable falls through to a paragraph. It never throws;
  `parseMarkdown` has an outer guard that degrades to a single paragraph carrying the raw source.
  This is the "degrade, don't break" rule from `CLAUDE.md` applied to our own parser.
- **Copy yields source, not glyphs.** Terminal rows are `selectable` with no copy button, so the
  spans themselves must carry the markdown source text.
- **An escape hatch ships with it.** A terminal view is a debugging surface; when someone is reading
  exactly what the agent emitted, formatting is in the way. `terminalRenderMarkdown` in
  `useSettingsStore`, **default on**, with a Switch in the Session section of `app/settings.tsx`;
  copy lives in `locales/*/settings.json` under `session.terminalMarkdown` (the settings screen's
  namespace is `settings`, not `terminal`), never a module const — `i18next/no-literal-string` runs
  at `error` and does not inspect module scope.
- **Links are styled, not pressable.** Opening an agent-supplied URL is its own decision with its own
  phishing surface; it must not arrive as a side effect of rendering. `href` is parsed and kept on
  the span so a later change can act on it.
- **Parse once, across recycles.** `parseMarkdownFor(block, text)` memoises on a `WeakMap` keyed by
  the content block itself. Transcript blocks are immutable and reference-stable once adapted, so
  this is one parse per block for the session with no cache size to manage — and it needs no change
  to the `Row` union, which threading parsed blocks down from `TerminalOutput.tsx:177` would have
  forced. The stored text is compared too, so an owner mutated in place reparses rather than
  rendering stale.
- **`getItemType` stays coarse.** A markdown-rendered assistant message remains `msg:…`
  (`TerminalOutput.tsx:330`). A type per block kind fragments the recycling pools.
- **Headings change weight and color, not `fontSize`.** A larger font breaks the 18pt row rhythm and
  poisons FlashList's per-type height averages.
- **Bullets are glyphs, not emoji.** `•` / `◦`, per the Phosphor-only rule. Note the terminal view is
  already compliant (`⏺ ❯ ✻ ⎿` are geometric); chat is not (`🔧` at `MessageBubble.tsx:337`, live via
  `ConversationPreviewSheet.tsx:116`), and those pre-existing violations are catalogued in
  `docs/conversation-rendering-logic.md` → Observations. Do not inherit the habit.

## Files

| Path | Role |
|---|---|
| `lib/markdown/types.ts` | `MarkdownBlock`, `InlineSpan` |
| `lib/markdown/fences.ts` | `splitFences`, `guessLanguage`, `LANGUAGE_ALIASES`, `decodeEntities` — moved from `MessageBubble` |
| `lib/markdown/inline.ts` | `parseInline(string): InlineSpan[]` |
| `lib/markdown/blocks.ts` | `parseBlocks(string): MarkdownBlock[]` |
| `lib/markdown/index.ts` | `parseMarkdown(string): MarkdownBlock[]` — fences, then blocks, then inline |
| `components/terminal/TerminalMarkdown.tsx` | terminal renderer (+ `.stories.tsx`) |
| `components/terminal/TranscriptRow.tsx` | takes `renderMarkdown`; `⏺` moves into its own gutter column |
| `components/terminal/TerminalOutput.tsx` | reads the setting once for the list, passes it down |
| `stores/settings.ts` | `terminalRenderMarkdown`, persisted, default on |
| `app/settings.tsx` | the Switch, in the Session section |

## What landed in steps 1–2

- `lib/markdown/` with 35 unit tests across `inline`, `blocks` and `index`.
- `MessageBubble` re-pointed at `lib/markdown/fences` — ~3.7 KB of duplicated fence logic deleted
  from it, no behavior change, its existing suite green.
- `TerminalOutput`'s local `stripAnsi` copy dropped for the shared `utils/stripAnsi`.
- `TranscriptRow.markdown.test.tsx`, 7 integration tests covering both toggle states, the gutter
  split, fences, the unclassifiable fallthrough, and that user and tool rows are untouched.
- One existing assertion updated: `TerminalView.test.tsx` asserted the concatenated
  `⏺ older message two`, which the gutter split makes two elements. Intent preserved — it still
  asserts the assistant message renders above the PTY rows.
- Full suites green: 255 unit / 2,582 tests, 78 integration / 598 tests, i18n 451 tests at 100%
  locale parity with no unused keys.

### Verified visually (2026-10-04)

Rendered through `react-native-web` in a throwaway Vite harness and screenshotted
with Playwright, because this container has no simulator and the repo's Storybook does
not currently boot (see below). That checks structure and hierarchy, **not** iOS pixels —
font metrics, `gap` and `paddingStart` all differ on device, so the terminal view still
wants a look on a real simulator before this is called done.

It caught two things no test would have:

- **Ordered markers wrapped.** `1.` is ~14.4pt at 12pt monospace against a `width: 14`
  marker column, so the dot fell to its own line, and `10.` would have been worse. The
  column is `minWidth` now, so a bullet keeps its 14pt column for nesting while an
  ordinal sizes to itself.
- **Blank lines vanished.** `parseBlocks` drops them, so two paragraphs in a row were the
  only trace of an author's blank line — and they rendered at the same 2pt gap as wrapped
  lines inside one paragraph. Paragraphs after the first now carry a 5pt lead.

Confirmed correct in the same pass: `2 * 3 * 4`, `snake_case_names`, an unclosed `**` and
table pipes all stay literal; nesting glyphs, the quote rule, the thematic break, the
toggle-off source view and the untouched user row all read as intended.

Known and deliberate: `#`/`##` share one style and `###`–`######` share another, so H1 and
H2 are not distinguishable from each other. Splitting them means either `fontSize` (rejected
above) or more palette, and neither earns its place yet.

### Blocked: Storybook does not boot

`npm run storybook` fails on `main`, before any of this work. Two independent breakages:

1. `.storybook/main.ts:34` passes `tailwindcss` directly as a PostCSS plugin. Tailwind v4
   moved that to `@tailwindcss/postcss`, which the app's own `postcss.config.mjs` already
   uses and which is installed. One-line fix.
2. Behind it, `jsxImportSource: 'nativewind'` cannot resolve — `nativewind@5.0.0-preview.4`
   exports only `.`, `./babel`, `./metro`, `./types` and `./theme`, no JSX runtime.

The second is a version mismatch in shared build config, not a typo, so neither is fixed
here: it changes how every story in the catalog renders and wants its own change.

### Still open before this is finished

- Step 3 (chat adoption) is where the `HighlightText` per-span work and the `LONG_TEXT_CHARS`
  re-tune live. Until it lands the two views disagree: the terminal renders headings and lists,
  chat still shows their source. That is the known cost of landing terminal-first.
- No Maestro coverage yet. A flow asserting the toggle flips a known transcript row between source
  and rendered belongs in the mock suite.
- Tables, and whether a `code` block in the terminal should eventually get Prism after all.
