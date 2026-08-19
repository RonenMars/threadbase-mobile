import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { QrCode, Lightning } from 'phosphor-react-native'
import { useNavigation, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { AddServerActionSheet } from '@/components/servers/AddServerActionSheet'
import { PairScannerModal } from '@/components/pair/PairScannerModal'
import { PairConfirmGate, type PendingPairTarget } from '@/components/pair/PairConfirmGate'
import { PairCameraIdentityCard } from '@/components/pair/PairCameraIdentityCard'
import { pendingTargetFromApiKey } from '@/services/pair-confirm-target'
import { formatFingerprint } from '@/services/e2ee/fingerprint'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { NetworkError } from '@/services/api-client'
import { authedFetch, AuthError } from '@/services/authed-fetch'
import { CleartextBlockedError } from '@/services/cleartext-policy'
import type { ExchangeResult } from '@/services/pair-exchange'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  isAddingServer: boolean
}

export function AddServerScreen({ isAddingServer }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { t } = useTranslation(['servers', 'shared', 'settings', 'common'])
  const router = useRouter()
  const navigation = useNavigation()
  const { addServer, displayedServerIds, setDisplayedServerIds } = useServersStore()
  const { addServerAction, setAddServerAction } = useSettingsStore()
  const defaultUrl = process.env.EXPO_PUBLIC_DEFAULT_SERVER_URL ?? ''
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
  const [confirmTarget, setConfirmTarget] = useState<PendingPairTarget | null>(null)
  const [cameraFingerprint, setCameraFingerprint] = useState<string | null>(null)
  const pendingConnect = useRef<{
    url: string
    apiKey: string
    label?: string
  } | null>(null)
  const pendingScan = useRef<ExchangeResult | null>(null)

  useEffect(() => {
    navigation.setOptions({
      headerShown: isAddingServer,
      title: 'Add Server',
      headerBackTitle: 'Settings',
      gestureEnabled: isAddingServer,
      fullScreenGestureEnabled: isAddingServer,
    })
  }, [isAddingServer, navigation])

  const applyAddAction = useCallback(
    (
      action: 'add' | 'replace' | 'keep',
      addedServerId: string,
      rememberChoice: boolean,
    ): void => {
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
    },
    [displayedServerIds, setDisplayedServerIds, setAddServerAction, router],
  )

  const connectWith = useCallback(
    async ({
      url,
      apiKey: keyArg,
      label: labelArg,
      deviceId,
      deviceToken,
      capabilities,
      publicUrl,
      serverPublicKey,
      requireEncryption,
    }: {
      url: string
      apiKey: string
      label?: string
      deviceId?: string
      deviceToken?: string
      capabilities?: import('@/types/devices').DeviceCapability[]
      publicUrl?: string
      serverPublicKey?: string
      requireEncryption?: boolean
    }) => {
      setError(null)
      setLoading(true)

      try {
        const res = await authedFetch({ url, apiKey: keyArg }, '/api/profiles')
        if (!res.ok) throw new NetworkError(`HTTP ${res.status}`)

        await res.json()
        const addResult = await addServer(url, keyArg, labelArg || undefined, {
          deviceId,
          deviceToken,
          capabilities,
          publicUrl,
          serverPublicKey,
          requireEncryption,
        })
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
          // Only ever 'shared' here: this screen has no device token to present
          // yet, so the remedy is always about the key. It gets its own string
          // rather than backup-restore's because the situations differ — there
          // a key that used to work stopped, here a key that never worked was
          // just pasted, and the useful pointer is where the real one lives.
          setError(t('common:error.authKeyRejectedOnConnect'))
        } else if (err instanceof CleartextBlockedError) {
          // Ahead of the network branch: the request never left the process, so
          // the generic "is the streamer running?" pointer would send the user
          // to look at a server that is fine.
          setError(t('common:error.cleartextBlocked'))
        } else if (err instanceof NetworkError || err instanceof TypeError) {
          const usesLocalhost = /localhost|127\.0\.0\.1/.test(url)
          if (usesLocalhost) {
            setError(
              "Can't reach 'localhost' from a physical device. Use your Mac's local IP (e.g. http://192.168.x.x:8766) or run: tb serve --tunnel"
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
    [addServer, addServerAction, applyAddAction, displayedServerIds.length, router, t],
  )

  const handleConnect = async () => {
    const url = `${protocol}://${serverUrl.replace(/\/$/, '')}`
    pendingConnect.current = { url, apiKey, label }
    setConfirmTarget(pendingTargetFromApiKey(url))
  }

  const applyScan = async (result: ExchangeResult) => {
    const nextProtocol: 'https' | 'http' = result.url.startsWith('https://') ? 'https' : 'http'
    const stripped = result.url.replace(/^https?:\/\//, '').replace(/\/$/, '')
    const labelGuess = result.machineName ?? ''
    setProtocol(nextProtocol)
    setServerUrl(stripped)
    setApiKey(result.apiKey)
    setLabel(labelGuess)
    await connectWith({
      url: result.url,
      apiKey: result.apiKey,
      label: labelGuess,
      deviceId: result.deviceId ?? undefined,
      deviceToken: result.deviceToken ?? undefined,
      capabilities: result.capabilities ?? undefined,
      publicUrl: result.publicUrl ?? undefined,
      serverPublicKey: result.serverPublicKey ?? undefined,
      requireEncryption: result.e2eeRequired,
    })
  }

  const handleScanSuccess = (result: ExchangeResult) => {
    setScannerOpen(false)
    if (result.serverPublicKey) {
      pendingScan.current = result
      setCameraFingerprint(formatFingerprint(result.serverPublicKey))
      return
    }
    void applyScan(result)
  }

  const finishCameraIdentity = () => {
    const result = pendingScan.current
    pendingScan.current = null
    setCameraFingerprint(null)
    if (result) void applyScan(result)
  }

  return (
    <View style={styles.flex}>
      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        bottomOffset={16}
      >
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
              <QrCode size={18} color={theme.text.accent} />
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
              testID="onboarding-server-url-input"
              style={[styles.input, styles.urlInput]}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="192.168.x.x:8766"
              placeholderTextColor={theme.text.secondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="next"
            />
          </View>
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <Text style={styles.urlHint}>LAN IP, hostname, or any URL (e.g. https://myserver.com)</Text>

          <Text style={styles.label}>{t('form.labelOptional')}</Text>
          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder="Work Mac, Home Server…"
            placeholderTextColor={theme.text.secondary}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Text style={styles.label}>{t('form.apiKey')}</Text>
          <View style={styles.passwordRow}>
            <TextInput
              testID="onboarding-api-key-input"
              style={[styles.input, styles.passwordInput]}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="Paste your API token here"
              placeholderTextColor={theme.text.secondary}
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

        <Text style={styles.hint}>{t('servers:form.hint')}</Text>
      </KeyboardAwareScrollView>
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
      <PairConfirmGate
        visible={confirmTarget !== null}
        target={confirmTarget}
        onConfirm={() => {
          const args = pendingConnect.current
          pendingConnect.current = null
          setConfirmTarget(null)
          if (args) void connectWith(args)
        }}
        onCancel={() => {
          pendingConnect.current = null
          setConfirmTarget(null)
        }}
      />
      <PairCameraIdentityCard
        visible={cameraFingerprint !== null}
        fingerprint={cameraFingerprint}
        onDone={finishCameraIdentity}
      />
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.bg.primary },
    container: {
      flexGrow: 1,
      padding: spacing.xl,
      justifyContent: 'center',
      gap: spacing.xl,
    },
    hero: { alignItems: 'center', gap: spacing.sm },
    title: {
      color: theme.text.primary,
      fontSize: 32,
      fontWeight: '700',
    },
    subtitle: {
      color: theme.text.secondary,
      fontSize: font.lg,
    },
    form: { gap: spacing.md, zIndex: 1 },
    urlRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    urlInput: { flex: 1 },
    protocolDropdown: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: theme.border,
      paddingHorizontal: spacing.md,
      minHeight: 56,
      gap: 4,
    },
    protocolText: {
      color: theme.text.primary,
      fontSize: font.lg,
    },
    dropdownArrow: {
      color: theme.text.secondary,
      fontSize: 10,
    },
    protocolOptions: {
      position: 'absolute',
      top: 48,
      left: 0,
      right: 0,
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      zIndex: 10,
      overflow: 'hidden',
    },
    protocolOption: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    protocolOptionText: {
      color: theme.text.primary,
      fontSize: font.base,
    },
    protocolOptionSelected: {
      color: theme.text.accent,
      fontWeight: '600',
    },
    label: {
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
      marginBottom: spacing.xs,
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
      backgroundColor: theme.bg.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    input: {
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: theme.border,
      color: theme.text.primary,
      fontSize: font.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      minHeight: 56,
    },
    urlHint: {
      color: theme.text.secondary,
      fontSize: font.base,
      marginTop: -spacing.xs,
    },
    passwordRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'center',
    },
    passwordInput: { flex: 1 },
    showHideBtn: {
      minHeight: 56,
      paddingHorizontal: spacing.sm,
      justifyContent: 'center',
    },
    showHideText: {
      color: theme.text.accent,
      fontSize: font.base,
    },
    error: {
      color: theme.status.failed,
      fontSize: font.base,
      marginTop: spacing.xs,
    },
    connectBtn: {
      backgroundColor: theme.text.accent,
      borderRadius: radius.md,
      padding: spacing.md,
      alignItems: 'center',
      minHeight: 50,
      justifyContent: 'center',
      marginTop: spacing.sm,
    },
    connectBtnDisabled: { opacity: 0.5 },
    connectBtnText: {
      color: theme.text.onAccent,
      fontSize: font.lg,
      fontWeight: '700',
    },
    hint: {
      color: theme.text.secondary,
      fontSize: font.base,
      textAlign: 'center',
    },
    code: {
      fontFamily: 'monospace',
      color: theme.text.primary,
    },
  })
}
