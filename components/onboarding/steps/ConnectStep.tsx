import React, { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { useTBPair, type PairResult, type PairLogKind } from '@/hooks/useTBPair'
import { PairScannerModal } from '@/components/pair/PairScannerModal'
import type { ExchangeResult } from '@/services/pair-exchange'
import { PrimaryButton } from '../components/PrimaryButton'
import { TerminalCard } from '../components/TerminalCard'
import { colors, fonts } from '../theme'

type Mode = 'choose' | 'manual' | 'qr-explain'

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
  const { t } = useTranslation('onboarding')
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [mode, setMode] = useState<Mode>('choose')
  const [scannerOpen, setScannerOpen] = useState(false)
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

  const handleScanSuccess = (result: ExchangeResult) => {
    setScannerOpen(false)
    setUrl(result.url)
    setToken(result.apiKey)
    setMode('manual')
    pair({
      url: result.url,
      token: result.apiKey,
      onSuccess: (r) => {
        onPaired(r)
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

  if (mode === 'choose') {
    return (
      <View style={styles.root}>
        <Text style={styles.eyebrow}>{t('connect.eyebrow')}</Text>
        <Text style={styles.headline}>{t('connect.headline')}</Text>
        <Text style={styles.modeBlurb}>{t('connect.modeBlurb')}</Text>

        <TouchableOpacity
          style={styles.modeCard}
          onPress={() => setMode('qr-explain')}
          activeOpacity={0.85}
        >
          <Text style={styles.modeCardTitle}>{t('connect.scanQr')}</Text>
          <Text style={styles.modeCardBody}>{t('connect.scanQrBody')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="onboarding-connect-paste-card"
          style={styles.modeCard}
          onPress={() => setMode('manual')}
          activeOpacity={0.85}
        >
          <Text style={styles.modeCardTitle}>{t('connect.pasteCredentials')}</Text>
          <Text style={styles.modeCardBody}>{t('connect.pasteCredentialsBody')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (mode === 'qr-explain') {
    return (
      <View style={styles.root}>
        <Text style={styles.eyebrow}>{t('connect.qrEyebrow')}</Text>
        <Text style={styles.headline}>{t('connect.qrHeadline')}</Text>

        <TerminalCard>
          <Text style={styles.explainStep}>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <Text style={styles.stepNum}>1.</Text>{' '}On your server, run{' '}
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <Text style={{ color: colors.fg2 }}>tb pair</Text>. A QR will print to the terminal.
          </Text>
          <Text style={[styles.explainStep, { marginTop: 10 }]}>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <Text style={styles.stepNum}>2.</Text>{' '}Tap{' '}
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <Text style={{ color: colors.fg2 }}>{t('connect.openCamera')}</Text> below. Threadbase will ask
            permission to use the camera — that&apos;s only used to read the QR.
          </Text>
          <Text style={[styles.explainStep, { marginTop: 10 }]}>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <Text style={styles.stepNum}>3.</Text>{' '}Point your phone at the QR. The pair token is
            valid for 3 minutes; if it expires, just run{' '}
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <Text style={{ color: colors.fg2 }}>tb pair</Text> again.
          </Text>
        </TerminalCard>

        <View style={styles.flex} />

        <PrimaryButton onPress={() => setScannerOpen(true)}>{t('connect.openCamera')}</PrimaryButton>
        <TouchableOpacity onPress={() => setMode('manual')} style={styles.linkBtn}>
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <Text style={styles.linkText}>Use manual entry instead</Text>
        </TouchableOpacity>
        <View style={{ height: 14 }} />

        <PairScannerModal
          visible={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onSuccess={handleScanSuccess}
        />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <Text style={styles.eyebrow}>{t('connect.eyebrow')}</Text>
      <Text style={styles.headline}>{t('connect.headline')}</Text>

      <TouchableOpacity onPress={() => setMode('qr-explain')} style={styles.linkBtnTop}>
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <Text style={styles.linkText}>Scan a QR instead →</Text>
      </TouchableOpacity>

      <TerminalCard>
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <Text style={styles.commandLabel}>$ tb pair --server</Text>
        <View style={styles.inputRow}>
          <Text style={styles.prompt}>›</Text>
          <TextInput
            testID="onboarding-connect-url-input"
            value={url}
            onChangeText={setUrl}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
            editable={!busy}
            placeholder="https://threadbase.local:7331"
            placeholderTextColor={colors.fg4}
          />
        </View>

        {/* eslint-disable-next-line i18next/no-literal-string */}
        <Text style={[styles.commandLabel, { marginTop: 10 }]}>$ tb pair --token</Text>
        <View style={styles.inputRow}>
          <Text style={styles.prompt}>›</Text>
          <TextInput
            testID="onboarding-connect-token-input"
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
                {t('connect.ready')}
              </Animated.Text>
            )}
          </View>
        )}
      </TerminalCard>

      <View style={styles.footnote}>
        <Text style={[styles.footnoteText, { color: colors.fg3 }]}>{'//'}</Text>
        <Text style={styles.footnoteText}>
          {/* eslint-disable-next-line i18next/no-literal-string */}
          {' '}On your desktop, run{' '}
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <Text style={{ color: colors.fg2 }}>tb token --new</Text> to mint one.
        </Text>
      </View>

      <View style={styles.flex} />

      <PrimaryButton
        testID="onboarding-connect-handshake-cta"
        onPress={handleConnect}
        disabled={!valid || busy}
      >
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
  modeBlurb: {
    color: colors.fg3,
    fontFamily: fonts.mono,
    fontSize: 12.5,
    lineHeight: 19,
    marginBottom: 16,
  },
  modeCard: {
    borderWidth: 1,
    borderColor: colors.ink5,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  modeCardTitle: {
    color: colors.fg0,
    fontFamily: fonts.sans,
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  modeCardBody: {
    color: colors.fg3,
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 18,
  },
  explainStep: {
    color: colors.fg2,
    fontFamily: fonts.mono,
    fontSize: 12.5,
    lineHeight: 19,
  },
  stepNum: {
    color: colors.amber400,
    fontWeight: '600',
  },
  linkBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  linkBtnTop: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    marginBottom: 4,
  },
  linkText: {
    color: colors.blue400,
    fontFamily: fonts.mono,
    fontSize: 12.5,
    fontWeight: '500',
  },
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
