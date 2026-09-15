import React, { useCallback, useMemo, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Copy, Check } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import * as Clipboard from 'expo-clipboard'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { alertAppearance } from '@/lib/alertAppearance'
import type { AlertEntry } from '@/types/alerts'

const TARGET = 44

type Props = {
  entry: AlertEntry
}

export function StatusRow({ entry }: Props) {
  const { t } = useTranslation('common')
  const theme = useTheme()
  const appearance = alertAppearance(entry.level, theme)
  const styles = useMemo(() => makeStyles(theme, appearance.accent), [theme, appearance.accent])
  const Icon = appearance.Icon
  const [detailsOpen, setDetailsOpen] = useState(false)
  const hasTechnical = Boolean(entry.code || entry.rawMessage)
  const showRetry = entry.retryable === true && entry.buttonAction !== undefined
  const retryLabel = entry.retrying ? t('errorBanner.retrying') : (entry.buttonText ?? t('button.retry'))
  const detailsLabel = t('alert.status.technicalDetails')
  const secondaryLabel = entry.buttonText
  const showSecondary = !showRetry && Boolean(entry.buttonText && entry.buttonAction)

  return (
    <View style={styles.row} testID={`error-sheet-row-${entry.id}`}>
      <View style={styles.header}>
        <Icon size={16} color={appearance.accent} weight={appearance.iconWeight} />
        <Text style={styles.title}>{entry.title}</Text>
      </View>
      <Text style={styles.message}>{entry.message}</Text>
      {entry.details ? <Text style={styles.message}>{entry.details}</Text> : null}
      {showRetry || hasTechnical || showSecondary ? (
        <View style={styles.actions}>
          {showRetry ? (
            <TouchableOpacity
              style={[styles.action, styles.retry]}
              onPress={entry.buttonAction}
              disabled={entry.retrying}
              accessibilityRole="button"
              accessibilityLabel={retryLabel}
              accessibilityState={{ disabled: Boolean(entry.retrying) }}
              testID={`error-sheet-retry-${entry.id}`}
            >
              <Text style={[styles.actionText, styles.retryText]}>{retryLabel}</Text>
            </TouchableOpacity>
          ) : null}
          {hasTechnical ? (
            <TouchableOpacity
              style={styles.action}
              onPress={() => setDetailsOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel={detailsLabel}
              testID={`status-row-details-${entry.id}`}
            >
              <Text style={styles.actionText}>{detailsLabel}</Text>
            </TouchableOpacity>
          ) : null}
          {showSecondary ? (
            <TouchableOpacity
              style={styles.action}
              onPress={entry.buttonAction}
              accessibilityRole="button"
              accessibilityLabel={secondaryLabel}
              testID={`status-row-action-${entry.id}`}
            >
              <Text style={styles.actionText}>{secondaryLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {detailsOpen ? (
        <View style={styles.details}>
          {entry.code ? <CopyRow label={t('errorBanner.codeLabel')} value={entry.code} /> : null}
          {entry.rawMessage ? <CopyRow label={t('errorBanner.rawLabel')} value={entry.rawMessage} /> : null}
        </View>
      ) : null}
    </View>
  )
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme, theme.border), [theme])
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [value])

  return (
    <View style={styles.copyRow}>
      <View style={styles.copyRowText}>
        <Text style={styles.copyLabel}>{label}</Text>
        <Text style={styles.copyValue} selectable>{value}</Text>
      </View>
      <TouchableOpacity
        onPress={handleCopy}
        style={styles.copyBtn}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {copied
          ? <Check size={16} color={theme.text.success} />
          : <Copy size={16} color={theme.text.secondary} />}
      </TouchableOpacity>
    </View>
  )
}

function makeStyles(theme: Theme, accent: string) {
  return StyleSheet.create({
    row: {
      borderWidth: 1,
      borderColor: accent === theme.status.failed ? `${theme.status.failed}66` : theme.border,
      borderRadius: radius.md,
      backgroundColor: theme.bg.primary,
      padding: spacing.md,
      gap: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    title: {
      flex: 1,
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
    },
    message: {
      color: theme.text.secondary,
      fontSize: font.sm,
      lineHeight: 18,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    action: {
      minHeight: TARGET,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    retry: {
      backgroundColor: theme.status.failed,
      borderColor: theme.status.failed,
    },
    actionText: {
      color: theme.text.secondary,
      fontSize: font.sm,
      fontWeight: '600',
    },
    retryText: {
      color: theme.text.onAccent,
    },
    details: {
      gap: spacing.sm,
    },
    copyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      backgroundColor: theme.bg.secondary,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      minHeight: TARGET,
    },
    copyRowText: {
      flex: 1,
      paddingVertical: spacing.sm,
    },
    copyLabel: {
      color: theme.text.secondary,
      fontSize: 11,
      textTransform: 'uppercase',
    },
    copyValue: {
      color: theme.text.primary,
      fontSize: 12,
      fontFamily: 'monospace',
      marginTop: 2,
    },
    copyBtn: {
      width: TARGET,
      height: TARGET,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
}
