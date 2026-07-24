import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Share,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import { useTranslation } from 'react-i18next'
import {
  Heartbeat,
  ClipboardText,
  Check,
  Export,
  ArrowsClockwise,
  WarningCircle,
  CheckCircle,
  XCircle,
  Question,
} from 'phosphor-react-native'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { useServersStore } from '@/stores/servers'
import { useServerDiagnostics } from '@/hooks/useServerDiagnostics'
import {
  isSupportedDiagnosticsContract,
  needsRemediation,
  serverDiagnosticsToText,
} from '@/services/server-diagnostics'
import type {
  CheckStatus,
  ServerDiagnosticCheck,
} from '@/types/server-diagnostics'
import { MIN_TOUCH_TARGET } from '@/constants/a11y'

export default function ServerHealthScreen() {
  const { t } = useTranslation(['servers', 'common'])
  const theme = useTheme()
  const isGlass = useIsGlass()
  const s = useMemo(() => styles(theme), [theme])

  const servers = useServersStore((st) => st.servers)
  const activeServerIds = useServersStore((st) => st.activeServerIds)
  const serverIds = useMemo(
    () => activeServerIds.filter((id) => !!servers[id]),
    [activeServerIds, servers],
  )

  const [pickedId, setPickedId] = useState<string | null>(null)
  const selectedId =
    pickedId && serverIds.includes(pickedId) ? pickedId : (serverIds[0] ?? null)

  const selected = selectedId ? servers[selectedId] : undefined
  const serverLabel = selected?.label?.trim() || selected?.url || selectedId || '—'

  const { data, error, isFetching, isLoading, refetch } = useServerDiagnostics(selectedId)

  const [copied, setCopied] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleCopy = useCallback(async () => {
    if (!data || !selectedId) return
    try {
      await Clipboard.setStringAsync(serverDiagnosticsToText(serverLabel, data))
      setCopied(true)
      setActionError(null)
    } catch {
      setActionError(t('servers:health.copyFailed'))
    }
  }, [data, selectedId, serverLabel, t])

  const handleShare = useCallback(async () => {
    if (!data || !selectedId) return
    try {
      await Share.share({ message: serverDiagnosticsToText(serverLabel, data) })
      setActionError(null)
    } catch {
      setActionError(t('servers:health.shareFailed'))
    }
  }, [data, selectedId, serverLabel, t])

  const handleRetry = useCallback(() => {
    setCopied(false)
    setActionError(null)
    void refetch()
  }, [refetch])

  const overallStatusLabel =
    data?.overall === 'ok'
      ? t('servers:health.status.ok')
      : data?.overall === 'degraded'
        ? t('servers:health.status.degraded')
        : data?.overall === 'failed'
          ? t('servers:health.status.failed')
          : t('servers:health.status.unknown')

  if (serverIds.length === 0) {
    return (
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={s.centered}>
          <Text style={s.emptyTitle}>{t('servers:health.emptyTitle')}</Text>
          <Text style={s.emptyBody}>{t('servers:health.emptyBody')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.headerRow}>
          <Heartbeat size={24} color={theme.text.accent} />
          <Text style={s.heading}>{t('servers:health.heading')}</Text>
        </View>
        <Text style={s.subtitle}>{t('servers:health.subtitle')}</Text>

        {serverIds.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.serverChips}>
            {serverIds.map((id) => {
              const label = servers[id]?.label?.trim() || servers[id]?.url || id
              const selectedChip = id === selectedId
              return (
                <TouchableOpacity
                  key={id}
                  style={[s.chip, selectedChip && s.chipSelected]}
                  onPress={() => {
                    setPickedId(id)
                    setCopied(false)
                    setActionError(null)
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedChip }}
                  testID={`server-health-chip-${id}`}
                >
                  <Text style={[s.chipText, selectedChip && s.chipTextSelected]} numberOfLines={1}>
                    {label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        ) : null}

        <View style={s.toolbar}>
          <TouchableOpacity
            style={s.retryBtn}
            onPress={handleRetry}
            disabled={isFetching}
            accessibilityRole="button"
            accessibilityLabel={t('servers:health.retry')}
            testID="server-health-retry"
          >
            <ArrowsClockwise size={18} color={theme.text.accent} />
            <Text style={s.retryText}>{t('servers:health.retry')}</Text>
          </TouchableOpacity>
        </View>

        {isLoading && !data ? (
          <View style={s.centeredInline}>
            <ActivityIndicator size="small" color={theme.text.accent} />
            <Text style={s.loadingText}>{t('servers:health.loading')}</Text>
          </View>
        ) : null}

        {error && !data ? (
          <View style={[s.card, isGlass && s.cardGlass]} testID="server-health-error">
            <GlassFill />
            <Text style={s.errorText}>
              {error instanceof Error ? error.message : t('servers:health.loadFailed')}
            </Text>
          </View>
        ) : null}

        {data ? (
          <>
            {!isSupportedDiagnosticsContract(data) ? (
              <View style={[s.card, isGlass && s.cardGlass]}>
                <GlassFill />
                <Text style={s.warnText}>
                  {t('servers:health.unsupportedContract', { version: data.contractVersion })}
                </Text>
              </View>
            ) : null}

            <View style={[s.card, isGlass && s.cardGlass]} testID="server-health-overall">
              <GlassFill />
              <View style={s.overallRow}>
                <StatusIcon status={data.overall} theme={theme} />
                <View style={s.overallBody}>
                  <Text style={s.overallLabel}>{t('servers:health.overall')}</Text>
                  <Text style={s.overallValue}>{overallStatusLabel}</Text>
                </View>
              </View>
              <Text style={s.metaLine}>
                {t('servers:health.generatedAt', { at: data.generatedAt })}
              </Text>
            </View>

            {data.checks.map((check) => (
              <CheckCard key={check.id} check={check} theme={theme} isGlass={isGlass} />
            ))}

            {actionError ? <Text style={s.errorText}>{actionError}</Text> : null}

            <TouchableOpacity
              style={s.primaryBtn}
              onPress={handleCopy}
              accessibilityRole="button"
              accessibilityLabel={t('servers:health.copy')}
              testID="server-health-copy"
            >
              {copied ? (
                <Check size={18} color={theme.text.onAccent} weight="bold" />
              ) : (
                <ClipboardText size={18} color={theme.text.onAccent} />
              )}
              <Text style={s.primaryBtnText}>
                {copied ? t('servers:health.copied') : t('servers:health.copy')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.secondaryBtn}
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityLabel={t('servers:health.share')}
              testID="server-health-share"
            >
              <Export size={18} color={theme.text.accent} />
              <Text style={s.secondaryBtnText}>{t('servers:health.share')}</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function StatusIcon({ status, theme }: { status: CheckStatus; theme: Theme }) {
  const size = 22
  switch (status) {
    case 'ok':
      return <CheckCircle size={size} color={theme.text.success} weight="fill" />
    case 'degraded':
      return <WarningCircle size={size} color={theme.text.warning} weight="fill" />
    case 'failed':
      return <XCircle size={size} color={theme.text.danger} weight="fill" />
    default:
      return <Question size={size} color={theme.text.secondary} />
  }
}

function CheckCard({
  check,
  theme,
  isGlass,
}: {
  check: ServerDiagnosticCheck
  theme: Theme
  isGlass: boolean
}) {
  const { t } = useTranslation('servers')
  const s = useMemo(() => styles(theme), [theme])
  const showRemediation = needsRemediation(check.remediation)

  const checkTitle = (() => {
    switch (check.id) {
      case 'streamer':
        return t('health.checks.streamer')
      case 'provider:claude-code':
        return t('health.checks.providerClaude')
      case 'provider:codex-cli':
        return t('health.checks.providerCodex')
      case 'cache':
        return t('health.checks.cache')
      case 'pty':
        return t('health.checks.pty')
      case 'filesystem':
        return t('health.checks.filesystem')
      default:
        return check.id
    }
  })()

  const remediationTitle = (() => {
    switch (check.remediation) {
      case 'PROVIDER_NOT_INSTALLED':
        return t('health.remediation.PROVIDER_NOT_INSTALLED.title')
      case 'PROVIDER_VERSION_UNVERIFIED':
        return t('health.remediation.PROVIDER_VERSION_UNVERIFIED.title')
      case 'DB_UNAVAILABLE':
        return t('health.remediation.DB_UNAVAILABLE.title')
      case 'DB_MIGRATION_PENDING':
        return t('health.remediation.DB_MIGRATION_PENDING.title')
      case 'PTY_UNAVAILABLE':
        return t('health.remediation.PTY_UNAVAILABLE.title')
      case 'CACHE_DEGRADED':
        return t('health.remediation.CACHE_DEGRADED.title')
      case 'CLOCK_SKEWED':
        return t('health.remediation.CLOCK_SKEWED.title')
      case 'FS_SCOPE_MISSING':
        return t('health.remediation.FS_SCOPE_MISSING.title')
      case 'NONE':
        return t('health.remediation.NONE.title')
    }
  })()

  const remediationAction = (() => {
    switch (check.remediation) {
      case 'PROVIDER_NOT_INSTALLED':
        return t('health.remediation.PROVIDER_NOT_INSTALLED.action')
      case 'PROVIDER_VERSION_UNVERIFIED':
        return t('health.remediation.PROVIDER_VERSION_UNVERIFIED.action')
      case 'DB_UNAVAILABLE':
        return t('health.remediation.DB_UNAVAILABLE.action')
      case 'DB_MIGRATION_PENDING':
        return t('health.remediation.DB_MIGRATION_PENDING.action')
      case 'PTY_UNAVAILABLE':
        return t('health.remediation.PTY_UNAVAILABLE.action')
      case 'CACHE_DEGRADED':
        return t('health.remediation.CACHE_DEGRADED.action')
      case 'CLOCK_SKEWED':
        return t('health.remediation.CLOCK_SKEWED.action')
      case 'FS_SCOPE_MISSING':
        return t('health.remediation.FS_SCOPE_MISSING.action')
      case 'NONE':
        return t('health.remediation.NONE.action')
    }
  })()

  const statusLabel = (() => {
    switch (check.status) {
      case 'ok':
        return t('health.status.ok')
      case 'degraded':
        return t('health.status.degraded')
      case 'failed':
        return t('health.status.failed')
      case 'unknown':
        return t('health.status.unknown')
    }
  })()

  return (
    <View style={[s.card, isGlass && s.cardGlass]} testID={`server-health-check-${check.id}`}>
      <GlassFill />
      <View style={s.checkHeader}>
        <StatusIcon status={check.status} theme={theme} />
        <View style={s.checkHeaderBody}>
          <Text style={s.checkId}>{checkTitle}</Text>
          <Text style={s.checkStatus}>{statusLabel}</Text>
        </View>
      </View>
      <Text style={s.checkSummary}>{check.summary}</Text>
      {check.detail
        ? Object.entries(check.detail).map(([k, v]) => (
            <Text key={k} style={s.detailLine}>
              {`${k}: ${v === null ? '—' : String(v)}`}
            </Text>
          ))
        : null}
      {showRemediation ? (
        <View style={s.remediationBox} testID={`server-health-remediation-${check.remediation}`}>
          <Text style={s.remediationCode}>{check.remediation}</Text>
          <Text style={s.remediationTitle}>{remediationTitle}</Text>
          <Text style={s.remediationAction}>{remediationAction}</Text>
        </View>
      ) : null}
    </View>
  )
}

function styles(theme: Theme) {
  const warn = theme.text.warning
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg.primary },
    content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
    centeredInline: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
    emptyTitle: { color: theme.text.primary, fontSize: font.lg, fontWeight: '600', textAlign: 'center' },
    emptyBody: { color: theme.text.secondary, fontSize: font.base, textAlign: 'center', lineHeight: 21 },
    loadingText: { color: theme.text.secondary, fontSize: font.base },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
    heading: { color: theme.text.primary, fontSize: font.xl, fontWeight: '700' },
    subtitle: { color: theme.text.secondary, fontSize: font.base, lineHeight: 21, marginBottom: spacing.xs },
    serverChips: { gap: spacing.xs, paddingVertical: spacing.xs },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      minHeight: MIN_TOUCH_TARGET,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg.card,
      justifyContent: 'center',
      maxWidth: 220,
    },
    chipSelected: { borderColor: theme.text.accent, backgroundColor: theme.bg.secondary },
    chipText: { color: theme.text.secondary, fontSize: font.sm },
    chipTextSelected: { color: theme.text.accent, fontWeight: '600' },
    toolbar: { flexDirection: 'row', justifyContent: 'flex-end' },
    retryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minHeight: MIN_TOUCH_TARGET,
      paddingHorizontal: spacing.sm,
    },
    retryText: { color: theme.text.accent, fontSize: font.sm, fontWeight: '600' },
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
    overallRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    overallBody: { flex: 1, gap: 2 },
    overallLabel: { color: theme.text.secondary, fontSize: font.xs },
    overallValue: { color: theme.text.primary, fontSize: font.lg, fontWeight: '700' },
    metaLine: { color: theme.text.secondary, fontSize: font.xs },
    checkHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    checkHeaderBody: { flex: 1 },
    checkId: { color: theme.text.primary, fontSize: font.base, fontWeight: '600' },
    checkStatus: { color: theme.text.secondary, fontSize: font.xs },
    checkSummary: { color: theme.text.secondary, fontSize: font.sm, lineHeight: 20 },
    detailLine: { color: theme.text.secondary, fontSize: font.xs, fontFamily: 'monospace' },
    remediationBox: {
      marginTop: spacing.xs,
      padding: spacing.sm,
      borderRadius: radius.sm,
      backgroundColor: theme.bg.secondary,
      gap: 4,
    },
    remediationCode: { color: theme.text.secondary, fontSize: font.xs, fontFamily: 'monospace' },
    remediationTitle: { color: theme.text.primary, fontSize: font.sm, fontWeight: '600' },
    remediationAction: { color: theme.text.secondary, fontSize: font.sm, lineHeight: 19 },
    errorText: { color: theme.text.danger, fontSize: font.sm },
    warnText: { color: warn, fontSize: font.sm, lineHeight: 19 },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: theme.text.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      minHeight: MIN_TOUCH_TARGET,
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
      minHeight: MIN_TOUCH_TARGET,
    },
    secondaryBtnText: { color: theme.text.accent, fontSize: font.base, fontWeight: '600' },
  })
}
