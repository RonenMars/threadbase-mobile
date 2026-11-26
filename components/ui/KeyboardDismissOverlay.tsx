import React, { useEffect, useState } from 'react'
import { Keyboard, Platform, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'

// Android only emits the `did` pair.
const SHOW_EVENT = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
const HIDE_EVENT = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

/**
 * While the keyboard is up, covers its parent so a tap anywhere on it closes the
 * keyboard instead of reaching what is underneath. Kept faint: search results
 * arrive while the user is still typing and have to stay readable.
 */
export function KeyboardDismissOverlay() {
  const { t } = useTranslation('common')
  const [keyboardOpen, setKeyboardOpen] = useState(() => Keyboard.isVisible())

  useEffect(() => {
    const shown = Keyboard.addListener(SHOW_EVENT, () => setKeyboardOpen(true))
    const hidden = Keyboard.addListener(HIDE_EVENT, () => setKeyboardOpen(false))
    return () => {
      shown.remove()
      hidden.remove()
    }
  }, [])

  if (!keyboardOpen) return null

  return (
    <Pressable
      testID="keyboard-dismiss-overlay"
      style={styles.scrim}
      onPress={() => Keyboard.dismiss()}
      accessibilityRole="button"
      accessibilityLabel={t('keyboard.dismiss')}
    />
  )
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 0, 0, 0.24)' },
})
