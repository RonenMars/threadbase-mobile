import { Platform, type ScrollViewProps, type ViewStyle } from 'react-native'

interface ListTopInset {
  props: Pick<
    ScrollViewProps,
    'contentInset' | 'contentOffset' | 'scrollIndicatorInsets' | 'automaticallyAdjustContentInsets' | 'contentInsetAdjustmentBehavior'
  > & {
    progressViewOffset?: number
  }
  contentStyle: ViewStyle
}

/**
 * Lets a list scroll under the floating chrome. iOS gets a content inset so the
 * pull-to-refresh spinner lands below the chrome and a changed inset snaps the
 * list back to the top; Android has no inset, so the content is padded and
 * the refresh indicator offset instead.
 */
export function listTopInset(top: number): ListTopInset {
  if (Platform.OS === 'ios') {
    return {
      props: {
        contentInset: { top },
        contentOffset: { x: 0, y: -top },
        scrollIndicatorInsets: { top },
        // The chrome is the only inset; keep iOS from adding the status bar on top.
        automaticallyAdjustContentInsets: false,
        contentInsetAdjustmentBehavior: 'never',
      },
      contentStyle: {},
    }
  }
  return { props: { progressViewOffset: top }, contentStyle: { paddingTop: top } }
}
