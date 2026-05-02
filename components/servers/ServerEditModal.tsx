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
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { X, Eye, EyeSlash, QrCode, XCircle } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { PairScannerModal } from '@/components/pair/PairScannerModal'
import { useServersStore } from '@/stores/servers'
import { wsManager } from '@/services/ws-client'
import { dark, font, radius, spacing } from '@/constants/theme'
import type { ExchangeResult } from '@/services/pair-exchange'

interface Props {
  visible: boolean
  /** null = Add mode, string = Edit mode (serverId) */
  serverId: string | null
  onClose: () => void
}

export function ServerEditModal({ visible, serverId, onClose }: Props) {
  const { t } = useTranslation('common')
  const { servers, addServer, editServer } = useServersStore()
  const server = serverId ? servers[serverId] : null
  const isEditMode = serverId !== null

  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  // Pre-fill fields when opening
  useEffect(() => {
    if (visible) {
      if (server) {
        setLabel(server.label ?? '')
        setUrl(server.url)
        setApiKey(server.apiKey)
      } else {
        setLabel('')
        setUrl('')
        setApiKey('')
      }
      setError(null)
      setIsDirty(false)
      setShowApiKey(false)
    }
  }, [visible, serverId])

  function markDirty() {
    if (!isDirty) setIsDirty(true)
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
    const trimmedUrl = url.trim().replace(/\/+$/, '')
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
    setUrl(result.url)
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

        <KeyboardAvoidingView
          style={styles.avoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{isEditMode ? 'Edit Server' : 'Add Server'}</Text>
              <TouchableOpacity onPress={handleDismiss} hitSlop={12} style={styles.closeBtn}>
                <X size={20} color={dark.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
              {/* Label row — QR icon right-aligned */}
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Label (optional)</Text>
                <TouchableOpacity
                  onPress={() => setScannerOpen(true)}
                  hitSlop={12}
                  accessibilityLabel="Scan QR code"
                >
                  <QrCode size={18} color={dark.text.accent} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                value={label}
                onChangeText={(v) => { setLabel(v); markDirty() }}
                placeholder="e.g. Work Mac, Home Server"
                placeholderTextColor={dark.text.secondary}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
              />

              <Text style={styles.fieldLabel}>Server URL</Text>
              <TextInput
                style={styles.input}
                value={url}
                onChangeText={(v) => { setUrl(v); markDirty() }}
                placeholder="http://192.168.1.10:7070"
                placeholderTextColor={dark.text.secondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="next"
              />

              <Text style={styles.fieldLabel}>API Key</Text>
              <View style={styles.apiKeyRow}>
                <TextInput
                  style={[styles.input, styles.apiKeyInput]}
                  value={apiKey}
                  onChangeText={(v) => { setApiKey(v); markDirty() }}
                  placeholder="Enter THREADBASE_API_KEY"
                  placeholderTextColor={dark.text.secondary}
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
                    ? <EyeSlash size={18} color={dark.text.secondary} />
                    : <Eye size={18} color={dark.text.secondary} />}
                </TouchableOpacity>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <XCircle size={14} color={dark.text.danger} weight="fill" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.saveBtn, (!url.trim() || !apiKey.trim()) && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={!url.trim() || !apiKey.trim()}
              >
                <Text style={styles.saveBtnText}>{t('button.save')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <PairScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onSuccess={handleScanSuccess}
      />
    </>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  avoidingView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  modal: {
    width: '100%',
    backgroundColor: dark.bg.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: dark.border,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.border,
  },
  title: {
    color: dark.text.primary,
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
    color: dark.text.secondary,
    fontSize: font.sm,
    fontWeight: '500',
    marginBottom: 2,
  },
  input: {
    backgroundColor: dark.bg.primary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    color: dark.text.primary,
    fontSize: font.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
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
    color: dark.text.danger,
    fontSize: font.sm,
    flex: 1,
    lineHeight: 18,
  },
  saveBtn: {
    backgroundColor: dark.text.accent,
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
    color: '#fff',
    fontSize: font.base,
    fontWeight: '600',
  },
})
