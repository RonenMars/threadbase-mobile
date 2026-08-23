import React, { useEffect, useRef, useState } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Alert,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { X, QrCode, XCircle } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { PairScannerModal } from '@/components/pair/PairScannerModal'
import { PairConfirmGate, type PendingPairTarget } from '@/components/pair/PairConfirmGate'
import { PairCameraIdentityCard } from '@/components/pair/PairCameraIdentityCard'
import { pendingTargetFromApiKey } from '@/services/pair-confirm-target'
import { formatFingerprint } from '@/services/e2ee/fingerprint'
import { authToken } from '@/services/authed-fetch'
import { ServerClaudeFlagsSection } from '@/components/servers/ServerClaudeFlagsSection'
import { ServerEncryptionSection } from '@/components/servers/ServerEncryptionSection'
import { ServerFormFields, splitUrl } from '@/components/servers/ServerFormFields'
import { useServersStore, type AddServerMeta } from '@/stores/servers'
import { wsManager } from '@/services/ws-client'
import { useTheme } from '@/contexts/ThemeContext'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import type { ExchangeResult } from '@/services/pair-exchange'
import { useDirectionStyle } from '@/lib/rtl'

interface Props {
  visible: boolean
  /** null = Add mode, string = Edit mode (serverId) */
  serverId: string | null
  onClose: () => void
}

