import React from 'react'
import { View, Text, TouchableOpacity, type ViewStyle } from 'react-native'

interface BannerAction {
  label: string
  onPress: () => void
}

interface Props {
  title: string
  message: string
  accent: string
  icon?: React.ReactNode
  action?: BannerAction
  style?: ViewStyle
}

export function Banner({ title, message, accent, icon, action, style }: Props) {
  return (
    <View
      className="absolute inset-0 items-center justify-start"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingTop: '55%' }}
    >
      <View
        className="w-60 items-center gap-3 bg-bg-card border rounded-[12px] py-4 px-6"
        style={[{ borderColor: accent }, style]}
      >
        {icon}
        <Text className="text-text-primary text-font-base text-center font-semibold mt-2">
          {title}
        </Text>
        <Text
          className="text-font-sm text-center"
          style={{ color: accent, lineHeight: 19 }}
        >
          {message}
        </Text>
        {action ? (
          <TouchableOpacity
            className="mt-2 py-1 px-4 bg-bg-secondary border border-border rounded-lg"
            onPress={action.onPress}
          >
            <Text className="text-text-primary text-font-sm font-semibold">
              {action.label}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}
