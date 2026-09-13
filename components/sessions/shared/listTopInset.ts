import type { ScrollViewProps, ViewStyle } from 'react-native'

interface ListTopInset {
  props: Pick<ScrollViewProps, 'scrollIndicatorInsets'>
  contentStyle: ViewStyle
  /** For the list's RefreshControl, so the spinner lands below the chrome on both platforms. */
  progressViewOffset: number
}

/**
 * Lets a list scroll under the floating chrome. The content is padded rather
 * than inset, so the rest position never depends on when the chrome was
 * measured and the first row can never start under it.
 */
export function listTopInset(top: number): ListTopInset {
  return {
    props: { scrollIndicatorInsets: { top } },
    contentStyle: { paddingTop: top },
    progressViewOffset: top,
  }
}
