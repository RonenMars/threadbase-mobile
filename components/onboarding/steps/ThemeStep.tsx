import React, { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { THEMES } from '@/constants/theme'
import type { ThemeId } from '@/constants/theme'
import { useSettingsStore } from '@/stores/settings'
import { PrimaryButton } from '../components/PrimaryButton'
import { colors, fonts } from '../theme'

interface Props {
  onNext: () => void
}

const THEME_LABELS: Record<Exclude<ThemeId, 'system'>, string> = {
  dark: 'Dark',
  light: 'Light',
  dracula: 'Dracula',
  catppuccin: 'Mocha',
  catppuccinLatte: 'Latte',
  nord: 'Nord',
  oneDark: 'One Dark',
  oneLight: 'One Light',
  solarizedDark: 'Solarized Dark',
  solarizedLight: 'Solarized Light',
  rosePine: 'Rosé Pine',
  rosePineDawn: 'Rosé Pine Dawn',
  tokyoNight: 'Tokyo Night',
  tokyoNightLight: 'Tokyo Night Light',
  appleGlass: 'Apple Glass',
}

const THEME_IDS = Object.keys(THEMES) as Exclude<ThemeId, 'system'>[]

export function ThemeStep({ onNext }: Props) {
  const { t } = useTranslation('onboarding')
  const setColorScheme = useSettingsStore((s) => s.setColorScheme)
  const currentScheme = useSettingsStore((s) => s.colorScheme)
  const [selected, setSelected] = useState<Exclude<ThemeId, 'system'>>(
    currentScheme === 'system' ? 'dark' : (currentScheme as Exclude<ThemeId, 'system'>)
  )

  function handleSelect(id: Exclude<ThemeId, 'system'>) {
    setSelected(id)
    setColorScheme(id)
  }

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <Text style={styles.eyebrow}>{t('theme.eyebrow')}</Text>
        <Text style={styles.headline}>
          {t('theme.headlineLine1')}{'\n'}
          <Text style={styles.headlineAccent}>{t('valueProp.headlineAccent')}</Text>
        </Text>
        <Text style={styles.body}>{t('theme.body')}</Text>

        <View style={styles.grid}>
          {THEME_IDS.map((id) => {
            const t = THEMES[id]
            const isSelected = selected === id
            return (
              <TouchableOpacity
                key={id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => handleSelect(id)}
                activeOpacity={0.7}
              >
                <View style={[styles.preview, { backgroundColor: t.bg.primary }]}>
                  <View
                    style={{
                      height: 10,
                      borderRadius: 3,
                      backgroundColor: t.bg.card,
                      borderWidth: 1,
                      borderColor: t.border,
                    }}
                  />
                  <View
                    style={{
                      height: 7,
                      width: '55%',
                      borderRadius: 2,
                      backgroundColor: t.text.secondary,
                      opacity: 0.6,
                    }}
                  />
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: t.text.accent,
                      alignSelf: 'flex-end',
                    }}
                  />
                </View>
                <View style={{ backgroundColor: t.bg.secondary }}>
                  <Text style={[styles.cardLabel, { color: t.text.secondary }]}>
                    {THEME_LABELS[id]}
                  </Text>
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton testID="onboarding-theme-cta" onPress={onNext}>
          {t('notifications.continue')}
        </PrimaryButton>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 22, paddingTop: 4 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  eyebrow: {
    color: colors.fg3,
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
    fontSize: 36,
    lineHeight: 36,
    fontWeight: '600',
    letterSpacing: -1,
    textAlign: 'center',
    marginBottom: 14,
  },
  headlineAccent: { color: colors.blue400 },
  body: {
    color: colors.fg2,
    fontFamily: fonts.sans,
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 28,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    width: '100%',
  },
  card: {
    width: '30%',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: colors.blue400,
  },
  preview: {
    height: 60,
    padding: 8,
    gap: 5,
  },
  cardLabel: {
    fontSize: 11,
    fontFamily: fonts.sans,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 5,
  },
  footer: { paddingBottom: 14 },
})
