import type { ComponentProps } from 'react'
import BaseTextInput from 'react-native/Libraries/Components/TextInput/TextInput'
import { enlarge } from './enlarge'

// Bundled only when metro.config.js sees TB_DEV_BIG_TEXT=1, in place of RN's own TextInput.
function TextInput(props: ComponentProps<typeof BaseTextInput>) {
  return <BaseTextInput {...props} style={enlarge(props.style, true)} />
}

// Keeps statics such as TextInput.State.
export default Object.assign(TextInput, BaseTextInput)
