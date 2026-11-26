import React from 'react'
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { At, CaretRight, File, Folder, Lightning, UsersThree, X } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useThemedStyles } from '@/hooks/useThemedStyles'
import { useMentionEntries, usePeerEntries, type MentionListState } from '@/hooks/useMentionEntries'
import { useSkillEntries } from '@/hooks/useSkillEntries'
import type { ComposerMention, ComposerSlash } from '@/hooks/useFileMentions'
import type { MentionEntry, PeerEntry } from '@/lib/mentionToken'
import type { SkillEntry } from '@/lib/slashToken'
import type { RtlStyleKit } from '@/lib/rtl'

interface BoardProps {
  /** Directory being listed, relative to the session cwd; '' for the cwd. */
  dir: string
  query: string
  list: MentionListState
  /** Peer sessions, listed above the paths; none for an older streamer. */
  peers?: PeerEntry[]
  onSelect: (entry: MentionEntry) => void
  onSelectPeer?: (peer: PeerEntry) => void
  onDismiss: () => void
}

/**
 * Inline, inside the composer rather than a Modal: it rides the keyboard lift
 * with the input, and it can show over the expanded editor, which a second
 * Modal cannot on iOS.
 */
export function FileMentionBoard({ dir, query, list, peers = [], onSelect, onSelectPeer, onDismiss }: BoardProps) {
  const { t } = useTranslation('terminal')
  const { styles, theme } = useThemedStyles(makeStyles)
  const location = dir ? `${dir}/` : './'

  // Peers do not depend on the folder listing, so they show while it loads or fails.
  let message: React.ReactNode = null
  if (list.status === 'loading') {
    message = <BoardMessage />
  } else if (list.status === 'unsupported') {
    message = <BoardMessage text={t('mentions.unsupported')} />
  } else if (list.status === 'error') {
    message = <BoardMessage text={t('mentions.error')} />
  } else if (list.entries.length === 0 && peers.length === 0) {
    message = <BoardMessage text={query ? t('mentions.empty', { query }) : t('mentions.emptyFolder')} />
  }
  const entries = list.status === 'ready' ? list.entries : []

  const body =
    peers.length === 0 && entries.length === 0 ? (
      message
    ) : (
      <FlatList
        data={[...peers.map((peer) => ({ peer })), ...entries.map((entry) => ({ entry }))]}
        keyExtractor={(item) => ('peer' in item ? `peer:${item.peer.id}` : `${item.entry.kind}:${item.entry.name}`)}
        renderItem={({ item }) =>
          'peer' in item ? (
            <PeerRow peer={item.peer} onPress={() => onSelectPeer?.(item.peer)} theme={theme} styles={styles} />
          ) : (
            <EntryRow entry={item.entry} onPress={() => onSelect(item.entry)} theme={theme} styles={styles} />
          )
        }
        ListFooterComponent={message ?? undefined}
        style={styles.list}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      />
    )

  return (
    <MentionBoardShell
      testIDPrefix="file-mention"
      icon={<At size={14} color={theme.text.accent} />}
      title={location}
      closeLabel={t('mentions.close')}
      onDismiss={onDismiss}
    >
      {body}
    </MentionBoardShell>
  )
}

interface ShellProps {
  testIDPrefix: string
  icon: React.ReactNode
  title: string
  closeLabel: string
  onDismiss: () => void
  children: React.ReactNode
}

