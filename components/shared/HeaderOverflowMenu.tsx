import React, { useState } from 'react'
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native'
import { DotsThreeVertical, type IconProps } from 'phosphor-react-native'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { textDirectionStyle, useAppDirection, useDirectionStyle } from '@/lib/rtl'

export interface HeaderOverflowMenuItem {
  key: string
  label: string
  icon: React.ComponentType<IconProps>
  onPress: () => void
  disabled?: boolean
  destructive?: boolean
  /** Small caps heading drawn above this item, with a divider when it isn't first. */
  sectionLabel?: string
  dividerBefore?: boolean
  testID?: string
}

interface Props {
  items: HeaderOverflowMenuItem[]
  accessibilityLabel?: string
  testID?: string
}

export function HeaderOverflowMenu({ items, accessibilityLabel = 'More options', testID }: Props) {
  const theme = useTheme()
  const directionStyle = useDirectionStyle()
  const { direction } = useAppDirection()
  const copyStyle = textDirectionStyle(direction)
  const styles = makeStyles(theme)
  const [open, setOpen] = useState(false)

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
      >
        <DotsThreeVertical size={22} color={theme.text.secondary} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.backdrop, directionStyle]} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            {items.map((item, index) => (
              <React.Fragment key={item.key}>
                {item.dividerBefore || (item.sectionLabel && index > 0) ? <View style={styles.divider} /> : null}
                {item.sectionLabel ? <Text style={[styles.section, copyStyle]}>{item.sectionLabel}</Text> : null}
                <Pressable
                  testID={item.testID}
                  disabled={item.disabled}
                  onPress={() => {
                    setOpen(false)
                    item.onPress()
                  }}
                  style={({ pressed }) => [
                    styles.item,
                    { opacity: item.disabled ? 0.4 : pressed ? 0.6 : 1 },
                  ]}
                >
                  <item.icon size={20} color={item.destructive ? theme.status.failed : theme.text.secondary} />
                  <Text style={[styles.itemText, item.destructive && { color: theme.status.failed }, copyStyle]}>
                    {item.label}
                  </Text>
                </Pressable>
              </React.Fragment>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.15)',
      alignItems: 'flex-end',
    },
    menu: {
      marginTop: 52,
      marginEnd: spacing.sm,
      backgroundColor: theme.bg.secondary,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      minWidth: 180,
      paddingVertical: spacing.xs,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    itemText: { color: theme.text.primary, fontSize: font.sm },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
      marginVertical: spacing.xs,
    },
    section: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xs,
      paddingBottom: 2,
      color: theme.text.secondary,
      fontSize: font.xs,
      fontWeight: '600',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
  })
}
