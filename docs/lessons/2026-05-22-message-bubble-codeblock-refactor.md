# MessageBubble CodeBlock refactor — prism-react-renderer, no collapse

**Date:** 2026-05-22
**Branch:** `fix/flashlist-v2-recycling-mvcp`
**Commits:** `cdf0303`, `d3aec11`, `f58d74d`

## Context

We hit two ugly problems in `components/conversation/MessageBubble.tsx`:

1. A visual bleed bug where bubbles containing a `\`\`\` … \`\`\`` block painted their background ~244 pt past visible content. Root cause analysis: [Bubble bleed](./2026-05-22-bubble-bleed-horizontal-scrollview.md).
2. The collapse-after-N-lines truncation cut messages mid-fence, leaving a stray ` \`\`\` ` opener rendering as plain text and a code block invisible until the user tapped "Show all".

We solved both by replacing the hand-rolled CodeBlock and removing the collapse entirely.

## What changed

### Library swap

Hand-rolled `<ScrollView horizontal>` + plain `<Text>` → [`prism-react-renderer`](https://github.com/FormidableLabs/prism-react-renderer) (~3.6M weekly downloads, no native deps, render-props API). Theme: `themes.oneDark`.

Each code line renders as `<View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>` with token `<Text>`s. No horizontal scroll — long lines wrap. This eliminates the structural cause of the bleed bug.

### Language detection for bare fences

prism-react-renderer requires a language, no auto-detect. Two layers:

1. **Explicit tag** (` \`\`\`ts `, ` \`\`\`bash `, …) → `LANGUAGE_ALIASES` table normalizes (`ts → tsx`, `sh → bash`, `py → python`, etc.)
2. **Bare fence** (no tag) → `guessLanguage(code)` heuristic, ordered most-specific to most-general:
   - `bash` — env-var prefixes + known command names (`cd`, `git`, `npm`, `lsof`, `docker`, ...)
   - `diff` — `diff --git` / `@@` headers, OR a mix of `+ ` AND `- ` prefixed lines (mix required so markdown bullet lists aren't misclassified)
   - `json` — leading `{ "key":`
   - `markup` — XML/HTML doctypes or root tags
   - `tsx` — `import … from`, `export const/function/class/interface/type`, or `=>` / `const x =` / `function x(`
   - `python` — `def`/`class`/`import` followed by trailing `:`
   - `markdown` — leading `#`/`*`/`1.`/` \`\`\` `
   - `clike` — fallback for everything else (generic curly-brace grammar)

Users can fix wrong detections by writing the language tag explicitly.

### Diff rendering

prism-react-renderer's bundled Prism does NOT ship the `diff` grammar (verified by `Object.keys(Prism.languages)`). When `language === 'diff'`, skip Prism entirely and render via a small `DiffLines` component: each line in its own row, with `styles.diffAdd` (subtle green tint) for `+` lines and `styles.diffDel` (subtle red tint) for `-` lines.

### Removed: text/code expand-collapse

Killed everything: `MAX_COLLAPSED_LINES`, `MAX_COLLAPSED_CHARS`, `MAX_CODE_LINES`, the `useRecyclingState`-backed `expanded` state in both `TextBlockBody` and `CodeBlock`, the related styles. Bubbles render full content. FlashList v2 + MVCP handles tall rows; we accept the trade-off.

This also eliminates the mid-fence truncation problem that motivated the broader cleanup.

### Copy UX

`Clipboard.setStringAsync` + `Haptics.impactAsync(Light)` + button text flips "Copy" → "Copied" for 1.5 s. Implemented with local `useState` + `useRef` timer cleaned up on unmount. Added `action.copiedCode = "Copied"` to `locales/en/conversation.json`.

### Style polish

- `codeBlock` gets `marginVertical: spacing.xs` for breathing room from prose.
- `codeBody` is `paddingHorizontal: spacing.sm`, `paddingVertical: 6`.
- `codeToken` is `fontSize: font.sm`, `fontWeight: '600'`, `color: dark.text.primary` (white default; Prism token styles override per syntax category via `tokenStyle`).
- `TextBlockBody` trims one leading `\n` from text immediately after a fence and one trailing `\n` from text immediately before a fence — collapses the doubled gap that fence syntax otherwise introduces.

## Constraints to remember

- **No `<ScrollView horizontal>` around `<Text>` inside the code body.** That's the bug we just escaped.
- **No emojis** in any code block chrome — Phosphor icons or nothing (per project rule).
- **Heuristic ordering matters.** If you add a new branch to `guessLanguage`, put it before less-specific patterns or it won't fire.
- **Locales:** any new copy keys need entries in all `locales/<lang>/` folders if/when non-`en` locales are added.

## Tests

- `__tests__/integration/components/MessageBubble.test.tsx` — text-collapse describe block (3 tests, 4 if counting the "no toggle for short text" sanity check) was deleted; feature removed. Other blocks still pass.
- `__tests__/integration/components/ToolCard.test.tsx` — 19 failures fixed in the same session by extending the FlashList Jest mock; see [FlashList Jest mock hooks](./2026-05-22-flashlist-jest-mock-hooks.md).
- Final state: 476 passing, 2 skipped pre-existing, 0 failing.
