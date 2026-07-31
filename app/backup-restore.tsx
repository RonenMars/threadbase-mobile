import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Share,
  TextInput,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import { useTranslation } from 'react-i18next'
import { Archive, ArrowsClockwise, Warning } from 'phosphor-react-native'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { MIN_TOUCH_TARGET } from '@/constants/a11y'
import { useServersStore } from '@/stores/servers'
import { useBackupRestore } from '@/hooks/useBackup'
import { archiveToShareText, exportBackup, RestoreConflictError } from '@/services/backup'
import {
  parseBackupArchive,
  type BackupArchive,
  type RestoreDryRunResponse,
  type RestorePlan,
} from '@/types/backup'
import { NetworkError } from '@/services/api-client'

export default function BackupRestoreScreen() {
  const { t } = useTranslation(['settings', 'common'])
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

  const restore = useBackupRestore(selectedId)

  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState<BackupArchive | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [pathFrom, setPathFrom] = useState('')
  const [pathTo, setPathTo] = useState('')
  const [dryRun, setDryRun] = useState<RestoreDryRunResponse | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const pathMap = useMemo(() => {
    const from = pathFrom.trim()
    const to = pathTo.trim()
    if (!from || !to) return undefined
    return [{ from, to }]
  }, [pathFrom, pathTo])

  const handleExport = useCallback(async () => {
    if (!selectedId) return
    setExporting(true)
    setActionError(null)
    setActionMsg(null)
    try {
      const archive = await exportBackup(selectedId)
      setExported(archive)
      setActionMsg(t('backup.exported', { count: archive.manifest.counts.projects }))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('backup.exportFailed'))
    } finally {
      setExporting(false)
    }
  }, [selectedId, t])

  const handleShareExport = useCallback(async () => {
    if (!exported) return
    try {
      await Share.share({ message: archiveToShareText(exported) })
    } catch {
      setActionError(t('backup.shareFailed'))
    }
  }, [exported, t])

  const handleCopyExport = useCallback(async () => {
    if (!exported) return
    try {
      await Clipboard.setStringAsync(archiveToShareText(exported))
      setActionMsg(t('backup.copied'))
    } catch {
      setActionError(t('backup.copyFailed'))
    }
  }, [exported, t])

  const resolveArchiveFromPaste = useCallback((): BackupArchive | null => {
    const trimmed = pasteText.trim()
    if (!trimmed) {
      setActionError(t('backup.pasteRequired'))
      return null
    }
    let parsedJson: object
    try {
      parsedJson = JSON.parse(trimmed) as object
    } catch {
      setActionError(t('backup.invalidJson'))
      return null
    }
    const archive = parseBackupArchive(parsedJson)
    if (!archive) {
      setActionError(t('backup.invalidArchive'))
      return null
    }
    return archive
  }, [pasteText, t])

  const handleDryRun = useCallback(async () => {
    if (!selectedId) return
    const archive = resolveArchiveFromPaste()
    if (!archive) return
    setActionError(null)
    setActionMsg(null)
    setDryRun(null)
    try {
      const result = await restore.mutateAsync({ archive, apply: false, pathMap })
      if (result.applied) {
        setActionError(t('backup.unexpectedApply'))
        return
      }
      setDryRun(result)
      setActionMsg(t('backup.dryRunReady'))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('backup.dryRunFailed'))
    }
  }, [pathMap, resolveArchiveFromPaste, restore, selectedId, t])

  const handleApply = useCallback(() => {
    if (!selectedId || !dryRun) return
    const archive = resolveArchiveFromPaste()
    if (!archive) return

    Alert.alert(t('backup.applyTitle'), t('backup.applyBody'), [
      { text: t('common:button.cancel'), style: 'cancel' },
      {
        text: t('backup.applyConfirm'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setActionError(null)
            setActionMsg(null)
            try {
              const result = await restore.mutateAsync({ archive, apply: true, pathMap })
              if (!result.applied) {
                setActionError(t('backup.applyFailed'))
                return
              }
              setActionMsg(t('backup.applied', { count: result.appliedCount }))
              setDryRun(null)
            } catch (err) {
              if (err instanceof RestoreConflictError) {
                setDryRun({ applied: false, summary: err.summary, plan: err.plan })
                setActionError(t('backup.conflict'))
                return
              }
              if (err instanceof NetworkError && err.code === 'RESTORE_CONFLICT') {
                setActionError(t('backup.conflict'))
                return
              }
              setActionError(err instanceof Error ? err.message : t('backup.applyFailed'))
            }
          })()
        },
      },
    ])
  }, [dryRun, pathMap, resolveArchiveFromPaste, restore, selectedId, t])

  if (serverIds.length === 0) {
    return (
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={s.centered}>
          <Text style={s.emptyTitle}>{t('backup.emptyTitle')}</Text>
          <Text style={s.emptyBody}>{t('backup.emptyBody')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.headerRow}>
          <Archive size={24} color={theme.text.accent} />
          <Text style={s.heading}>{t('backup.heading')}</Text>
        </View>
        <Text style={s.subtitle}>{t('backup.subtitle')}</Text>

        <View style={[s.card, isGlass && s.cardGlass]}>
          <GlassFill />
          <View style={s.warnRow}>
            <Warning size={18} color={theme.text.warning} />
            <Text style={s.warnText}>{t('backup.metadataOnly')}</Text>
          </View>
        </View>

        {serverIds.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {serverIds.map((id) => {
              const label = servers[id]?.label?.trim() || servers[id]?.url || id
              const selectedChip = id === selectedId
              return (
                <TouchableOpacity
                  key={id}
                  style={[s.chip, selectedChip && s.chipSelected]}
                  onPress={() => {
                    setPickedId(id)
                    setExported(null)
                    setDryRun(null)
                    setActionMsg(null)
                    setActionError(null)
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedChip }}
                  testID={`backup-chip-${id}`}
                >
                  <Text style={[s.chipText, selectedChip && s.chipTextSelected]} numberOfLines={1}>
                    {label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        ) : null}

        <Text style={s.sectionLabel}>{t('backup.exportSection')}</Text>
        <View style={s.toolbar}>
          <TouchableOpacity
            style={s.toolbarBtn}
            onPress={() => void handleExport()}
            disabled={exporting}
            accessibilityRole="button"
            testID="backup-export"
          >
            {exporting ? (
              <ActivityIndicator size="small" color={theme.text.accent} />
            ) : (
              <ArrowsClockwise size={18} color={theme.text.accent} />
            )}
            <Text style={s.toolbarBtnText}>
              {exporting ? t('backup.exporting') : t('backup.export')}
            </Text>
          </TouchableOpacity>
          {exported ? (
            <>
              <TouchableOpacity style={s.toolbarBtn} onPress={() => void handleCopyExport()} testID="backup-copy">
                <Text style={s.toolbarBtnText}>{t('backup.copy')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.toolbarBtn} onPress={() => void handleShareExport()} testID="backup-share">
                <Text style={s.toolbarBtnText}>{t('backup.share')}</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>

        {exported ? (
          <View style={[s.card, isGlass && s.cardGlass]} testID="backup-export-summary">
            <GlassFill />
            <Text style={s.cardTitle}>{t('backup.manifestTitle')}</Text>
            <Text style={s.meta}>
              {t('backup.manifestHost', { host: exported.manifest.sourceHost })}
            </Text>
            <Text style={s.meta}>
              {t('backup.manifestVersion', { version: exported.manifest.streamerVersion })}
            </Text>
            <Text style={s.meta}>
              {t('backup.manifestProjects', { count: exported.manifest.counts.projects })}
            </Text>
            <Text style={s.meta}>
              {t('backup.manifestCreated', { at: exported.manifest.createdAt })}
            </Text>
          </View>
        ) : null}

        <Text style={s.sectionLabel}>{t('backup.restoreSection')}</Text>
        <Text style={s.helper}>{t('backup.pasteHint')}</Text>
        <TextInput
          style={s.pasteInput}
          value={pasteText}
          onChangeText={setPasteText}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t('backup.pastePlaceholder')}
          placeholderTextColor={theme.text.secondary}
          testID="backup-paste-input"
        />

        <Text style={s.helper}>{t('backup.pathMapHint')}</Text>
        <TextInput
          style={s.singleInput}
          value={pathFrom}
          onChangeText={setPathFrom}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t('backup.pathFrom')}
          placeholderTextColor={theme.text.secondary}
          testID="backup-path-from"
        />
        <TextInput
          style={s.singleInput}
          value={pathTo}
          onChangeText={setPathTo}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t('backup.pathTo')}
          placeholderTextColor={theme.text.secondary}
          testID="backup-path-to"
        />

        <View style={s.toolbar}>
          <TouchableOpacity
            style={s.toolbarBtn}
            onPress={() => void handleDryRun()}
            disabled={restore.isPending}
            accessibilityRole="button"
            testID="backup-dry-run"
          >
            <Text style={s.toolbarBtnText}>
              {restore.isPending ? t('backup.planning') : t('backup.dryRun')}
            </Text>
          </TouchableOpacity>
          {dryRun ? (
            <TouchableOpacity
              style={s.toolbarBtn}
              onPress={handleApply}
              disabled={restore.isPending || dryRun.summary.conflict > 0}
              accessibilityRole="button"
              testID="backup-apply"
            >
              <Text style={[s.toolbarBtnText, dryRun.summary.conflict > 0 && s.disabledText]}>
                {t('backup.apply')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {dryRun ? <PlanCard plan={dryRun.plan} summary={dryRun.summary} isGlass={isGlass} s={s} /> : null}

        {actionMsg ? <Text style={s.actionMsg} testID="backup-action-msg">{actionMsg}</Text> : null}
        {actionError ? (
          <Text style={s.errorText} testID="backup-action-error">
            {actionError}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function PlanCard({
  plan,
  summary,
  isGlass,
  s,
}: {
  plan: RestorePlan
  summary: { create: number; update: number; conflict: number }
  isGlass: boolean
  s: ReturnType<typeof styles>
}) {
  const { t } = useTranslation('settings')
  return (
    <View style={[s.card, isGlass && s.cardGlass]} testID="backup-plan">
      <GlassFill />
      <Text style={s.cardTitle}>{t('backup.planTitle')}</Text>
      <Text style={s.meta}>{t('backup.planSummary', summary)}</Text>
      {summary.conflict > 0 ? (
        <Text style={s.warnText}>{t('backup.conflictDetail')}</Text>
      ) : null}
      {plan.conflict.slice(0, 8).map((c) => (
        <Text key={`${c.incoming.id}-${c.existingId}`} style={s.meta}>
          {t('backup.conflictRow', {
            path: c.incoming.path,
            incoming: c.incoming.id.slice(0, 8),
            existing: c.existingId.slice(0, 8),
          })}
        </Text>
      ))}
      {plan.create.slice(0, 5).map((p) => (
        <Text key={`c-${p.id}`} style={s.meta}>
          {t('backup.createRow', { name: p.name ?? p.path })}
        </Text>
      ))}
      {plan.update.slice(0, 5).map((p) => (
        <Text key={`u-${p.id}`} style={s.meta}>
          {t('backup.updateRow', { name: p.name ?? p.path })}
        </Text>
      ))}
    </View>
  )
}

function styles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg.primary },
    content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      padding: spacing.lg,
    },
    emptyTitle: { color: theme.text.primary, fontSize: font.lg, fontWeight: '600', textAlign: 'center' },
    emptyBody: { color: theme.text.secondary, fontSize: font.base, textAlign: 'center', lineHeight: 21 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
    heading: { color: theme.text.primary, fontSize: font.xl, fontWeight: '700' },
    subtitle: { color: theme.text.secondary, fontSize: font.base, lineHeight: 21 },
    chips: { gap: spacing.xs, paddingVertical: spacing.xs },
    chip: {
      paddingHorizontal: spacing.md,
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
    sectionLabel: {
      color: theme.text.secondary,
      fontSize: font.xs,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: spacing.sm,
    },
    helper: { color: theme.text.secondary, fontSize: font.sm, lineHeight: 18 },
    toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    toolbarBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minHeight: MIN_TOUCH_TARGET,
      paddingHorizontal: spacing.sm,
    },
    toolbarBtnText: { color: theme.text.accent, fontSize: font.sm, fontWeight: '600' },
    disabledText: { opacity: 0.4 },
    card: {
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
      padding: spacing.md,
      gap: spacing.xs,
    },
    cardGlass: { backgroundColor: 'transparent' },
    cardTitle: { color: theme.text.primary, fontSize: font.base, fontWeight: '600' },
    meta: { color: theme.text.secondary, fontSize: font.xs, lineHeight: 16 },
    warnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    warnText: { flex: 1, color: theme.text.warning, fontSize: font.sm, lineHeight: 20 },
    pasteInput: {
      minHeight: 120,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      padding: spacing.sm,
      color: theme.text.primary,
      fontSize: font.sm,
      textAlignVertical: 'top',
      backgroundColor: theme.bg.card,
    },
    singleInput: {
      minHeight: MIN_TOUCH_TARGET,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      color: theme.text.primary,
      fontSize: font.sm,
      backgroundColor: theme.bg.card,
    },
    actionMsg: { color: theme.text.secondary, fontSize: font.sm },
    errorText: { color: theme.text.danger, fontSize: font.sm, lineHeight: 20 },
  })
}
