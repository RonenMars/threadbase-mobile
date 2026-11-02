import React from 'react'
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { At, CaretRight, File, Folder, X } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useThemedStyles } from '@/hooks/useThemedStyles'
import { useMentionEntries, type MentionListState } from '@/hooks/useMentionEntries'
import type { ComposerMention } from '@/hooks/useFileMentions'
import type { MentionEntry } from '@/lib/mentionToken'
import type { RtlStyleKit } from '@/lib/rtl'

interface BoardProps {
  /** Directory being listed, relative to the session cwd; '' for the cwd. */
  dir: string
  query: string
  list: MentionListState
  onSelect: (entry: MentionEntry) => void
  onDismiss: () => void
}

/**
 * Inline, inside the composer rather than a Modal: it rides the keyboard lift
 * with the input, and it can show over the expanded editor, which a second
 * Modal cannot on iOS.
 */
export function FileMentionBoard({ dir, query, list, onSelect, onDismiss }: BoardProps) {
  const { t } = useTranslation('terminal')
  const { styles, theme } = useThemedStyles(makeStyles)
  const location = dir ? `${dir}/` : './'

  let body: React.ReactNode
  if (list.status === 'loading') {
    body = (
      <View style={styles.message}>
        <ActivityIndicator size="small" color={theme.text.secondary} />
      </View>
    )
  } else if (list.status === 'unsupported') {
    body = <Text style={[styles.message, styles.messageText]}>{t('mentions.unsupported')}</Text>
  } else if (list.status === 'error') {
    body = <Text style={[styles.message, styles.messageText]}>{t('mentions.error')}</Text>
  } else if (list.entries.length === 0) {
    const emptyText = query ? t('mentions.empty', { query }) : t('mentions.emptyFolder')
    body = <Text style={[styles.message, styles.messageText]}>{emptyText}</Text>
  } else {
    body = (
      <FlatList
        data={list.entries}
        keyExtractor={(item) => `${item.kind}:${item.name}`}
        renderItem={({ item }) => <EntryRow entry={item} onPress={() => onSelect(item)} theme={theme} styles={styles} />}
        style={styles.list}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      />
    )
  }

  return (
    <View style={styles.board} testID="file-mention-board">
      <View style={styles.header}>
        <At size={14} color={theme.text.accent} />
        <Text style={styles.location} numberOfLines={1} ellipsizeMode="head">
          {location}
        </Text>
        <TouchableOpacity
          testID="file-mention-close"
          onPress={onDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('mentions.close')}
        >
          <X size={14} color={theme.text.secondary} />
        </TouchableOpacity>
      </View>
      {body}
    </View>
  )
}

interface RowProps {
  entry: MentionEntry
  onPress: () => void
  theme: Theme
  styles: ReturnType<typeof makeStyles>
}

function EntryRow({ entry, onPress, theme, styles }: RowProps) {
  const { t } = useTranslation('terminal')
  const isDir = entry.kind === 'dir'
  const label = isDir ? t('mentions.folderLabel', { name: entry.name }) : t('mentions.fileLabel', { name: entry.name })
  return (
    <TouchableOpacity
      testID={`file-mention-row-${entry.name}`}
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {isDir ? (
        <Folder size={16} color={theme.text.accent} weight="fill" />
      ) : (
        <File size={16} color={theme.text.secondary} />
      )}
      <Text style={styles.name} numberOfLines={1}>
        {entry.name}
      </Text>
      {isDir ? <CaretRight size={12} color={theme.text.secondary} /> : null}
    </TouchableOpacity>
  )
}

/** Fetches the listing; mounted only while a mention is open, so a closed picker costs nothing. */
export function FileMentionPanel({ mention }: { mention: ComposerMention }) {
  const { serverId, projectPath, token, onSelect, onDismiss } = mention
  const list = useMentionEntries(serverId, projectPath, token.dir, token.query)
  return <FileMentionBoard dir={token.dir} query={token.query} list={list} onSelect={onSelect} onDismiss={onDismiss} />
}

function makeStyles(theme: Theme, rtl: RtlStyleKit) {
  return StyleSheet.create({
    board: {
      backgroundColor: theme.bg.secondary,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    location: {
      ...rtl.ltr,
      flex: 1,
      color: theme.text.secondary,
      fontSize: font.xs,
      fontFamily: 'monospace',
    },
    // About five rows; the composer must stay on screen above the keyboard.
    list: { maxHeight: 200, flexGrow: 0 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
      minHeight: 40,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    name: {
      ...rtl.ltr,
      flex: 1,
      color: theme.text.primary,
      fontSize: font.sm,
    },
    message: {
      padding: spacing.md,
      alignItems: 'center',
    },
    messageText: {
      ...rtl.copy,
      color: theme.text.secondary,
      fontSize: font.sm,
    },
  })
}
