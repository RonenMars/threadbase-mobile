import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/contexts/ThemeContext'
import { font, type Theme } from '@/constants/theme'

interface Props {
  visible: boolean
  // banner: centered above the list (single-server Hub/Tree).
  // caption: top-right, under the header fallback spinner (single-server Classic).
  variant: 'banner' | 'caption'
}

export function SyncCachedNotice({ visible, variant }: Props) {
  const theme = useTheme()
  const { t } = useTranslation('sessions')
  const styles = makeStyles(theme)

  if (!visible) return null

  return (
    <View
      style={[styles.base, variant === 'banner' ? styles.banner : styles.caption]}
      pointerEvents="none"
      testID={`sync-cached-notice-${variant}`}
    >
      <Text style={[styles.text, variant === 'banner' && styles.bannerText]} numberOfLines={1}>
        {t('sync.cachedDataSyncing')}
      </Text>
    </View>
  )
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  base: {
    position: 'absolute',
    top: 8,
    zIndex: 5,
    backgroundColor: theme.status.waiting + '21',
    borderRadius: 8,
  },
  banner: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: theme.status.waiting + '4D',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  caption: {
    top: 4,
    right: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontSize: font.xs,
    fontWeight: '500',
    color: theme.status.waiting,
  },
  bannerText: {
    fontSize: font.sm,
  },
})
