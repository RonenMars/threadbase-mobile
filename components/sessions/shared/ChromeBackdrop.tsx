import { StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { GlassView as NativeGlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { useReduceTransparency } from '@/hooks/useAccessibilitySettings'
import { useTheme } from '@/contexts/ThemeContext'

/**
 * Backdrop of the floating list chrome. The scrim is the contrast mechanism and
 * is always painted, on both platforms: rows fade into the canvas as they pass
 * under the header. It holds full opacity through the brand row and fades to
 * clear across the segmented control, so the title never sits on a half-faded
 * row while the control still shows what is scrolling beneath it.
 * Liquid Glass is decoration beneath it, gated on device capability rather
 * than OS, and dropped under Reduce Transparency.
 */
export function ChromeBackdrop() {
  const theme = useTheme()
  const reduceTransparency = useReduceTransparency()
  const glass = isLiquidGlassAvailable() && !reduceTransparency

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {glass ? (
        <NativeGlassView
          glassEffectStyle="regular"
          colorScheme={theme.colorMode}
          style={StyleSheet.absoluteFill}
          testID="chrome-glass"
        />
      ) : null}
      <LinearGradient
        colors={[theme.bg.primary, theme.bg.primary, `${theme.bg.primary}00`]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        testID="chrome-scrim"
      />
      <View style={[styles.hairline, { backgroundColor: `${theme.text.accent}1f` }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  hairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
})
