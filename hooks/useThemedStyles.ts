import { useMemo } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import type { Theme } from '@/constants/theme'
import { useRtlStyles, type RtlStyleKit } from '@/lib/rtl'

/**
 * Builds a component stylesheet from theme and the shared RTL kit so copy/LTR
 * fragments live next to colors instead of being composed at each JSX site.
 */
export function useThemedStyles<S>(
  factory: (theme: Theme, rtl: RtlStyleKit) => S,
): { styles: S; theme: Theme; rtl: RtlStyleKit } {
  const theme = useTheme()
  const rtl = useRtlStyles()
  const styles = useMemo(() => factory(theme, rtl), [factory, theme, rtl])
  return { styles, theme, rtl }
}
