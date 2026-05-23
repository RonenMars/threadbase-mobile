import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { colors, fonts } from '../theme'

interface Props {
  children: React.ReactNode
  onPress?: () => void
  disabled?: boolean
  showIcon?: boolean
  testID?: string
}

export function PrimaryButton({ children, onPress, disabled, showIcon = true, testID }: Props) {
  const bg = disabled ? colors.ink3 : colors.blue500
  const fg = disabled ? colors.fg3 : '#0a1424'
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={[styles.btn, { backgroundColor: bg }, !disabled && styles.shadow]}
    >
      <Text style={[styles.label, { color: fg }]}>{children}</Text>
      {showIcon && (
        <View style={styles.icon}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d="M5 12h14M13 6l6 6-6 6"
              fill="none"
              stroke={fg}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  shadow: {
    shadowColor: colors.blue400,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 4,
  },
  label: {
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
  icon: { display: 'flex' },
})
