import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Check } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { isRTLLocale, SUPPORTED_LOCALES } from '@/lib/locale'
import type { SupportedLocale } from '@/lib/locale'
import { useSettingsStore } from '@/stores/settings'
import { PrimaryButton } from '../components/PrimaryButton'
import { colors, fonts } from '../theme'

interface Props {
  onContinue: () => void
  busy?: boolean
  error?: string | null
}

export function LanguageStep({ onContinue, busy = false, error }: Props) {
  const { t, i18n } = useTranslation(['onboarding', 'settings'])
  const locale = useSettingsStore((state) => state.locale)
  const setLocale = useSettingsStore((state) => state.setLocale)
  const [focusedLocale, setFocusedLocale] = useState<SupportedLocale | null>(null)
  const headingDirectionStyle = isRTLLocale(locale) ? styles.headingRtl : styles.headingLtr

  const selectLocale = (nextLocale: typeof locale) => {
    if (busy) return
    setLocale(nextLocale)
    void i18n.changeLanguage(nextLocale)
  }

  return (
    <View style={styles.root}>
      <Text style={[styles.eyebrow, headingDirectionStyle]}>{t('onboarding:language.eyebrow')}</Text>
      <Text style={[styles.headline, headingDirectionStyle]}>{t('onboarding:language.headline')}</Text>
      <Text style={[styles.body, headingDirectionStyle]}>{t('onboarding:language.body')}</Text>

      <View accessibilityRole="radiogroup" style={styles.options}>
        {SUPPORTED_LOCALES.map((option) => {
          const selected = locale === option.code
          return (
            <Pressable
              key={option.code}
              testID={`onboarding-language-option-${option.code}`}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: busy }}
              disabled={busy}
              onPress={() => selectLocale(option.code)}
              onFocus={() => setFocusedLocale(option.code)}
              onBlur={() => setFocusedLocale((focused) => focused === option.code ? null : focused)}
              style={[
                styles.option,
                { direction: option.direction },
                selected && styles.optionSelected,
                focusedLocale === option.code && styles.optionFocused,
              ]}
            >
              <Text
                style={[
                  styles.optionLabel,
                  selected && styles.optionLabelSelected,
                  option.direction === 'rtl' && styles.optionLabelRtl,
                  {
                    writingDirection: option.direction,
                    textAlign: 'auto',
                  },
                ]}
              >
                {t(option.labelKey, { ns: 'settings' })}
              </Text>
              <View style={[styles.check, selected && styles.checkSelected]}>
                {selected ? <Check size={16} weight="bold" color={colors.ink1} /> : null}
              </View>
            </Pressable>
          )
        })}
      </View>

      <View style={styles.flex} />
      {error ? (
        <Text testID="onboarding-language-error" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <PrimaryButton
        testID="onboarding-language-cta"
        onPress={onContinue}
        disabled={busy}
      >
        {t('onboarding:language.continue')}
      </PrimaryButton>
      <View style={styles.bottomSpace} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 22, paddingTop: 20 },
  headingLtr: { direction: 'ltr', writingDirection: 'ltr', textAlign: 'auto', width: '100%' },
  headingRtl: { direction: 'rtl', writingDirection: 'rtl', textAlign: 'auto', width: '100%' },
  eyebrow: {
    color: colors.blue400,
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
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '600',
    letterSpacing: -0.7,
    marginBottom: 8,
  },
  body: {
    color: colors.fg2,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 24,
  },
  options: { width: '100%', gap: 10 },
  option: {
    width: '100%',
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink5,
    backgroundColor: colors.ink2,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionSelected: {
    borderColor: colors.blue500,
    backgroundColor: colors.ink3,
  },
  optionFocused: {
    borderColor: colors.blue400,
    borderWidth: 2,
  },
  optionLabel: {
    flex: 1,
    color: colors.fg1,
    fontFamily: fonts.sans,
    fontSize: 17,
    fontWeight: '500',
  },
  optionLabelRtl: { paddingStart: 12 },
  optionLabelSelected: { color: colors.fg0 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSelected: {
    borderColor: colors.blue500,
    backgroundColor: colors.blue500,
  },
  flex: { flex: 1 },
  error: {
    color: colors.red400,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 10,
  },
  bottomSpace: { height: 14 },
})
