import { THEMES } from '@/constants/theme'

// The search-match highlight (MessageBubble + ToolCard) uses a dedicated
// per-theme token pair — `text.highlight` (fill) + `text.onHighlight` (text on
// the fill). Guard that every registered theme (including glass variants)
// defines both as concrete `#rrggbb` colors, so a new theme can't ship a
// missing or malformed highlight.
const ALL_THEMES = THEMES

describe('search highlight color', () => {
  it.each(Object.entries(ALL_THEMES))('theme "%s" defines a #rrggbb highlight fill', (_id, theme) => {
    expect(theme.text.highlight).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  it.each(Object.entries(ALL_THEMES))('theme "%s" defines a #rrggbb onHighlight text color', (_id, theme) => {
    expect(theme.text.onHighlight).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  it.each(Object.entries(ALL_THEMES))('theme "%s" highlight is distinct from its surface and its own text', (_id, theme) => {
    // A fill equal to the card behind it, or to the text drawn on it, is invisible.
    expect(theme.text.highlight.toLowerCase()).not.toBe(theme.bg.card.toLowerCase())
    expect(theme.text.highlight.toLowerCase()).not.toBe(theme.text.onHighlight.toLowerCase())
  })
})
