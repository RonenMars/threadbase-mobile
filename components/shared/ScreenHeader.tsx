import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { CaretLeft } from 'phosphor-react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { dark, font, spacing } from '@/constants/theme'

interface Props {
  title?: string
  titleRight?: React.ReactNode
  right?: React.ReactNode
  onBack?: () => void
}

export function ScreenHeader({ title, titleRight, right, onBack }: Props) {
  const router = useRouter()
  const { t } = useTranslation('common')
  // Deep links (push notifications, threadbase:// URLs) can mount a screen as
  // the only entry in the stack — there is nothing to pop, so GO_BACK would be
  // unhandled. Fall back to the hub instead.
  const goBack = () => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/')
    }
  }
  return (
    <View style={styles.bar}>
      <Pressable
        testID="screen-header-back-button"
        onPress={onBack ?? goBack}
        hitSlop={16}
        style={({ pressed }) => [styles.side, { opacity: pressed ? 0.5 : 1 }]}
        accessibilityLabel={t('button.back')}
      >
        <CaretLeft size={28} color={dark.text.primary} />
      </Pressable>
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={1}>{title ?? ''}</Text>
        {titleRight ?? null}
      </View>
      <View style={styles.side}>{right ?? null}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.bg.primary,
    height: 52,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.border,
  },
  side: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  title: {
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '600',
    flexShrink: 1,
  },
})
