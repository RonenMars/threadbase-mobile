import React, { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native'
import { CaretDown, CaretUp } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { font, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

interface BannerAction {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'destructive'
}

interface Props {
  title: string
  message: string
  accent: string
  icon?: React.ReactNode
  action?: BannerAction
  secondaryAction?: BannerAction
  details?: string
  style?: ViewStyle
}

export function Banner({ title, message, accent, icon, action, secondaryAction, details, style }: Props) {
  const { t } = useTranslation('shared')
  const theme = useTheme()
  const s = useMemo(() => styles(theme), [theme])
  const [detailsOpen, setDetailsOpen] = useState(false)

  return (
    <View style={s.overlay} pointerEvents="box-none">
      <View style={[s.card, { borderColor: accent }, style]}>
        {icon}
        <Text style={s.title}>{title}</Text>
        <Text style={[s.message, { color: accent }]}>{message}</Text>

        {details ? (
          <View style={s.detailsContainer}>
            <TouchableOpacity
              style={s.detailsToggle}
              onPress={() => setDetailsOpen((v) => !v)}
            >
              <Text style={{ color: accent, fontSize: 12 }}>{t('banner.moreInfo')}</Text>
              {detailsOpen
                ? <CaretUp size={12} color={accent} />
                : <CaretDown size={12} color={accent} />}
            </TouchableOpacity>
            {detailsOpen ? (
              <Text style={[s.detailsText, { color: accent }]}>{details}</Text>
            ) : null}
          </View>
        ) : null}

        {(action || secondaryAction) ? (
          <View style={s.actions}>
            {secondaryAction ? (
              <TouchableOpacity style={s.actionBtn} onPress={secondaryAction.onPress}>
                <Text style={s.actionLabel}>{secondaryAction.label}</Text>
              </TouchableOpacity>
            ) : null}
            {action ? (
              <TouchableOpacity
                style={[
                  s.actionBtn,
                  action.variant === 'destructive' && { borderColor: theme.text.danger },
                  action.variant === 'primary' && { borderColor: accent },
                ]}
                onPress={action.onPress}
              >
                <Text
                  style={[
                    s.actionLabel,
                    action.variant === 'destructive' && { color: theme.text.danger },
                    action.variant === 'primary' && { color: accent },
                  ]}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  )
}

function styles(theme: Theme) {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: {
      width: 240,
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.bg.card,
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 24,
    },
    title: {
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: 4,
    },
    message: {
      fontSize: font.sm,
      textAlign: 'center',
      lineHeight: 19,
    },
    detailsContainer: {
      width: '100%',
    },
    detailsToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    detailsText: {
      fontSize: 11,
      textAlign: 'center',
      marginTop: 8,
      opacity: 0.75,
      fontFamily: 'monospace',
    },
    actions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    actionBtn: {
      flex: 1,
      paddingVertical: 4,
      paddingHorizontal: 16,
      backgroundColor: theme.bg.secondary,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      alignItems: 'center',
    },
    actionLabel: {
      color: theme.text.primary,
      fontSize: 13,
      fontWeight: '600',
    },
  })
}
