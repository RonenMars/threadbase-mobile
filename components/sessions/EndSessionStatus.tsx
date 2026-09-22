import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { HourglassMedium, Warning } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

// Long enough for a clean SIGINT exit to have landed; offering Force sooner
// invites a SIGKILL on an agent that was already shutting down.
const ESCALATE_AFTER_MS = 8000

interface Props {
  armed: boolean
  /** Epoch ms of the Terminate tap, while the session is still live. */
  terminatingAt?: number
  /** Omitted when the server has no /kill: the strip then only reports. */
  onForce?: () => void
}

/** What the user already asked of a live session: armed to end, or terminating. Never escalates by itself. */
export function EndSessionStatus({ armed, terminatingAt, onForce }: Props) {
  const { t } = useTranslation('sessions')
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    if (terminatingAt == null) return
    const id = setTimeout(() => setNow(Date.now()), Math.max(0, terminatingAt + ESCALATE_AFTER_MS - Date.now()))
    return () => clearTimeout(id)
  }, [terminatingAt])

  if (terminatingAt != null && now - terminatingAt < ESCALATE_AFTER_MS) {
    return (
      <View style={styles.row} testID="end-session-terminating">
        <ActivityIndicator size="small" color={theme.text.secondary} />
        <Text style={styles.muted}>{t('endSession.terminating')}</Text>
      </View>
    )
  }
  if (terminatingAt != null) {
    return (
      <View style={[styles.row, styles.strip]} testID="end-session-still-running">
        <Warning size={16} color={theme.text.warning} weight="fill" />
        <Text style={styles.stripText}>{t('endSession.stillRunning')}</Text>
        {onForce ? (
          <Pressable
            onPress={onForce}
            hitSlop={8}
            accessibilityRole="button"
            style={({ pressed }) => [styles.force, { opacity: pressed ? 0.6 : 1 }]}
            testID="end-session-force"
          >
            <Text style={styles.forceLabel}>{t('endSession.force')}</Text>
          </Pressable>
        ) : null}
      </View>
    )
  }
  if (armed) {
    return (
      <View style={[styles.row, styles.chip]} testID="end-session-armed">
        <HourglassMedium size={14} color={theme.text.warning} />
        <Text style={styles.chipText}>{t('endSession.armed')}</Text>
      </View>
    )
  }
  return null
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm - 2 },
    muted: { color: theme.text.secondary, fontSize: font.xs },
    strip: {
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: `${theme.text.warning}55`,
      backgroundColor: `${theme.text.warning}14`,
    },
    stripText: { flex: 1, color: theme.text.primary, fontSize: font.xs },
    force: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      backgroundColor: theme.status.failed,
    },
    forceLabel: { color: theme.text.onAccent, fontSize: font.xs, fontWeight: '700' },
    chip: {
      alignSelf: 'flex-start',
      paddingVertical: 2,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: `${theme.text.warning}55`,
    },
    chipText: { color: theme.text.warning, fontSize: font.xs, fontWeight: '600' },
  })
}
