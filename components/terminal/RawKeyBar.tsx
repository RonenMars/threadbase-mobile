import React from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowElbowDownLeft } from 'phosphor-react-native'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

// Universal raw-keystroke fallback. Output analysis can never enumerate every
// interactive prompt (slash pickers, plugin prompts, script y/n), so this bar
// lets the user drive ANY waiting PTY prompt by hand: digits, y/n, arrows,
// Enter, Esc — sent as raw bytes via the /input { keys } route. Works in both
// LiveConversationView and TerminalView. Intentionally NOT gated by the
// composer's `disabled` (waking-up) state — the whole point is to answer a
// prompt that's blocking right now.

interface KeyDef {
  label?: string
  icon?: 'up' | 'down' | 'left' | 'right' | 'enter'
  keys: string
  a11y: string
}

const ESC = '\x1b'
const KEYS: KeyDef[] = [
  { label: '1', keys: '1', a11y: 'Send 1' },
  { label: '2', keys: '2', a11y: 'Send 2' },
  { label: '3', keys: '3', a11y: 'Send 3' },
  { label: 'y', keys: 'y', a11y: 'Send y' },
  { label: 'n', keys: 'n', a11y: 'Send n' },
  { icon: 'up', keys: '\x1b[A', a11y: 'Arrow up' },
  { icon: 'down', keys: '\x1b[B', a11y: 'Arrow down' },
  { icon: 'left', keys: '\x1b[D', a11y: 'Arrow left' },
  { icon: 'right', keys: '\x1b[C', a11y: 'Arrow right' },
  { icon: 'enter', keys: '\r', a11y: 'Enter' },
  { label: 'Esc', keys: ESC, a11y: 'Escape' },
]

function KeyIcon({ name, color }: { name: NonNullable<KeyDef['icon']>; color: string }) {
  const size = font.base
  if (name === 'up') return <ArrowUp size={size} color={color} weight="bold" />
  if (name === 'down') return <ArrowDown size={size} color={color} weight="bold" />
  if (name === 'left') return <ArrowLeft size={size} color={color} weight="bold" />
  if (name === 'right') return <ArrowRight size={size} color={color} weight="bold" />
  return <ArrowElbowDownLeft size={size} color={color} weight="bold" />
}

export function RawKeyBar({ onSendKeys }: { onSendKeys: (keys: string) => void }) {
  const theme = useTheme()
  const styles = makeStyles(theme)

  const press = (keys: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onSendKeys(keys)
  }

  return (
    <View style={styles.wrapper} testID="raw-key-bar">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {KEYS.map((k, i) => (
          <TouchableOpacity
            key={i}
            style={styles.key}
            onPress={() => press(k.keys)}
            accessibilityRole="button"
            accessibilityLabel={k.a11y}
          >
            {k.icon ? (
              <KeyIcon name={k.icon} color={theme.text.primary} />
            ) : (
              <Text style={styles.keyText}>{k.label}</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    wrapper: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      backgroundColor: theme.bg.secondary,
    },
    row: {
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    key: {
      minWidth: 40,
      height: 34,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.bg.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyText: {
      fontFamily: 'monospace',
      fontSize: font.sm,
      color: theme.text.primary,
    },
  })
}
