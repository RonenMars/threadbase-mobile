import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { PlugsConnected, ArrowRight } from 'phosphor-react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { font, spacing, radius, type Theme } from '@/constants/theme'

interface Props {
  /** Called when the CTA is tapped. Defaults to pushing /settings. */
  onAddServer?: () => void
}

export function NoServersWelcome({ onAddServer }: Props) {
  const theme = useTheme()
  const s = makeStyles(theme)
  const { t } = useTranslation('sessions')
  const router = useRouter()

  const handlePress = onAddServer ?? (() => router.push('/settings'))

  return (
    <View style={s.container}>
      <View style={s.card}>
        <View style={s.iconWrap}>
          <PlugsConnected size={32} color={theme.text.accent} weight="light" />
        </View>
        <Text style={s.title}>{t('noServer.title')}</Text>
        <Text style={s.desc}>{t('noServer.desc')}</Text>
        <TouchableOpacity
          onPress={() => Linking.openURL(t('noServer.repoUrl'))}
          accessibilityLabel="tb-streamer repository"
          accessibilityRole="link"
        >
          <Text style={s.link}>{t('noServer.repoLink')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.btn}
          onPress={handlePress}
          activeOpacity={0.8}
          accessibilityLabel="Add Server"
        >
          <Text style={s.btnText}>{t('noServer.cta')}</Text>
          <ArrowRight size={16} color="#fff" weight="bold" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    card: {
      width: '100%',
      backgroundColor: theme.bg.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.xl,
      alignItems: 'center',
      gap: spacing.md,
    },
    iconWrap: {
      width: 64,
      height: 64,
      borderRadius: radius.md,
      backgroundColor: theme.bg.secondary,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    title: {
      color: theme.text.primary,
      fontSize: font.lg,
      fontWeight: '700',
      textAlign: 'center',
      letterSpacing: -0.3,
    },
    desc: {
      color: theme.text.secondary,
      fontSize: font.base,
      textAlign: 'center',
      lineHeight: 20,
    },
    link: {
      color: theme.text.accent,
      fontSize: font.base,
      textDecorationLine: 'underline',
    },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: theme.text.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.xs,
    },
    btnText: {
      color: '#fff',
      fontSize: font.base,
      fontWeight: '600',
    },
  })
}
