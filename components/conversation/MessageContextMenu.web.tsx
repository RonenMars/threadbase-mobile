import React, { createContext } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import type { Message } from '@/types/api'

// react-native-context-menu-view has no web build; web keeps plain bubbles.
export const MessageQuoteContext = createContext<((text: string) => void) | null>(null)

export function MessageContextMenu({ style, children }: { message: Message; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return <View style={style}>{children}</View>
}
