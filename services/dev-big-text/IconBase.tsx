import { useContext, type ComponentProps } from 'react'
import { IconContext } from 'phosphor-react-native'
import BaseIconBase from 'phosphor-react-native/lib/module/lib/icon-base'
import { enlargeIconSize } from './enlarge'

// Bundled only when metro.config.js sees TB_DEV_BIG_TEXT=1, in place of Phosphor's icon base.
export default function IconBase(props: ComponentProps<typeof BaseIconBase>) {
  const { size: contextSize = 24 } = useContext(IconContext)
  return <BaseIconBase {...props} size={enlargeIconSize(props.size ?? contextSize)} />
}
