import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { Eye, EyeSlash, CaretDown, ClipboardText } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/contexts/ThemeContext'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { ltrContentStyle, textDirectionStyle, useAppDirection } from '@/lib/rtl'

export function splitUrl(full: string): { protocol: 'http' | 'https'; host: string } {
  if (full.startsWith('https://')) return { protocol: 'https', host: full.slice(8).replace(/\/+$/, '') }
  if (full.startsWith('http://')) return { protocol: 'http', host: full.slice(7).replace(/\/+$/, '') }
  return { protocol: 'http', host: full.replace(/\/+$/, '') }
}

interface Props {
  /** Omit onLabelChange to hide the label field entirely */
  label?: string
  onLabelChange?: (v: string) => void
  /** Rendered on the right of the label field's title row (e.g. QR scan button) */
  labelAccessory?: React.ReactNode
  protocol: 'http' | 'https'
  onProtocolChange: (p: 'http' | 'https') => void
  urlHost: string
  onUrlHostChange: (v: string) => void
  apiKey: string
  onApiKeyChange: (v: string) => void
  /** Overrides the default "API Key" field title (e.g. "Token" in onboarding) */
  keyFieldLabel?: string
  /** Rendered next to the field titles (e.g. info tooltips in onboarding) */
  urlAccessory?: React.ReactNode
  keyAccessory?: React.ReactNode
  editable?: boolean
  urlInputTestID?: string
  keyInputTestID?: string
  onSubmitEditing?: () => void
}

export function ServerFormFields({
  label = '',
  onLabelChange,
  labelAccessory,
  protocol,
  onProtocolChange,
  urlHost,
  onUrlHostChange,
  apiKey,
  onApiKeyChange,
  keyFieldLabel,
  urlAccessory,
  keyAccessory,
  editable = true,
  urlInputTestID,
  keyInputTestID,
  onSubmitEditing,
}: Props) {
  const { t } = useTranslation('servers')
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { direction } = useAppDirection()
  const labelDirection = textDirectionStyle(direction)

  const [showApiKey, setShowApiKey] = useState(false)
  const [showProtocolPicker, setShowProtocolPicker] = useState(false)

  const apiKeyTitle = keyFieldLabel ?? t('form.apiKey')

  // Full URLs (typed or pasted directly into the host field) auto-split so the
  // host input never carries a scheme — otherwise saving would produce
  // "http://http://host".
  function handleUrlHostChange(v: string) {
    if (v.startsWith('http://') || v.startsWith('https://')) {
      const { protocol: p, host } = splitUrl(v)
      onProtocolChange(p)
      onUrlHostChange(host)
    } else {
      onUrlHostChange(v)
    }
  }

  // Paste handlers clear the field first so a stale value never survives an
  // empty or failed clipboard read.
  async function pasteUrl() {
    onUrlHostChange('')
    const text = await Clipboard.getStringAsync()
    if (!text) return
    const { protocol: p, host } = splitUrl(text.trim())
    onProtocolChange(p)
    onUrlHostChange(host)
  }

  async function pasteApiKey() {
    onApiKeyChange('')
    const text = await Clipboard.getStringAsync()
    if (!text) return
    onApiKeyChange(text.trim())
  }

  return (
    <View style={styles.wrap}>
      {onLabelChange && (
        <>
          <View style={styles.fieldLabelRow}>
            <Text style={[styles.fieldLabel, labelDirection]}>{t('form.labelOptional')}</Text>
            {labelAccessory}
          </View>
          <TextInput
            style={[styles.input, labelDirection]}
            value={label}
            onChangeText={onLabelChange}
            placeholder={t('form.labelPlaceholder')}
            placeholderTextColor={theme.text.secondary}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
            editable={editable}
          />
        </>
      )}

      <View style={styles.fieldLabelRow}>
        <View style={styles.fieldLabelGroup}>
          <Text style={[styles.fieldLabel, labelDirection]}>{t('form.serverUrl')}</Text>
          {urlAccessory}
        </View>
        <TouchableOpacity testID="server-form-paste-url" onPress={pasteUrl} hitSlop={8} disabled={!editable}>
          <ClipboardText size={18} color={theme.text.accent} />
        </TouchableOpacity>
      </View>
      <View style={styles.urlRow}>
        <View>
          <TouchableOpacity
            style={styles.protocolBtn}
            onPress={() => setShowProtocolPicker((v) => !v)}
            disabled={!editable}
          >
            <Text style={[styles.protocolText, ltrContentStyle]}>{protocol}://</Text>
            <CaretDown size={10} color={theme.text.secondary} weight="bold" />
          </TouchableOpacity>
          {showProtocolPicker && (
            <View style={styles.protocolOptions}>
              {(['http', 'https'] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={styles.protocolOption}
                  onPress={() => { onProtocolChange(opt); setShowProtocolPicker(false) }}
                >
                  <Text style={[styles.protocolOptionText, ltrContentStyle, protocol === opt && styles.protocolOptionSelected]}>
                    {opt}://
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <TextInput
          testID={urlInputTestID}
          style={[styles.input, styles.urlInput, ltrContentStyle]}
          value={urlHost}
          onChangeText={handleUrlHostChange}
          placeholder="192.168.1.10:8766"
          placeholderTextColor={theme.text.secondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="next"
          editable={editable}
        />
      </View>

      <View style={styles.fieldLabelRow}>
        <View style={styles.fieldLabelGroup}>
          <Text style={[styles.fieldLabel, labelDirection]}>{apiKeyTitle}</Text>
          {keyAccessory}
        </View>
        <TouchableOpacity testID="server-form-paste-key" onPress={pasteApiKey} hitSlop={8} disabled={!editable}>
          <ClipboardText size={18} color={theme.text.accent} />
        </TouchableOpacity>
      </View>
      <View style={styles.apiKeyRow}>
        <TextInput
          testID={keyInputTestID}
          style={[styles.input, styles.apiKeyInput, ltrContentStyle]}
          value={apiKey}
          onChangeText={onApiKeyChange}
          placeholder={t('form.apiKeyPlaceholder')}
          placeholderTextColor={theme.text.secondary}
          secureTextEntry={!showApiKey}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={onSubmitEditing}
          editable={editable}
        />
        <TouchableOpacity
          testID="server-form-toggle-api-key"
          onPress={() => setShowApiKey((v) => !v)}
          hitSlop={8}
          style={styles.eyeBtn}
        >
          {showApiKey
            ? <EyeSlash size={18} color={theme.text.secondary} />
            : <Eye size={18} color={theme.text.secondary} />}
        </TouchableOpacity>
      </View>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    wrap: {
      gap: spacing.sm,
    },
    fieldLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    fieldLabelGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    fieldLabel: {
      color: theme.text.secondary,
      fontSize: font.base,
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
      direction: 'ltr',
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
      direction: 'ltr',
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
  })
}
