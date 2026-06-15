import React, { useEffect, useState } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Alert,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { X, Eye, EyeSlash, QrCode, XCircle, CaretDown } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { PairScannerModal } from '@/components/pair/PairScannerModal'
import { useServersStore } from '@/stores/servers'
import { wsManager } from '@/services/ws-client'
import { useTheme } from '@/contexts/ThemeContext'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import type { ExchangeResult } from '@/services/pair-exchange'

interface Props {
  visible: boolean
  /** null = Add mode, string = Edit mode (serverId) */
  serverId: string | null
  onClose: () => void
}

function splitUrl(full: string): { protocol: 'http' | 'https'; host: string } {
  if (full.startsWith('https://')) return { protocol: 'https', host: full.slice(8).replace(/\/+$/, '') }
  if (full.startsWith('http://')) return { protocol: 'http', host: full.slice(7).replace(/\/+$/, '') }
  return { protocol: 'http', host: full.replace(/\/+$/, '') }
}

export function ServerEditModal({ visible, serverId, onClose }: Props) {
  const { t } = useTranslation(['common', 'servers'])
  const theme = useTheme()
  const { servers, addServer, editServer } = useServersStore()
  const server = serverId ? servers[serverId] : null
  const isEditMode = serverId !== null

  const [label, setLabel] = useState('')
  const [protocol, setProtocol] = useState<'http' | 'https'>('http')
  const [urlHost, setUrlHost] = useState('')
  const [showProtocolPicker, setShowProtocolPicker] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  const styles = makeStyles(theme)

  // Pre-fill fields when opening
  useEffect(() => {
    if (visible) {
      queueMicrotask(() => {
        if (server) {
          setLabel(server.label ?? '')
          const { protocol: p, host } = splitUrl(server.url)
          setProtocol(p)
          setUrlHost(host)
          setApiKey(server.apiKey)
        } else {
          setLabel('')
          setProtocol('http')
          setUrlHost('')
          setApiKey('')
        }
        setError(null)
        setIsDirty(false)
        setShowApiKey(false)
        setShowProtocolPicker(false)
      })
    }
  }, [visible, serverId, server])

  function markDirty() {
    if (!isDirty) setIsDirty(true)
  }

  async function pasteUrl() {
    const text = await Clipboard.getStringAsync()
    if (!text) return
    const { protocol: p, host } = splitUrl(text.trim())
    setProtocol(p)
    setUrlHost(host)
    markDirty()
  }

  async function pasteApiKey() {
    const text = await Clipboard.getStringAsync()
    if (!text) return
    setApiKey(text.trim())
    markDirty()
  }

  function handleDismiss() {
    if (isDirty) {
      Alert.alert('Discard changes?', 'Your unsaved changes will be lost.', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onClose },
      ])
    } else {
      onClose()
    }
  }

  async function handleSave() {
    const trimmedHost = urlHost.trim().replace(/\/+$/, '')
    const trimmedUrl = trimmedHost ? `${protocol}://${trimmedHost}` : ''
    const trimmedKey = apiKey.trim()

    if (!trimmedUrl) {
      setError('Server URL is required.')
      return
    }
    if (!trimmedKey) {
      setError('API key is required.')
      return
    }

    setError(null)

    if (isEditMode && serverId) {
      const result = await editServer(serverId, { url: trimmedUrl, apiKey: trimmedKey, label: label.trim() || undefined })
      if (result && 'error' in result && result.error === 'duplicate') {
        setError('A server with this URL and API key already exists.')
        return
      }
      // Reconnect WS with potentially new credentials
      const state = useServersStore.getState()
      const newId = Object.keys(state.servers).find(
        (id) => state.servers[id].url === trimmedUrl && state.servers[id].apiKey === trimmedKey
      ) ?? serverId
      const updated = state.servers[newId]
      if (updated) {
        wsManager.connect(newId, updated.url, updated.apiKey)
      }
    } else {
      const result = await addServer(trimmedUrl, trimmedKey, label.trim() || undefined)
      if (result && typeof result === 'object' && 'error' in result && result.error === 'duplicate') {
        setError('A server with this URL and API key already exists.')
        return
      }
      const newId = result as string
      wsManager.connect(newId, trimmedUrl, trimmedKey)
    }

    onClose()
  }

  function handleScanSuccess(result: ExchangeResult) {
    setScannerOpen(false)
    const { protocol: p, host } = splitUrl(result.url)
    setProtocol(p)
    setUrlHost(host)
    setApiKey(result.apiKey)
    if (result.machineName && !label) setLabel(result.machineName)
    markDirty()
  }

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
        <TouchableWithoutFeedback onPress={handleDismiss}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>

        <KeyboardAwareScrollView
          style={styles.avoidingView}
          contentContainerStyle={styles.avoidingViewContent}
          keyboardShouldPersistTaps="handled"
          bottomOffset={16}
          pointerEvents="box-none"
        >
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{isEditMode ? 'Edit Server' : 'Add Server'}</Text>
              <TouchableOpacity onPress={handleDismiss} hitSlop={12} style={styles.closeBtn}>
                <X size={20} color={theme.text.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.body}>
              {/* Label row — QR icon right-aligned */}
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>{t('servers:form.labelOptional')}</Text>
                <TouchableOpacity
                  onPress={() => setScannerOpen(true)}
                  hitSlop={12}
                  accessibilityLabel="Scan QR code"
                >
                  <QrCode size={18} color={theme.text.accent} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                value={label}
                onChangeText={(v) => { setLabel(v); markDirty() }}
                placeholder="e.g. Work Mac, Home Server"
                placeholderTextColor={theme.text.secondary}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
              />

              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>{t('servers:form.serverUrl')}</Text>
                <TouchableOpacity onPress={pasteUrl} hitSlop={8}>
                  <Text style={styles.pasteBtn}>{t('button.paste')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.urlRow}>
                <View>
                  <TouchableOpacity
                    style={styles.protocolBtn}
                    onPress={() => { setShowProtocolPicker((v) => !v); markDirty() }}
                  >
                    <Text style={styles.protocolText}>{protocol}://</Text>
                    <CaretDown size={10} color={theme.text.secondary} weight="bold" />
                  </TouchableOpacity>
                  {showProtocolPicker && (
                    <View style={styles.protocolOptions}>
                      {(['http', 'https'] as const).map((opt) => (
                        <TouchableOpacity
                          key={opt}
                          style={styles.protocolOption}
                          onPress={() => { setProtocol(opt); setShowProtocolPicker(false); markDirty() }}
                        >
                          <Text style={[styles.protocolOptionText, protocol === opt && styles.protocolOptionSelected]}>
                            {opt}://
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                <TextInput
                  style={[styles.input, styles.urlInput]}
                  value={urlHost}
                  onChangeText={(v) => { setUrlHost(v); markDirty() }}
                  placeholder="192.168.1.10:8766"
                  placeholderTextColor={theme.text.secondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>{t('servers:form.apiKey')}</Text>
                <TouchableOpacity onPress={pasteApiKey} hitSlop={8}>
                  <Text style={styles.pasteBtn}>{t('button.paste')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.apiKeyRow}>
                <TextInput
                  style={[styles.input, styles.apiKeyInput]}
                  value={apiKey}
                  onChangeText={(v) => { setApiKey(v); markDirty() }}
                  placeholder="Paste your API token here"
                  placeholderTextColor={theme.text.secondary}
                  secureTextEntry={!showApiKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
                <TouchableOpacity
                  onPress={() => setShowApiKey((v) => !v)}
                  hitSlop={8}
                  style={styles.eyeBtn}
                >
                  {showApiKey
                    ? <EyeSlash size={18} color={theme.text.secondary} />
                    : <Eye size={18} color={theme.text.secondary} />}
                </TouchableOpacity>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <XCircle size={14} color={theme.text.danger} weight="fill" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.saveBtn, (!urlHost.trim() || !apiKey.trim()) && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={!urlHost.trim() || !apiKey.trim()}
              >
                <Text style={styles.saveBtnText}>{t('button.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAwareScrollView>
      </Modal>

      <PairScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onSuccess={handleScanSuccess}
      />
    </>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    overlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    avoidingView: {
      flex: 1,
    },
    avoidingViewContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xl,
    },
    modal: {
      width: '100%',
      backgroundColor: theme.bg.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
      maxHeight: '85%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    title: {
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
    },
    closeBtn: {
      padding: spacing.xs,
    },
    body: {
      padding: spacing.md,
      gap: spacing.sm,
    },
    fieldLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    fieldLabel: {
      color: theme.text.secondary,
      fontSize: font.sm,
      fontWeight: '500',
      marginBottom: 2,
    },
    input: {
      backgroundColor: theme.bg.primary,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      color: theme.text.primary,
      fontSize: font.base,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      minHeight: 44,
    },
    urlRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      zIndex: 1,
    },
    urlInput: {
      flex: 1,
    },
    protocolBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.bg.primary,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: spacing.sm,
      minHeight: 44,
    },
    protocolText: {
      color: theme.text.primary,
      fontSize: font.base,
    },
    protocolOptions: {
      position: 'absolute',
      top: 46,
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
    apiKeyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    apiKeyInput: {
      flex: 1,
    },
    eyeBtn: {
      padding: spacing.xs,
      minHeight: 44,
      justifyContent: 'center',
    },
    pasteBtn: {
      color: theme.text.accent,
      fontSize: font.sm,
      fontWeight: '500',
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      backgroundColor: 'rgba(248,81,73,0.08)',
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: 'rgba(248,81,73,0.25)',
      padding: spacing.sm,
    },
    errorText: {
      color: theme.text.danger,
      fontSize: font.sm,
      flex: 1,
      lineHeight: 18,
    },
    saveBtn: {
      backgroundColor: theme.text.accent,
      borderRadius: radius.md,
      padding: spacing.md,
      alignItems: 'center',
      minHeight: 44,
      justifyContent: 'center',
      marginTop: spacing.xs,
    },
    saveBtnDisabled: {
      opacity: 0.4,
    },
    saveBtnText: {
      color: theme.text.onAccent,
      fontSize: font.base,
      fontWeight: '600',
    },
  })
}