export function ServerEditModal({ visible, serverId, onClose }: Props) {
  const { t } = useTranslation(['common', 'servers', 'pair'])
  const theme = useTheme()
  const { addServer, editServer } = useServersStore()
  const isEditMode = serverId !== null

  const [label, setLabel] = useState('')
  const [protocol, setProtocol] = useState<'http' | 'https'>('http')
  const [urlHost, setUrlHost] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [fromScan, setFromScan] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<PendingPairTarget | null>(null)
  const [cameraFingerprint, setCameraFingerprint] = useState<string | null>(null)
  const pendingAdd = useRef<{ url: string; apiKey: string; label?: string } | null>(null)
  const pendingScanMeta = useRef<AddServerMeta | undefined>(undefined)

  const styles = makeStyles(theme)
  const directionStyle = useDirectionStyle()

  // Pre-fill fields when opening. Read the server fresh from the store rather than
  // depending on the `server` reference — background polling replaces that object on
  // every refresh interval, which would otherwise re-fire this effect and clobber
  // whatever the user is currently typing.
  useEffect(() => {
    if (visible) {
      queueMicrotask(() => {
        const current = serverId ? useServersStore.getState().servers[serverId] : null
        if (current) {
          setLabel(current.label ?? '')
          const { protocol: p, host } = splitUrl(current.url)
          setProtocol(p)
          setUrlHost(host)
          setApiKey(current.apiKey)
        } else {
          setLabel('')
          setProtocol('http')
          setUrlHost('')
          setApiKey('')
        }
        setError(null)
        setIsDirty(false)
        setFromScan(false)
        setConfirmTarget(null)
        setCameraFingerprint(null)
        pendingScanMeta.current = undefined
      })
    }
  }, [visible, serverId])

  function markDirty() {
    if (!isDirty) setIsDirty(true)
  }

  function handleDismiss() {
    if (isDirty) {
      Alert.alert(t('servers:discardDialog.title'), t('servers:discardDialog.message'), [
        { text: t('servers:discardDialog.keepEditing'), style: 'cancel' },
        { text: t('servers:discardDialog.discard'), style: 'destructive', onPress: onClose },
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
      setError(t('servers:form.urlRequired'))
      return
    }
    if (!trimmedKey) {
      setError(t('servers:form.apiKeyRequired'))
      return
    }

    setError(null)

    if (!isEditMode && !fromScan) {
      pendingAdd.current = { url: trimmedUrl, apiKey: trimmedKey, label: label.trim() || undefined }
      setConfirmTarget(pendingTargetFromApiKey(trimmedUrl))
      return
    }

    await commitSave(trimmedUrl, trimmedKey, label.trim() || undefined)
  }

  async function commitSave(trimmedUrl: string, trimmedKey: string, labelArg?: string) {
    if (isEditMode && serverId) {
      const result = await editServer(serverId, { url: trimmedUrl, apiKey: trimmedKey, label: labelArg })
      if (result && 'error' in result && result.error === 'duplicate') {
        setError(t('pair:scanner.errors.alreadyAdded'))
        return
      }
      const state = useServersStore.getState()
      const newId = Object.keys(state.servers).find(
        (id) => state.servers[id].url === trimmedUrl && state.servers[id].apiKey === trimmedKey
      ) ?? serverId
      const updated = state.servers[newId]
      if (updated) {
        wsManager.connect(newId, updated.url, authToken(updated))
      }
    } else {
      const result = await addServer(trimmedUrl, trimmedKey, labelArg, pendingScanMeta.current)
      if (result && typeof result === 'object' && 'error' in result && result.error === 'duplicate') {
        setError(t('pair:scanner.errors.alreadyAdded'))
        return
      }
      const newId = result as string
      wsManager.connect(newId, trimmedUrl, trimmedKey)
    }

    onClose()
  }

  function clearScanMeta() {
    setFromScan(false)
    pendingScanMeta.current = undefined
  }

  const modalTitle = isEditMode ? t('servers:action.edit') : t('servers:action.add')

  function handleScanSuccess(result: ExchangeResult) {
    setScannerOpen(false)
    const { protocol: p, host } = splitUrl(result.url)
    setProtocol(p)
    setUrlHost(host)
    setApiKey(result.apiKey)
    if (result.machineName && !label) setLabel(result.machineName)
    setFromScan(true)
    pendingScanMeta.current = {
      deviceId: result.deviceId ?? undefined,
      deviceToken: result.deviceToken ?? undefined,
      capabilities: result.capabilities ?? undefined,
      publicUrl: result.publicUrl ?? undefined,
      serverPublicKey: result.serverPublicKey ?? undefined,
      requireEncryption: result.e2eeRequired,
    }
    if (result.serverPublicKey) {
      setCameraFingerprint(formatFingerprint(result.serverPublicKey))
    }
    markDirty()
  }

  return (
    <>
      {/*
        PairConfirmGate and PairScannerModal are siblings that each render their
        own RN Modal, and iOS presents only one modal per window: asking either
        to appear while this one is still up silently drops it. That is what made
        Save look dead — handleSave sets confirmTarget and returns without saving,
        so with the gate unable to present the form just sat there with no gate,
        no server added and no error. Yield to whichever child needs the window.
      */}
      <Modal
        visible={visible && confirmTarget === null && !scannerOpen}
        transparent
        animationType="fade"
        onRequestClose={handleDismiss}
      >
        <TouchableWithoutFeedback onPress={handleDismiss}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>

        <KeyboardAwareScrollView
          style={[styles.avoidingView, directionStyle]}
          contentContainerStyle={styles.avoidingViewContent}
          keyboardShouldPersistTaps="handled"
          bottomOffset={16}
          pointerEvents="box-none"
        >
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{modalTitle}</Text>
              <TouchableOpacity onPress={handleDismiss} hitSlop={12} style={styles.closeBtn}>
                <X size={20} color={theme.text.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.body}>
              {/* key remount on open resets internal eye/protocol-picker state */}
              <ServerFormFields
                key={String(visible)}
                label={label}
                onLabelChange={(v) => { setLabel(v); markDirty() }}
                labelAccessory={
                  <TouchableOpacity
                    onPress={() => setScannerOpen(true)}
                    hitSlop={12}
                    accessibilityLabel="Scan QR code"
                  >
                    <QrCode size={18} color={theme.text.accent} />
                  </TouchableOpacity>
                }
                protocol={protocol}
                onProtocolChange={(p) => { setProtocol(p); markDirty() }}
                urlHost={urlHost}
                onUrlHostChange={(v) => { setUrlHost(v); clearScanMeta(); markDirty() }}
                apiKey={apiKey}
                onApiKeyChange={(v) => { setApiKey(v); clearScanMeta(); markDirty() }}
                urlInputTestID="server-edit-url-input"
                keyInputTestID="server-edit-key-input"
                onSubmitEditing={handleSave}
              />

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

              {/* Only in edit mode: the pin is written onto a server record, and
                  Add mode has none until Save. */}
              {isEditMode && serverId ? <ServerEncryptionSection serverId={serverId} /> : null}

              {/* Only in edit mode: the flags are fetched from the server, which
                  must already exist (and be reachable) to have any. */}
              {isEditMode && serverId ? <ServerClaudeFlagsSection serverId={serverId} /> : null}
            </View>
          </View>
        </KeyboardAwareScrollView>
      </Modal>

      <PairScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onSuccess={handleScanSuccess}
      />
      <PairConfirmGate
        visible={confirmTarget !== null}
        target={confirmTarget}
        onConfirm={() => {
          const pending = pendingAdd.current
          pendingAdd.current = null
          setConfirmTarget(null)
          if (pending) void commitSave(pending.url, pending.apiKey, pending.label)
        }}
        onCancel={() => {
          pendingAdd.current = null
          setConfirmTarget(null)
        }}
      />
      <PairCameraIdentityCard
        visible={cameraFingerprint !== null}
        fingerprint={cameraFingerprint}
        onDone={() => setCameraFingerprint(null)}
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
      // Opaque under glass — this modal can stack over the Servers Status modal,
      // and a translucent sheet over a translucent sheet bleeds text through.
      backgroundColor: theme.glass?.opaqueSurface ?? theme.bg.card,
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
      fontSize: font.base,
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
