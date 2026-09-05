import React, { useCallback, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, AccessibilityInfo } from 'react-native'
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { CaretDown, CaretUp, CaretRight, ArrowsClockwise, Copy, Check, WarningCircle } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { useGlassSheetBackground } from '@/components/ui/GlassSheet'
import * as Clipboard from 'expo-clipboard'
import type { AlertItem } from '@/types/alerts'

const SNAP_POINTS = ['50%', '85%']

interface Props {
  visible: boolean
  title: string
  items: AlertItem[]
  retryAllLabel?: string
  retryAllRetrying?: boolean
  onRetryAll?: () => void
  onClose: () => void
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme()
  const s = useMemo(() => styles(theme), [theme])
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [value])

  return (
    <View style={s.copyRow}>
      <View style={s.copyRowText}>
        <Text style={s.copyLabel}>{label}</Text>
        <Text style={s.copyValue} selectable>{value}</Text>
      </View>
      <TouchableOpacity
        onPress={handleCopy}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {copied
          ? <Check size={14} color={theme.text.success} />
          : <Copy size={14} color={theme.text.secondary} />}
      </TouchableOpacity>
    </View>
  )
}

function AccordionRow({ item }: { item: AlertItem }) {
  const { t } = useTranslation('common')
  const theme = useTheme()
  const s = useMemo(() => styles(theme), [theme])
  const [open, setOpen] = useState(false)
  const hasRetry = item.buttonAction !== undefined

  return (
    <View style={s.row}>
      <TouchableOpacity
        style={s.rowHeader}
        testID={`error-sheet-row-${item.id}`}
        onPress={() => item.onPress ? item.onPress() : setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <WarningCircle size={16} color={theme.text.danger} />
        <Text style={s.rowTitle} numberOfLines={1}>{item.title}</Text>
        {hasRetry ? (
          <TouchableOpacity
            style={s.retryIcon}
            onPress={item.buttonAction}
            disabled={item.retrying}
            hitSlop={8}
            testID={`error-sheet-retry-${item.id}`}
            accessibilityRole="button"
            accessibilityLabel={item.retrying ? t('errorBanner.retrying') : (item.buttonText ?? t('button.retry'))}
          >
            <ArrowsClockwise size={14} color={item.retrying ? theme.text.secondary : theme.text.accent} />
          </TouchableOpacity>
        ) : null}
        {item.onPress
          ? <CaretRight size={12} color={theme.text.secondary} />
          : open
            ? <CaretUp size={12} color={theme.text.secondary} />
            : <CaretDown size={12} color={theme.text.secondary} />}
      </TouchableOpacity>
      {open ? (
        <View style={s.rowBody}>
          <Text style={s.rowMessage}>{item.message}</Text>
          {item.code ? <CopyRow label={t('errorBanner.codeLabel')} value={item.code} /> : null}
          {item.rawMessage ? <CopyRow label={t('errorBanner.rawLabel')} value={item.rawMessage} /> : null}
        </View>
      ) : null}
    </View>
  )
}

export function ErrorRecoverySheet({ visible, title, items, retryAllLabel, retryAllRetrying, onRetryAll, onClose }: Props) {
  const { t } = useTranslation('common')
  const theme = useTheme()
  const isGlass = useIsGlass()
  const insets = useSafeAreaInsets()
  const s = useMemo(() => styles(theme), [theme])
  const glassBackground = useGlassSheetBackground()

  const announcedRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!visible) return
    const key = `${title}:${items.length}`
    if (announcedRef.current === key) return
    announcedRef.current = key
    AccessibilityInfo.announceForAccessibility(`${title}. ${items.length}`)
  }, [visible, title, items.length])

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="close" />
    ),
    [],
  )

  if (!visible) return null

  return (
      <BottomSheet
        snapPoints={SNAP_POINTS}
        index={0}
        bottomInset={insets.bottom}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={[s.sheetBg, isGlass && s.sheetBgGlass]}
      backgroundComponent={glassBackground}
      handleIndicatorStyle={s.handle}
      accessibilityLabel={title}
      accessibilityLiveRegion="assertive"
    >
      <BottomSheetScrollView contentContainerStyle={s.content}>
        <View testID="error-recovery-sheet">
          <Text style={s.title} accessibilityRole="header">{title}</Text>
          {items.map((item) => <AccordionRow key={item.id} item={item} />)}
          {retryAllLabel && onRetryAll ? (
            <TouchableOpacity
              style={[s.retryAllBtn, { borderColor: theme.text.accent }]}
              onPress={onRetryAll}
              disabled={retryAllRetrying}
              testID="error-sheet-retry-all"
              accessibilityRole="button"
              accessibilityLabel={retryAllLabel}
            >
              <Text style={[s.retryAllText, { color: theme.text.accent }]}>{retryAllLabel}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={s.closeBtn}
            onPress={onClose}
            testID="error-sheet-close"
            accessibilityRole="button"
            accessibilityLabel={t('button.close')}
          >
            <Text style={s.closeText}>{t('button.close')}</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  )
}

function styles(theme: Theme) {
  return StyleSheet.create({
    sheetBg: {
      backgroundColor: theme.bg.card,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
    },
    sheetBgGlass: {
      backgroundColor: 'transparent',
    },
    handle: {
      backgroundColor: theme.border,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
      gap: spacing.sm,
    },
    title: {
      color: theme.text.primary,
      fontSize: font.lg,
      fontWeight: '600',
      marginBottom: spacing.sm,
    },
    row: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    rowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    rowTitle: {
      flex: 1,
      color: theme.text.primary,
      fontSize: font.sm,
      fontWeight: '600',
    },
    retryIcon: {
      padding: 4,
    },
    rowBody: {
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    rowMessage: {
      color: theme.text.secondary,
      fontSize: font.sm,
      lineHeight: 19,
    },
    copyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      backgroundColor: theme.bg.secondary,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    copyRowText: {
      flex: 1,
    },
    copyLabel: {
      color: theme.text.secondary,
      fontSize: 11,
      textTransform: 'uppercase',
    },
    copyValue: {
      color: theme.text.primary,
      fontSize: 12,
      fontFamily: 'monospace',
      marginTop: 2,
    },
    retryAllBtn: {
      borderWidth: 1,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    retryAllText: {
      fontSize: font.sm,
      fontWeight: '600',
    },
    closeBtn: {
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    closeText: {
      color: theme.text.secondary,
      fontSize: font.sm,
    },
  })
}
