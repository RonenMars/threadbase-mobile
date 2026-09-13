import { StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { GlassView as NativeGlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { useReduceTransparency } from '@/hooks/useAccessibilitySettings'
import { useTheme } from '@/contexts/ThemeContext'

/**
 * Backdrop of the floating list chrome. The scrim is the contrast mechanism and
 * is always painted, on both platforms: a plain fade from the canvas colour at
 * the top to clear at the bottom, so a row passing under the chrome dims
 * gradually instead of being cut at the edge. Liquid Glass is decoration
 * beneath it, gated on device capability rather than OS, and dropped under
 * Reduce Transparency; the clear style keeps the rows visible through it.
 */
export function ChromeBackdrop() {
  const theme = useTheme()
  const reduceTransparency = useReduceTransparency()
  const glass = isLiquidGlassAvailable() && !reduceTransparency

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {glass ? (
        <NativeGlassView
          glassEffectStyle="clear"
          colorScheme={theme.colorMode}
          style={StyleSheet.absoluteFill}
          testID="chrome-glass"
        />
      ) : null}
      <LinearGradient
        colors={[theme.bg.primary, `${theme.bg.primary}00`]}
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
