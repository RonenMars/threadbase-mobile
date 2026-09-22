import React from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import type { IconProps } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useReduceMotion } from '@/hooks/useAccessibilitySettings'
import { textDirectionStyle, useAppDirection, useDirectionStyle } from '@/lib/rtl'

export interface SessionActionItem {
  key: string
  label: string
  hint?: string
  icon: React.ComponentType<IconProps>
  onPress: () => void
  destructive?: boolean
  /** Starts the End session group. */
  endSection?: boolean
  dividerBefore?: boolean
  testID?: string
}

interface Props {
  visible: boolean
  title: string
  /** "Agent · status · server". */
  meta: string
  items: SessionActionItem[]
  onClose: () => void
}

/** Bottom sheet behind a session card's ⋮ and long-press. */
export function SessionActionSheet({ visible, title, meta, items, onClose }: Props) {
  const { t } = useTranslation(['sessions', 'common'])
  const theme = useTheme()
  const styles = makeStyles(theme)
  const reduceMotion = useReduceMotion()
  const directionStyle = useDirectionStyle()
  const { direction } = useAppDirection()
  const copyStyle = textDirectionStyle(direction)

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, directionStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('common:button.cancel')} />
        <View style={styles.sheet} accessibilityViewIsModal testID="session-action-sheet">
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={[styles.title, copyStyle]} numberOfLines={2}>{title}</Text>
            <Text style={[styles.meta, copyStyle]} numberOfLines={1}>{meta}</Text>
          </View>
          {items.map((item) => {
            const color = item.destructive ? theme.status.failed : theme.text.primary
            return (
              <React.Fragment key={item.key}>
                {item.endSection ? (
                  <Text style={[styles.section, copyStyle]}>{t('endSession.section')}</Text>
                ) : null}
                {item.dividerBefore ? <View style={styles.divider} /> : null}
                <Pressable
                  testID={item.testID}
                  onPress={() => {
                    onClose()
                    item.onPress()
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  accessibilityHint={item.hint}
                  style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <item.icon size={20} color={item.destructive ? color : theme.text.secondary} />
                  <View style={styles.itemCopy}>
                    <Text style={[styles.itemLabel, { color }, copyStyle]}>{item.label}</Text>
                    {item.hint ? <Text style={[styles.itemHint, copyStyle]}>{item.hint}</Text> : null}
                  </View>
                </Pressable>
              </React.Fragment>
            )
          })}
        </View>
      </View>
    </Modal>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      backgroundColor: theme.bg.card,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxl,
    },
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      marginBottom: spacing.sm,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      gap: 2,
    },
    title: { color: theme.text.primary, fontSize: font.base, fontWeight: '600' },
    meta: { color: theme.text.secondary, fontSize: font.xs },
    section: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
      color: theme.text.secondary,
      fontSize: font.xs,
      fontWeight: '600',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
      marginHorizontal: spacing.lg,
      marginVertical: spacing.xs,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 48,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    itemCopy: { flex: 1, gap: 1 },
    itemLabel: { fontSize: font.base },
    itemHint: { color: theme.text.secondary, fontSize: font.xs },
  })
}
