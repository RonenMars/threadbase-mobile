import React, { useState } from 'react'
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
import { useRouter } from 'expo-router'
import { AddServerActionSheet } from '@/components/servers/AddServerActionSheet'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { AuthError, NetworkError } from '@/services/api-client'
import { dark, font, radius, spacing } from '@/constants/theme'


export default function OnboardingScreen() {
  const router = useRouter()
  const { addServer, displayedServerIds, setDisplayedServerIds } = useServersStore()
  const { addServerAction, setAddServerAction } = useSettingsStore()
  const [serverUrl, setServerUrl] = useState(
    process.env.EXPO_PUBLIC_DEFAULT_SERVER_URL ?? 'http://localhost:7070'
  )
  const [apiKey, setApiKey] = useState('')
  const [label, setLabel] = useState('')
  const [showApiKey, setShowApiKey] = useState(__DEV__)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newServerId, setNewServerId] = useState<string | null>(null)

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
    router.replace('/(tabs)/sessions')
  }


  const handleConnect = async () => {
    setError(null)
    setLoading(true)

    try {
      const url = serverUrl.replace(/\/$/, '')
      const res = await fetch(`${url}/api/profiles`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (res.status === 401) throw new AuthError()
      if (!res.ok) throw new NetworkError(`HTTP ${res.status}`)

      await res.json()
      const id = await addServer(url, apiKey, label || undefined)
      const hadCustomMultiSelection = displayedServerIds.length > 1
      if (hadCustomMultiSelection) {
        if (addServerAction === 'ask') {
          setNewServerId(id)
        } else {
          applyAddAction(addServerAction, id, false)
        }
      } else {
        router.replace('/(tabs)/sessions')
      }
    } catch (err) {
      if (err instanceof AuthError) {
        setError('Invalid API key. Check THREADBASE_API_KEY on your server.')
      } else if (err instanceof NetworkError || err instanceof TypeError) {
        const usesLocalhost = /localhost|127\.0\.0\.1/.test(serverUrl)
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
  }

  return (
    <>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.logo}>⚡</Text>
          <Text style={styles.title}>Threadbase</Text>
          <Text style={styles.subtitle}>AI Agent Control Center</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Server URL</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://localhost:7070"
            placeholderTextColor={dark.text.secondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="next"
          />

          <Text style={styles.label}>Label (optional)</Text>
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

          <Text style={styles.label}>API Key</Text>
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
              <Text style={styles.connectBtnText}>Connect</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Run <Text style={styles.code}>cch serve --tunnel --qr</Text> on your Mac to get a QR-scannable URL.
        </Text>
        </ScrollView>
      </KeyboardAvoidingView>
      <AddServerActionSheet
        visible={Boolean(newServerId)}
        onClose={() => {
          setNewServerId(null)
          router.replace('/(tabs)/sessions')
        }}
        onConfirm={(choice, rememberChoice) => {
          if (!newServerId) return
          applyAddAction(choice, newServerId, rememberChoice)
        }}
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
  logo: { fontSize: 64 },
  title: {
    color: dark.text.primary,
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    color: dark.text.secondary,
    fontSize: font.lg,
  },
  form: { gap: spacing.sm },
  label: {
    color: dark.text.secondary,
    fontSize: font.sm,
    fontWeight: '500',
    marginBottom: 2,
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
