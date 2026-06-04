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
import { useTranslation } from 'react-i18next'
import { PrimaryButton } from '../components/PrimaryButton'
import { colors, fonts } from '../theme'

interface Props {
  /** Initial value when the user navigates back to this step. */
  value: string
  /** Persist on advance — empty string when the user submits blank or skips. */
  onSubmit: (label: string) => void
}

/**
 * Feature 23 — optional server-name slide. Inserted before ConnectStep so the
 * user can label the server they're about to pair without diving into Settings
 * after the fact. Empty submit and Skip are equivalent: both leave the server
 * unlabelled and let the post-pair `host:port` fallback (Bug 28) take over.
 */
export function ServerNameStep({ value, onSubmit }: Props) {
  const { t } = useTranslation('onboarding')
  const [name, setName] = useState(value)

  const submit = () => onSubmit(name.trim())
  const skip = () => onSubmit('')

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <Text style={styles.eyebrow}>{t('serverName.eyebrow')}</Text>
      <Text style={styles.headline}>{t('serverName.headline')}</Text>
      <Text style={styles.body}>{t('serverName.body')}</Text>

      <View style={styles.inputWrap}>
        <Text style={styles.label}>{t('serverName.fieldLabel')}</Text>
        <TextInput
          testID="onboarding-server-name-input"
          value={name}
          onChangeText={setName}
          placeholder={t('serverName.placeholder')}
          placeholderTextColor={colors.fg4}
          style={styles.input}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      </View>

      <View style={styles.flex} />

      <PrimaryButton testID="onboarding-server-name-cta" onPress={submit}>
        {t('serverName.cta')}
      </PrimaryButton>

      <TouchableOpacity
        testID="onboarding-server-name-skip"
        onPress={skip}
        style={styles.skipBtn}
        accessibilityRole="button"
      >
        <Text style={styles.skipText}>{t('serverName.skip')}</Text>
      </TouchableOpacity>

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
    marginBottom: 10,
  },
  body: {
    color: colors.fg2,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  inputWrap: { gap: 6 },
  label: {
    color: colors.fg3,
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '500',
  },
  input: {
    color: colors.fg0,
    fontFamily: fonts.sans,
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.ink5,
    backgroundColor: colors.ink2,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  skipText: {
    color: colors.fg3,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '500',
  },
  flex: { flex: 1 },
})
