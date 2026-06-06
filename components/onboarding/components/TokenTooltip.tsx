import React, { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors, fonts } from '../theme'

export function TokenTooltip() {
  const [visible, setVisible] = useState(false)

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        testID="token-tooltip-trigger"
        onPress={() => setVisible((v) => !v)}
        hitSlop={8}
        style={styles.trigger}
      >
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <Text style={styles.icon}>?</Text>
      </TouchableOpacity>
      {visible && (
        <View testID="token-tooltip-body" style={styles.tooltip}>
          <Text style={styles.text}>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            A temporary API key. Run{' '}
            <Text style={styles.code}>tb token --new</Text>
            {' '}on your Mac to generate one.
          </Text>
          <TouchableOpacity onPress={() => setVisible(false)} hitSlop={8}>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <Text style={styles.dismiss}>Got it</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  trigger: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.fg4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    color: colors.fg4,
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '600',
    lineHeight: 12,
  },
  tooltip: {
    position: 'absolute',
    top: 20,
    right: 0,
    width: 220,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.ink5,
    borderRadius: 8,
    padding: 10,
    zIndex: 10,
  },
  text: {
    color: colors.fg2,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
  code: {
    color: colors.fg1,
    fontFamily: fonts.mono,
    fontSize: 11,
  },
  dismiss: {
    color: colors.blue400,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '500',
  },
})
