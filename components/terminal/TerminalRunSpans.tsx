import React from 'react'
import { Text, type TextStyle } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { ANSI_PALETTE, type Theme } from '@/constants/theme'
import type { TerminalColor, TerminalRun, TerminalStyle } from '@/services/virtual-terminal'

export function terminalRunStyle(style: TerminalStyle, theme: Theme): TextStyle | undefined {
  const palette = ANSI_PALETTE[theme.colorMode]
  const resolve = (color: TerminalColor | undefined) =>
    typeof color === 'number' ? palette[color] : color
  let fg = resolve(style.fg)
  let bg = resolve(style.bg)
  if (style.inverse) [fg, bg] = [bg ?? theme.bg.primary, fg ?? theme.text.primary]
  // Nested Text ignores `opacity`, so dim fades the colour itself (hex + alpha).
  if (style.dim) fg = `${fg ?? theme.text.primary}99`
  const out: TextStyle = {
    ...(fg !== undefined && { color: fg }),
    ...(bg !== undefined && { backgroundColor: bg }),
    ...(style.bold && { fontWeight: '700' }),
    ...(style.italic && { fontStyle: 'italic' }),
    ...(style.underline && { textDecorationLine: 'underline' }),
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** One nested span per attribute run of a terminal row; render inside the row's `Text`. */
export function TerminalRunSpans({ runs }: { runs: readonly TerminalRun[] }) {
  const theme = useTheme()
  return (
    <>
      {runs.map((run, i) => (
        <Text key={i} style={terminalRunStyle(run.style, theme)}>
          {run.text}
        </Text>
      ))}
    </>
  )
}
