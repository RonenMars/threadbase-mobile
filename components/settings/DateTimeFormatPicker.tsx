import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Check } from 'phosphor-react-native'
import { font, spacing, type Theme } from '@/constants/theme'
import { useThemedStyles } from '@/hooks/useThemedStyles'
import {
  DATE_FORMATS,
  DEFAULT_DATE_TIME_FORMAT,
  formatDatePart,
  formatTimeOfDay,
  TIME_FORMATS,
  type DateFormat,
  type TimeFormat,
} from '@/lib/dateTimeFormat'

// 20 is past 12, so "20 Nov" and "Nov 20" cannot be mistaken for each other.
const SAMPLE = new Date(2026, 10, 20, 15, 7)

function getDateFormatLabel(format: DateFormat, t: TFunction<'settings'>): string {
  switch (format) {
    case 'auto':
      return t('dateTime.date.auto')
    case 'dmy':
      return t('dateTime.date.dmy')
    case 'mdy':
      return t('dateTime.date.mdy')
    case 'ymd':
      return t('dateTime.date.ymd')
  }
}

function getTimeFormatLabel(format: TimeFormat, t: TFunction<'settings'>): string {
  switch (format) {
    case '24h':
      return t('dateTime.time.h24')
    case '12h':
      return t('dateTime.time.h12')
    case 'auto':
      return t('dateTime.time.auto')
  }
}

interface OptionProps {
  label: string
  example: string
  selected: boolean
  isDefault: boolean
  onPress: () => void
  testID: string
}

function Option({ label, example, selected, isDefault, onPress, testID }: OptionProps) {
  const { t } = useTranslation('settings')
  const { styles, theme } = useThemedStyles(makeStyles)
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label}, ${example}`}
      onPress={onPress}
      style={styles.option}
    >
      <View style={styles.optionText}>
        <Text style={styles.optionLabel}>{label}</Text>
        <Text style={styles.optionExample}>
          {isDefault ? `${example} · ${t('dateTime.default')}` : example}
        </Text>
      </View>
      {selected ? <Check size={18} color={theme.text.accent} weight="bold" /> : null}
    </Pressable>
  )
}

interface Props {
  dateFormat: DateFormat
  timeFormat: TimeFormat
  onChangeDate: (format: DateFormat) => void
  onChangeTime: (format: TimeFormat) => void
}

/** The date and time format choice. Each option shows the same moment written that way. */
export function DateTimeFormatPicker({ dateFormat, timeFormat, onChangeDate, onChangeTime }: Props) {
  const { t } = useTranslation('settings')
  const { styles } = useThemedStyles(makeStyles)

  return (
    <View>
      <Text style={styles.groupTitle}>{t('dateTime.dateLabel')}</Text>
      <View accessibilityRole="radiogroup">
        {DATE_FORMATS.map((format) => (
          <Option
            key={format}
            testID={`settings-date-format-${format}`}
            label={getDateFormatLabel(format, t)}
            example={formatDatePart(SAMPLE, format, true)}
            selected={dateFormat === format}
            isDefault={format === DEFAULT_DATE_TIME_FORMAT.date}
            onPress={() => onChangeDate(format)}
          />
        ))}
      </View>
      <Text style={styles.groupTitle}>{t('dateTime.timeLabel')}</Text>
      <View accessibilityRole="radiogroup">
        {TIME_FORMATS.map((format) => (
          <Option
            key={format}
            testID={`settings-time-format-${format}`}
            label={getTimeFormatLabel(format, t)}
            example={formatTimeOfDay(SAMPLE, format)}
            selected={timeFormat === format}
            isDefault={format === DEFAULT_DATE_TIME_FORMAT.time}
            onPress={() => onChangeTime(format)}
          />
        ))}
      </View>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    groupTitle: {
      color: theme.text.secondary,
      fontSize: font.xs,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    optionText: { flex: 1, gap: 2 },
    optionLabel: { color: theme.text.primary, fontSize: font.base },
    optionExample: { color: theme.text.secondary, fontSize: font.sm },
  })
}
