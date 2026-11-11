import React from 'react'
import { useTranslation } from 'react-i18next'
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import type { Theme } from '@/constants/theme'
import { useThemedStyles } from '@/hooks/useThemedStyles'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const BACKDROP = 'rgba(0,0,0,0.72)'
const MONO = 'Menlo'

export interface TourTarget {
  x: number
  y: number
  width: number
  height: number
}

interface Props {
  target: TourTarget
  text: string
  onGotIt: () => void
  onSkip: () => void
  stepLabel?: string
}

export function TourOverlay({ target, text, onGotIt, onSkip, stepLabel }: Props) {
  const { t } = useTranslation('sessions')
  const { styles } = useThemedStyles(makeStyles)
  const PADDING = 8
  const holeX = target.x - PADDING
  const holeY = target.y - PADDING
  const holeW = target.width + PADDING * 2
  const holeH = target.height + PADDING * 2

  // Place tooltip below target; flip above if too close to screen bottom
  const tooltipTop = holeY + holeH + 12
  const flipAbove = tooltipTop + 120 > SCREEN_H - 60
  const tooltipY = flipAbove ? holeY - 12 - 120 : tooltipTop

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop — top strip */}
      <View style={[styles.strip, { top: 0, height: Math.max(0, holeY), width: SCREEN_W }]} />
      {/* Backdrop — bottom strip */}
      <View
        style={[
          styles.strip,
          {
            top: holeY + holeH,
            height: Math.max(0, SCREEN_H - holeY - holeH),
            width: SCREEN_W,
          },
        ]}
      />
      {/* Backdrop — left strip */}
      <View
        style={[
          styles.strip,
          { top: holeY, height: holeH, width: Math.max(0, holeX) },
        ]}
      />
      {/* Backdrop — right strip */}
      <View
        style={[
          styles.strip,
          {
            top: holeY,
            left: holeX + holeW,
            height: holeH,
            width: Math.max(0, SCREEN_W - holeX - holeW),
          },
        ]}
      />

      {/* Tooltip card */}
      <View style={[styles.card, { top: tooltipY, left: 16, right: 16 }]}>
        {stepLabel != null && (
          <Text testID="tour-step-label" style={styles.stepLabel}>
            {stepLabel}
          </Text>
        )}
        <Text style={styles.text}>{text}</Text>
        <View style={styles.actions}>
          <TouchableOpacity testID="tour-skip" onPress={onSkip} hitSlop={8}>
            <Text style={styles.skip}>{t('tour.skip')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="tour-got-it"
            onPress={onGotIt}
            style={styles.gotItBtn}
            activeOpacity={0.75}
          >
            <Text style={styles.gotItText}>{t('tour.gotIt')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    strip: {
      position: 'absolute',
      backgroundColor: BACKDROP,
    },
    card: {
      position: 'absolute',
      backgroundColor: theme.bg.secondary,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 14,
    },
    stepLabel: {
      color: theme.text.secondary,
      fontFamily: MONO,
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    text: {
      color: theme.text.primary,
      fontSize: 14,
      lineHeight: 21,
      marginBottom: 12,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    skip: {
      color: theme.text.secondary,
      fontFamily: MONO,
      fontSize: 11,
      fontWeight: '500',
    },
    gotItBtn: {
      backgroundColor: theme.text.accent,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    gotItText: {
      color: theme.text.onAccent,
      fontFamily: MONO,
      fontSize: 12,
      fontWeight: '600',
    },
  })
}
