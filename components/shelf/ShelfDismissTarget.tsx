import React, { useMemo } from 'react'
import { StyleSheet } from 'react-native'
import Animated, { useAnimatedStyle, withTiming, type SharedValue } from 'react-native-reanimated'
import { X } from 'phosphor-react-native'
import { type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

export const DISMISS_TARGET_SIZE = 56
const ACTIVE_SCALE = 1.15
const FADE = { duration: 140 }

interface Props {
  /** 1 while the bubble is being dragged. */
  dragging: SharedValue<number>
  /** 1 while the bubble is close enough to the target to be dropped on it. */
  armed: SharedValue<number>
  centerX: number
  centerY: number
  reduceMotion: boolean
}

/** The circular X that appears under a dragged shelf bubble; dropping the bubble on it hides the bubble. */
export function ShelfDismissTarget({ dragging, armed, centerX, centerY, reduceMotion }: Props) {
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(dragging.value, FADE),
    transform: [{ scale: reduceMotion ? 1 : withTiming(armed.value ? ACTIVE_SCALE : 1, FADE) }],
    backgroundColor: armed.value ? theme.text.danger : theme.bg.secondary,
  }))

  return (
    <Animated.View
      testID="chat-shelf-dismiss-target"
      pointerEvents="none"
      style={[styles.target, { left: centerX - DISMISS_TARGET_SIZE / 2, top: centerY - DISMISS_TARGET_SIZE / 2 }, animatedStyle]}
    >
      <X size={26} color={theme.text.primary} weight="bold" />
    </Animated.View>
  )
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    target: {
      position: 'absolute',
      width: DISMISS_TARGET_SIZE,
      height: DISMISS_TARGET_SIZE,
      borderRadius: DISMISS_TARGET_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
  })
