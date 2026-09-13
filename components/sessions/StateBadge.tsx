import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { font, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { LiveDot } from './LiveDot'
import { colorForToken } from './SessionStatusBadge'
import { tierColorToken, type SessionTier } from '@/lib/sessionPresentation'

/** The five words a list row may render. Detail screens keep the 15 `statusLabel` values. */
export function getSessionTierLabel(tier: SessionTier, t: TFunction<'sessions'>): string {
  switch (tier) {
    case 'needsYou':
      return t('status.needsYou')
    case 'working':
      return t('status.working')
    case 'resumable':
      return t('status.resumable')
    case 'cantResume':
      return t('status.cantResume')
    case 'observed':
      return t('status.observed')
  }
}

/** Tiers backed by a live process, which pulse and colour the rail. */
export function isLiveTier(tier: SessionTier): boolean {
  return tier === 'needsYou' || tier === 'working' || tier === 'observed'
}

interface Props {
  tier: SessionTier
  /** Trailing detail in the same colour, e.g. "waiting 2m". */
  qualifier?: string
}

export function StateBadge({ tier, qualifier }: Props) {
  const theme = useTheme()
  const { t } = useTranslation('sessions')
  const color = colorForToken(theme, tierColorToken(tier))
  const label = getSessionTierLabel(tier, t)

  return (
    <View style={styles.row} testID={`state-badge-${tier}`}>
      <LiveDot live={isLiveTier(tier)} color={color} size={7} />
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
        {qualifier ? ' · ' : null}
        {qualifier}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    fontSize: font.xs,
    fontWeight: '500',
  },
})
