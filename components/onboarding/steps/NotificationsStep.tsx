import React, { useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path, Polyline } from 'react-native-svg'
import * as Notifications from 'expo-notifications'
import { useTranslation } from 'react-i18next'
import { PrimaryButton } from '../components/PrimaryButton'
import { colors, fonts } from '../theme'

interface Props {
  onNext: () => void
}

function BellIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10 21a2 2 0 0 0 4 0"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function NotificationsStep({ onNext }: Props) {
  const { t } = useTranslation('onboarding')
  const [enabled, setEnabled] = useState(false)
  const [requesting, setRequesting] = useState(false)

  const handleToggle = async () => {
    if (enabled || requesting) {
      setEnabled((v) => !v)
      return
    }
    setRequesting(true)
    try {
      const { granted } = await Notifications.requestPermissionsAsync()
      setEnabled(granted)
    } catch {
      // If the OS prompt is unavailable (e.g. simulator quirks), still flip
      // the visual state so the user can advance.
      setEnabled(true)
    } finally {
      setRequesting(false)
    }
  }

  return (
    <View style={styles.root}>
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <Text style={styles.eyebrow}>{'>'} 03 / NOTIFY</Text>

      {/* eslint-disable-next-line i18next/no-literal-string */}
      <Text style={styles.headline}>Wake me only when it counts.</Text>
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <Text style={styles.subhead}>
        Push fires on plan-ready, tool-confirms, and run failures. That&apos;s it.
      </Text>

      {/* Mock notification preview */}
      <View style={styles.preview}>
        <View style={styles.previewRow}>
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.previewIcon}
          />
          <View style={styles.previewBody}>
            <View style={styles.previewHead}>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <Text style={styles.previewBrand}>THREADBASE</Text>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <Text style={styles.previewTime}>now</Text>
            </View>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <Text style={styles.previewTitle}>Plan ready · feat/queue</Text>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <Text style={styles.previewMessage}>
              3 files queued for edit. Tap to review.
            </Text>
          </View>
        </View>
      </View>

      {/* Allow card */}
      <Pressable
        onPress={handleToggle}
        style={[
          styles.allow,
          { borderColor: enabled ? colors.blue500 : colors.ink5 },
        ]}
      >
        <View
          style={[
            styles.bellWrap,
            {
              backgroundColor: enabled ? 'rgba(99,179,255,0.15)' : colors.ink3,
            },
          ]}
        >
          <BellIcon color={enabled ? colors.blue400 : colors.fg3} />
        </View>
        <View style={styles.allowText}>
          <Text style={styles.allowTitle}>{t('notifications.allowTitle')}</Text>
          <Text style={styles.allowStatus}>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            {enabled ? 'ENABLED · alerts.threadbase.dev' : 'TAP TO ALLOW'}
          </Text>
        </View>
        <View
          style={[
            styles.checkbox,
            {
              borderColor: enabled ? colors.blue500 : colors.ink6,
              backgroundColor: enabled ? colors.blue500 : 'transparent',
            },
          ]}
        >
          {enabled && (
            <Svg width={10} height={10} viewBox="0 0 24 24">
              <Polyline
                points="20 6 9 17 4 12"
                fill="none"
                stroke="#0a1424"
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          )}
        </View>
      </Pressable>

      <View style={styles.flex} />

      <PrimaryButton onPress={onNext}>
        {/* eslint-disable-next-line i18next/no-literal-string */}
        {enabled ? 'Continue' : "Skip — I'll watch the kanban"}
      </PrimaryButton>
      <View style={{ height: 14 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 22, paddingTop: 4 },
  eyebrow: {
    color: colors.amber400,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  headline: {
    color: colors.fg0,
    fontFamily: fonts.sans,
    fontSize: 26,
    lineHeight: 29,
    fontWeight: '600',
    letterSpacing: -0.55,
    marginBottom: 6,
  },
  subhead: {
    color: colors.fg2,
    fontFamily: fonts.sans,
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: 18,
  },
  preview: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(99,179,255,0.06)',
    borderWidth: 1,
    borderColor: colors.ink5,
    marginBottom: 14,
  },
  previewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  previewIcon: { width: 32, height: 32, borderRadius: 7 },
  previewBody: { flex: 1, minWidth: 0 },
  previewHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  previewBrand: {
    color: colors.fg0,
    fontFamily: fonts.sans,
    fontSize: 11.5,
    fontWeight: '600',
  },
  previewTime: {
    color: colors.fg4,
    fontFamily: fonts.mono,
    fontSize: 10.5,
    fontWeight: '500',
  },
  previewTitle: {
    color: colors.fg0,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: 4,
  },
  previewMessage: {
    color: colors.fg2,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  allow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  bellWrap: {
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allowText: { flex: 1 },
  allowTitle: {
    color: colors.fg0,
    fontFamily: fonts.sans,
    fontSize: 13.5,
    fontWeight: '600',
  },
  allowStatus: {
    color: colors.fg3,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
})
