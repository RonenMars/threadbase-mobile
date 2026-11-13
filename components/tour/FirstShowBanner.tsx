import React, { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Theme } from '@/constants/theme'
import { useThemedStyles } from '@/hooks/useThemedStyles'

interface Props {
  storageKey: string
  text: string
}

export function FirstShowBanner({ storageKey, text }: Props) {
  const { styles } = useThemedStyles(makeStyles)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(storageKey).then((v) => {
      if (v !== 'seen') setVisible(true)
    })
  }, [storageKey])

  const dismiss = useCallback(() => {
    setVisible(false)
    void AsyncStorage.setItem(storageKey, 'seen')
  }, [storageKey])

  if (!visible) return null

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{text}</Text>
      <TouchableOpacity
        testID="first-show-banner-dismiss"
        onPress={dismiss}
        hitSlop={8}
      >
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <Text style={styles.dismiss}>Got it</Text>
      </TouchableOpacity>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: `${theme.text.accent}1a`,
      borderWidth: 1,
      borderColor: `${theme.text.accent}40`,
      borderRadius: 8,
      marginHorizontal: 12,
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 9,
      gap: 10,
    },
    text: {
      flex: 1,
      color: theme.text.secondary,
      fontSize: 15.5,
      fontWeight: '600',
      lineHeight: 22,
    },
    dismiss: {
      color: theme.text.accent,
      fontFamily: 'Menlo',
      fontSize: 14.5,
      fontWeight: '700',
    },
  })
}
