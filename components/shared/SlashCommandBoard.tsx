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
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useThemedStyles } from '@/hooks/useThemedStyles'
import { SLASH_COMMANDS, type SlashCommand } from '@/constants/slashCommands'
import type { RtlStyleKit } from '@/lib/rtl'

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
  const { styles, theme } = useThemedStyles(makeStyles)
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
            <Terminal size={15} color={theme.text.accent} />
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
              <CommandRow command={item} onPress={() => onSelect(item)} theme={theme} styles={styles} />
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
  theme: Theme
  styles: ReturnType<typeof makeStyles>
}

function CommandRow({ command, onPress, theme, styles }: RowProps) {
  const { t } = useTranslation('shared')
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`${command.title} command: ${command.description}`}
    >
      <View style={styles.iconWrap}>
        <command.icon size={18} color={theme.text.accent} />
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
      <CaretRight size={14} color={theme.text.secondary} />
    </TouchableOpacity>
  )
}

function makeStyles(theme: Theme, rtl: RtlStyleKit) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    sheet: {
      ...rtl.overlay,
      backgroundColor: theme.bg.secondary,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      borderTopWidth: 1,
      borderStartWidth: 1,
      borderEndWidth: 1,
      borderColor: theme.border,
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
      borderBottomColor: theme.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    headerTitle: {
      color: theme.text.secondary,
      fontSize: font.xs,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      ...rtl.copy,
    },
    queryBadge: {
      ...rtl.ltr,
      color: theme.text.accent,
      fontSize: font.xs,
      fontFamily: 'monospace',
      backgroundColor: `${theme.text.accent}18`,
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
      color: theme.text.secondary,
      fontSize: font.sm,
      ...rtl.copy,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      gap: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      minHeight: 56,
    },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: radius.sm,
      backgroundColor: `${theme.text.accent}18`,
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
      color: theme.text.accent,
      fontSize: font.base,
      fontWeight: '600',
      fontFamily: 'monospace',
    },
    commandTitle: {
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
      ...rtl.ltr,
    },
    argsBadge: {
      color: theme.text.warning,
      fontSize: font.xs,
      marginStart: spacing.xs,
      backgroundColor: `${theme.text.warning}18`,
      paddingHorizontal: spacing.xs,
      paddingVertical: 1,
      borderRadius: radius.sm,
      overflow: 'hidden',
    },
    commandDesc: {
      color: theme.text.secondary,
      fontSize: font.sm,
      ...rtl.copy,
    },
  })
}