/** Header with a close X over the body; shared by the `@` and `/` pickers. */
function MentionBoardShell({ testIDPrefix, icon, title, closeLabel, onDismiss, children }: ShellProps) {
  const { styles, theme } = useThemedStyles(makeStyles)
  return (
    <View style={styles.board} testID={`${testIDPrefix}-board`}>
      <View style={styles.header}>
        {icon}
        <Text style={styles.location} numberOfLines={1} ellipsizeMode="head">
          {title}
        </Text>
        <TouchableOpacity
          testID={`${testIDPrefix}-close`}
          onPress={onDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
        >
          <X size={14} color={theme.text.secondary} />
        </TouchableOpacity>
      </View>
      {children}
    </View>
  )
}

/** A line of text in place of the list; no text shows the loading spinner. */
function BoardMessage({ text }: { text?: string }) {
  const { styles, theme } = useThemedStyles(makeStyles)
  if (text === undefined) {
    return (
      <View style={styles.message}>
        <ActivityIndicator size="small" color={theme.text.secondary} />
      </View>
    )
  }
  return <Text style={[styles.message, styles.messageText]}>{text}</Text>
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

function PeerRow({ peer, onPress, theme, styles }: { peer: PeerEntry; onPress: () => void; theme: Theme; styles: ReturnType<typeof makeStyles> }) {
  const { t } = useTranslation('terminal')
  return (
    <TouchableOpacity
      testID={`peer-mention-row-${peer.id}`}
      style={styles.peerRow}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={t('mentions.peerLabel', { name: peer.name, project: peer.projectName })}
    >
      <View style={styles.peerContent} pointerEvents="none">
        <UsersThree size={16} color={theme.text.accent} weight="fill" />
        <View style={styles.skillText}>
          <View style={styles.peerTitle}>
            <Text style={[styles.name, styles.peerName]} numberOfLines={1}>
              {peer.name}
            </Text>
            <Text style={styles.peerTag}>{t('mentions.peerTag')}</Text>
          </View>
          <Text style={styles.description} numberOfLines={1}>
            {`${peer.projectName} · ${peer.shortId}`}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

/** Fetches the listing; mounted only while a mention is open, so a closed picker costs nothing. */
export function FileMentionPanel({ mention }: { mention: ComposerMention }) {
  const { serverId, sessionId, projectPath, additionalPaths, token, onSelect, onSelectPeer, onDismiss } = mention
  const list = useMentionEntries(serverId, projectPath, sessionId, token.dir, token.query, additionalPaths)
  const peers = usePeerEntries(serverId, sessionId, token.dir, token.query)
  return (
    <FileMentionBoard
      dir={token.dir}
      query={token.query}
      list={list}
      peers={peers}
      onSelect={onSelect}
      onSelectPeer={onSelectPeer}
      onDismiss={onDismiss}
    />
  )
}

/** The `/` picker: the session's Claude Code skills and commands. */
export function SkillMentionPanel({ slash }: { slash: ComposerSlash }) {
  const { t } = useTranslation('terminal')
  const { styles, theme } = useThemedStyles(makeStyles)
  const { token, onSelect, onDismiss } = slash
  const list = useSkillEntries(slash.serverId, slash.sessionId, token.query)

  let body: React.ReactNode
  if (list.status === 'loading') {
    body = <BoardMessage />
  } else if (list.status === 'unsupported') {
    body = <BoardMessage text={t('skills.unsupported')} />
  } else if (list.status === 'error') {
    body = <BoardMessage text={t('skills.error')} />
  } else if (list.skills.length === 0) {
    body = <BoardMessage text={token.query ? t('skills.empty', { query: token.query }) : t('skills.none')} />
  } else {
    body = (
      <FlatList
        data={list.skills}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => <SkillRow skill={item} onPress={() => onSelect(item)} styles={styles} />}
        style={styles.list}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      />
    )
  }

  return (
    <MentionBoardShell
      testIDPrefix="skill-mention"
      icon={<Lightning size={14} color={theme.text.accent} />}
      title={t('skills.title')}
      closeLabel={t('skills.close')}
      onDismiss={onDismiss}
    >
      {body}
    </MentionBoardShell>
  )
}

function SkillRow({ skill, onPress, styles }: { skill: SkillEntry; onPress: () => void; styles: ReturnType<typeof makeStyles> }) {
  return (
    <TouchableOpacity
      testID={`skill-mention-row-${skill.name}`}
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={skill.description ? `${skill.name}, ${skill.description}` : skill.name}
    >
      <View style={styles.skillText}>
        <Text style={styles.name} numberOfLines={1}>
          {skill.name}
        </Text>
        {skill.description ? (
          <Text style={styles.description} numberOfLines={1}>
            {skill.description}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  )
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
    skillText: { flex: 1, paddingVertical: spacing.xs },
    // PeerRow's own pair, so its layout holds whatever the file and skill row styles carry.
    peerRow: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    peerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
      minHeight: 40,
    },
    peerTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    peerName: { flex: 0, flexShrink: 1, fontWeight: '600' },
    peerTag: {
      ...rtl.copy,
      color: theme.text.accent,
      fontSize: font.xs,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.text.accent,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.xs,
      overflow: 'hidden',
    },
    description: {
      ...rtl.copy,
      color: theme.text.secondary,
      fontSize: font.xs,
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
