import React, { useEffect, useMemo, useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, ClipboardText, Check, Export, Prohibit } from 'phosphor-react-native'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import {
  generateDiagnostics,
  diagnosticsToRows,
  diagnosticsToText,
  type DiagnosticsReport,
} from '@/services/diagnostics'

export default function DiagnosticsScreen() {
  const { t } = useTranslation('feedback')
  const theme = useTheme()
  const isGlass = useIsGlass()
  const insets = useSafeAreaInsets()
  const s = useMemo(() => styles(theme), [theme])
  // Transparent header (glass themes) doesn't reserve layout space, so the
  // ScrollView starts under it; push content down by the header's own height.
  const headerHeight = Platform.OS === 'ios' ? 44 : 56
  const glassContentStyle =
    isGlass && Platform.OS !== 'android'
      ? { paddingTop: s.content.padding + insets.top + headerHeight }
      : null

  const [report, setReport] = useState<DiagnosticsReport | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    generateDiagnostics().then((r) => {
      if (!cancelled) setReport(r)
    })
    return () => { cancelled = true }
  }, [])

  const rows = useMemo(() => (report ? diagnosticsToRows(report) : []), [report])

  const handleCopy = useCallback(async () => {
    if (!report) return
    try {
      await Clipboard.setStringAsync(diagnosticsToText(report))
      setCopied(true)
      setError(null)
    } catch {
      setError(t('diagnostics.copyFailed'))
    }
  }, [report, t])

  const handleShare = useCallback(async () => {
    if (!report) return
    try {
      await Share.share({ message: diagnosticsToText(report) })
      setError(null)
    } catch {
      setError(t('diagnostics.shareFailed'))
    }
  }, [report, t])

  if (!report) {
    return (
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={s.centered}>
          <ActivityIndicator size="small" color={theme.text.accent} />
          <Text style={s.loadingText}>{t('diagnostics.loading')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={[s.content, glassContentStyle]}>
        <View style={s.headerRow}>
          <ShieldCheck size={24} color={theme.text.accent} />
          <Text style={s.heading}>{t('diagnostics.heading')}</Text>
        </View>
        <Text style={s.subtitle}>{t('diagnostics.subtitle')}</Text>

        {/* What's included / excluded / control */}
        <View style={[s.card, isGlass && s.cardGlass]}>
          <GlassFill />
          <View style={s.noteRow}>
            <Check size={16} color={theme.text.success} weight="bold" />
            <View style={s.noteBody}>
              <Text style={s.noteTitle}>{t('diagnostics.includedTitle')}</Text>
              <Text style={s.noteText}>{t('diagnostics.included')}</Text>
            </View>
          </View>
          <View style={s.noteRow}>
            <Prohibit size={16} color={theme.text.danger} />
            <View style={s.noteBody}>
              <Text style={s.noteTitle}>{t('diagnostics.excludedTitle')}</Text>
              <Text style={s.noteText}>{t('diagnostics.excluded')}</Text>
            </View>
          </View>
          <Text style={s.controlNote}>{t('diagnostics.controlNote')}</Text>
        </View>

        {/* Live preview */}
        <View style={[s.card, isGlass && s.cardGlass]} testID="diagnostics-preview">
          <GlassFill />
          {rows.map((row) => (
            <View key={row.key} style={s.row}>
              <Text style={s.rowKey}>{row.key}</Text>
              <Text style={s.rowValue}>{row.value}</Text>
            </View>
          ))}
          {report.recentEvents.length > 0 ? (
            <View style={s.eventsBlock}>
              {report.recentEvents.map((e, i) => (
                <Text key={`${e.event}-${i}`} style={s.eventLine}>{`${e.at}  ${e.event}`}</Text>
              ))}
            </View>
          ) : null}
        </View>

        {error ? <Text style={s.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={s.primaryBtn}
          onPress={handleCopy}
          accessibilityRole="button"
          accessibilityLabel={t('diagnostics.copy')}
          testID="diagnostics-copy"
        >
          {copied ? (
            <Check size={18} color={theme.text.onAccent} weight="bold" />
          ) : (
            <ClipboardText size={18} color={theme.text.onAccent} />
          )}
          <Text style={s.primaryBtnText}>{copied ? t('diagnostics.copied') : t('diagnostics.copy')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.secondaryBtn}
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel={t('diagnostics.share')}
          testID="diagnostics-share"
        >
          <Export size={18} color={theme.text.accent} />
          <Text style={s.secondaryBtnText}>{t('diagnostics.share')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

function styles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg.primary },
    content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
    loadingText: { color: theme.text.secondary, fontSize: font.base },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
    heading: { color: theme.text.primary, fontSize: font.xl, fontWeight: '700' },
    subtitle: { color: theme.text.secondary, fontSize: font.base, lineHeight: 21, marginBottom: spacing.sm },
    card: {
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
      padding: spacing.md,
      gap: spacing.sm,
    },
    cardGlass: { backgroundColor: 'transparent' },
    noteRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
    noteBody: { flex: 1, gap: 2 },
    noteTitle: { color: theme.text.primary, fontSize: font.sm, fontWeight: '600' },
    noteText: { color: theme.text.secondary, fontSize: font.xs, lineHeight: 17 },
    controlNote: { color: theme.text.secondary, fontSize: font.xs, lineHeight: 17, fontStyle: 'italic' },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
    rowKey: { color: theme.text.secondary, fontSize: font.xs, fontFamily: 'monospace' },
    rowValue: { color: theme.text.primary, fontSize: font.xs, fontFamily: 'monospace', flexShrink: 1, textAlign: 'right' },
    eventsBlock: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      paddingTop: spacing.sm,
      gap: 2,
    },
    eventLine: { color: theme.text.secondary, fontSize: font.xs, fontFamily: 'monospace' },
    errorText: { color: theme.text.danger, fontSize: font.sm },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: theme.text.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      minHeight: 48,
      marginTop: spacing.sm,
    },
    primaryBtnText: { color: theme.text.onAccent, fontSize: font.base, fontWeight: '600' },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: spacing.md,
      minHeight: 48,
    },
    secondaryBtnText: { color: theme.text.accent, fontSize: font.base, fontWeight: '600' },
  })
}
