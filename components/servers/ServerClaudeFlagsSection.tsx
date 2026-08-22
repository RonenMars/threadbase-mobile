import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/contexts/ThemeContext'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useClaudeFlags, useUpdateClaudeFlags } from '@/hooks/useClaudeFlags'
import { claudeFlagValueRisk } from '@/types/api'
import type { ClaudeFlagDefinition, ClaudeFlagValue, ClaudeFlagValues } from '@/types/api'
import { confirmDangerousChange } from '@/utils/confirmDangerousChange'

interface Props {
  serverId: string
}

/** Lists render as comma-separated text; empty entries are dropped on parse. */
function valueToText(value: ClaudeFlagValue | undefined): string {
  if (value === undefined) return ''
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

function textToValue(def: ClaudeFlagDefinition, text: string): ClaudeFlagValue | undefined {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  if (def.valueType === 'list') {
    const items = trimmed.split(',').map((s) => s.trim()).filter(Boolean)
    return items.length > 0 ? items : undefined
  }
  return trimmed
}

/**
 * Per-server Claude CLI flags.
 *
 * Renders generically from the registry the SERVER supplies, so a streamer that
 * knows about a newer flag needs no app update. Hidden entirely when the server
 * predates the feature (query resolves to null).
 */
// CLI flags the user retypes verbatim, not copy — translating them would make them wrong.
// eslint-disable-next-line i18next/no-literal-string
const EXTRA_ARGS_PLACEHOLDER = '--bare --agent reviewer'

export function ServerClaudeFlagsSection({ serverId }: Props) {
  const { t } = useTranslation(['servers', 'common'])
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])

  const { data, isLoading } = useClaudeFlags(serverId)
  const update = useUpdateClaudeFlags(serverId)

  const [values, setValues] = useState<ClaudeFlagValues>({})
  const [extraArgs, setExtraArgs] = useState('')

  // Every flag's copy is enumerated here rather than built as
  // t(`…flags.${def.id}.label`), so each key is a literal a static analyser can
  // see — `i18next-cli status --unused` cannot resolve a key assembled from a
  // server value, and would report all twelve as dead.
  //
  // `def.id` is a plain string on the wire (types/api.ts:473) and the registry
  // comes from the streamer, so this list is a snapshot of the ids we have copy
  // for — the same snapshot locales/*/servers.json already encodes. An id that
  // isn't here degrades to the raw CLI flag, which is what defaultValue did.
  const flagCopy = useMemo<Record<string, { label: string; description: string }>>(
    () => ({
      permissionMode: { label: t('servers:claudeFlags.flags.permissionMode.label'), description: t('servers:claudeFlags.flags.permissionMode.description') },
      addDir: { label: t('servers:claudeFlags.flags.addDir.label'), description: t('servers:claudeFlags.flags.addDir.description') },
      allowedTools: { label: t('servers:claudeFlags.flags.allowedTools.label'), description: t('servers:claudeFlags.flags.allowedTools.description') },
      disallowedTools: { label: t('servers:claudeFlags.flags.disallowedTools.label'), description: t('servers:claudeFlags.flags.disallowedTools.description') },
      maxBudgetUsd: { label: t('servers:claudeFlags.flags.maxBudgetUsd.label'), description: t('servers:claudeFlags.flags.maxBudgetUsd.description') },
      fallbackModel: { label: t('servers:claudeFlags.flags.fallbackModel.label'), description: t('servers:claudeFlags.flags.fallbackModel.description') },
    }),
    [t],
  )

  // Seed the edit state from the server's copy by ADJUSTING STATE DURING RENDER
  // (https://react.dev/reference/react/useState#storing-information-from-previous-renders)
  // rather than in an effect, which would cost a second render pass on every load.
  //
  // Keyed on the CONTENT, not the object identity: react-query hands back a
  // fresh object on every refetch, so an identity key would re-seed mid-edit and
  // silently discard whatever the user had just typed.
  const serverSnapshot = data ? JSON.stringify([data.values, data.extraArgs]) : null
  const [seededFrom, setSeededFrom] = useState<string | null>(null)
  if (serverSnapshot !== null && serverSnapshot !== seededFrom) {
    setSeededFrom(serverSnapshot)
    setValues(data ? data.values : {})
    setExtraArgs(data?.extraArgs ?? '')
  }

  if (isLoading) {
    return (
      <View style={styles.section}>
        <ActivityIndicator color={theme.text.accent} />
      </View>
    )
  }

  // null = server predates the feature. Render nothing rather than an error.
  if (!data) return null

  const apply = (def: ClaudeFlagDefinition, next: ClaudeFlagValue | undefined) => {
    setValues((prev) => {
      const copy = { ...prev }
      if (next === undefined) delete copy[def.id]
      else copy[def.id] = next
      return copy
    })
  }

  const stage = (def: ClaudeFlagDefinition, next: ClaudeFlagValue | undefined) => {
    // Gate only the transition INTO a dangerous value; clearing one is always
    // allowed without friction. Everything else applies synchronously.
    if (next !== undefined && claudeFlagValueRisk(def, next) === 'dangerous') {
      void confirmDangerousChange(t('servers:claudeFlags.dangerousExplanation')).then((ok) => {
        if (ok) apply(def, next)
      })
      return
    }
    apply(def, next)
  }

  const onSave = () => {
    update.mutate({ values, extraArgs: extraArgs.trim() || undefined })
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('servers:claudeFlags.title')}</Text>
      <Text style={styles.sectionDescription}>{t('servers:claudeFlags.description')}</Text>

      {!data.persisted ? (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>{t('servers:claudeFlags.notPersisted')}</Text>
        </View>
      ) : null}

      {data.registry.map((def) => {
        const value = values[def.id]
        const dangerous = value !== undefined && claudeFlagValueRisk(def, value) === 'dangerous'
        const copy = flagCopy[def.id] ?? { label: def.flag, description: '' }

        return (
          <View key={def.id} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, dangerous && styles.rowLabelDangerous]}>
                {copy.label}
              </Text>
              {copy.description ? (
                <Text style={styles.rowDescription}>{copy.description}</Text>
              ) : null}
            </View>

            {def.valueType === 'boolean' ? (
              <Switch
                value={value === true}
                onValueChange={(on) => stage(def, on ? true : undefined)}
                trackColor={{ false: theme.border, true: theme.text.accent }}
                thumbColor="#fff"
                testID={`claude-flag-${def.id}`}
              />
            ) : def.valueType === 'enum' ? (
              <View style={styles.enumRow}>
                {(def.enumValues ?? []).map((option) => {
                  const selected = value === option
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[styles.chip, selected && styles.chipActive]}
                      onPress={() => stage(def, selected ? undefined : option)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      testID={`claude-flag-${def.id}-${option}`}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            ) : (
              <TextInput
                style={styles.input}
                value={valueToText(value)}
                onChangeText={(text) => stage(def, textToValue(def, text))}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={def.valueType === 'list' ? t('servers:claudeFlags.listHint') : def.flag}
                placeholderTextColor={theme.text.secondary}
                testID={`claude-flag-${def.id}`}
              />
            )}
          </View>
        )
      })}

      <Text style={styles.rowLabel}>{t('servers:claudeFlags.extraArgsLabel')}</Text>
      <Text style={styles.rowDescription}>{t('servers:claudeFlags.extraArgsUnsupported')}</Text>
      <TextInput
        style={styles.input}
        value={extraArgs}
        onChangeText={setExtraArgs}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={EXTRA_ARGS_PLACEHOLDER}
        placeholderTextColor={theme.text.secondary}
        testID="claude-flag-extra-args"
      />

      {update.isError ? (
        <Text style={styles.errorText}>{update.error.message}</Text>
      ) : null}

      <TouchableOpacity
        style={[styles.saveBtn, update.isPending && styles.saveBtnDisabled]}
        onPress={onSave}
        disabled={update.isPending}
        testID="claude-flags-save"
      >
        {update.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>{t('servers:claudeFlags.save')}</Text>
        )}
      </TouchableOpacity>
    </View>
  )
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    section: { marginTop: spacing.lg, gap: spacing.sm },
    sectionTitle: { color: theme.text.primary, fontSize: font.base, fontWeight: '600' },
    sectionDescription: { color: theme.text.secondary, fontSize: font.sm },
    warningBox: {
      backgroundColor: theme.bg.secondary,
      borderRadius: radius.sm,
      padding: spacing.sm,
    },
    warningText: { color: theme.text.secondary, fontSize: font.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    rowText: { flex: 1, gap: 2 },
    rowLabel: { color: theme.text.primary, fontSize: font.sm, fontWeight: '500' },
    rowLabelDangerous: { color: theme.text.danger },
    rowDescription: { color: theme.text.secondary, fontSize: font.xs },
    enumRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, maxWidth: '55%' },
    chip: {
      paddingHorizontal: spacing.sm,
      // minHeight, not paddingVertical: these chips set permissionMode (and now
      // model/effort), so they need a real 44pt tap target rather than the ~24pt
      // that paddingVertical: 4 alone produced. Centering keeps the label where
      // it was, so the visual weight of the row is unchanged.
      minHeight: 44,
      justifyContent: 'center',
      borderRadius: radius.sm,
      backgroundColor: theme.bg.secondary,
    },
    chipActive: { backgroundColor: theme.text.accent },
    chipText: { color: theme.text.secondary, fontSize: font.xs },
    chipTextActive: { color: '#fff' },
    input: {
      color: theme.text.primary,
      backgroundColor: theme.bg.secondary,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      fontSize: font.sm,
      minWidth: 140,
      maxWidth: '55%',
    },
    errorText: { color: theme.text.danger, fontSize: font.sm },
    saveBtn: {
      backgroundColor: theme.text.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: '#fff', fontSize: font.sm, fontWeight: '600' },
  })
