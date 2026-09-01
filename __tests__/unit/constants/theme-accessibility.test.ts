import { THEMES } from '@/constants/theme'

function relativeLuminance(color: string): number {
  const channels = color.match(/\w\w/g)?.map((channel) => Number.parseInt(channel, 16) / 255)
  if (!channels || channels.length !== 3) throw new Error(`Expected #rrggbb color, got ${color}`)

  return channels
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0)
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  )
  return (lighter + 0.05) / (darker + 0.05)
}

describe('theme accent foregrounds', () => {
  it.each(Object.entries(THEMES))('%s supplies a readable foreground over its accent', (_id, theme) => {
    expect(contrastRatio(theme.text.onAccent, theme.text.accent)).toBeGreaterThanOrEqual(4.5)
  })
})
