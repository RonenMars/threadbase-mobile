import React, { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { useTBPair, type PairResult, type PairLogKind } from '@/hooks/useTBPair'
import { PrimaryButton } from '../components/PrimaryButton'
import { TerminalCard } from '../components/TerminalCard'
import { colors, fonts } from '../theme'

interface Props {
  onPaired: (result: PairResult) => void
  onAdvance: () => void
}

function colorForKind(k: PairLogKind): string {
  if (k === 'ok') return colors.green400
  if (k === 'i') return colors.blue400
  if (k === 'err') return colors.red400
  return colors.fg3
}

export function ConnectStep({ onPaired, onAdvance }: Props) {
  const [url, setUrl] = useState('https://threadbase.local:7331')
  const [token, setToken] = useState('')
  const { phase, log, pair } = useTBPair()

  const valid = url.startsWith('http') && token.length >= 8
  const busy = phase !== 'idle' && phase !== 'err'

  const handleConnect = () => {
    if (!valid || busy) return
    pair({
      url,
      token,
      onSuccess: (result) => {
        onPaired(result)
        onAdvance()
      },
    })
  }

  const ctaLabel = phase === 'idle'
    ? 'Open handshake'
    : phase === 'ok'
      ? 'Connected'
      : phase === 'err'
        ? 'Retry'
        : '…handshake'

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <Text style={styles.eyebrow}>{'>'} 02 / PAIR</Text>
      <Text style={styles.headline}>Connect a runtime.</Text>

      <TerminalCard>
        <Text style={styles.commandLabel}>$ tb pair --server</Text>
        <View style={styles.inputRow}>
          <Text style={styles.prompt}>›</Text>
          <TextInput
            value={url}
            onChangeText={setUrl}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
            editable={!busy}
            placeholderTextColor={colors.fg4}
          />
        </View>

        <Text style={[styles.commandLabel, { marginTop: 10 }]}>$ tb pair --token</Text>
        <View style={styles.inputRow}>
          <Text style={styles.prompt}>›</Text>
          <TextInput
            value={token}
            onChangeText={setToken}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            placeholder="paste from desktop"
            placeholderTextColor={colors.fg4}
            style={styles.input}
            editable={!busy}
          />
        </View>

        {log.length > 0 && (
          <View style={styles.logWrap}>
            {log.map((ln, i) => (
              <Animated.View
                key={`${i}-${ln.t}`}
                entering={FadeIn.duration(200)}
                style={styles.logRow}
              >
                <Text style={[styles.logLine, { color: colorForKind(ln.k) }]}>
                  <Text style={styles.logIndex}>
                    [{String(i + 1).padStart(2, '0')}]{' '}
                  </Text>
                  {ln.t}
                </Text>
              </Animated.View>
            ))}
            {phase === 'ok' && (
              <Animated.Text
                entering={FadeIn.duration(200)}
                style={[styles.logLine, { color: colors.green400, marginTop: 4 }]}
              >
                ✓ ready
              </Animated.Text>
            )}
          </View>
        )}
      </TerminalCard>

      <View style={styles.footnote}>
        <Text style={[styles.footnoteText, { color: colors.fg3 }]}>{'//'}</Text>
        <Text style={styles.footnoteText}>
          {' '}On your desktop, run{' '}
          <Text style={{ color: colors.fg2 }}>tb token --new</Text> to mint one.
        </Text>
      </View>

      <View style={styles.flex} />

      <PrimaryButton onPress={handleConnect} disabled={!valid || busy}>
        {ctaLabel}
      </PrimaryButton>
      <View style={{ height: 14 }} />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 22, paddingTop: 4 },
  eyebrow: {
    color: colors.amber400,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  headline: {
    color: colors.fg0,
    fontFamily: fonts.sans,
    fontSize: 26,
    lineHeight: 29,
    fontWeight: '600',
    letterSpacing: -0.55,
    marginBottom: 14,
  },
  commandLabel: {
    color: colors.fg3,
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  prompt: {
    color: colors.blue400,
    fontFamily: fonts.mono,
    fontSize: 12.5,
    fontWeight: '500',
  },
  input: {
    flex: 1,
    color: colors.fg0,
    fontFamily: fonts.mono,
    fontSize: 12.5,
    fontWeight: '500',
    padding: 0,
    margin: 0,
  },
  logWrap: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.ink5,
    gap: 2,
  },
  logRow: {},
  logLine: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 18,
  },
  logIndex: { color: colors.fg4 },
  footnote: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 6,
  },
  footnoteText: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.fg4,
  },
  flex: { flex: 1 },
})
