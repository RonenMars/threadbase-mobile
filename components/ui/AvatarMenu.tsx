import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Modal,
} from 'react-native'
import { useRouter } from 'expo-router'
import { dark, font, radius, spacing } from '@/constants/theme'
import { useSettingsStore } from '@/stores/settings'

interface Props {
  onOpenServerFilter: () => void
}

export function AvatarMenu({ onOpenServerFilter }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const sessionsLayout = useSettingsStore((s) => s.sessionsLayout)
  const setSessionsLayout = useSettingsStore((s) => s.setSessionsLayout)

  const close = () => setOpen(false)

  return (
    <View>
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        style={[styles.avatar, open && styles.avatarActive]}
        accessibilityLabel="Menu"
        accessibilityRole="button"
        hitSlop={8}
      >
        <Text style={styles.avatarText}>T</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={close}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={close}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
        <View style={styles.menu}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => { close(); router.push('/settings') }}
          >
            <Text style={styles.menuIcon}>⚙️</Text>
            <Text style={styles.menuLabel}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => { close(); onOpenServerFilter() }}
          >
            <Text style={styles.menuIcon}>🖥️</Text>
            <Text style={styles.menuLabel}>Servers</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemLast]}
            onPress={() => {
              setSessionsLayout(sessionsLayout === 'hub' ? 'classic' : 'hub')
              close()
            }}
          >
            <Text style={styles.menuIcon}>{sessionsLayout === 'hub' ? '📋' : '📂'}</Text>
            <Text style={styles.menuLabel}>
              {sessionsLayout === 'hub' ? 'Classic view' : 'Hub view'}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0a84ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActive: {
    borderWidth: 2,
    borderColor: dark.text.accent,
  },
  avatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  menu: {
    position: 'absolute',
    top: 52,
    left: 16,
    backgroundColor: dark.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    minWidth: 160,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: dark.border,
    minHeight: 44,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuIcon: { fontSize: 16 },
  menuLabel: { color: dark.text.primary, fontSize: font.base },
})
