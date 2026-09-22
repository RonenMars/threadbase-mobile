import React, { useEffect, useRef, useState } from 'react'
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { CheckSquareIcon, DotsThreeVertical, SquareIcon, X } from 'phosphor-react-native'
import { Trans, useTranslation } from 'react-i18next'
import { LiveDot } from '@/components/sessions/LiveDot'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useReduceMotion, useScreenReaderEnabled } from '@/hooks/useAccessibilitySettings'
import type { SessionLeavePhase } from '@/hooks/useSessionLeaveGuard'
import { blockTextDirectionStyle, useAppDirection, useDirectionStyle } from '@/lib/rtl'

export const LEAVE_NOTICE_MS = 5000
// One segment per second.
const SEGMENTS = 5
// Threadbase modal scrim (DESIGN.md → "Sheet overlays"); every theme shares it.
const SCRIM = 'rgba(4,7,11,0.72)'

type Props = {
  visible: boolean
  phase: SessionLeavePhase
  agent: string
  server: string
  /** The agent is waiting on the user rather than working. */
  waiting: boolean
  /** Leaves now; true when "Skip this warning in the future" is ticked. */
  onLeave: (skipInFuture: boolean) => void
  onModalDismiss: () => void
}

/**
 * Keep running, said out loud: leaving a live session under that setting
 * shows this over the session, then leaves by itself. Holding anywhere on the
 * screen freezes the countdown, as in Instagram stories, and the X leaves early.
 */
export function LeaveNotice({ visible, phase, agent, server, waiting, onLeave, onModalDismiss }: Props) {
  const { t } = useTranslation(['sessions', 'common'])
  const theme = useTheme()
  const styles = makeStyles(theme)
  const reduceMotion = useReduceMotion()
  const screenReader = useScreenReaderEnabled()
  const directionStyle = useDirectionStyle()
  const { direction } = useAppDirection()
  const copyStyle = blockTextDirectionStyle(direction)
  // The one commit the guard spends in 'pending' keeps the modal up, so iOS
  // sees it close rather than vanish in the tick that confirmed it.
  const open = visible || phase === 'pending'
  const [held, setHeld] = useState(false)
  const [skip, setSkip] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setHeld(false)
      setSkip(false)
    }
  }
  // The countdown's finish callback reads the box from here, so ticking it
  // does not restart the animation.
  const skipRef = useRef(false)
  const toggleSkip = () => {
    skipRef.current = !skipRef.current
    setSkip(skipRef.current)
  }
  const leave = () => onLeave(skipRef.current)

  // The bar is the timer: its animation finishing is what leaves, so a hold
  // freezes both at once. `elapsed` carries the fraction across holds.
  const [progress] = useState(() => new Animated.Value(0))
  const elapsed = useRef(0)
  useEffect(() => {
    if (!visible) return
    elapsed.current = 0
    skipRef.current = false
    progress.setValue(0)
  }, [visible, progress])

  // A screen reader needs longer than the countdown to read the card, so the
  // notice waits there and the X is the way out.
  const counting = visible && !held && !screenReader
  useEffect(() => {
    if (!counting) return
    Animated.timing(progress, {
      toValue: 1,
      duration: LEAVE_NOTICE_MS * (1 - elapsed.current),
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) onLeave(skipRef.current)
    })
    return () => progress.stopAnimation((value) => {
      elapsed.current = value
    })
  }, [counting, onLeave, progress])
  // Drains from the end: the last segment empties first, then the one before it.
  const segmentWidth = (i: number) =>
    progress.interpolate({
      inputRange: [(SEGMENTS - 1 - i) / SEGMENTS, (SEGMENTS - i) / SEGMENTS],
      outputRange: ['100%', '0%'],
      extrapolate: 'clamp',
    })

  const statusColor = waiting ? theme.status.waiting : theme.status.running
  const statusLabel = waiting ? t('status.needsYou') : t('status.working')
  const title = waiting ? t('leaveNotice.waiting', { agent }) : t('leaveNotice.working', { agent })

  return (
    <Modal
      visible={open}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      statusBarTranslucent
      onRequestClose={visible ? leave : () => {}}
      onDismiss={onModalDismiss}
    >
      <Pressable
        style={[styles.scrim, directionStyle]}
        onPressIn={() => setHeld(true)}
        onPressOut={() => setHeld(false)}
        accessible={false}
        accessibilityViewIsModal
        testID="leave-notice"
      >
        <View style={styles.card}>
          <View style={styles.top}>
            <View style={[styles.pill, { backgroundColor: `${statusColor}1f` }]}>
              <LiveDot live={!waiting} color={statusColor} size={8} />
              <Text style={[styles.pillLabel, { color: statusColor }]}>{statusLabel}</Text>
            </View>
            <TouchableOpacity
              onPress={leave}
              hitSlop={spacing.md}
              accessibilityRole="button"
              accessibilityLabel={t('common:button.close')}
              accessibilityHint={t('leaveNotice.leaveHint')}
              testID="leave-notice-close"
            >
              <X size={20} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, copyStyle]}>{title}</Text>
            <Text style={[styles.message, copyStyle]}>{t('leaveNotice.body', { server })}</Text>
            <Text style={[styles.message, copyStyle]} testID="leave-notice-terminate-hint">
              <Trans
                t={t}
                i18nKey="leaveNotice.terminateHint"
                values={{ action: t('endSession.terminate') }}
                components={{
                  menu: <DotsThreeVertical size={14} color={theme.text.primary} weight="bold" testID="leave-notice-menu-icon" />,
                }}
              />
            </Text>
          </View>
          <TouchableOpacity
            style={styles.skipRow}
            onPress={toggleSkip}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: skip }}
            testID="leave-notice-skip"
          >
            {skip ? (
              <CheckSquareIcon size={22} color={theme.text.accent} weight="fill" />
            ) : (
              <SquareIcon size={22} color={theme.text.secondary} />
            )}
            <Text style={[styles.skipLabel, copyStyle]}>{t('leaveNotice.skip')}</Text>
          </TouchableOpacity>
          {screenReader ? null : (
            <View style={styles.segments} importantForAccessibility="no-hide-descendants">
              {Array.from({ length: SEGMENTS }, (_, i) => (
                <View key={i} style={styles.segment}>
                  <Animated.View style={[styles.fill, { width: segmentWidth(i) }]} testID="leave-notice-segment" />
                </View>
              ))}
            </View>
          )}
        </View>
      </Pressable>
    </Modal>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    scrim: {
      flex: 1,
      backgroundColor: SCRIM,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: theme.bg.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.xl,
      gap: spacing.lg,
      shadowColor: '#000',
      shadowOpacity: 0.55,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 14 },
      elevation: 12,
    },
    top: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.full,
    },
    pillLabel: {
      fontSize: font.xs,
      lineHeight: 14,
      fontWeight: '600',
      letterSpacing: 0.9,
      textTransform: 'uppercase',
    },
    copy: {
      gap: 6,
    },
    title: {
      color: theme.text.primary,
      fontSize: font.lg,
      fontWeight: '600',
    },
    message: {
      color: theme.text.primary,
      fontSize: font.sm,
      lineHeight: 20,
    },
    skipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 44,
    },
    skipLabel: {
      color: theme.text.primary,
      fontSize: font.sm,
      flex: 1,
    },
    segments: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    segment: {
      flex: 1,
      height: 4,
      borderRadius: radius.full,
      backgroundColor: theme.border,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      backgroundColor: theme.text.accent,
    },
  })
}
