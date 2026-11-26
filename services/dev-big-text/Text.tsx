import { useContext, type ComponentProps } from 'react'
import { unstable_TextAncestorContext } from 'react-native'
import BaseText from 'react-native/Libraries/Text/Text'
import { enlarge } from './enlarge'

// Bundled only when metro.config.js sees TB_DEV_BIG_TEXT=1, in place of RN's own Text.
export default function Text(props: ComponentProps<typeof BaseText>) {
  const nested = useContext(unstable_TextAncestorContext)
  return <BaseText {...props} style={enlarge(props.style, !nested)} />
}
