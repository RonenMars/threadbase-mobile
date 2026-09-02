import React, { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet, type ViewStyle } from 'react-native'
import { CaretDown, CaretUp, CaretRight } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { font, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import type { AlertItem } from '@/types/alerts'

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
  /** Renders one collapsible row per entry instead of the single message body. */
  items?: AlertItem[]
  style?: ViewStyle
}

export function Banner({ title, message, accent, icon, action, secondaryAction, details, items, style }: Props) {
  const { t } = useTranslation('shared')
  const theme = useTheme()
  const s = useMemo(() => styles(theme), [theme])
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const list = items ?? []

  return (
    <View style={s.overlay} pointerEvents="box-none">
      <View style={[s.card, list.length > 0 && s.cardList, { borderColor: accent }, style]}>
        {icon}
        <Text style={s.title}>{title}</Text>
        {list.length > 0 ? null : <Text style={[s.message, { color: accent }]}>{message}</Text>}

        {list.length > 0 ? (
          <FlatList
            style={s.list}
            contentContainerStyle={s.listContent}
            data={list}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const open = openItemId === item.id
              return (
                <View style={[s.row, { borderColor: theme.border }]}>
                  <TouchableOpacity
                    style={s.rowHeader}
                    testID={`banner-row-${item.id}`}
                    onPress={() => {
                      if (item.onPress) item.onPress()
                      else setOpenItemId(open ? null : item.id)
                    }}
                  >
                    <Text style={s.rowTitle} numberOfLines={1}>{item.title}</Text>
                    {item.onPress
                      ? <CaretRight size={12} color={accent} />
                      : open
                        ? <CaretUp size={12} color={accent} />
                        : <CaretDown size={12} color={accent} />}
                  </TouchableOpacity>
                  {open ? (
                    <View style={s.rowBody}>
                      <Text style={[s.message, { color: accent }]}>{item.message}</Text>
                      {item.details ? (
                        <Text style={[s.detailsText, { color: accent }]}>{item.details}</Text>
                      ) : null}
                      {item.buttonText ? (
                        <TouchableOpacity
                          style={[s.actionBtn, { borderColor: accent }]}
                          testID={`banner-row-retry-${item.id}`}
                          onPress={item.buttonAction}
                        >
                          <Text style={[s.actionLabel, { color: accent }]}>{item.buttonText}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              )
            }}
          />
        ) : null}

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
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardList: {
      width: 300,
      alignItems: 'stretch',
    },
    list: {
      width: '100%',
      // Relative, not a fixed 320: the card also carries a title, actions and
      // padding, and a pixel cap overflows a landscape screen.
      maxHeight: '50%',
    },
    listContent: {
      gap: 8,
    },
    row: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    rowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    rowTitle: {
      flex: 1,
      color: theme.text.primary,
      fontSize: font.sm,
      fontWeight: '600',
    },
    rowBody: {
      gap: 8,
      marginTop: 8,
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
