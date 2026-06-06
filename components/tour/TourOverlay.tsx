import React from 'react'
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const BACKDROP = 'rgba(0,0,0,0.72)'
const CARD_BG = '#161f2e'
const CARD_BORDER = '#2a3650'
const TEXT_PRIMARY = '#e6edf3'
const TEXT_SECONDARY = '#8b949e'
const BLUE = '#3b82f6'
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
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <Text style={styles.skip}>Skip tour</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="tour-got-it"
            onPress={onGotIt}
            style={styles.gotItBtn}
            activeOpacity={0.75}
          >
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <Text style={styles.gotItText}>Got it →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  strip: {
    position: 'absolute',
    backgroundColor: BACKDROP,
  },
  card: {
    position: 'absolute',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 12,
    padding: 14,
  },
  stepLabel: {
    color: TEXT_SECONDARY,
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  text: {
    color: TEXT_PRIMARY,
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
    color: TEXT_SECONDARY,
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '500',
  },
  gotItBtn: {
    backgroundColor: BLUE,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  gotItText: {
    color: '#fff',
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: '600',
  },
})
