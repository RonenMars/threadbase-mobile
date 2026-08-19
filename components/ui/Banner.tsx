import React, { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native'
import { CaretDown, CaretUp } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { font, type Theme } from '@/constants/theme'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import { alertAppearance } from '@/lib/alertAppearance'
import type { AlertSpec } from '@/types/alerts'

type Props = AlertSpec & {
  style?: ViewStyle
  onDismiss?: () => void
}

export function Banner({
  level,
  title,
  message,
  details,
  buttonText,
  buttonAction,
  buttonVariant,
  hideCloseButton = false,
  accent,
  icon,
  style,
  onDismiss,
  onClose,
}: Props) {
  const { t } = useTranslation(['shared', 'common'])
  const theme = useTheme()
  const isGlass = useIsGlass()
  const s = useMemo(() => styles(theme), [theme])
  const [detailsOpen, setDetailsOpen] = useState(false)
  const appearance = alertAppearance(level, theme, accent)
  const Icon = appearance.Icon
  const moreInfoLabel = t('shared:banner.moreInfo')
  const closeLabel = t('common:button.close')

  function handleClose() {
    onClose?.()
    onDismiss?.()
  }

  return (
    <View style={s.overlay} pointerEvents="box-none">
      <View style={[s.card, isGlass && s.cardGlass, { borderColor: appearance.accent }, style]}>
        <GlassFill />
        {icon ?? <Icon size={28} color={appearance.accent} weight={appearance.iconWeight} />}
        <Text style={s.title}>{title}</Text>
        <Text style={[s.message, { color: appearance.accent }]}>{message}</Text>

        {details ? (
          <View style={s.detailsContainer}>
            <TouchableOpacity
              style={s.detailsToggle}
              onPress={() => setDetailsOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={moreInfoLabel}
            >
              <Text style={{ color: appearance.accent, fontSize: 12 }}>{moreInfoLabel}</Text>
              {detailsOpen
                ? <CaretUp size={12} color={appearance.accent} />
                : <CaretDown size={12} color={appearance.accent} />}
            </TouchableOpacity>
            {detailsOpen ? (
              <Text style={[s.detailsText, { color: appearance.accent }]}>{details}</Text>
            ) : null}
          </View>
        ) : null}

        {(buttonText || !hideCloseButton) ? (
          <View style={s.actions}>
            {hideCloseButton ? null : (
              <TouchableOpacity style={s.actionBtn} onPress={handleClose} accessibilityRole="button">
                <Text style={s.actionLabel}>{closeLabel}</Text>
              </TouchableOpacity>
            )}
            {buttonText ? (
              <TouchableOpacity
                style={[
                  s.actionBtn,
                  buttonVariant === 'destructive' && { borderColor: theme.text.danger },
                  buttonVariant === 'primary' && { borderColor: appearance.accent },
                ]}
                onPress={buttonAction}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    s.actionLabel,
                    buttonVariant === 'destructive' && { color: theme.text.danger },
                    buttonVariant === 'primary' && { color: appearance.accent },
                  ]}
                >
                  {buttonText}
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
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
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
      overflow: 'hidden',
      paddingVertical: 16,
      paddingHorizontal: 24,
    },
    cardGlass: {
      backgroundColor: 'transparent',
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
