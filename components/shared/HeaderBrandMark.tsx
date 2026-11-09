import React from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { IS_QA_APP } from '@/lib/appScheme'

const YELLOW = '#f5c518'
const GRAY = '#3d4654'

const MARK = 22

interface Props {
  /** Storybook override. The home header uses the TbDev application id. */
  qa?: boolean
}

export function HeaderBrandMark({ qa = IS_QA_APP }: Props) {
  const { t } = useTranslation('shared')

  if (!qa) {
    return (
      <Image
        source={require('../../assets/icon.png')}
        style={styles.icon}
        testID="header-brand-icon"
      />
    )
  }

  return (
    <View style={styles.qaRow}>
      <Image
        source={require('../../assets/icon-qa.png')}
        style={styles.icon}
        testID="header-qa-mark"
      />
      <Text style={styles.qaLabel} testID="header-qa-label">{t('app.qaBadge')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  icon: {
    width: MARK,
    height: MARK,
    borderRadius: 5,
  },
  qaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qaLabel: {
    color: GRAY,
    backgroundColor: YELLOW,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
})
