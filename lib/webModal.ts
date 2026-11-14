import { Platform, type ViewStyle } from 'react-native'

/**
 * RN `Modal` renders outside the web layout's 768px frame, so a full-width card
 * would span the whole browser window. Spread into a modal's card or sheet style.
 */
export const webModalWidth: ViewStyle =
  Platform.OS === 'web' ? { width: '100%', maxWidth: 520, alignSelf: 'center' } : {}
