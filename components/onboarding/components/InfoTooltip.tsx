import React, { useState } from 'react'
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { ArrowRight } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useAppDirection } from '@/lib/rtl'
import { colors, fonts } from '../theme'

interface Props {
  children: React.ReactNode
  linkLabel?: string
  linkUrl?: string
}

export function InfoTooltip({ children, linkLabel, linkUrl }: Props) {
  const { t } = useTranslation('onboarding')
  const { isRTL } = useAppDirection()
  const [visible, setVisible] = useState(false)

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        testID="info-tooltip-trigger"
        onPress={() => setVisible((v) => !v)}
        hitSlop={8}
        style={styles.trigger}
      >
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <Text style={styles.icon}>?</Text>
      </TouchableOpacity>
      {visible && (
        <View testID="info-tooltip-body" style={styles.tooltip}>
          <Text style={styles.text}>{children}</Text>
          {linkLabel && linkUrl && (
            <TouchableOpacity
              onPress={() => Linking.openURL(linkUrl)}
              style={styles.linkRow}
            >
              <Text style={styles.link}>{linkLabel}</Text>
              <ArrowRight size={12} color={colors.blue400} weight="bold" mirrored={isRTL} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setVisible(false)} hitSlop={8} style={styles.dismissRow}>
            <Text style={styles.dismiss}>{t('tooltip.dismiss')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  trigger: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.fg4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    color: colors.fg4,
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 13,
  },
  tooltip: {
    position: 'absolute',
    top: 24,
    start: 0,
    width: 260,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.ink6,
    borderRadius: 10,
    padding: 12,
    zIndex: 100,
  },
  text: {
    color: colors.fg2,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  link: {
    color: colors.blue400,
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '500',
  },
  dismissRow: { alignSelf: 'flex-start' },
  dismiss: {
    color: colors.fg3,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '500',
  },
})
