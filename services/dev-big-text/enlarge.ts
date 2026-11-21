import { StyleSheet, type StyleProp, type TextStyle } from 'react-native'

// RN's default when a Text sets no fontSize.
const DEFAULT_FONT_SIZE = 14
const SIZE_STEP = 3
const MIN_LINE_HEIGHT_RATIO = 1.2
// About what +3pt is to 14pt body text, so icons keep their size next to the text.
const ICON_SCALE = 1.2
const HEAVIER: Record<string, TextStyle['fontWeight']> = {
  normal: '600',
  '400': '600',
  '500': '700',
  '600': '700',
}

// A nested Text that sets no size or weight inherits its parent's, which was already raised,
// so only a root Text gets the defaults.
export function enlarge(style: StyleProp<TextStyle>, isRoot: boolean): StyleProp<TextStyle> {
  const flat = StyleSheet.flatten(style) ?? {}
  let size: Pick<TextStyle, 'fontSize' | 'lineHeight'> = {}
  if (flat.fontSize != null || isRoot) {
    const from = flat.fontSize ?? DEFAULT_FONT_SIZE
    const to = from + SIZE_STEP
    size = typeof flat.lineHeight === 'number'
      ? { fontSize: to, lineHeight: Math.round(to * Math.max(flat.lineHeight / from, MIN_LINE_HEIGHT_RATIO)) }
      : { fontSize: to }
  }
  const fontWeight = flat.fontWeight != null ? HEAVIER[String(flat.fontWeight)] : isRoot ? '600' : undefined
  const extra: TextStyle = fontWeight ? { ...size, fontWeight } : size
  return [style, extra]
}

export function enlargeIconSize(size: string | number): string | number {
  return typeof size === 'number' ? size * ICON_SCALE : size
}
