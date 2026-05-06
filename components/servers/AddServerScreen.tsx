import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { QrCode, Lightning } from 'phosphor-react-native'
import { useHeaderHeight } from '@react-navigation/elements'
import { useNavigation, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { AddServerActionSheet } from '@/components/servers/AddServerActionSheet'
import { PairScannerModal } from '@/components/pair/PairScannerModal'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { AuthError, NetworkError } from '@/services/api-client'
import type { ExchangeResult } from '@/services/pair-exchange'
import { dark, font, radius, spacing } from '@/constants/theme'

interface Props {
  isAddingServer: boolean
}

export function AddServerScreen({ isAddingServer }: Props) {
  const { t } = useTranslation('servers')
  const router = useRouter()
  const navigation = useNavigation()
  const headerHeight = useHeaderHeight()
  const { addServer, displayedServerIds, setDisplayedServerIds } = useServersStore()
  const { addServerAction, setAddServerAction } = useSettingsStore()
  const defaultUrl = process.env.EXPO_PUBLIC_DEFAULT_SERVER_URL ?? 'http://localhost:7070'
  const [protocol, setProtocol] = useState<'https' | 'http'>(
    defaultUrl.startsWith('https://') ? 'https' : 'http'
  )
  const [showProtocolPicker, setShowProtocolPicker] = useState(false)
  const [serverUrl, setServerUrl] = useState(
    defaultUrl.replace(/^https?:\/\//, '')
  )
  const [apiKey, setApiKey] = useState('')
  const [label, setLabel] = useState('')
  const [showApiKey, setShowApiKey] = useState(__DEV__)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newServerId, setNewServerId] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)

  useEffect(() => {
    navigation.setOptions({
      headerShown: isAddingServer,
      title: 'Add Server',
      headerBackTitle: 'Settings',
      gestureEnabled: isAddingServer,
      fullScreenGestureEnabled: isAddingServer,
    })
  }, [isAddingServer, navigation])

  function applyAddAction(
    action: 'add' | 'replace' | 'keep',
    addedServerId: string,
    rememberChoice: boolean,
  ): void {
    switch (action) {
      case 'add':
        setDisplayedServerIds(Array.from(new Set([...displayedServerIds, addedServerId])))
        break
      case 'replace':
        setDisplayedServerIds([addedServerId])
        break
      case 'keep':
        break
    }

    if (rememberChoice) {
      setAddServerAction(action)
    }

    setNewServerId(null)
    router.replace('/')
  }

  const connectWith = useCallback(
    async ({ url, apiKey: keyArg, label: labelArg }: { url: string; apiKey: string; label?: string }) => {
      setError(null)
      setLoading(true)

      try {
        const res = await fetch(`${url}/api/profiles`, {
          headers: { Authorization: `Bearer ${keyArg}` },
        })
        if (res.status === 401) throw new AuthError()
        if (!res.ok) throw new NetworkError(`HTTP ${res.status}`)

        await res.json()
        const addResult = await addServer(url, keyArg, labelArg || undefined)
        if (typeof addResult !== 'string') {
          setError('This server is already in your list.')
          return
        }
        const id = addResult
        const hadCustomMultiSelection = displayedServerIds.length > 1
        if (hadCustomMultiSelection) {
          if (addServerAction === 'ask') {
            setNewServerId(id)
          } else {
            applyAddAction(addServerAction, id, false)
          }
        } else {
          router.replace('/')
        }
      } catch (err) {
        if (err instanceof AuthError) {
          setError('Invalid API key. Check THREADBASE_API_KEY on your server.')
        } else if (err instanceof NetworkError || err instanceof TypeError) {
          const usesLocalhost = /localhost|127\.0\.0\.1/.test(url)
          if (usesLocalhost) {
            setError(
              "Can't reach 'localhost' from a physical device. Use your Mac's local IP (e.g. http://192.168.x.x:7070) or run: cch serve --tunnel --qr"
            )
          } else {
            setError('Could not reach the server. Is cch serve running?')
          }
        } else {
          setError('Connection failed. Check the server URL and try again.')
        }
      } finally {
        setLoading(false)
      }
    },
    [addServer, addServerAction, applyAddAction, displayedServerIds.length, router],
  )

  const handleConnect = async () => {
    const url = `${protocol}://${serverUrl.replace(/\/$/, '')}`
    await connectWith({ url, apiKey, label })
  }

  const handleScanSuccess = async (result: ExchangeResult) => {
    setScannerOpen(false)
    let nextProtocol: 'https' | 'http' = result.url.startsWith('https://') ? 'https' : 'http'
    const stripped = result.url.replace(/^https?:\/\//, '').replace(/\/$/, '')
    const labelGuess = result.machineName ?? ''
    setProtocol(nextProtocol)
    setServerUrl(stripped)
    setApiKey(result.apiKey)
    setLabel(labelGuess)
    await connectWith({ url: result.url, apiKey: result.apiKey, label: labelGuess })
  }

  return (
    <>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Lightning size={64} color="#f0883e" weight="fill" />
          <Text style={styles.title}>{t('shared:app.title')}</Text>
          <Text style={styles.subtitle}>{t('settings:about.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{t('form.serverUrl')}</Text>
            <TouchableOpacity
              style={styles.scanQrBtn}
              onPress={() => setScannerOpen(true)}
              accessibilityLabel="Scan pairing QR"
            >
              <QrCode size={18} color={dark.text.accent} />
            </TouchableOpacity>
          </View>
          <View style={styles.urlRow}>
            <View>
              <TouchableOpacity
                style={styles.protocolDropdown}
                onPress={() => setShowProtocolPicker((v) => !v)}
              >
                <Text style={styles.protocolText}>{protocol}://</Text>
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>
              {showProtocolPicker && (
                <View style={styles.protocolOptions}>
                  {(['https', 'http'] as const).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={styles.protocolOption}
                      onPress={() => {
                        setProtocol(opt)
                        setShowProtocolPicker(false)
                      }}
                    >
                      <Text
                        style={[
                          styles.protocolOptionText,
                          protocol === opt && styles.protocolOptionSelected,
                        ]}
                      >
                        {opt}://
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <TextInput
              style={[styles.input, styles.urlInput]}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="localhost:7070"
              placeholderTextColor={dark.text.secondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="next"
            />
          </View>

          <Text style={styles.label}>{t('form.labelOptional')}</Text>
          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. Work Mac, Home Server"
            placeholderTextColor={dark.text.secondary}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Text style={styles.label}>{t('form.apiKey')}</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="Enter THREADBASE_API_KEY"
              placeholderTextColor={dark.text.secondary}
              secureTextEntry={__DEV__ ? false : !showApiKey}
              textContentType={__DEV__ ? 'none' : 'password'}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleConnect}
            />
            <TouchableOpacity
              style={styles.showHideBtn}
              onPress={() => setShowApiKey((v) => !v)}
            >
              <Text style={styles.showHideText}>{showApiKey ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.connectBtn, loading && styles.connectBtnDisabled]}
            onPress={handleConnect}
            disabled={loading || !serverUrl || !apiKey}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.connectBtnText}>{t('action.connect')}</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          {/* eslint-disable-next-line i18next/no-literal-string */}
          Run <Text style={styles.code}>cch serve --tunnel --qr</Text> on your Mac to get a QR-scannable URL.
        </Text>
        </ScrollView>
      </KeyboardAvoidingView>
      <AddServerActionSheet
        visible={Boolean(newServerId)}
        onClose={() => {
          setNewServerId(null)
          router.replace('/')
        }}
        onConfirm={(choice, rememberChoice) => {
          if (!newServerId) return
          applyAddAction(choice, newServerId, rememberChoice)
        }}
      />
      <PairScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onSuccess={handleScanSuccess}
      />
    </>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: dark.bg.primary },
  container: {
    flexGrow: 1,
    padding: spacing.xl,
    justifyContent: 'center',
    gap: spacing.xl,
  },
  hero: { alignItems: 'center', gap: spacing.sm },
  title: {
    color: dark.text.primary,
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    color: dark.text.secondary,
    fontSize: font.lg,
  },
  form: { gap: spacing.sm, zIndex: 1 },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  urlInput: { flex: 1 },
  protocolDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    gap: 4,
  },
  protocolText: {
    color: dark.text.primary,
    fontSize: font.base,
  },
  dropdownArrow: {
    color: dark.text.secondary,
    fontSize: 10,
  },
  protocolOptions: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    zIndex: 10,
    overflow: 'hidden',
  },
  protocolOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  protocolOptionText: {
    color: dark.text.primary,
    fontSize: font.base,
  },
  protocolOptionSelected: {
    color: dark.text.accent,
    fontWeight: '600',
  },
  label: {
    color: dark.text.secondary,
    fontSize: font.sm,
    fontWeight: '500',
    marginBottom: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  scanQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: dark.bg.card,
    borderWidth: 1,
    borderColor: dark.border,
  },
  input: {
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    color: dark.text.primary,
    fontSize: font.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  passwordRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  passwordInput: { flex: 1 },
  showHideBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
  },
  showHideText: {
    color: dark.text.accent,
    fontSize: font.sm,
  },
  error: {
    color: dark.status.failed,
    fontSize: font.sm,
    marginTop: spacing.xs,
  },
  connectBtn: {
    backgroundColor: dark.text.accent,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  connectBtnDisabled: { opacity: 0.5 },
  connectBtnText: {
    color: '#fff',
    fontSize: font.lg,
    fontWeight: '700',
  },
  hint: {
    color: dark.text.secondary,
    fontSize: font.sm,
    textAlign: 'center',
  },
  code: {
    fontFamily: 'monospace',
    color: dark.text.primary,
  },
})
