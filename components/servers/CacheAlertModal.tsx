import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ScrollView } from 'react-native'
import { WarningCircle, CheckCircle, CircleIcon } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { getCacheAlert, resolveCacheAlert } from '@/services/api-client'
import { useServersStore } from '@/stores/servers'
import type { CacheAlertResolveAction } from '@/types/api'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'

interface Props {
  visible: boolean
  serverId: string | null
  onClose: () => void
  onResolved: (backupPath?: string) => void
}

const DESTRUCTIVE_ACTIONS: CacheAlertResolveAction[] = ['prune_all', 'prune_selected', 'reset_rescan']

export function CacheAlertModal({ visible, serverId, onClose, onResolved }: Props) {
  const { t } = useTranslation('servers')
  const theme = useTheme()
  const isGlass = useIsGlass()
  const styles = makeStyles(theme)
  const servers = useServersStore((s) => s.servers)
  const cacheAlert = useServersStore((s) => s.cacheAlert)
  const setCacheAlert = useServersStore((s) => s.setCacheAlert)

  const alert = serverId ? cacheAlert[serverId] : null
  const [pendingAction, setPendingAction] = useState<CacheAlertResolveAction | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [selectError, setSelectError] = useState(false)

  // Reset transient UI state whenever a different alert is shown, without an
  // effect: adjust state during render per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [shownFingerprint, setShownFingerprint] = useState(alert?.fingerprint)
  if (alert?.fingerprint !== shownFingerprint) {
    setShownFingerprint(alert?.fingerprint)
    setPendingAction(null)
    setSelectedIds(new Set())
    setSubmitting(false)
    setSelectError(false)
  }

  if (!visible || !serverId || !alert) return null

  const serverLabel = servers[serverId]?.label || servers[serverId]?.url || serverId
  const missing = alert.missing ?? []

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const refetchAlert = async () => {
    const fresh = await getCacheAlert(serverId)
    setCacheAlert(serverId, fresh)
  }

  const submit = async (action: CacheAlertResolveAction) => {
    setSubmitting(true)
    try {
      const result = await resolveCacheAlert(serverId, {
        fingerprint: alert.fingerprint,
        action,
        ids: action === 'prune_selected' ? Array.from(selectedIds) : undefined,
      })
      if (!result.ok) {
        // Fingerprint changed since we fetched — refetch and let the user re-decide.
        await refetchAlert()
        setPendingAction(null)
        return
      }
      if ('alreadyResolved' in result) {
        onResolved()
      } else {
        onResolved(result.backupPath)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleActionPress = (action: CacheAlertResolveAction) => {
    if (action === 'prune_selected' && selectedIds.size === 0) {
      setSelectError(true)
      return
    }
    setSelectError(false)
    if (DESTRUCTIVE_ACTIONS.includes(action)) {
      setPendingAction(action)
    } else {
      void submit(action)
    }
  }

  const confirmMessage = pendingAction === 'prune_all'
    ? t('cacheAlert.confirmPruneAll', { count: alert.missingCount })
    : pendingAction === 'prune_selected'
      ? t('cacheAlert.confirmPruneSelected', { count: selectedIds.size })
      : pendingAction === 'reset_rescan'
        ? t('cacheAlert.confirmResetRescan')
        : ''

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={submitting ? undefined : onClose}>
        <Pressable style={[styles.sheet, isGlass && styles.sheetGlass]} onPress={() => {}}>
          <GlassFill />
          <View style={styles.header}>
            <WarningCircle size={20} color={theme.status.failed} weight="fill" />
            <Text style={styles.title}>
              {t('cacheAlert.title', {
                missing: alert.missingCount,
                total: alert.totalRows,
                server: serverLabel,
              })}
            </Text>
          </View>

          {alert.severity === 'high' ? (
            <Text style={styles.backupHint}>{t('cacheAlert.backupHint')}</Text>
          ) : null}

          {pendingAction ? (
            <View style={styles.confirmBlock}>
              <Text style={styles.confirmTitle}>{t('cacheAlert.confirmTitle')}</Text>
              <Text style={styles.confirmMessage}>{confirmMessage}</Text>
              <View style={styles.confirmActions}>
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={() => setPendingAction(null)}
                  disabled={submitting}
                >
                  <Text style={styles.confirmBtnText}>{t('cacheAlert.confirmCancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, styles.confirmBtnDestructive]}
                  onPress={() => submit(pendingAction)}
                  disabled={submitting}
                >
                  <Text style={[styles.confirmBtnText, { color: theme.text.danger }]}>
                    {t('cacheAlert.confirmProceed')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {missing.length > 0 ? (
                <>
                  <View style={styles.selectRow}>
                    <TouchableOpacity onPress={() => setSelectedIds(new Set(missing.map((m) => m.id)))}>
                      <Text style={styles.selectLink}>{t('cacheAlert.selectAll')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setSelectedIds(new Set())}>
                      <Text style={styles.selectLink}>{t('cacheAlert.selectNone')}</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={styles.list}>
                    {missing.map((item) => {
                      const selected = selectedIds.has(item.id)
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.listItem}
                          onPress={() => toggleId(item.id)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selected }}
                        >
                          {selected
                            ? <CheckCircle size={18} color={theme.text.accent} weight="fill" />
                            : <CircleIcon size={18} color={theme.text.secondary} />}
                          <Text style={styles.listItemText} numberOfLines={1}>
                            {item.title || item.filePath}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </ScrollView>
                  {selectError ? (
                    <Text style={styles.selectErrorText}>{t('cacheAlert.selectAtLeastOne')}</Text>
                  ) : null}
                </>
              ) : null}

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleActionPress('prune_all')}
                  disabled={submitting}
                >
                  <Text style={styles.actionText}>{t('cacheAlert.actionPruneAll')}</Text>
                </TouchableOpacity>
                {missing.length > 0 ? (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleActionPress('prune_selected')}
                    disabled={submitting}
                  >
                    <Text style={styles.actionText}>{t('cacheAlert.actionPruneSelected')}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleActionPress('reset_rescan')}
                  disabled={submitting}
                >
                  <Text style={styles.actionText}>{t('cacheAlert.actionResetRescan')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleActionPress('ignore')}
                  disabled={submitting}
                >
                  <Text style={styles.actionText}>{t('cacheAlert.actionIgnore')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
      paddingBottom: 40,
      paddingHorizontal: spacing.md,
    },
    sheet: {
      backgroundColor: theme.bg.secondary,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.md,
      gap: spacing.sm,
      maxHeight: '80%',
    },
    sheetGlass: {
      backgroundColor: 'transparent',
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    title: {
      flex: 1,
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
      lineHeight: 20,
    },
    backupHint: {
      color: theme.text.secondary,
      fontSize: font.xs,
      lineHeight: 16,
    },
    selectRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    selectLink: {
      color: theme.text.accent,
      fontSize: font.xs,
      fontWeight: '500',
    },
    list: {
      maxHeight: 200,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    listItemText: {
      flex: 1,
      color: theme.text.primary,
      fontSize: font.sm,
    },
    selectErrorText: {
      color: theme.text.danger,
      fontSize: font.xs,
    },
    actions: {
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    actionBtn: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: theme.bg.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    actionText: {
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '500',
    },
    confirmBlock: {
      gap: spacing.sm,
    },
    confirmTitle: {
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
    },
    confirmMessage: {
      color: theme.text.secondary,
      fontSize: font.sm,
      lineHeight: 19,
    },
    confirmActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    confirmBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      backgroundColor: theme.bg.card,
    },
    confirmBtnDestructive: {
      borderColor: theme.text.danger,
    },
    confirmBtnText: {
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
    },
  })
}
