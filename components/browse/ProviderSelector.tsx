import React, { useMemo, useState } from 'react'
import { type LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { CaretDown, CaretUp } from 'phosphor-react-native'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

export interface ProviderSelectorOption<T extends string> {
  value: T
  label: string
  color: string
  unavailable: boolean
}

interface Props<T extends string> {
  options: ProviderSelectorOption<T>[]
  selected: T
  onSelect: (value: T) => void
  disabled?: boolean
}

// One row while every option fits at its natural width; a dropdown once they
// don't (4+ providers, a narrow phone, or a large accessibility font size).
// The hidden twin row measures the natural width, so the choice re-runs on its
// own whenever font scale or width changes.
export function ProviderSelector<T extends string>({ options, selected, onSelect, disabled = false }: Props<T>) {
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const [availableWidth, setAvailableWidth] = useState(0)
  const [naturalWidth, setNaturalWidth] = useState(0)
  const [open, setOpen] = useState(false)
  const compact = availableWidth > 0 && naturalWidth > availableWidth

  const renderOption = (option: ProviderSelectorOption<T>, extraStyle?: object) => {
    const isSelected = selected === option.value
    const dimmed = option.unavailable || disabled
    return (
      <TouchableOpacity
        key={option.value}
        style={[
          styles.option,
          isSelected && styles.optionSelected,
          isSelected ? { borderColor: option.color } : null,
          dimmed && styles.optionDisabled,
          extraStyle,
        ]}
        // Guarded in onPress, not via `disabled`: TouchableOpacity overwrites
        // accessibilityState.disabled with its own prop, which would report an
        // unavailable provider as enabled.
        onPress={() => {
          if (disabled) return
          onSelect(option.value)
          setOpen(false)
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected, disabled: dimmed }}
        testID={`start-provider-${option.value}`}
      >
        <View style={[styles.dot, { backgroundColor: option.color }]} />
        <Text
          style={[
            styles.optionText,
            isSelected && styles.optionTextSelected,
            isSelected ? { color: option.color } : null,
            dimmed && styles.optionTextDisabled,
          ]}
        >
          {option.label}
        </Text>
      </TouchableOpacity>
    )
  }

  const current = options.find((o) => o.value === selected) ?? options[0]
  const Caret = open ? CaretUp : CaretDown

  return (
    <View
      style={styles.container}
      testID="provider-selector"
      onLayout={(e: LayoutChangeEvent) =>
        setAvailableWidth(e.nativeEvent.layout.width - spacing.xl * 2)
      }
    >
      <View
        pointerEvents="none"
        style={styles.measurer}
        testID="provider-selector-measurer"
        onLayout={(e: LayoutChangeEvent) => setNaturalWidth(e.nativeEvent.layout.width)}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {options.map((o) => (
          <View key={o.value} style={[styles.option, styles.measuredOption]}>
            <View style={styles.dot} />
            <Text style={styles.optionText}>{o.label}</Text>
          </View>
        ))}
      </View>
      {compact && current ? (
        <View>
          <TouchableOpacity
            style={[styles.option, styles.trigger, { borderColor: current.color }, disabled && styles.optionDisabled]}
            onPress={() => { if (!disabled) setOpen(!open) }}
            accessibilityRole="button"
            accessibilityState={{ expanded: open, disabled }}
            accessibilityLabel={current.label}
            testID="start-provider-dropdown"
          >
            <View style={[styles.dot, { backgroundColor: current.color }]} />
            <Text style={[styles.optionText, { color: current.color }]}>{current.label}</Text>
            <Caret size={14} color={theme.text.secondary} />
          </TouchableOpacity>
          {open ? (
            <View style={styles.list}>{options.map((o) => renderOption(o, styles.listOption))}</View>
          ) : null}
        </View>
      ) : (
        <View style={styles.row}>{options.map((o) => renderOption(o))}</View>
      )}
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    measurer: {
      position: 'absolute',
      left: 0,
      top: 0,
      opacity: 0,
      flexDirection: 'row',
      gap: spacing.sm,
    },
    measuredOption: {
      flexGrow: 0,
      paddingHorizontal: spacing.md,
    },
    option: {
      flexGrow: 1,
      flexBasis: 0,
      minHeight: 40,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg.secondary,
      gap: spacing.xs,
    },
    optionSelected: {
      backgroundColor: theme.bg.card,
    },
    optionDisabled: {
      opacity: 0.55,
    },
    trigger: {
      flexGrow: 0,
      justifyContent: 'space-between',
    },
    list: {
      marginTop: spacing.xs,
      gap: spacing.xs,
    },
    listOption: {
      flexGrow: 0,
      justifyContent: 'flex-start',
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    optionText: {
      color: theme.text.secondary,
      fontSize: font.sm,
      fontWeight: '600',
    },
    optionTextSelected: {
      color: theme.text.primary,
    },
    optionTextDisabled: {
      color: theme.text.secondary,
    },
  })
}
