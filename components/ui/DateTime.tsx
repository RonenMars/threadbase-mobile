import React from 'react'
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native'
import { useDateTimeFormat } from '@/hooks/useDateTimeFormat'

interface Props extends Pick<TextProps, 'numberOfLines' | 'testID'> {
  value: string | number | Date | null | undefined
  /** `list` is relative to now ("14:35", "Yesterday 14:35"); `time` is the time of day alone. */
  variant?: 'list' | 'time'
  style?: StyleProp<TextStyle>
}

/**
 * The one place a standalone timestamp is drawn. It follows the date and time
 * format picked in Settings and renders nothing for an empty or unparsable value.
 */
export function DateTime({ value, variant = 'list', style, numberOfLines, testID }: Props) {
  const { formatList, formatTime, formatAccessible } = useDateTimeFormat()
  const text = variant === 'time' ? formatTime(value) : formatList(value)
  if (!text) return null
  return (
    <Text
      style={style}
      numberOfLines={numberOfLines}
      testID={testID}
      accessibilityLabel={formatAccessible(value)}
    >
      {text}
    </Text>
  )
}
