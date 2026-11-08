import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native'
import { useTranslation } from 'react-i18next'
import { X } from 'phosphor-react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { spacing } from '@/constants/theme'

const CLEAR_SIZE = 18
// Leaves room for the X so long text never runs underneath it.
const CLEAR_RESERVED = spacing.md + CLEAR_SIZE + spacing.sm

interface SearchInputProps extends Omit<TextInputProps, 'value' | 'onChangeText' | 'clearButtonMode'> {
  value: string
  onChangeText: (text: string) => void
  containerStyle?: StyleProp<ViewStyle>
}

/**
 * Search field with its own clear button. `clearButtonMode` is iOS-only and
 * hides the X while the field is unfocused, so this draws the X itself:
 * identical on both platforms and visible whenever there is text.
 */
export const SearchInput = forwardRef<TextInput, SearchInputProps>(function SearchInput(
  { value, onChangeText, containerStyle, style, ...rest },
  ref,
) {
  const { t } = useTranslation('conversation')
  const theme = useTheme()
  const inputRef = useRef<TextInput>(null)
  useImperativeHandle(ref, () => inputRef.current as TextInput)

  const clear = () => {
    onChangeText('')
    inputRef.current?.focus()
  }

  return (
    <View style={containerStyle}>
      <TextInput
        {...rest}
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        style={[style, value ? { paddingEnd: CLEAR_RESERVED } : null]}
      />
      {value ? (
        <Pressable
          onPress={clear}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('search.clearSearch')}
          testID="search-input-clear"
          style={styles.clear}
        >
          <X size={CLEAR_SIZE} color={theme.text.secondary} weight="bold" />
        </Pressable>
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  clear: {
    position: 'absolute',
    end: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
})
