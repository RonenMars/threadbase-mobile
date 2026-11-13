import React, { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native'
import { Copy, Check } from 'phosphor-react-native'
import * as Clipboard from 'expo-clipboard'
import { spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

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
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(value)
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), COPIED_MS)
  }, [value])

  return (
    <TouchableOpacity
      onPress={handleCopy}
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
