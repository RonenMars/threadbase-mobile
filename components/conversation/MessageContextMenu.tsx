import React, { createContext, useContext, useMemo, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native'
import ContextMenu, { type ContextMenuAction } from 'react-native-context-menu-view'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { useTranslation } from 'react-i18next'
import { font, spacing, type Theme } from '@/constants/theme'
import { useThemedStyles } from '@/hooks/useThemedStyles'
import { messageCodeBlocks, messageMarkdown, messagePlainText } from '@/lib/messageText'
import type { Message } from '@/types/api'

/** Set by a screen that has a composer; without it the Quote item is hidden. */
export const MessageQuoteContext = createContext<((text: string) => void) | null>(null)

type MenuKey = 'copy' | 'selectText' | 'copyMarkdown' | 'copyCode' | 'quote'

interface Props {
  message: Message
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}

async function copy(text: string) {
  try {
    await Clipboard.setStringAsync(text)
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  } catch {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  }
}

/** Long-press native menu on a chat bubble: copy, select, quote. */
export function MessageContextMenu({ message, style, children }: Props) {
  const { t } = useTranslation('conversation')
  const { styles } = useThemedStyles(makeStyles)
  const onQuote = useContext(MessageQuoteContext)
  const [selecting, setSelecting] = useState(false)

  const code = useMemo(() => messageCodeBlocks(message), [message])
  const actions: (ContextMenuAction & { key: MenuKey })[] = [
    { key: 'copy', title: t('messageMenu.copy'), systemIcon: 'doc.on.doc' },
    { key: 'selectText', title: t('messageMenu.selectText'), systemIcon: 'character.cursor.ibeam' },
    { key: 'copyMarkdown', title: t('messageMenu.copyMarkdown'), systemIcon: 'number' },
    ...(code
      ? [{ key: 'copyCode' as const, title: t('messageMenu.copyCode'), systemIcon: 'chevron.left.forwardslash.chevron.right' }]
      : []),
    ...(onQuote ? [{ key: 'quote' as const, title: t('messageMenu.quote'), systemIcon: 'text.quote' }] : []),
  ]

  const run = (key: MenuKey) => {
    switch (key) {
      case 'copy':
        return copy(messagePlainText(message))
      case 'selectText':
        return setSelecting(true)
      case 'copyMarkdown':
        return copy(messageMarkdown(message))
      case 'copyCode':
        return copy(code)
      case 'quote':
        return onQuote?.(messagePlainText(message))
    }
  }

  return (
    <>
      <ContextMenu
        actions={actions}
        onPress={(e) => {
          const action = actions[e.nativeEvent.index]
          if (action) void run(action.key)
        }}
        previewBackgroundColor="transparent"
        style={style}
        testID="message-context-menu"
      >
        {children}
      </ContextMenu>
      <Modal visible={selecting} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelecting(false)}>
        <View style={styles.sheet} testID="message-select-sheet">
          <View style={styles.header}>
            <Text style={styles.title}>{t('messageMenu.selectTitle')}</Text>
            <Pressable onPress={() => setSelecting(false)} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.done}>{t('messageMenu.done')}</Text>
            </Pressable>
          </View>
          <TextInput
            testID="message-select-text"
            style={styles.text}
            value={messagePlainText(message)}
            multiline
            editable={false}
            scrollEnabled
            showSoftInputOnFocus={false}
          />
        </View>
      </Modal>
    </>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    sheet: { flex: 1, backgroundColor: theme.bg.primary, padding: spacing.md },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    title: { color: theme.text.primary, fontSize: font.lg, fontWeight: '600' },
    done: { color: theme.text.accent, fontSize: font.base, fontWeight: '600' },
    text: { flex: 1, color: theme.text.primary, fontSize: font.base, textAlignVertical: 'top' },
  })
}
