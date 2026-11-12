import React from 'react'
import { StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native'
import { Copy, Check } from 'phosphor-react-native'
import { spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'

const COPIED_MS = 1500

interface Props {
  value: string
  accessibilityLabel: string
  size?: number
  style?: StyleProp<ViewStyle>
  testID?: string
}

export function CopyButton({ value, accessibilityLabel, size = 16, style, testID }: Props) {
  const theme = useTheme()
  const { copied, copy } = useCopyToClipboard(COPIED_MS)

  return (
    <TouchableOpacity
      onPress={() => void copy(value)}
      style={[styles.btn, style]}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {copied
        ? <Check size={size} color={theme.text.success} />
        : <Copy size={size} color={theme.text.secondary} />}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  btn: { padding: spacing.xs },
})
