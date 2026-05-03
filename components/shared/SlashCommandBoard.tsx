import React, { useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native'
import { Terminal, CaretRight } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { dark, font, radius, spacing } from '@/constants/theme'
import { SLASH_COMMANDS, type SlashCommand } from '@/constants/slashCommands'

interface Props {
  /** Whether the board is visible */
  visible: boolean
  /** The current text after the slash — used to filter commands */
  query: string
  /** Called when user taps a command */
  onSelect: (command: SlashCommand) => void
  /** Called when the backdrop is tapped */
  onDismiss: () => void
}

export function SlashCommandBoard({ visible, query, onSelect, onDismiss }: Props) {
  const { t } = useTranslation('shared')
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return SLASH_COMMANDS
    return SLASH_COMMANDS.filter(
      (c) =>
        c.id.includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q),
    )
  }, [query])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      {/* Tapping outside dismisses without sending */}
      <Pressable style={styles.backdrop} onPress={onDismiss} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Terminal size={15} color={dark.text.accent} />
            <Text style={styles.headerTitle}>{t('commands.title')}</Text>
          </View>
          {query.length > 0 && (
            <Text style={styles.queryBadge}>/{query}</Text>
          )}
        </View>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('commands.empty', { query })}</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <CommandRow command={item} onPress={() => onSelect(item)} />
            )}
            style={styles.list}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  )
}

interface RowProps {
  command: SlashCommand
  onPress: () => void
}

function CommandRow({ command, onPress }: RowProps) {
  const { t } = useTranslation('shared')
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`${command.title} command: ${command.description}`}
    >
      <View style={styles.iconWrap}>
        <command.icon size={18} color={dark.text.accent} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTitleRow}>
          <Text style={styles.commandSlash}>/</Text>
          <Text style={styles.commandTitle}>{command.id}</Text>
          {command.needsArgs && (
            <Text style={styles.argsBadge}>{t('commands.argsBadge')}</Text>
          )}
        </View>
        <Text style={styles.commandDesc} numberOfLines={1}>
          {command.description}
        </Text>
      </View>
      <CaretRight size={14} color={dark.text.secondary} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: dark.bg.secondary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: dark.border,
    maxHeight: '55%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: dark.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerTitle: {
    color: dark.text.secondary,
    fontSize: font.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  queryBadge: {
    color: dark.text.accent,
    fontSize: font.xs,
    fontFamily: 'monospace',
    backgroundColor: `${dark.text.accent}18`,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  list: { flexGrow: 0 },
  empty: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: dark.text.secondary,
    fontSize: font.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.border,
    minHeight: 56,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: `${dark.text.accent}18`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  commandSlash: {
    color: dark.text.accent,
    fontSize: font.base,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  commandTitle: {
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '600',
  },
  argsBadge: {
    color: dark.text.warning,
    fontSize: font.xs,
    marginLeft: spacing.xs,
    backgroundColor: `${dark.text.warning}18`,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  commandDesc: {
    color: dark.text.secondary,
    fontSize: font.sm,
  },
})
