/**
 * Parsed markdown, shared by the terminal and chat renderers.
 *
 * Deliberately flat: a span never contains another span, and a block never
 * contains another block. Both renderers draw into a single `<Text>` tree, and
 * nesting would force them to recurse for a case agent output almost never
 * emits (see docs/design/markdown-rendering.md → "Scope of the markdown subset").
 */

export type InlineSpan =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'em'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strike'; text: string }
  | { kind: 'link'; text: string; href: string }

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export type MarkdownBlock =
  | { kind: 'paragraph'; spans: InlineSpan[] }
  | { kind: 'heading'; level: HeadingLevel; spans: InlineSpan[] }
  | { kind: 'quote'; spans: InlineSpan[] }
  /**
   * `marker` is the glyph to draw, resolved at parse time so neither renderer
   * has to know the nesting convention: `•` / `◦` / `▪` by depth, or the
   * original ordinal (`3.`) for an ordered item.
   */
  | { kind: 'listItem'; ordered: boolean; depth: number; marker: string; spans: InlineSpan[] }
  | { kind: 'rule' }
  | { kind: 'code'; code: string; language: string }
