import React, { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface Props {
  storageKey: string
  text: string
}

export function FirstShowBanner({ storageKey, text }: Props) {
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

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.25)',
    borderRadius: 8,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 10,
  },
  text: {
    flex: 1,
    color: '#94aac7',
    fontSize: 12.5,
    lineHeight: 18,
  },
  dismiss: {
    color: '#3b82f6',
    fontFamily: 'Menlo',
    fontSize: 11.5,
    fontWeight: '600',
  },
})
