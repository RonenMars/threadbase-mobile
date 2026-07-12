import React, { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { CaretDown, CaretUp } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/contexts/ThemeContext'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { diagnosticsToRows } from '@/services/feedback-diagnostics'
import type { FeedbackDiagnostics } from '@/types/feedback'

interface Props {
  diagnostics: FeedbackDiagnostics
}

/**
 * Expandable preview of the exact allowlisted diagnostic fields that will be
 * sent. Shows the plain-language intro (what is / isn't included) and, when
 * expanded, every key/value row so the user sees precisely what leaves the
 * device.
 */
export function DiagnosticsPreview({ diagnostics }: Props) {
  const { t } = useTranslation('feedback')
  const theme = useTheme()
  const s = useMemo(() => styles(theme), [theme])
  const [open, setOpen] = useState(false)
  const rows = useMemo(() => diagnosticsToRows(diagnostics), [diagnostics])

  return (
    <View style={s.wrap}>
      <Text style={s.intro}>{t('diagnostics.previewIntro')}</Text>
      <TouchableOpacity
        style={s.toggle}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={open ? t('form.hideDiagnostics') : t('form.viewDiagnostics')}
        testID="feedback-diagnostics-toggle"
      >
        <Text style={s.toggleText}>{open ? t('form.hideDiagnostics') : t('form.viewDiagnostics')}</Text>
        {open ? (
          <CaretUp size={14} color={theme.text.accent} />
        ) : (
          <CaretDown size={14} color={theme.text.accent} />
        )}
      </TouchableOpacity>
      {open ? (
        <View style={s.rows} testID="feedback-diagnostics-rows">
          {rows.map((row) => (
            <View key={row.key} style={s.row}>
              <Text style={s.rowKey}>{row.key}</Text>
              <Text style={s.rowValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function styles(theme: Theme) {
  return StyleSheet.create({
    wrap: {
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    intro: {
      color: theme.text.secondary,
      fontSize: font.xs,
      lineHeight: 17,
    },
    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 32,
    },
    toggleText: {
      color: theme.text.accent,
      fontSize: font.sm,
      fontWeight: '500',
    },
    rows: {
      backgroundColor: theme.bg.primary,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.sm,
      gap: 4,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    rowKey: {
      color: theme.text.secondary,
      fontSize: font.xs,
      fontFamily: 'monospace',
    },
    rowValue: {
      color: theme.text.primary,
      fontSize: font.xs,
      fontFamily: 'monospace',
      flexShrink: 1,
      textAlign: 'right',
    },
  })
}
