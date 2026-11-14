import { Platform, useWindowDimensions, type ViewStyle } from 'react-native'

// Web only: the layout is phone-first, so on a wide browser window it keeps a
// tablet-width card centered instead of stretching rows and the FAB edge to edge.
export const WEB_MAX_CONTENT_WIDTH = 768
export const WEB_FRAME_GUTTER = 24

/**
 * RN `Modal` renders outside the web layout's 768px frame, so a full-width card
 * would span the whole browser window. Spread into a modal's card or sheet style.
 */
export const webModalWidth: ViewStyle =
  Platform.OS === 'web' ? { width: '100%', maxWidth: 520, alignSelf: 'center' } : {}

/**
 * Padding for a full-window overlay so content anchored to its edges (a header
 * dropdown) lands at the web frame's edges, not the browser window's.
 */
export function useWebFrameInset(): ViewStyle | null {
  const { width } = useWindowDimensions()
  if (Platform.OS !== 'web' || width <= WEB_MAX_CONTENT_WIDTH) return null
  return { paddingHorizontal: (width - WEB_MAX_CONTENT_WIDTH) / 2, paddingTop: WEB_FRAME_GUTTER }
}
