import React, { useMemo, useState } from 'react'
import { StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useTheme } from '@/contexts/ThemeContext'
import { font, radius, spacing } from '@/constants/theme'
import { isValidTime, WEEKDAYS } from '@/lib/notification-prefs'
import { useSettingsStore } from '@/stores/settings'
import type { QuietWindow, Weekday } from '@/types/api'

function getWeekdayLabel(day: Weekday, t: TFunction<'settings'>): string {
  switch (day) {
    case 'mon':
      return t('notifications.weekday.mon')
    case 'tue':
      return t('notifications.weekday.tue')
    case 'wed':
      return t('notifications.weekday.wed')
    case 'thu':
      return t('notifications.weekday.thu')
    case 'fri':
      return t('notifications.weekday.fri')
    case 'sat':
      return t('notifications.weekday.sat')
    case 'sun':
      return t('notifications.weekday.sun')
  }
}

function TimeField({
  value,
  label,
  onCommit,
  testID,
}: {
  value: string
  label: string
  onCommit: (value: string) => void
  testID: string
}) {
  const theme = useTheme()
  const s = useMemo(() => styles(theme), [theme])
  const [draft, setDraft] = useState(value)
  const [editing, setEditing] = useState(false)

  const commit = () => {
    setEditing(false)
    if (isValidTime(draft)) onCommit(draft)
    else setDraft(value)
  }

  return (
    <TextInput
      style={s.timeInput}
      value={editing ? draft : value}
      onFocus={() => {
        setDraft(value)
        setEditing(true)
      }}
      onChangeText={setDraft}
      onBlur={commit}
      onSubmitEditing={commit}
      keyboardType="numbers-and-punctuation"
      maxLength={5}
      accessibilityLabel={label}
      testID={testID}
    />
  )
}

function WindowFields({
  window,
  onChange,
  testIDPrefix,
}: {
  window: QuietWindow
  onChange: (window: QuietWindow) => void
  testIDPrefix: string
}) {
  const { t } = useTranslation('settings')
  const theme = useTheme()
  const s = useMemo(() => styles(theme), [theme])
  return (
    <View style={s.fields}>
      <Text style={s.fieldLabel}>{t('notifications.quietFrom')}</Text>
      <TimeField
        value={window.from}
        label={t('notifications.quietFrom')}
        onCommit={(from) => onChange({ ...window, from })}
        testID={`${testIDPrefix}-from`}
      />
      <Text style={s.fieldLabel}>{t('notifications.quietTo')}</Text>
      <TimeField
        value={window.to}
        label={t('notifications.quietTo')}
        onCommit={(to) => onChange({ ...window, to })}
        testID={`${testIDPrefix}-to`}
      />
    </View>
  )
}

/**
 * The quiet-hours schedule: one window for every day, plus an optional
 * per-weekday override. An override replaces the window that STARTS that day;
 * switching a day off means no quiet hours that day.
 */
export function QuietHoursEditor() {
  const { t } = useTranslation('settings')
  const theme = useTheme()
  const s = useMemo(() => styles(theme), [theme])
  const notifications = useSettingsStore((state) => state.notifications)
  const setNotifications = useSettingsStore((state) => state.setNotifications)
  const [byDayOpen, setByDayOpen] = useState(false)

  const globalWindow: QuietWindow = {
    from: notifications.quietHoursFrom,
    to: notifications.quietHoursTo,
  }

  const setDay = (day: Weekday, value: QuietWindow | null | undefined) => {
    const days = { ...notifications.quietHoursDays }
    if (value === undefined) delete days[day]
    else days[day] = value
    setNotifications({ quietHoursDays: days })
  }

  return (
    <View testID="quiet-hours-editor">
      <View style={s.row}>
        <Text style={s.rowLabel}>{t('notifications.quietEveryDay')}</Text>
        <WindowFields
          window={globalWindow}
          onChange={(w) => setNotifications({ quietHoursFrom: w.from, quietHoursTo: w.to })}
          testIDPrefix="quiet-hours-global"
        />
      </View>
      <TouchableOpacity
        style={s.row}
        onPress={() => setByDayOpen((open) => !open)}
        accessibilityState={{ expanded: byDayOpen }}
        testID="quiet-hours-by-day-toggle"
      >
        <Text style={s.rowLabel}>{t('notifications.quietByDay')}</Text>
        <Text style={s.rowValue}>
          {byDayOpen ? t('notifications.quietHide') : t('notifications.quietShow')}
        </Text>
      </TouchableOpacity>
      {byDayOpen
        ? WEEKDAYS.map((day) => {
            const override = notifications.quietHoursDays[day]
            const quiet = override !== null
            return (
              <View key={day} style={s.dayRow} testID={`quiet-hours-day-${day}`}>
                <Text style={s.dayLabel}>{getWeekdayLabel(day, t)}</Text>
                {quiet ? (
                  <WindowFields
                    window={override ?? globalWindow}
                    onChange={(w) => setDay(day, w)}
                    testIDPrefix={`quiet-hours-${day}`}
                  />
                ) : (
                  <Text style={s.rowValue}>{t('notifications.quietDayOff')}</Text>
                )}
                <Switch
                  value={quiet}
                  onValueChange={(on) => setDay(day, on ? undefined : null)}
                  trackColor={{ false: theme.border, true: theme.text.accent }}
                  thumbColor="#fff"
                  accessibilityLabel={getWeekdayLabel(day, t)}
                  testID={`quiet-hours-day-${day}-switch`}
                />
              </View>
            )
          })
        : null}
    </View>
  )
}

function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      minHeight: 44,
      gap: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    dayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      minHeight: 44,
      gap: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    rowLabel: { color: theme.text.primary, fontSize: font.base },
    rowValue: { color: theme.text.secondary, fontSize: font.sm, flex: 1 },
    dayLabel: { color: theme.text.primary, fontSize: font.sm, minWidth: 56 },
    fields: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 },
    fieldLabel: { color: theme.text.secondary, fontSize: font.xs },
    timeInput: {
      color: theme.text.primary,
      fontSize: font.sm,
      minWidth: 56,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      textAlign: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.sm,
    },
  })
}
