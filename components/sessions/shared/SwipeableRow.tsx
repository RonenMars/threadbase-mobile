import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import type { IconProps } from 'phosphor-react-native'
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { layoutDirectionStyle, useAppDirection } from '@/lib/rtl'

export interface SwipeAction {
  key: string
  label: string
  icon: React.ComponentType<IconProps>
  /** Fill of the round button. */
  color: string
  onPress: () => void
  testID?: string
}

interface Props {
  /** Revealed by swiping toward the end edge; listed from the card outward. */
  leading?: SwipeAction[]
  /** Revealed by swiping toward the start edge; listed from the card outward. */
  trailing?: SwipeAction[]
  children: ReactNode
  testID?: string
}

const ACTION_WIDTH = 68
const BUTTON_SIZE = 46

/**
 * Messages-style swipe actions around a list row. With no actions the row is
 * rendered bare, so callers can pass whatever the session allows.
 */
export function SwipeableRow({ leading = [], trailing = [], children, testID }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { direction, isRTL } = useAppDirection()

  // ReanimatedSwipeable places its panels from I18nManager, which this app
  // never flips (see lib/rtl.ts). Pin the swipeable to LTR so its panels sit
  // on the physical side they are revealed from, map leading/trailing onto
  // those sides here, and hand the row its real direction back.
  const left = isRTL ? trailing : leading
  const right = isRTL ? leading : trailing

  const renderPanel = (actions: SwipeAction[], side: 'left' | 'right', methods: SwipeableMethods) => {
    // Outermost action sits at the screen edge.
    const ordered = side === 'left' ? [...actions].reverse() : actions
    return (
      <View style={styles.panel}>
        {ordered.map((action) => (
          <Pressable
            key={action.key}
            testID={action.testID}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={() => {
              methods.close()
              action.onPress()
            }}
            style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}
          >
            <View style={[styles.button, { backgroundColor: action.color }]}>
              <action.icon size={22} color={theme.text.onAccent} weight="fill" />
            </View>
            <Text style={styles.label} numberOfLines={1}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    )
  }

  if (left.length === 0 && right.length === 0) return <>{children}</>

  return (
    <Swipeable
      testID={testID}
      friction={1.5}
      overshootFriction={8}
      containerStyle={layoutDirectionStyle('ltr')}
      onSwipeableWillOpen={() => void Haptics.selectionAsync()}
      renderLeftActions={left.length > 0 ? (_p, _t, methods) => renderPanel(left, 'left', methods) : undefined}
      renderRightActions={right.length > 0 ? (_p, _t, methods) => renderPanel(right, 'right', methods) : undefined}
    >
      <View style={layoutDirectionStyle(direction)}>{children}</View>
    </Swipeable>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    panel: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.xs,
    },
    action: {
      width: ACTION_WIDTH,
      alignItems: 'center',
      gap: spacing.xs,
    },
    button: {
      width: BUTTON_SIZE,
      height: BUTTON_SIZE,
      borderRadius: BUTTON_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      color: theme.text.secondary,
      fontSize: font.xs,
      fontWeight: '500',
    },
  })
}
