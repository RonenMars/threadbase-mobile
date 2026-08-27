import React, { useEffect, useMemo, useState } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { ClockCounterClockwise, CaretRight, MagnifyingGlass, X } from 'phosphor-react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { MIN_TOUCH_TARGET } from '@/constants/a11y'
import { ltrContentStyle, textDirectionStyle, useAppDirection, useDirectionStyle } from '@/lib/rtl'

export interface RecentDir {
  path: string
  name: string
  lastUsedAt: string
}

interface Props {
  visible: boolean
  dirs: RecentDir[]
  onClose: () => void
  onSelect: (dir: RecentDir) => void
  disabled?: boolean
}

export function RecentDirsModal({ visible, dirs, onClose, onSelect, disabled }: Props) {
  const theme = useTheme()
  const directionStyle = useDirectionStyle()
  const { direction, isRTL } = useAppDirection()
  const searchDirection = textDirectionStyle(direction)
  const styles = useMemo(() => makeStyles(theme), [theme])
  const { t } = useTranslation(['browse', 'common'])
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (visible) {
      queueMicrotask(() => {
        setQuery('')
      })
    }
  }, [visible])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return dirs
    return dirs.filter((dir) => dir.path.toLowerCase().includes(q))
  }, [dirs, query])

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.root, directionStyle]} edges={['bottom']} testID="recent-dirs-modal">
        <View style={styles.header}>
          <Text style={[styles.title, searchDirection]}>{t('nav.allRecentDirs')}</Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common:button.cancel')}
            hitSlop={8}
            style={styles.closeBtn}
            testID="recent-dirs-modal-close"
          >
            <X size={22} color={theme.text.secondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <MagnifyingGlass size={16} color={theme.text.secondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('nav.searchRecentDirs')}
            placeholderTextColor={theme.text.secondary}
            style={[styles.search, searchDirection]}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            testID="recent-dirs-search"
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.path}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={[styles.empty, searchDirection]}>{t('nav.noMatchingDirs')}</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => onSelect(item)}
              disabled={disabled}
              testID={`recent-dir-row-${item.path}`}
            >
              <ClockCounterClockwise size={18} color={theme.text.secondary} />
              <View style={styles.textWrap}>
                <Text style={[styles.name, ltrContentStyle]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.path, ltrContentStyle]} numberOfLines={1}>
                  {item.path}
                </Text>
              </View>
              <CaretRight size={16} color={theme.text.secondary} mirrored={isRTL} />
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    </Modal>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.bg.primary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    title: {
      color: theme.text.primary,
      fontSize: font.lg,
      fontWeight: '600',
    },
    closeBtn: {
      minWidth: MIN_TOUCH_TARGET,
      minHeight: MIN_TOUCH_TARGET,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.lg,
      marginVertical: spacing.md,
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: theme.bg.secondary,
      borderWidth: 1,
      borderColor: theme.border,
    },
    search: {
      flex: 1,
      paddingVertical: spacing.sm,
      color: theme.text.primary,
      fontSize: font.base,
    },
    empty: {
      color: theme.text.secondary,
      fontSize: font.sm,
      textAlign: 'center',
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    textWrap: {
      flex: 1,
    },
    name: {
      color: theme.text.primary,
      fontSize: font.base,
    },
    path: {
      color: theme.text.secondary,
      fontSize: font.xs,
      marginTop: 2,
    },
  })
}
