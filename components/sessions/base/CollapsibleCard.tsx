import React, { useCallback } from 'react'
import { View, TouchableOpacity, Platform, UIManager, LayoutAnimation } from 'react-native'
import { Card } from '@/components/ui/Card'
import { useThemedStyles } from '@/hooks/useThemedStyles'
import { useReduceMotion } from '@/hooks/useAccessibilitySettings'
import { makeStyles } from './CollapsibleCard.styles'
import { CardSpine, CardTitleBlock, CountBadge, ChevronToggle, CardBody } from './CollapsibleCardParts'

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true)
}

export interface CollapsibleCardProps {
  id: string
  /** Muted, left-truncated line above the title (e.g. the parent path). */
  parentLabel?: string
  title: string
  activityLine?: string
  count: number
  /** Spine colour; null leaves the spine blank. */
  railColor: string | null
  isOpen: boolean
  onToggle: (id: string) => void
  accessibilityLabel: string
  headerTestID: string
  /** Rendered inside the card, under the header, only while open. */
  children: React.ReactNode
  /** Rendered inside the card, after the spine row (sheets, overlays). */
  after?: React.ReactNode
}

export function CollapsibleCard({
  id,
  parentLabel,
  title,
  activityLine,
  count,
  railColor,
  isOpen,
  onToggle,
  accessibilityLabel,
  headerTestID,
  children,
  after,
}: CollapsibleCardProps) {
  const { styles } = useThemedStyles(makeStyles)
  const reduceMotion = useReduceMotion()

  const handleToggle = useCallback(() => {
    // Reduce Motion: the body appears in place and the chevron snaps.
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    onToggle(id)
  }, [onToggle, id, reduceMotion])

  return (
    <Card style={{ overflow: 'hidden', gap: 0, padding: 0 }}>
      <View style={styles.spineRow}>
        <CardSpine color={railColor} />

        <View style={styles.spineRowBody}>
          <TouchableOpacity
            onPress={handleToggle}
            activeOpacity={0.75}
            style={styles.header}
            accessibilityRole="button"
            accessibilityState={{ expanded: isOpen }}
            accessibilityLabel={accessibilityLabel}
            testID={headerTestID}
          >
            <CardTitleBlock parentLabel={parentLabel} title={title} activityLine={activityLine} />
            <CountBadge count={count} />
            <ChevronToggle isOpen={isOpen} />
          </TouchableOpacity>

          {isOpen ? <CardBody>{children}</CardBody> : null}
        </View>
      </View>
      {after}
    </Card>
  )
}
