import React, { useMemo, useState } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useTranslation } from 'react-i18next'
import { FileCode, CopySimple, PaperPlaneTilt, X } from 'phosphor-react-native'
import * as Clipboard from 'expo-clipboard'
import { DiffViewer } from '@/components/conversation/DiffViewer'
import {
  buildReviewFromMessages,
  formatReviewNote,
  type ReviewFile,
  type ReviewFileKind,
} from '@/lib/reviewFromConversation'
import type { Message } from '@/types/api'
import { useTheme } from '@/contexts/ThemeContext'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { MIN_TOUCH_TARGET } from '@/constants/a11y'
import { ltrContentStyle, textDirectionStyle, useAppDirection, useDirectionStyle } from '@/lib/rtl'

type FilterKind = 'all' | ReviewFileKind

interface Props {
  visible: boolean
  messages: Message[]
  projectPath?: string
  machineName?: string
  canSendNote?: boolean
  onClose: () => void
  onSendNote?: (note: string) => void
}

export function ReviewSheet({
  visible,
  messages,
  projectPath,
  machineName,
  canSendNote = false,
  onClose,
  onSendNote,
}: Props) {
  const { t } = useTranslation('conversation')
  const theme = useTheme()
  const directionStyle = useDirectionStyle()
  const { direction } = useAppDirection()
  const copyStyle = textDirectionStyle(direction)
  const styles = makeStyles(theme)
  const [filter, setFilter] = useState<FilterKind>('all')
  const [query, setQuery] = useState('')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  const summary = useMemo(() => buildReviewFromMessages(messages), [messages])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return summary.files.filter((f) => {
      if (filter !== 'all' && f.kind !== filter) return false
      if (q && !f.path.toLowerCase().includes(q)) return false
      return true
    })
  }, [summary.files, filter, query])

  const selected: ReviewFile | undefined = selectedPath
    ? summary.files.find((f) => f.path === selectedPath)
    : undefined

  const handoffPacket = useMemo(() => {
    const lines = [
      machineName ? `machine: ${machineName}` : null,
      projectPath ? `project: ${projectPath}` : null,
      `files: ${summary.files.length}`,
      ...summary.files.slice(0, 30).map((f) => f.path),
    ].filter(Boolean)
    return lines.join('\n')
  }, [machineName, projectPath, summary.files])

  const copyHandoff = async () => {
    await Clipboard.setStringAsync(handoffPacket)
  }

  const sendNote = () => {
    if (!onSendNote) return
    const note = formatReviewNote(summary, selectedPath ?? undefined)
    onSendNote(note)
  }

  const kindLabel = (kind: ReviewFileKind) => {
    if (kind === 'edited') return t('review.kindEdited')
    if (kind === 'written') return t('review.kindWritten')
    if (kind === 'diff') return t('review.kindDiff')
    return t('review.kindUnknown')
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, directionStyle]} testID="review-sheet">
        <View style={styles.header}>
          <Text style={[styles.title, copyStyle]}>{t('review.title')}</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" hitSlop={8} style={{ minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' }}>
            <X size={22} color={theme.text.secondary} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.summary, copyStyle]}>
          {t('review.summary', {
            files: summary.files.length,
            added: summary.totalAdded,
            removed: summary.totalRemoved,
          })}
        </Text>

        {summary.incomplete ? (
          <Text style={[styles.warning, copyStyle]} testID="review-incomplete-warning">
            {t('review.incompleteWarning')}
          </Text>
        ) : null}
        {summary.hasOversized ? (
          <Text style={[styles.warning, copyStyle]}>{t('review.oversizedWarning')}</Text>
        ) : null}

        <View style={styles.filters}>
          {(['all', 'edited', 'written', 'diff'] as FilterKind[]).map((k) => (
            <TouchableOpacity
              key={k}
              onPress={() => setFilter(k)}
              style={[styles.chip, filter === k && styles.chipActive]}
            >
              <Text style={[styles.chipText, copyStyle, filter === k && styles.chipTextActive]}>
                {k === 'all' ? t('review.filterAll') : kindLabel(k)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('review.searchPlaceholder')}
          placeholderTextColor={theme.text.secondary}
          style={[styles.search, copyStyle]}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.body}>
          <View style={styles.listPane}>
            <FlashList
              data={filtered}
              keyExtractor={(item) => item.path}
              ListEmptyComponent={
                <Text style={[styles.empty, copyStyle]}>{t('review.empty')}</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => setSelectedPath(item.path)}
                  style={[styles.row, selectedPath === item.path && styles.rowActive]}
                  testID="review-file-row"
                >
                  <FileCode size={16} color={theme.text.secondary} />
                  <View style={styles.rowText}>
                    <Text style={[styles.path, ltrContentStyle]} numberOfLines={1}>{item.path}</Text>
                    <Text style={[styles.meta, copyStyle]}>
                      {t('review.fileMeta', {
                        kind: kindLabel(item.kind),
                        added: item.added,
                        removed: item.removed,
                      })}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>

          <ScrollView style={styles.diffPane} contentContainerStyle={styles.diffContent}>
            {selected ? (
              <DiffViewer
                filename={selected.path}
                hunks={selected.hunks}
                recycleKey={selected.path}
              />
            ) : (
              <Text style={[styles.empty, copyStyle]}>{t('review.selectFile')}</Text>
            )}
          </ScrollView>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={copyHandoff}
            style={styles.actionBtn}
            accessibilityRole="button"
            testID="review-copy-handoff"
          >
            <CopySimple size={16} color={theme.text.accent} />
            <Text style={[styles.actionText, copyStyle]}>{t('review.copyHandoff')}</Text>
          </TouchableOpacity>
          {canSendNote ? (
            <TouchableOpacity
              onPress={() => {
                if (!onSendNote) return
                Alert.alert(t('review.sendNoteTitle'), t('review.sendNoteBody'), [
                  { text: t('review.cancel'), style: 'cancel' },
                  { text: t('review.send'), onPress: sendNote },
                ])
              }}
              style={styles.actionBtn}
              accessibilityRole="button"
              testID="review-send-note"
            >
              <PaperPlaneTilt size={16} color={theme.text.accent} />
            <Text style={[styles.actionText, copyStyle]}>{t('review.sendNote')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.bg.primary, paddingTop: spacing.md },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
    title: { color: theme.text.primary, fontSize: font.lg, fontWeight: '700' },
    summary: {
      color: theme.text.secondary,
      fontSize: font.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.xs,
    },
    warning: {
      color: theme.text.warning,
      fontSize: font.xs,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.xs,
      lineHeight: 16,
    },
    filters: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
    chip: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.full ?? 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    chipActive: { backgroundColor: theme.bg.secondary, borderColor: theme.text.accent },
    chipText: { color: theme.text.secondary, fontSize: font.xs },
    chipTextActive: { color: theme.text.accent, fontWeight: '600' },
    search: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: 8,
      color: theme.text.primary,
      fontSize: font.sm,
    },
    body: { flex: 1 },
    listPane: { flex: 1, minHeight: 160, borderBottomWidth: 1, borderBottomColor: theme.border },
    diffPane: { flex: 1.2 },
    diffContent: { padding: spacing.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    rowActive: { backgroundColor: theme.bg.secondary },
    rowText: { flex: 1, gap: 2 },
    path: { color: theme.text.primary, fontSize: font.sm, fontFamily: 'monospace' },
    meta: { color: theme.text.secondary, fontSize: font.xs },
    empty: {
      color: theme.text.secondary,
      fontSize: font.sm,
      padding: spacing.lg,
      textAlign: 'center',
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionText: { color: theme.text.accent, fontSize: font.sm, fontWeight: '600' },
  })
}
